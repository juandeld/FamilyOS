import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  managedConfig, assertSameOrigin, readBoundedJson, serviceClient, sessionClient,
  usernameSchema, enforceLoginLimit, internalStaffAddress, ManagedAccessError,
  errorResponse, successResponse,
} from "../../../../lib/supabase/managed-access";
export const runtime = "nodejs";
const bodySchema = z.object({ username: usernameSchema, password: z.string().min(1).max(128) }).strict();
const invalid = () => new ManagedAccessError(401, "Usuario o contraseña incorrectos, o acceso desactivado.");
export async function POST(request: NextRequest) {
  try {
    const config = managedConfig();
    assertSameOrigin(request, config);
    const parsed = bodySchema.safeParse(await readBoundedJson(request, 2048));
    if (!parsed.success) throw invalid();
    const { username, password } = parsed.data;
    const service = serviceClient(config);
    await enforceLoginLimit(request, config, service, username);
    const { data: account, error: accountError } = await service.from("managed_staff_accounts")
      .select("id,user_id,household_id,status").eq("username", username).maybeSingle();
    if (accountError) throw new ManagedAccessError(503, "No se pudo verificar el acceso. Inténtalo más tarde.");
    if (!account || account.status !== "active" || !account.user_id) throw invalid();
    const { data: member, error: memberError } = await service.from("household_members")
      .select("role,active,is_principal").eq("household_id", account.household_id).eq("user_id", account.user_id).maybeSingle();
    if (memberError) throw new ManagedAccessError(503, "No se pudo verificar el acceso. Inténtalo más tarde.");
    if (!member?.active || member.role !== "collaborator" || member.is_principal) throw invalid();
    const client = sessionClient(config);
    const { data, error: signInError } = await client.auth.signInWithPassword({
      email: internalStaffAddress(account.id), password,
    });
    if (signInError || !data.session || data.user?.id !== account.user_id) throw invalid();
    const { data: allowed, error: permissionError } = await client.rpc("household_session_allowed", { hid: account.household_id });
    if (permissionError || allowed !== true) {
      // Do not return credentials for an invalidated/deactivated session.
      await client.auth.signOut({ scope: "local" }).catch(() => undefined);
      throw invalid();
    }
    return successResponse({ session: data.session });
  } catch (error) { return errorResponse(error); }
}
