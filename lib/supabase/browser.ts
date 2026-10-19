"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
export const supabaseConfigured = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
let client: SupabaseClient<any, string> | undefined;
export function browserSupabase() {
  if (!supabaseConfigured) throw new Error("Supabase aún no está configurado.");
  return (client ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA || "public" },
      global: {
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
      auth: {
        storageKey: "familyos-auth-session",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    },
  ));
}
