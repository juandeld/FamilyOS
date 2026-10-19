import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { permissionOptions } from "../../../../lib/supabase/access";
export const runtime = "nodejs";
const bodySchema = z
  .object({
    householdId: z.string().uuid(),
    email: z.email().max(254),
    name: z.string().trim().min(1).max(100),
    permissions: z
      .array(z.enum(permissionOptions.map((p) => p[0])))
      .max(permissionOptions.length),
  })
  .strict();
export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    secret = process.env.SUPABASE_SERVICE_ROLE_KEY,
    site = process.env.NEXT_PUBLIC_APP_URL;
  if (!url || !anon || !secret || !site)
    return NextResponse.json(
      { error: "Falta configurar Supabase y la URL pública en el servidor." },
      { status: 503 },
    );
  if (request.headers.get("origin") !== new URL(site).origin)
    return NextResponse.json(
      { error: "Origen no permitido." },
      { status: 403 },
    );
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer "))
    return NextResponse.json({ error: "Inicia sesión." }, { status: 401 });
  const raw = await request.text();
  if (raw.length > 5000)
    return NextResponse.json(
      { error: "Solicitud demasiado grande." },
      { status: 413 },
    );
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(JSON.parse(raw));
  } catch {
    return NextResponse.json(
      { error: "Revisa el correo, nombre y permisos." },
      { status: 400 },
    );
  }
  const schema = process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA || "public";
  const userClient = createClient(url, anon, {
    db: { schema },
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser(authorization.slice(7));
  if (authError || !user)
    return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  const { data: membership } = await userClient
    .from("household_members")
    .select("role,active")
    .eq("household_id", body.householdId)
    .eq("user_id", user.id)
    .single();
  if (!membership?.active || membership.role !== "admin")
    return NextResponse.json(
      { error: "Solo los administradores pueden invitar." },
      { status: 403 },
    );
  const { data: inviteId, error: reserveError } = await userClient.rpc(
    "reserve_household_invitation",
    {
      hid: body.householdId,
      invite_email: body.email,
      invite_name: body.name,
      invite_permissions: body.permissions,
    },
  );
  if (reserveError)
    return NextResponse.json(
      {
        error:
          "No se pudo crear la invitación. Revisa si la persona ya pertenece al hogar.",
      },
      { status: 409 },
    );
  const service = createClient(url, secret, {
    db: { schema },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: deliveryError } = await service.auth.admin.inviteUserByEmail(
    body.email,
    { redirectTo: new URL("/auth/callback", site).toString() },
  );
  const { error: statusError } = await service
    .from("household_invitations")
    .update({ delivery_status: deliveryError ? "failed" : "sent" })
    .eq("id", inviteId);
  if (deliveryError)
    return NextResponse.json(
      {
        error:
          "La invitación quedó pendiente, pero no se pudo confirmar el envío del correo. Revisa SMTP, límites de envío o si la cuenta ya existe. Una cuenta existente con correo confirmado puede iniciar sesión para aceptar el acceso.",
      },
      { status: 502 },
    );
  return NextResponse.json(
    {
      sent: true,
      ...(statusError
        ? {
            warning:
              "Correo enviado; no se pudo actualizar el estado de entrega.",
          }
        : {}),
    },
    { status: 201 },
  );
}
