"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
export const supabaseConfigured = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
let client: SupabaseClient | undefined;
export function browserSupabase() {
  if (!supabaseConfigured) throw new Error("Supabase aún no está configurado.");
  return (client ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    },
  ));
}
