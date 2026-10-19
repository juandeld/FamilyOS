"use client";
import { useEffect, useRef, useState } from "react";
import {
  browserSupabase,
  supabaseConfigured,
} from "../../../lib/supabase/browser";
export default function Confirm() {
  const [error, setError] = useState(""),
    started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    async function verify() {
      if (!supabaseConfigured) {
        setError("Supabase aún no está configurado.");
        return;
      }
      const params = new URLSearchParams(
        window.location.hash.slice(1) || window.location.search,
      );
      const token = params.get("token_hash"),
        type = params.get("type");
      if (!token || !["invite", "recovery"].includes(type || "")) {
        setError("Enlace inválido. Pide una nueva invitación o recuperación.");
        return;
      }
      window.history.replaceState({}, "", window.location.pathname);
      const { error } = await browserSupabase().auth.verifyOtp({
        token_hash: token,
        type: type as "invite" | "recovery",
      });
      if (error) {
        setError("El enlace venció o ya fue utilizado. Solicita uno nuevo.");
        return;
      }
      window.location.replace("/auth/reset-password");
    }
    verify().catch(() =>
      setError("No se pudo confirmar el enlace. Revisa la conexión."),
    );
  }, []);
  return (
    <div className="access-loading">
      <h1>{error ? "Revisa tu enlace" : "Confirmando tu acceso…"}</h1>
      {error && (
        <>
          <p role="alert">{error}</p>
          <a href="/login">Volver al inicio de sesión</a>
        </>
      )}
    </div>
  );
}
