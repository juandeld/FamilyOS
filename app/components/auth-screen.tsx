"use client";
import { useState, type FormEvent } from "react";
import Brand from "./brand";
import ThemeToggle from "./theme-toggle";
import { ShieldCheck } from "lucide-react";
import {
  browserSupabase,
  supabaseConfigured,
} from "../../lib/supabase/browser";
export default function AuthScreen({ demoOnly = false }: { demoOnly?: boolean }) {
  const [demoCode, setDemoCode] = useState("");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [recovery, setRecovery] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    if (demoOnly) {
      if (demoCode !== "0000") { setMessage("La clave temporal es 0000. Inténtalo de nuevo."); return; }
      window.location.assign("/demo");
      return;
    }
    setBusy(true);
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
      <div className="auth-tools"><ThemeToggle /></div>
      <a href="/" className="brand" aria-label="LT Living, inicio"><Brand vertical /></a>
      <section className="auth-card">
        <span className="eyebrow">LIMA TORALLA</span>
        <h1>{demoOnly ? "La casa, en calma." : recovery ? "Volvamos a casa." : "Bienvenido a casa."}</h1>
        <p>
          {demoOnly ? "Prueba la cocina, las compras y el equipo de casa con datos ficticios." : recovery
            ? "Te enviaremos un enlace seguro."
            : "Todo lo que ocurre en casa, anticipado con discreción."}
        </p>
        {demoOnly ? (
          <form onSubmit={submit}>
            <label>Clave de demostración
              <input type="password" inputMode="numeric" autoComplete="off" maxLength={4} pattern="[0-9]{4}" required value={demoCode} onChange={(e) => setDemoCode(e.target.value)} aria-describedby="demo-code-help" />
            </label>
            <p id="demo-code-help" className="demo-code-help">Clave temporal: <strong>0000</strong></p>
            <button className="primary" type="submit">Entrar a la demostración</button>
          </form>
        ) : !supabaseConfigured ? (
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
                  : "Entrar a casa"}
            </button>
          </form>
        )}
        {message && <p role="status">{message}</p>}
        {supabaseConfigured && !demoOnly && (
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
          {demoOnly ? "Solo datos ficticios. Esta clave no abre tu cuenta privada." : "Acceso privado. Solo por invitación."}
        </div>
        <a className="demo-link" href={demoOnly ? "/login" : "/prueba"}>
          {demoOnly ? "Entrar a mi cuenta privada →" : "Probar con clave temporal 0000 →"}
        </a>

      </section>
    </main>
  );
}
