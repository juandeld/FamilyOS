// Browser integration uses a local HTTP contract fixture, NOT a Supabase
// deployment. PostgreSQL authorization is tested separately against real RLS.
import {
  test,
  expect,
  type BrowserContext,
  type Route,
} from "@playwright/test";
import { emptyHouseholdState } from "../../lib/state";
const household = "00000000-0000-4000-8000-000000000001";
const users = [
  {
    id: "00000000-0000-4000-8000-000000000011",
    email: "juan@example.test",
    name: "Juan",
  },
  {
    id: "00000000-0000-4000-8000-000000000012",
    email: "pamela@example.test",
    name: "Pamela",
  },
];
function authUser(id: string) {
  const u = users.find((u) => u.id === id) || users[0];
  return {
    id: u.id,
    email: u.email,
    aud: "authenticated",
    role: "authenticated",
    created_at: "2026-10-19T00:00:00Z",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
  };
}
function session(id: string) {
  const payload = Buffer.from(
    JSON.stringify({
      sub: id,
      aud: "authenticated",
      role: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url");
  return {
    access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.local-fixture`,
    token_type: "bearer",
    expires_in: 3600,
    refresh_token: "local-fixture-not-real",
    user: authUser(id),
  };
}
function member(id: string) {
  return {
    household_id: household,
    user_id: id,
    display_name: users.find((u) => u.id === id)!.name,
    role: "admin",
    active: true,
    is_principal: true,
    permissions: [],
  };
}
async function fixture(
  context: BrowserContext,
  backend: {
    state: ReturnType<typeof emptyHouseholdState>;
    revision: number;
    privateReads: number;
  },
  collaborator = false,
) {
  await context.route(
    "https://familyos-test.supabase.co/**",
    async (route: Route) => {
      const request = route.request(),
        url = new URL(request.url()),
        auth = request.headers().authorization || "";
      let id = users[0].id;
      try {
        id =
          JSON.parse(Buffer.from(auth.split(".")[1], "base64url").toString())
            .sub || id;
      } catch {}
      const send = (body: unknown, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      if (url.pathname === "/auth/v1/token") {
        const body = request.postDataJSON();
        return send(
          session(users.find((u) => u.email === body.email)?.id || id),
        );
      }
      if (url.pathname === "/auth/v1/user")
        return send(
          request.method() === "PUT" ? { user: authUser(id) } : authUser(id),
        );
      if (url.pathname === "/auth/v1/logout")
        return route.fulfill({ status: 204 });
      if (url.pathname === "/auth/v1/recover") return send({});
      if (url.pathname === "/auth/v1/verify") return send(session(id));
      if (url.pathname === "/rest/v1/rpc/accept_my_invitations") return send(0);
      if (url.pathname === "/rest/v1/household_members")
        return send(
          url.searchParams.has("user_id")
            ? [
                collaborator
                  ? {
                      ...member(id),
                      display_name: "Cocina de prueba",
                      role: "collaborator",
                      is_principal: false,
                      permissions: ["kitchen.read", "tasks.read"],
                    }
                  : member(id),
              ]
            : users.map((u) => member(u.id)),
        );
      if (url.pathname === "/rest/v1/household_invitations") return send([]);
      if (url.pathname === "/rest/v1/rpc/get_collaborator_workspace")
        return send({
          revision: 0,
          plan: [
            {
              slot: "Juan|Lunes|Almuerzo",
              recipeId: "1-0",
              person: "Juan",
              day: "Lunes",
              meal: "Almuerzo",
              name: "Pollo al limón",
              portions: 1,
              ingredients: [{ name: "Pollo", quantity: 180, unit: "g" }],
              instructions: ["Cocinar completamente"],
            },
          ],
          tasks: [
            {
              id: "task",
              title: "Preparar el almuerzo",
              frequency: "Diaria",
              done: false,
            },
          ],
        });
      if (url.pathname === "/rest/v1/rpc/get_maintenance_tasks")
        return send([]);
      if (url.pathname === "/rest/v1/household_state") {
        backend.privateReads++;
        return send({ data: backend.state, revision: backend.revision });
      }
      if (url.pathname === "/rest/v1/rpc/save_household_state") {
        const args = request.postDataJSON();
        if (args.expected_revision !== backend.revision)
          return send({ code: "40001", message: "State conflict" }, 409);
        backend.state = args.new_data;
        backend.revision++;
        return send(backend.revision);
      }
      return send({ message: "Unexpected request " + url.pathname }, 500);
    },
  );
}
test("login, persistent session, distinct administrators share edits, demo isolation and logout", async ({
  browser,
}) => {
  const backend = {
    state: emptyHouseholdState(),
    revision: 0,
    privateReads: 0,
  };
  const a = await browser.newContext(),
    b = await browser.newContext();
  await fixture(a, backend);
  await fixture(b, backend);
  const pa = await a.newPage(),
    pb = await b.newPage();
  for (const [page, u] of [
    [pa, users[0]],
    [pb, users[1]],
  ] as const) {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Bienvenido a casa." }),
    ).toBeVisible();
    await page.getByLabel("Correo electrónico").fill(u.email);
    await page
      .getByLabel("Contraseña", { exact: true })
      .fill("Local-fixture-password");
    await page.getByRole("button", { name: "Entrar a casa" }).click();
    await expect(
      page.getByRole("heading", { name: "Hoy en casa" }),
    ).toBeVisible();
  }
  await pa.getByRole("button", { name: "Abrir navegación" }).click();
  await pa
    .getByRole("navigation")
    .getByRole("button", { name: "Personal", exact: true })
    .click();
  await pa.getByRole("button", { name: "Agregar tarea" }).click();
  await pa
    .getByRole("dialog")
    .getByRole("textbox")
    .fill("Cambio compartido por Juan");
  await pa.getByRole("button", { name: "Guardar", exact: true }).click();
  await pb.getByRole("button", { name: "Abrir navegación" }).click();
  await pb
    .getByRole("navigation")
    .getByRole("button", { name: "Personal", exact: true })
    .click();
  await expect(
    pb.getByText("Cambio compartido por Juan", { exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await pb.reload();
  await expect(pb.getByRole("heading", { name: "Hoy en casa" })).toBeVisible();
  const before = backend.privateReads;
  await pa.goto("/demo");
  await expect(pa.getByText("DATOS FICTICIOS", { exact: true })).toBeVisible();
  await pa.waitForTimeout(1000);
  expect(backend.privateReads).toBe(before);
  await pb.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
  await expect(
    pb.getByRole("heading", { name: "Bienvenido a casa." }),
  ).toBeVisible();
  await a.close();
  await b.close();
});
test("recovery request, invitation verification, password form, and no public signup", async ({
  page,
  context,
}) => {
  await fixture(context, {
    state: emptyHouseholdState(),
    revision: 0,
    privateReads: 0,
  });
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: /registrar|crear cuenta/i }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Olvidé mi contraseña" }).click();
  await page.getByLabel("Correo electrónico").fill("juan@example.test");
  await page
    .getByRole("button", { name: "Enviar enlace", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Si la cuenta existe");
  await page.goto("/auth/confirm#token_hash=local-fixture&type=invite");
  await expect(
    page.getByRole("heading", { name: "Tu nueva contraseña." }),
  ).toBeVisible();
  await page
    .getByLabel("Nueva contraseña", { exact: true })
    .fill("Local-fixture-password");
  await page
    .getByLabel("Confirmar contraseña", { exact: true })
    .fill("Local-fixture-password");
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(
    page.getByRole("heading", { name: "Hoy en casa" }),
  ).toBeVisible();
  const response = await page.request.post("/api/admin/invitations", {
    headers: { Origin: "http://127.0.0.1:3001" },
    data: {},
  });
  expect(response.status()).toBe(401);
});

test("collaborator loads only operational data and never requests the private document", async ({
  page,
  context,
}) => {
  const backend = {
    state: emptyHouseholdState(),
    revision: 0,
    privateReads: 0,
  };
  await fixture(context, backend, true);
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill("juan@example.test");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("Local-fixture-password");
  await page.getByRole("button", { name: "Entrar a casa" }).click();
  await expect(
    page.getByRole("heading", { name: "Hola, Cocina de prueba." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Menú de cocina" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Pollo al limón" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirmar una preparación" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Usuarios y permisos" }),
  ).toHaveCount(0);
  expect(backend.privateReads).toBe(0);
});
test("principal users can open administration and the API rejects cross-origin invitations", async ({
  page,
  context,
}) => {
  await fixture(context, {
    state: emptyHouseholdState(),
    revision: 0,
    privateReads: 0,
  });
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill("juan@example.test");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("Local-fixture-password");
  await page.getByRole("button", { name: "Entrar a casa" }).click();
  await page.getByRole("button", { name: "Abrir navegación" }).click();
  await page
    .getByRole("button", { name: "Usuarios y permisos", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Invitar a un colaborador" }),
  ).toBeVisible();
  await expect(
    page.getByText("Administrador principal", { exact: true }),
  ).toHaveCount(2);
  const denied = await page.request.post("/api/admin/invitations", {
    headers: { Origin: "https://untrusted.example" },
    data: {},
  });
  expect(denied.status()).toBe(403);
});

test("administrator imports a prepared maintenance file privately and refuses fabricated history", async ({
  page,
  context,
}) => {
  const backend = {
    state: emptyHouseholdState(),
    revision: 0,
    privateReads: 0,
  };
  await fixture(context, backend);
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(users[0].email);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("local-fixture-password");
  await page.getByRole("button", { name: "Entrar a casa" }).click();
  await page.getByRole("button", { name: "Abrir navegación" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Casa", exact: true })
    .click();
  const { demoMaintenance } = await import("../../lib/maintenance");
  const prepared = demoMaintenance();
  await page
    .getByLabel("Archivo de mantenimiento preparado")
    .setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({ ...prepared, history: [{ id: "fabricated" }] }),
      ),
    });
  await expect(page.getByRole("status")).toContainText("No se importó nada");
  expect(backend.state.maintenance.plans).toHaveLength(0);
  await page
    .getByLabel("Archivo de mantenimiento preparado")
    .setInputFiles({
      name: "prepared.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(prepared)),
    });
  await page
    .getByRole("button", { name: "Confirmar importación privada" })
    .click();
  await expect.poll(() => backend.state.maintenance.plans.length).toBe(8);
  expect(backend.state.maintenance.history).toHaveLength(0);
  expect(
    backend.state.maintenance.plans.every(
      (p) => p.status === "draft" && p.assigneeId === "",
    ),
  ).toBeTruthy();
});
