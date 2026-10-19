"use client";
import { useEffect, useState, type FormEvent } from "react";
import {
  browserSupabase,
  supabaseConfigured,
} from "../../../lib/supabase/browser";
export default function ResetPassword() {
  const [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [authorized, setAuthorized] = useState(false);
  useEffect(() => {
    if (!supabaseConfigured) return;
    browserSupabase()
      .auth.getSession()
      .then(({ data }) => setAuthorized(!!data.session));
    const {
      data: { subscription },
    } = browserSupabase().auth.onAuthStateChange((_e, s) => setAuthorized(!!s));
    return () => subscription.unsubscribe();
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await browserSupabase().auth.updateUser({ password });
      if (error) throw error;
      await browserSupabase().rpc("accept_my_invitations");
      window.location.replace("/");
    } catch {
      setMessage(
        "No se pudo cambiar la contraseña. Revisa el enlace y los requisitos de seguridad.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-card">
        <span className="eyebrow">ACCESO PRIVADO</span>
        <h1>Tu nueva contraseña.</h1>
        {authorized ? (
          <form onSubmit={submit}>
            <label>
              Nueva contraseña
              <input
                type="password"
                minLength={12}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label>
              Confirmar contraseña
              <input
                type="password"
                minLength={12}
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
            <p>Usa al menos 12 caracteres y una contraseña única.</p>
            <button className="primary" disabled={busy}>
              Guardar contraseña
            </button>
          </form>
        ) : (
          <p>
            Abre un enlace válido de invitación o recuperación para continuar.
          </p>
        )}
        {message && <p role="alert">{message}</p>}
        <a href="/login">Volver al inicio de sesión</a>
      </section>
    </main>
  );
}
