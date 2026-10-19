"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, KeyRound } from "lucide-react";
import { browserSupabase } from "../../lib/supabase/browser";
import { permissionOptions, type Permission } from "../../lib/supabase/access";
import { useWorkspace } from "./access-gate";

type Account = {
  id: string;
  userId: string | null;
  username: string;
  name: string;
  permissions: Permission[];
  createdBy: string;
  status: "provisioning" | "active" | "resetting" | "failed";
};
type Props = { householdId: string; onChanged: () => Promise<void> | void };
const defaultPermissions: Permission[] = ["tasks.read", "tasks.update"];
const statusLabels: Record<Account["status"], string> = {
  provisioning: "Creación pendiente",
  active: "Usuario creado",
  resetting: "Restablecimiento pendiente",
  failed: "Requiere revisión",
};

class ManagedAccessError extends Error {}

async function sessionHeaders() {
  const {
    data: { session },
    error,
  } = await browserSupabase().auth.getSession();
  if (error || !session)
    throw new ManagedAccessError("Tu sesión venció. Vuelve a entrar.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

export default function ManagedStaff({ householdId, onChanged }: Props) {
  const workspace = useWorkspace();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [permissions, setPermissions] = useState<Permission[]>([
    ...defaultPermissions,
  ]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resumeAccountId, setResumeAccountId] = useState<string | null>(null);
  const createSection = useRef<HTMLElement | null>(null);
  const operation = useRef<{ id: string | null; attempted: boolean }>({
    id: null,
    attempted: false,
  });

  async function load() {
    setLoadError("");
    try {
      const headers = await sessionHeaders();
      const response = await fetch(
        `/api/admin/staff?householdId=${encodeURIComponent(householdId)}`,
        {
          headers,
          cache: "no-store",
        },
      );
      const result = await response.json();
      if (!response.ok || !Array.isArray(result.accounts)) throw new Error();
      setAccounts(result.accounts);
    } catch {
      setLoadError(
        "No se pudo actualizar la lista de usuarios. Inténtalo de nuevo.",
      );
    }
  }
  useEffect(() => {
    setAccounts([]);
    setPassword("");
    setResetPassword("");
    setResetUserId(null);
    setResumeAccountId(null);
    operation.current = { id: null, attempted: false };
    void load();
  }, [householdId]);

  function edited() {
    if (operation.current.attempted && !resumeAccountId)
      operation.current = { id: null, attempted: false };
    setMessage("");
  }
  function choosePermissions(value: Permission[]) {
    edited();
    setPermissions(value);
  }
  function resume(account: Account) {
    if (
      account.createdBy !== workspace?.session.user.id || account.userId !== null ||
      !["provisioning", "failed"].includes(account.status)
    )
      return;
    setResumeAccountId(account.id);
    operation.current = { id: account.id, attempted: false };
    setName(account.name);
    setUsername(account.username);
    setPermissions([...account.permissions]);
    setPassword("");
    setResetPassword("");
    setResetUserId(null);
    setMessage(
      "Vuelve a introducir la contraseña inicial para completar este usuario. Su nombre y permisos se conservarán.",
    );
    createSection.current?.scrollIntoView({ block: "start" });
  }
  function cancelResume() {
    setResumeAccountId(null);
    operation.current = { id: null, attempted: false };
    setName("");
    setUsername("");
    setPassword("");
    setPermissions([...defaultPermissions]);
    setMessage("");
  }
  async function refreshLists() {
    await load();
    try {
      await onChanged();
    } catch {
      setLoadError(
        "El cambio quedó guardado, pero no se pudo actualizar la lista de permisos.",
      );
    }
  }
  async function create(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setMessage("");
    const normalized = username.trim().toLowerCase();
    if (
      !/^[a-z0-9][a-z0-9._-]{2,31}$/.test(normalized) ||
      password.length < 12 ||
      !name.trim()
    ) {
      setMessage(
        "Revisa el nombre, el usuario y la contraseña de al menos 12 caracteres.",
      );
      return;
    }
    setBusy(true);
    operation.current.id ??= crypto.randomUUID();
    operation.current.attempted = true;
    try {
      const headers = await sessionHeaders();
      const response = await fetch("/api/admin/staff", {
        method: "POST",
        headers,
        body: JSON.stringify({
          householdId,
          id: operation.current.id,
          name: name.trim(),
          username: normalized,
          password,
          permissions,
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new ManagedAccessError(
          typeof result.error === "string"
            ? result.error
            : "No se pudo crear el usuario.",
        );
      setPassword("");
      setUsername("");
      setName("");
      setPermissions([...defaultPermissions]);
      setResumeAccountId(null);
      operation.current = { id: null, attempted: false };
      setMessage(
        result.created === false
          ? "Este usuario ya estaba creado. Conserva su contraseña inicial; puedes restablecerla abajo si hace falta."
          : "Usuario creado. Comparte el usuario y la contraseña personalmente.",
      );
      await refreshLists();
    } catch (error) {
      setMessage(
        error instanceof ManagedAccessError
          ? error.message
          : "No se pudo confirmar la creación. Puedes volver a intentarlo.",
      );
      await load();
    } finally {
      setBusy(false);
    }
  }
  async function reset(e: FormEvent, account: Account) {
    e.preventDefault();
    if (busy || !account.userId || resetPassword.length < 12) return;
    setBusy(true);
    setMessage("");
    try {
      const headers = await sessionHeaders();
      const response = await fetch("/api/admin/staff/reset", {
        method: "POST",
        headers,
        body: JSON.stringify({
          householdId,
          userId: account.userId,
          password: resetPassword,
        }),
      });
      const result = await response.json();
      if (!response.ok || result.reset !== true)
        throw new ManagedAccessError(
          typeof result.error === "string"
            ? result.error
            : "No se pudo restablecer el acceso.",
        );
      setResetPassword("");
      setResetUserId(null);
      setMessage(
        "Contraseña actualizada. Las sesiones anteriores ya no tendrán acceso. Comparte la nueva contraseña personalmente.",
      );
      await refreshLists();
    } catch (error) {
      setResetPassword("");
      setMessage(
        error instanceof ManagedAccessError
          ? error.message
          : "No se pudo confirmar el restablecimiento.",
      );
      await refreshLists();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section
        ref={createSection}
        className="panel"
        aria-label="Crear acceso del personal"
      >
        <span className="eyebrow">ACCESOS A TU MEDIDA</span>
        <h2>
          {resumeAccountId
            ? "Completar un usuario pendiente"
            : "Crear un usuario para tu equipo"}
        </h2>
        <p>
          Elige un usuario y una contraseña para la persona que necesita entrar.
          Tú decides sus permisos y puedes desactivar su acceso cuando lo
          necesites.
        </p>
        <form onSubmit={create}>
          <fieldset
            disabled={busy}
            style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
          >
            <div className="pantry-form">
              <label>
                Nombre del colaborador
                <input
                  required
                  disabled={!!resumeAccountId}
                  maxLength={100}
                  autoComplete="off"
                  value={name}
                  onChange={(e) => {
                    edited();
                    setName(e.target.value);
                  }}
                />
              </label>
              <label>
                Nombre de usuario
                <input
                  required
                  disabled={!!resumeAccountId}
                  minLength={3}
                  maxLength={32}
                  pattern="[a-z0-9][a-z0-9._\-]{2,31}"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={username}
                  aria-describedby="managed-username-help"
                  onChange={(e) => {
                    edited();
                    setUsername(e.target.value.toLowerCase());
                  }}
                />
              </label>
              <label>
                Contraseña inicial
                <input
                  type="password"
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete="new-password"
                  value={password}
                  aria-describedby="managed-password-help"
                  onChange={(e) => {
                    edited();
                    setPassword(e.target.value);
                  }}
                />
              </label>
            </div>
            <p id="managed-username-help">
              <small>
                De 3 a 32 letras minúsculas, números, puntos, guiones o guiones
                bajos. No necesita correo.
              </small>
            </p>
            <p id="managed-password-help">
              <small>
                Usa una frase fácil de recordar de al menos 12 caracteres. La
                contraseña no se mostrará después de crear el usuario.
              </small>
            </p>
            <div className="role-presets">
              <button
                type="button"
                className="text-button"
                disabled={!!resumeAccountId}
                onClick={() =>
                  choosePermissions([
                    "kitchen.read",
                    "kitchen.confirm",
                    "tasks.read",
                    "tasks.update",
                  ])
                }
              >
                Cocina
              </button>
              <button
                type="button"
                className="text-button"
                disabled={!!resumeAccountId}
                onClick={() =>
                  choosePermissions([
                    "tasks.read",
                    "tasks.update",
                    "assets.read",
                    "assets.write",
                  ])
                }
              >
                Mantenimiento
              </button>
              <button
                type="button"
                className="text-button"
                disabled={!!resumeAccountId}
                onClick={() => choosePermissions(["tasks.read"])}
              >
                Personalizar
              </button>
            </div>
            <fieldset className="permissions" disabled={!!resumeAccountId}>
              <legend>Permisos del nuevo usuario</legend>
              {permissionOptions.map(([permission, label]) => (
                <label className="permission-check" key={permission}>
                  <input
                    type="checkbox"
                    checked={permissions.includes(permission)}
                    onChange={(e) =>
                      choosePermissions(
                        e.target.checked
                          ? [...permissions, permission]
                          : permissions.filter((p) => p !== permission),
                      )
                    }
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <button className="primary" type="submit">
              <Plus size={16} />{" "}
              {busy
                ? "Guardando…"
                : resumeAccountId
                  ? "Completar creación"
                  : "Crear usuario"}
            </button>
            {resumeAccountId && (
              <button
                className="text-button"
                type="button"
                onClick={cancelResume}
              >
                Cancelar recuperación
              </button>
            )}
          </fieldset>
        </form>
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
      </section>
      <section className="panel" aria-label="Accesos sin correo">
        <h2>Usuarios de tu equipo</h2>
        <p>
          Para cambiar permisos o desactivar a alguien, utiliza su ficha de
          acceso arriba.
        </p>
        {loadError && (
          <div>
            <p role="alert">{loadError}</p>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => void load()}
            >
              Actualizar usuarios
            </button>
          </div>
        )}
        {!accounts.length && !loadError && (
          <p>Aún no has creado usuarios con nombre de usuario.</p>
        )}
        {accounts.map((account) => (
          <article className="member-card" key={account.id}>
            <div className="member-heading">
              <strong>{account.name}</strong>
              <span className="pill">
                {statusLabels[account.status] || "Requiere revisión"}
              </span>
            </div>
            <p>
              Usuario: <strong>{account.username}</strong>
            </p>
            {account.status !== "active" && (
              <small>
                Este acceso requiere completar su preparación antes de poder
                entrar.
              </small>
            )}
            {account.userId === null && ["provisioning", "failed"].includes(account.status) &&
              account.createdBy === workspace?.session.user.id && (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => resume(account)}
                  aria-label={`Reanudar creación de ${account.username}`}
                >
                  Reanudar creación
                </button>
              )}
            {account.userId &&
              (resetUserId === account.userId ? (
                <form onSubmit={(e) => void reset(e, account)}>
                  <label>
                    Nueva contraseña para {account.username}
                    <input
                      type="password"
                      minLength={12}
                      maxLength={128}
                      required
                      autoComplete="new-password"
                      disabled={busy}
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                    />
                  </label>
                  <p>
                    <small>
                      Al guardar, las sesiones anteriores pierden acceso. El
                      usuario conserva sus permisos.
                    </small>
                  </p>
                  <div className="role-presets">
                    <button
                      type="submit"
                      className="primary compact"
                      disabled={busy}
                    >
                      Guardar nueva contraseña
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      disabled={busy}
                      onClick={() => {
                        setResetUserId(null);
                        setResetPassword("");
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => {
                    setResetUserId(account.userId);
                    setResetPassword("");
                    setMessage("");
                  }}
                  aria-label={`Restablecer contraseña de ${account.username}`}
                >
                  <KeyRound size={15} /> Restablecer contraseña
                </button>
              ))}
          </article>
        ))}
      </section>
    </>
  );
}
