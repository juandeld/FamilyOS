"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Users, Plus, ShieldCheck } from "lucide-react";
import { browserSupabase } from "../../lib/supabase/browser";
import {
  permissionOptions,
  type Membership,
  type Permission,
} from "../../lib/supabase/access";
import { useWorkspace } from "./access-gate";
import ManagedStaff from "./managed-staff";
const managedAccess =
  process.env.NEXT_PUBLIC_FAMILYOS_MANAGED_ACCESS === "true";
type Invite = {
  id: string;
  email: string;
  display_name: string;
  permissions: Permission[];
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  delivery_status: string;
};
export default function UserManagement() {
  const workspace = useWorkspace();
  const [members, setMembers] = useState<Membership[]>([]),
    [invites, setInvites] = useState<Invite[]>([]),
    [email, setEmail] = useState(""),
    [name, setName] = useState(""),
    [permissions, setPermissions] = useState<Permission[]>([
      "tasks.read",
      "tasks.update",
    ]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function load() {
    if (!workspace) return;
    const db = browserSupabase();
    const [m, i] = await Promise.all([
      db
        .from("household_members")
        .select("*")
        .eq("household_id", workspace.membership.household_id)
        .order("display_name"),
      managedAccess
        ? Promise.resolve({ data: [], error: null })
        : db
            .from("household_invitations")
            .select(
              "id,email,display_name,permissions,expires_at,accepted_at,revoked_at,delivery_status",
            )
            .eq("household_id", workspace.membership.household_id),
    ]);
    if (m.error || i.error) {
      setMessage("No se pudieron cargar los accesos.");
      return;
    }
    setMembers(m.data || []);
    setInvites(i.data || []);
  }
  useEffect(() => {
    load();
  }, [workspace?.membership.household_id]);
  async function invite(e?: FormEvent, existing?: Invite) {
    e?.preventDefault();
    if (!workspace) return;
    setBusy(true);
    setMessage("");
    try {
      const {
        data: { session },
      } = await browserSupabase().auth.getSession();
      if (!session) throw new Error("Tu sesión venció.");
      const response = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          householdId: workspace.membership.household_id,
          email: existing?.email || email,
          name: existing?.display_name || name,
          permissions: existing?.permissions || permissions,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setMessage(
        result.warning || "Supabase confirmó el envío de la invitación.",
      );
      if (!existing) {
        setEmail("");
        setName("");
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
      await load();
    }
  }
  async function saveMember(member: Membership) {
    if (!workspace) return;
    setBusy(true);
    const { error } = await browserSupabase().rpc("manage_household_member", {
      hid: workspace.membership.household_id,
      member_id: member.user_id,
      new_active: member.active,
      new_permissions: member.permissions,
    });
    setMessage(
      error
        ? "No se pudieron guardar los permisos."
        : "Permisos guardados. La base de datos aplica el cambio de inmediato.",
    );
    setBusy(false);
    await load();
  }
  return (
    <>
      <section className="panel">
        <div className="section-title">
          <h2>Las personas de tu casa</h2>
          <Users size={21} />
        </div>
        <p>
          Los administradores tienen cuentas independientes y controlan los
          accesos del equipo. Manuela y Juan de Dios son perfiles familiares sin
          cuenta ni acceso.
        </p>
        {managedAccess && message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
        {members.map((member) => (
          <article className="member-card" key={member.user_id}>
            <div className="member-heading">
              <strong>{member.display_name}</strong>
              <span className="pill">
                {member.is_principal
                  ? member.active
                    ? "Administrador principal"
                    : "Acceso principal desactivado"
                  : member.active
                    ? "Colaborador activo"
                    : "Desactivado"}
              </span>
            </div>
            {member.is_principal ? (
              <p className="privacy">
                <ShieldCheck size={15} />
                Este acceso principal no se modifica desde colaboradores.
              </p>
            ) : (
              <>
                <PermissionFields
                  value={member.permissions}
                  onChange={(permissions) =>
                    setMembers((rows) =>
                      rows.map((m) =>
                        m.user_id === member.user_id
                          ? { ...m, permissions }
                          : m,
                      ),
                    )
                  }
                />
                <label className="permission-check">
                  <input
                    type="checkbox"
                    checked={member.active}
                    onChange={(e) =>
                      setMembers((rows) =>
                        rows.map((m) =>
                          m.user_id === member.user_id
                            ? { ...m, active: e.target.checked }
                            : m,
                        ),
                      )
                    }
                  />
                  Acceso activo
                </label>
                <button
                  disabled={busy}
                  className="primary compact"
                  onClick={() => saveMember(member)}
                >
                  Guardar permisos
                </button>
              </>
            )}
          </article>
        ))}
      </section>
      {managedAccess && workspace ? (
        <ManagedStaff
          householdId={workspace.membership.household_id}
          onChanged={load}
        />
      ) : (
        <>
          <section className="panel">
            <h2>Invitar a un colaborador</h2>
            <p>
              Invita solo a la persona que necesita acceso y elige sus permisos.
              Enviar invitación solicita un correo real a Supabase.
            </p>
            <form onSubmit={invite}>
              <div className="pantry-form">
                <label>
                  Nombre
                  <input
                    required
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label>
                  Correo electrónico
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
              </div>
              <div className="role-presets">
                <button
                  type="button"
                  className="text-button"
                  onClick={() =>
                    setPermissions([
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
                  onClick={() =>
                    setPermissions([
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
                  onClick={() => setPermissions(["tasks.read"])}
                >
                  Personalizar
                </button>
              </div>
              <PermissionFields value={permissions} onChange={setPermissions} />
              <button className="primary" disabled={busy}>
                <Plus size={16} />
                Enviar invitación
              </button>
            </form>
            {message && (
              <p role="status" className="notice">
                {message}
              </p>
            )}
          </section>
          <section className="panel">
            <h2>Invitaciones</h2>
            {invites.length === 0 && <p>Aún no hay invitaciones.</p>}
            {invites.map((i) => (
              <div className="member-card" key={i.id}>
                <strong>{i.display_name}</strong>
                <p>{i.email}</p>
                <small>
                  {i.accepted_at
                    ? "Aceptada"
                    : i.revoked_at
                      ? "Revocada"
                      : new Date(i.expires_at) < new Date()
                        ? "Vencida"
                        : i.delivery_status === "sent"
                          ? "Correo enviado"
                          : i.delivery_status === "failed"
                            ? "Envío no confirmado"
                            : "Envío pendiente"}
                </small>
                {!i.accepted_at && !i.revoked_at && (
                  <div>
                    <button
                      disabled={busy}
                      className="text-button"
                      onClick={() => invite(undefined, i)}
                    >
                      Reenviar invitación
                    </button>
                    <button
                      disabled={busy}
                      className="text-button"
                      onClick={async () => {
                        const { error } = await browserSupabase().rpc(
                          "revoke_household_invitation",
                          {
                            hid: workspace!.membership.household_id,
                            invitation_id: i.id,
                          },
                        );
                        setMessage(
                          error
                            ? "No se pudo revocar."
                            : "Invitación revocada.",
                        );
                        await load();
                      }}
                    >
                      Revocar invitación
                    </button>
                  </div>
                )}
              </div>
            ))}
          </section>
        </>
      )}
    </>
  );
}
function PermissionFields({
  value,
  onChange,
}: {
  value: Permission[];
  onChange: (p: Permission[]) => void;
}) {
  return (
    <fieldset className="permissions">
      <legend>Permisos de trabajo</legend>
      {permissionOptions.map(([permission, label]) => (
        <label className="permission-check" key={permission}>
          <input
            type="checkbox"
            checked={value.includes(permission)}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? [...value, permission]
                  : value.filter((p) => p !== permission),
              )
            }
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
export function TaskAssignee({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const workspace = useWorkspace();
  const [members, setMembers] = useState<Membership[]>([]);
  useEffect(() => {
    if (workspace?.membership.role === "admin")
      browserSupabase()
        .from("household_members")
        .select("*")
        .eq("household_id", workspace.membership.household_id)
        .eq("active", true)
        .then(({ data }) => setMembers(data || []));
  }, [workspace?.membership.household_id]);
  if (!workspace) return null;
  return (
    <label className="task-access">
      Acceso a esta tarea
      <select
        aria-label="Usuario con acceso a esta tarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Sin usuario asignado</option>
        {members.map((m) => (
          <option key={m.user_id} value={m.user_id}>
            {m.display_name}
          </option>
        ))}
      </select>
    </label>
  );
}
