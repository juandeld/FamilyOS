"use client";
import { useState, type FormEvent } from "react";
import { Home, ShieldCheck } from "lucide-react";
import {
  browserSupabase,
  supabaseConfigured,
} from "../../lib/supabase/browser";
export default function AuthScreen() {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [recovery, setRecovery] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (recovery) {
        const { error } = await browserSupabase().auth.resetPasswordForEmail(
          email,
          { redirectTo: window.location.origin + "/auth/reset-password" },
        );
        if (error) throw error;
        setMessage(
          "Si la cuenta existe, recibirás un enlace para recuperar tu contraseña.",
        );
      } else {
        const { error } = await browserSupabase().auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        window.location.assign("/");
      }
    } catch {
      setMessage(
        recovery
          ? "No se pudo solicitar el correo. Revisa la conexión e inténtalo después."
          : "No se pudo iniciar sesión. Revisa tus credenciales y tu invitación.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <a href="/" className="brand">
        <span className="brand-icon">
          <Home />
        </span>
        FamilyOS
      </a>
      <section className="auth-card">
        <span className="eyebrow">TU HOGAR, TU ESPACIO</span>
        <h1>{recovery ? "Volvamos a tu hogar." : "Bienvenido a casa."}</h1>
        <p>
          {recovery
            ? "Te enviaremos un enlace seguro."
            : "Acceso privado para las personas invitadas a tu hogar."}
        </p>
        {!supabaseConfigured ? (
          <p className="notice">
            La conexión segura todavía no está configurada. Puedes usar la demo
            con datos ficticios.
          </p>
        ) : (
          <form onSubmit={submit}>
            <label>
              Correo electrónico
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            {!recovery && (
              <label>
                Contraseña
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            )}
            <button disabled={busy} className="primary">
              {busy
                ? "Un momento…"
                : recovery
                  ? "Enviar enlace"
                  : "Entrar a mi hogar"}
            </button>
          </form>
        )}
        {message && <p role="status">{message}</p>}
        {supabaseConfigured && (
          <button
            className="text-button"
            onClick={() => {
              setRecovery(!recovery);
              setMessage("");
            }}
          >
            {recovery ? "Volver a iniciar sesión" : "Olvidé mi contraseña"}
          </button>
        )}
        <div className="privacy">
          <ShieldCheck size={16} />
          Sin registro público. Solo por invitación.
        </div>
        <a className="demo-link" href="/demo">
          Explorar la demo con datos ficticios →
        </a>
      </section>
    </main>
  );
}
