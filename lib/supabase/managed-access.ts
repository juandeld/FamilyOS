import { createHmac } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { permissionOptions } from "./access";

export type ServerClient = SupabaseClient<any, string>;
export class ManagedAccessError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export type ManagedConfig = {
  url: string; anon: string; secret: string; origin: string; schema: string;
};
export function managedConfig(): ManagedConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const site = process.env.NEXT_PUBLIC_APP_URL;
  if (!url || !anon || !secret || !site)
    throw new ManagedAccessError(503, "El acceso seguro todavía no está configurado.");
  let origin: string;
  try { origin = new URL(site).origin; }
  catch { throw new ManagedAccessError(503, "El acceso seguro todavía no está configurado."); }
  return { url, anon, secret, origin, schema: process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA || "public" };
}
export function assertSameOrigin(request: NextRequest, config: ManagedConfig, required = true) {
  const origin = request.headers.get("origin");
  if ((required || origin !== null) && origin !== config.origin)
    throw new ManagedAccessError(403, "Origen no permitido.");
}
export function serviceClient(config: ManagedConfig): ServerClient {
  return createClient(config.url, config.secret, {
    db: { schema: config.schema },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
export function sessionClient(config: ManagedConfig, token?: string): ServerClient {
  return createClient(config.url, config.anon, {
    db: { schema: config.schema },
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
export async function authorizeAdmin(request: NextRequest, householdId: string) {
  const config = managedConfig();
  assertSameOrigin(request, config, request.method !== "GET");
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer "))
    throw new ManagedAccessError(401, "Inicia sesión para administrar los accesos.");
  const token = authorization.slice(7);
  const userClient = sessionClient(config, token);
  const { data: { user }, error: authError } = await userClient.auth.getUser(token);
  if (authError || !user) throw new ManagedAccessError(401, "Tu sesión venció. Vuelve a entrar.");
  const { data: allowed, error } = await userClient.rpc("is_household_admin", { hid: householdId });
  if (error) throw new ManagedAccessError(503, "No se pudo verificar el permiso administrativo.");
  if (allowed !== true) throw new ManagedAccessError(403, "Solo un administrador de este hogar puede administrar accesos.");
  return { actorId: user.id, userClient, service: serviceClient(config), config };
}
export async function readBoundedJson(request: NextRequest, maxBytes = 8192): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json"))
    throw new ManagedAccessError(415, "Envía la solicitud en formato JSON.");
  const declaredLength = Number(request.headers.get("content-length"));
  if (declaredLength > maxBytes) throw new ManagedAccessError(413, "Solicitud demasiado grande.");
  const reader = request.body?.getReader();
  if (!reader) throw new ManagedAccessError(400, "Revisa la información de acceso.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new ManagedAccessError(413, "Solicitud demasiado grande.");
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new ManagedAccessError(400, "Revisa la información de acceso."); }
}
export const usernameSchema = z.string().trim().toLowerCase()
  .regex(/^[a-z0-9][a-z0-9._-]{2,31}$/);
export const permissionsSchema = z.array(z.enum(permissionOptions.map(p => p[0])))
  .max(permissionOptions.length).transform(values => [...new Set(values)].sort());
export const managedPasswordSchema = z.string().min(12).max(128)
  .refine(value => Buffer.byteLength(value, "utf8") <= 72);
export type ManagedAccount = {
  id: string; household_id: string; username: string; display_name: string;
  permissions: string[]; user_id: string | null; status: string; created_by: string;
};
export const accountColumns = "id,household_id,username,display_name,permissions,user_id,status,created_by";
export function publicAccount(row: ManagedAccount) {
  return { id: row.id, userId: row.user_id, username: row.username, name: row.display_name, status: row.status,
    permissions: row.permissions, createdBy: row.created_by };
}
export function internalStaffAddress(id: string) { return `${id}@staff.familyos.invalid`; }
export async function enforceLoginLimit(request: NextRequest, config: ManagedConfig, service: ServerClient, username: string) {
  // Vercel overwrites forwarding headers at the trusted edge. Local/unknown traffic
  // shares a conservative bucket; client-supplied form values never determine IP.
  const ip = (request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for") || "unknown")
    .split(",")[0].trim().slice(0, 128);
  const hash = (value: string) => createHmac("sha256", config.secret).update(value).digest("hex");
  for (const [bucket, max] of [[`ip:${hash(ip)}`, 20], [`user:${hash(username)}`, 8]] as const) {
    const { data, error } = await service.rpc("consume_login_attempt", {
      bucket, max_attempts: max, window_seconds: 900,
    });
    if (error) throw new ManagedAccessError(503, "No se pudo verificar el acceso. Inténtalo más tarde.");
    if (data !== true) throw new ManagedAccessError(429, "Demasiados intentos. Espera unos minutos antes de volver a entrar.");
  }
}
export function errorResponse(error: unknown) {
  const known = error instanceof ManagedAccessError;
  return NextResponse.json({ error: known ? error.message : "No se pudo completar la operación de acceso. Inténtalo de nuevo." }, {
    status: known ? error.status : 503,
    headers: { "Cache-Control": "no-store", ...(known && error.status === 429 ? { "Retry-After": "900" } : {}) },
  });
}
export function successResponse(value: unknown, status = 200) {
  return NextResponse.json(value, { status, headers: { "Cache-Control": "no-store" } });
}
