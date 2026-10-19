import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  authorizeAdmin, readBoundedJson, managedPasswordSchema, ManagedAccessError,
  errorResponse, successResponse,
} from "../../../../../lib/supabase/managed-access";
export const runtime = "nodejs";
const bodySchema = z.object({
  householdId: z.string().uuid(), userId: z.string().uuid(), password: managedPasswordSchema,
}).strict();
export async function POST(request: NextRequest) {
  let failedAccount: string | null = null;
  let failedUser: string | null = null;
  let householdId: string | null = null;
  let failureService: Awaited<ReturnType<typeof authorizeAdmin>>["service"] | null = null;
  try {
    const parsed = bodySchema.safeParse(await readBoundedJson(request, 2048));
    if (!parsed.success) throw new ManagedAccessError(400, "Revisa la cuenta y usa una contraseña de al menos 12 caracteres.");
    const body = parsed.data;
    const { actorId, service } = await authorizeAdmin(request, body.householdId);
    const { data: account, error: accountError } = await service.from("managed_staff_accounts")
      .select("id,user_id,status").eq("household_id", body.householdId).eq("user_id", body.userId).maybeSingle();
    const { data: member, error: memberError } = await service.from("household_members")
      .select("role,active,is_principal").eq("household_id", body.householdId).eq("user_id", body.userId).maybeSingle();
    if (accountError || memberError) throw new ManagedAccessError(503, "No se pudo verificar la cuenta del colaborador.");
    if (!account || !member || member.role !== "collaborator" || member.is_principal)
      throw new ManagedAccessError(403, "Solo se puede restablecer un colaborador de este hogar. Los administradores usan Google.");
    const { error: beginError } = await service.rpc("begin_managed_password_reset", { account_id: account.id });
    if (beginError) throw new ManagedAccessError(409, "La cuenta tiene otra operación en curso o no puede restablecerse.");
    failedAccount = account.id; failedUser = body.userId; householdId = body.householdId; failureService = service;
    const { error: passwordError } = await service.auth.admin.updateUserById(body.userId, { password: body.password });
    if (passwordError) throw new ManagedAccessError(502, "No se confirmó el cambio de contraseña. El acceso quedó bloqueado hasta que lo restablezcas de nuevo.");
    const { error: finishError } = await service.rpc("finish_managed_password_reset", { account_id: account.id, actor_id: actorId });
    if (finishError) throw new ManagedAccessError(503, "La contraseña pudo cambiar, pero no se confirmó la reactivación. Restablece la cuenta de nuevo antes de entregarla.");
    failedAccount = null;
    return successResponse({ reset: true });
  } catch (error) {
    if (failedAccount && failureService) {
      await failureService.from("managed_staff_accounts").update({ status: "failed" })
        .eq("id", failedAccount).eq("status", "resetting").then(() => undefined, () => undefined);
      if (failedUser && householdId) await failureService.from("household_members").update({ active: false })
        .eq("household_id", householdId).eq("user_id", failedUser).eq("role", "collaborator").eq("is_principal", false)
        .then(() => undefined, () => undefined);
    }
    return errorResponse(error);
  }
}
