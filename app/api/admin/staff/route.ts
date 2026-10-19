import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  authorizeAdmin, readBoundedJson, usernameSchema, permissionsSchema, managedPasswordSchema,
  accountColumns, type ManagedAccount, publicAccount, internalStaffAddress,
  ManagedAccessError, errorResponse, successResponse,
} from "../../../../lib/supabase/managed-access";
export const runtime = "nodejs";
const householdSchema = z.string().uuid();
const createSchema = z.object({
  householdId: householdSchema, id: z.string().uuid(),
  name: z.string().trim().min(1).max(100), username: usernameSchema,
  password: managedPasswordSchema, permissions: permissionsSchema,
}).strict();
export async function GET(request: NextRequest) {
  try {
    const parsed = householdSchema.safeParse(new URL(request.url).searchParams.get("householdId"));
    if (!parsed.success) throw new ManagedAccessError(400, "El hogar no es válido.");
    const { service } = await authorizeAdmin(request, parsed.data);
    const { data, error } = await service.from("managed_staff_accounts").select(accountColumns)
      .eq("household_id", parsed.data).order("display_name");
    if (error) throw new ManagedAccessError(503, "No se pudieron cargar los accesos del personal.");
    return successResponse({ accounts: (data as ManagedAccount[]).map(publicAccount) });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: NextRequest) {
  let reservedId: string | null = null;
  let reservedService: Awaited<ReturnType<typeof authorizeAdmin>>["service"] | null = null;
  try {
    const parsed = createSchema.safeParse(await readBoundedJson(request));
    if (!parsed.success) throw new ManagedAccessError(400, "Revisa el nombre, usuario, permisos y una contraseña de al menos 12 caracteres.");
    const body = parsed.data;
    const { actorId, service } = await authorizeAdmin(request, body.householdId);
    reservedService = service;
    const readAccount = async () => {
      const { data, error } = await service.from("managed_staff_accounts").select(accountColumns).eq("id", body.id).maybeSingle();
      if (error) throw new ManagedAccessError(503, "No se pudo comprobar la creación de la cuenta.");
      return data as ManagedAccount | null;
    };
    let account = await readAccount();
    if (!account) {
      const { error } = await service.from("managed_staff_accounts").insert({
        id: body.id, household_id: body.householdId, username: body.username,
        display_name: body.name, permissions: body.permissions, created_by: actorId,
        status: "provisioning",
      });
      if (error && error.code !== "23505")
        throw new ManagedAccessError(503, "No se pudo preparar la cuenta del colaborador.");
      account = await readAccount();
      if (!account) throw new ManagedAccessError(409, "Ese nombre de usuario ya está ocupado. Elige otro.");
    }
    const sameOperation = account.household_id === body.householdId && account.created_by === actorId &&
      account.username === body.username && account.display_name === body.name &&
      JSON.stringify([...account.permissions].sort()) === JSON.stringify(body.permissions);
    if (!sameOperation) throw new ManagedAccessError(409, "Esta operación pertenece a otra creación. Vuelve a abrir el formulario.");
    if (account.status === "active")
      return successResponse({ created: false, account: publicAccount(account) });
    if (account.user_id)
      throw new ManagedAccessError(409, "Este usuario ya fue creado. Restablece su contraseña desde sus accesos.");
    if (!["provisioning", "failed"].includes(account.status))
      throw new ManagedAccessError(409, "La cuenta tiene otra operación en curso. Inténtalo después.");
    reservedId = account.id;
    const resolve = async () => {
      const { data, error } = await service.rpc("resolve_managed_auth_user", { account_id: account!.id });
      if (error) throw new ManagedAccessError(503, "No se pudo comprobar el estado de la cuenta.");
      return typeof data === "string" ? data : null;
    };
    let userId = await resolve();
    let created = false;
    if (!userId) {
      try {
        const { data, error } = await service.auth.admin.createUser({
          email: internalStaffAddress(account.id), password: body.password,
          email_confirm: true, app_metadata: { familyos_managed: true },
          user_metadata: { display_name: body.name },
        });
        if (!error && data.user) { userId = data.user.id; created = true; }
      } catch {
        // A timeout does not prove that Auth failed. Resolve the same opaque identity
        // before another create attempt, rather than create a duplicate or send email.
      }
      if (!userId) userId = await resolve();
    }
    if (!userId) throw new ManagedAccessError(502, "La cuenta quedó pendiente. No se confirmó su creación; puedes reintentar sin duplicarla.");
    if (!created) {
      // After an interrupted create, the original password may have been lost by
      // the administrator. Honor the recovery form's current password before
      // activating the reserved identity; an active replay above never resets it.
      const { error: passwordError } = await service.auth.admin.updateUserById(userId, { password: body.password });
      if (passwordError && passwordError.code !== "same_password")
        throw new ManagedAccessError(502, "No se confirmó la contraseña de recuperación. La cuenta continúa pendiente.");
    }
    const { error: attachError } = await service.rpc("finalize_managed_staff_account", {
      account_id: account.id, auth_user_id: userId,
    });
    if (attachError) throw new ManagedAccessError(503, "La cuenta quedó pendiente de activar. No se confirmó el acceso del colaborador.");
    account = await readAccount();
    if (!account || account.status !== "active" || account.user_id !== userId)
      throw new ManagedAccessError(503, "No se pudo confirmar que la cuenta quedó activa. Revisa sus accesos antes de entregarla.");
    reservedId = null;
    return successResponse({ created, account: publicAccount(account) }, created ? 201 : 200);
  } catch (error) {
    if (reservedId && reservedService) {
      // Never delete an identity after an uncertain outcome. Keep its reservation
      // for recovery; only incomplete accounts fail closed. A concurrent successful
      // finalization is preserved by the status predicate.
      await reservedService.from("managed_staff_accounts").update({ status: "failed" })
        .eq("id", reservedId).in("status", ["provisioning", "failed"]).then(() => undefined, () => undefined);
    }
    return errorResponse(error);
  }
}
