import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const names = ["JUAN", "PAMELA", "COLLAB", "OTHER"] as const;
  const missing = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ...names.flatMap((n) => [
      `FAMILYOS_TEST_${n}_EMAIL`,
      `FAMILYOS_TEST_${n}_PASSWORD`,
    ]),
  ].filter((n) => !process.env[n]);
  if (missing.length) {
    console.error(
      "Verificación NO ejecutada. Faltan variables: " + missing.join(", "),
    );
    process.exitCode = 2;
    return;
  }
  const clients = await Promise.all(
    names.map(async (name) => {
      const client = createClient(url!, key!, {
        db: { schema: process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA || "public" },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await client.auth.signInWithPassword({
        email: process.env[`FAMILYOS_TEST_${name}_EMAIL`]!,
        password: process.env[`FAMILYOS_TEST_${name}_PASSWORD`]!,
      });
      if (error || !data.user)
        throw new Error(
          `No se pudo iniciar sesión en la cuenta de prueba ${name}.`,
        );
      const { data: m, error: e } = await client
        .from("household_members")
        .select("*")
        .eq("user_id", data.user.id)
        .eq("active", true)
        .limit(1)
        .single();
      if (e || !m) throw new Error(`Falta membresía activa en ${name}.`);
      return { client, member: m };
    }),
  );
  const [a, b, c, other] = clients;
  const hid = a.member.household_id;
  assert.equal(a.member.role, "admin");
  assert.equal(b.member.role, "admin");
  assert.equal(hid, b.member.household_id);
  assert.equal(c.member.household_id, hid);
  assert.equal(c.member.role, "collaborator");
  assert.notEqual(other.member.household_id, hid);
  for (const { client } of [c, other]) {
    const { data, error } = await client
      .from("household_state")
      .select("*")
      .eq("household_id", hid);
    assert.ifError(error);
    assert.equal(data.length, 0);
    const denied = await client.rpc("save_household_state", {
      hid,
      expected_revision: 0,
      new_data: {},
    });
    assert.ok(denied.error);
  }
  const denied = await c.client.rpc("get_collaborator_workspace", {
    hid: other.member.household_id,
  });
  assert.ok(denied.error);
  const operational = await c.client.rpc("get_collaborator_workspace", { hid });
  assert.ifError(operational.error);
  for (const field of ["goals", "staff", "history", "preferences", "notes"])
    assert.ok(!(field in operational.data));
  console.log(
    "Aprobado: acceso de cuentas invitadas, aislamiento por hogar y privacidad de colaboradores.",
  );
  if (process.env.FAMILYOS_LIVE_TEST_WRITE === "1") {
    const before = await a.client
      .from("household_state")
      .select("data,revision")
      .eq("household_id", hid)
      .single();
    assert.ifError(before.error);
    const marker =
      "Verificación temporal de sincronización " + crypto.randomUUID();
    let changed = false,
      disabled = false;
    try {
      const proposed = {
        ...before.data!.data,
        notes: [...(before.data!.data.notes || []), marker],
      };
      const saved = await a.client.rpc("save_household_state", {
        hid,
        expected_revision: before.data!.revision,
        new_data: proposed,
      });
      assert.ifError(saved.error);
      changed = true;
      const fromB = await b.client
        .from("household_state")
        .select("data,revision")
        .eq("household_id", hid)
        .single();
      assert.ifError(fromB.error);
      assert.ok(fromB.data!.data.notes.includes(marker));
      assert.equal(fromB.data!.revision, saved.data);
      const stale = await b.client.rpc("save_household_state", {
        hid,
        expected_revision: before.data!.revision,
        new_data: before.data!.data,
      });
      assert.equal(stale.error?.code, "40001");
      const disable = await a.client.rpc("manage_household_member", {
        hid,
        member_id: c.member.user_id,
        new_active: false,
        new_permissions: c.member.permissions,
      });
      assert.ifError(disable.error);
      disabled = true;
      const blocked = await c.client.rpc("get_collaborator_workspace", { hid });
      assert.ok(blocked.error);
      console.log(
        "Aprobado: cambio compartido entre administradores, conflicto de revisión y desactivación inmediata en Supabase alojado.",
      );
    } finally {
      if (disabled) {
        const restore = await a.client.rpc("manage_household_member", {
          hid,
          member_id: c.member.user_id,
          new_active: true,
          new_permissions: c.member.permissions,
        });
        if (restore.error)
          throw new Error(
            "No se pudo reactivar la cuenta colaboradora de prueba; revísala en Usuarios.",
          );
      }
      if (changed) {
        const latest = await a.client
          .from("household_state")
          .select("data,revision")
          .eq("household_id", hid)
          .single();
        assert.ifError(latest.error);
        const clean = {
          ...latest.data!.data,
          notes: (latest.data!.data.notes || []).filter(
            (n: string) => n !== marker,
          ),
        };
        const restore = await a.client.rpc("save_household_state", {
          hid,
          expected_revision: latest.data!.revision,
          new_data: clean,
        });
        if (restore.error)
          throw new Error(
            "No se pudo retirar la nota temporal: hay cambios concurrentes. Revísala manualmente.",
          );
      }
    }
  } else
    console.log(
      "Escritura/sincronización/desactivación NO ejecutadas: usa FAMILYOS_LIVE_TEST_WRITE=1 solo en un proyecto de pruebas.",
    );
  await Promise.all(
    clients.map(({ client }) => client.auth.signOut({ scope: "local" })),
  );
}
main().catch((error) => {
  if (
    error instanceof Error &&
    /^No se pudo (retirar|reactivar)/.test(error.message)
  )
    console.error(error.message);
  console.error(
    "La verificación no pasó. Revisa migraciones, membresías, permisos y las variables de las cuentas de prueba. No se muestran credenciales.",
  );
  process.exitCode = 1;
});
