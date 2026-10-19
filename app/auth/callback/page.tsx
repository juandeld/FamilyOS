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
      const params = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      // Standard Supabase invitation/recovery templates return an implicit session.
      // Remove credentials before initializing our PKCE client, then verify explicitly.
      if (accessToken || refreshToken) {
        window.history.replaceState({}, "", window.location.pathname);
        if (!accessToken || !refreshToken ||
            !["invite", "recovery"].includes(params.get("type") || "")) throw new Error();
        const { data, error } = await browserSupabase().auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error || !data.session) throw new Error();
      } else {
        const { data: { session }, error } = await browserSupabase().auth.getSession();
        if (error || !session) throw new Error();
        window.history.replaceState({}, "", window.location.pathname);
      }
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
