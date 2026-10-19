"use client";
import { useEffect, useRef, useState } from "react";
import {
  browserSupabase,
  supabaseConfigured,
} from "../../../lib/supabase/browser";
export default function Callback() {
  const [error, setError] = useState(""),
    started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    async function exchange() {
      if (!supabaseConfigured) throw new Error();
      const {
        data: { session },
      } = await browserSupabase().auth.getSession();
      if (!session) throw new Error();
      window.history.replaceState({}, "", window.location.pathname);
      window.location.replace("/auth/reset-password");
    }
    exchange().catch(() =>
      setError("El enlace no es válido o venció. Solicita uno nuevo."),
    );
  }, []);
  return (
    <div className="access-loading">
      <h1>Abriendo tu casa…</h1>
      {error && (
        <>
          <p role="alert">{error}</p>
          <a href="/login">Volver al inicio de sesión</a>
        </>
      )}
    </div>
  );
}
