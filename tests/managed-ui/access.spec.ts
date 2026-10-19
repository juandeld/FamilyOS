// Browser contracts use intercepted HTTP fixtures. Google/provider setup and
// hosted Supabase authorization are verified separately; no real email is sent.
import {
  test,
  expect,
  type BrowserContext,
  type Route,
} from "@playwright/test";
import { emptyHouseholdState } from "../../lib/state";
const home = "00000000-0000-4000-8000-000000000101";
const admin = "00000000-0000-4000-8000-000000000111";
const staff = "00000000-0000-4000-8000-000000000112";
type Account = {
  id: string;
  userId: string;
  username: string;
  name: string;
  status: string;
};
function user(id: string) {
  return {
    id,
    email:
      id === admin ? "admin@example.test" : "fixture@staff.familyos.invalid",
    aud: "authenticated",
    role: "authenticated",
    created_at: "2026-10-19T00:00:00Z",
    app_metadata: {
      provider: id === admin ? "google" : "email",
      providers: id === admin ? ["google"] : ["email"],
    },
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
      amr: [
        {
          method: id === admin ? "oauth" : "password",
          timestamp: Math.floor(Date.now() / 1000),
        },
      ],
    }),
  ).toString("base64url");
  return {
    access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.${Buffer.from("local-fixture-signature").toString("base64url")}`,
    refresh_token: "local-fixture-not-real",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: user(id),
  };
}
function member(id: string) {
  return {
    household_id: home,
    user_id: id,
    display_name: id === admin ? "Administrador de prueba" : "Rosa Demo",
    role: id === admin ? "admin" : "collaborator",
    active: true,
    is_principal: id === admin,
    permissions: id === admin ? [] : ["kitchen.read", "tasks.read"],
  };
}
async function json(route: Route, value: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(value),
  });
}
async function fixture(
  context: BrowserContext,
  options: { google?: boolean; claimAllowed?: boolean } = {},
) {
  const backend = { privateReads: 0, claimCalls: 0, accounts: [] as Account[] };
  await context.route("https://familyos-test.supabase.co/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    let id = admin;
    try {
      id =
        JSON.parse(
          Buffer.from(
            (request.headers().authorization || "").split(".")[1],
            "base64url",
          ).toString(),
        ).sub || admin;
    } catch {}
    if (url.pathname.startsWith("/rest/v1/")) {
      expect(
        request.headers()[
          ["GET", "HEAD"].includes(request.method())
            ? "accept-profile"
            : "content-profile"
        ],
      ).toBe("familyos");
    }
    if (url.pathname === "/auth/v1/settings")
      return json(route, { external: { google: options.google ?? true } });
    if (url.pathname === "/auth/v1/user") return json(route, user(id));
    if (url.pathname === "/auth/v1/token") return json(route, session(id));
    if (url.pathname === "/auth/v1/logout") {
      expect(url.searchParams.get("scope")).toBe("local");
      return route.fulfill({ status: 204 });
    }
    if (url.pathname === "/auth/v1/authorize")
      return route.fulfill({
        status: 200,
        contentType: "text/plain",
        body: "Local OAuth authorization fixture. No Google connection.",
      });
    if (url.pathname === "/rest/v1/rpc/accept_my_invitations")
      return json(route, 0);
    if (url.pathname === "/rest/v1/rpc/household_session_allowed")
      return json(route, true);
    if (url.pathname === "/rest/v1/rpc/is_household_admin")
      return json(route, id === admin);
    if (url.pathname === "/rest/v1/rpc/claim_google_principal") {
      backend.claimCalls++;
      return options.claimAllowed === false
        ? json(route, { code: "42501", message: "Forbidden" }, 403)
        : json(route, 1);
    }
    if (url.pathname === "/rest/v1/household_members")
      return json(
        route,
        url.searchParams.has("user_id")
          ? [member(id)]
          : [member(admin), ...backend.accounts.map(() => member(staff))],
      );
    if (url.pathname === "/rest/v1/household_invitations")
      return json(route, []);
    if (url.pathname === "/rest/v1/household_state") {
      backend.privateReads++;
      return json(route, { data: emptyHouseholdState(), revision: 0 });
    }
    if (url.pathname === "/rest/v1/rpc/get_collaborator_workspace")
      return json(route, {
        revision: 0,
        plan: [],
        tasks: [
          {
            id: "assigned",
            title: "Preparar cocina",
            frequency: "Diaria",
            done: false,
          },
        ],
      });
    if (url.pathname === "/rest/v1/rpc/get_maintenance_tasks")
      return json(route, []);
    return json(route, { error: "Unexpected local fixture request" }, 500);
  });
  await context.route("**/api/admin/staff?**", (route) =>
    json(route, { accounts: backend.accounts }),
  );
  return backend;
}
async function seed(context: BrowserContext, id: string) {
  await context.addInitScript(
    (value) =>
      localStorage.setItem("familyos-auth-session", JSON.stringify(value)),
    session(id),
  );
}
async function usersPage(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Abrir navegación" }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Usuarios y permisos", exact: true })
    .click();
}

test("Google is staged honestly and current administrator access remains available", async ({
  page,
  context,
}) => {
  await fixture(context, { google: false });
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "Continuar con Google" }),
  ).toBeDisabled();
  await expect(
    page.getByText("Estamos preparando el acceso con Google.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Correo electrónico")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Acceso anterior", exact: true })
    .click();
  await expect(page.getByLabel("Correo electrónico")).toBeVisible();
  await page.getByRole("button", { name: "Volver a Google y equipo" }).click();
  await expect(page.getByLabel("Correo electrónico")).toHaveCount(0);
});

test("administrator Google action uses provider and PKCE callback without a public signup", async ({
  page,
  context,
}) => {
  await fixture(context);
  await page.goto("/login");
  await page.getByRole("button", { name: "Continuar con Google" }).click();
  await page.waitForURL(/familyos-test\.supabase\.co\/auth\/v1\/authorize/);
  const url = new URL(page.url());
  expect(url.searchParams.get("provider")).toBe("google");
  expect(url.searchParams.get("redirect_to")).toBe(
    "http://127.0.0.1:3003/auth/google",
  );
  expect(url.searchParams.get("code_challenge_method")).toBe("s256");
  expect(url.searchParams.get("code_challenge")).toBeTruthy();
});

test("staff uses username only, receives generic failures and retains a private operational session after reload", async ({
  page,
  context,
}) => {
  const backend = await fixture(context);
  const attempts: Record<string, unknown>[] = [];
  await context.route("**/api/auth/staff", async (route) => {
    const body = route.request().postDataJSON();
    attempts.push(body);
    return attempts.length === 1
      ? json(
          route,
          {
            error: "No se pudo iniciar sesión. Revisa tu usuario y contraseña.",
          },
          401,
        )
      : json(route, { session: session(staff) });
  });
  await page.goto("/login");
  await page
    .getByRole("button", { name: "Equipo de casa", exact: true })
    .click();
  await expect(page.getByLabel("Correo electrónico")).toHaveCount(0);
  await page.getByLabel("Usuario", { exact: true }).fill("Rosa.Demo");
  await page.getByLabel("Contraseña del equipo").fill("fixture-staff-password");
  await page.getByRole("button", { name: "Entrar al equipo" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Revisa tu usuario y contraseña",
  );
  await expect(
    page.getByRole("heading", { name: "Hola, Rosa Demo." }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Entrar al equipo" }).click();
  await expect(
    page.getByRole("heading", { name: "Hola, Rosa Demo." }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByRole("checkbox", { name: /Preparar cocina/ }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Hola, Rosa Demo." }),
  ).toBeVisible({ timeout: 15000 });
  expect(attempts.map((a) => a.username)).toEqual(["rosa.demo", "rosa.demo"]);
  expect(attempts.every((a) => !("email" in a))).toBeTruthy();
  expect(backend.privateReads).toBe(0);
});

test("unapproved Google session cannot enter the house or choose a password", async ({
  page,
  context,
}) => {
  const backend = await fixture(context, { claimAllowed: false });
  await seed(context, admin);
  await page.goto("/auth/google");
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "No se pudo confirmar un acceso administrativo",
  );
  expect(backend.claimCalls).toBe(1);
  expect(backend.privateReads).toBe(0);
  await expect(
    page.getByLabel("Nueva contraseña", { exact: true }),
  ).toHaveCount(0);
  await expect(page).toHaveURL(/\/auth\/google$/);
});

test("administrator creates and resets staff without email; failed creation stays pending and retry preserves its operation", async ({
  page,
  context,
}) => {
  const backend = await fixture(context);
  await seed(context, admin);
  const creates: Record<string, unknown>[] = [];
  const resets: Record<string, unknown>[] = [];
  await context.route("**/api/admin/staff", async (route) => {
    if (route.request().method() !== "POST")
      return json(route, { accounts: backend.accounts });
    const body = route.request().postDataJSON();
    creates.push(body);
    if (creates.length === 1)
      return json(
        route,
        {
          error:
            "No se pudo confirmar la creación. Puedes volver a intentarlo.",
        },
        503,
      );
    backend.accounts = [
      {
        id: body.id,
        userId: staff,
        username: body.username,
        name: body.name,
        status: "active",
      },
    ];
    return json(route, { created: true, account: backend.accounts[0] }, 201);
  });
  await context.route("**/api/admin/staff/reset", async (route) => {
    resets.push(route.request().postDataJSON());
    return json(route, { reset: true });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Hoy en casa", exact: true }),
  ).toBeVisible();
  await usersPage(page);
  const create = page.getByRole("region", {
    name: "Crear acceso del personal",
  });
  await expect(
    page.getByRole("heading", { name: "Invitar a un colaborador" }),
  ).toHaveCount(0);
  await expect(create.getByLabel("Correo electrónico")).toHaveCount(0);
  await create.getByLabel("Nombre del colaborador").fill("Rosa Demo");
  await create.getByLabel("Nombre de usuario").fill("Rosa.Demo");
  await create
    .getByLabel("Contraseña inicial")
    .fill("fixture-initial-password");
  await create.getByRole("button", { name: "Cocina", exact: true }).click();
  await create
    .getByRole("button", { name: "Crear usuario", exact: true })
    .click();
  await expect(create.getByRole("status")).toContainText(
    "No se pudo confirmar la creación",
  );
  await expect(
    page.getByRole("region", { name: "Accesos sin correo" }),
  ).not.toContainText("Usuario: rosa.demo");
  await create
    .getByRole("button", { name: "Crear usuario", exact: true })
    .click();
  await expect(create.getByRole("status")).toContainText("Usuario creado.");
  await expect(create.getByLabel("Contraseña inicial")).toHaveValue("");
  expect(creates).toHaveLength(2);
  expect(creates[0].id).toBe(creates[1].id);
  expect(creates[1].permissions).toContain("kitchen.read");
  expect(creates.every((a) => !("email" in a))).toBeTruthy();
  await page
    .getByRole("button", { name: "Restablecer contraseña de rosa.demo" })
    .click();
  await page
    .getByLabel("Nueva contraseña para rosa.demo")
    .fill("fixture-replacement-password");
  await page.getByRole("button", { name: "Guardar nueva contraseña" }).click();
  await expect(create.getByRole("status")).toContainText(
    "Las sesiones anteriores ya no tendrán acceso",
  );
  expect(resets).toHaveLength(1);
  expect(resets[0].userId).toBe(staff);
  expect(resets[0].householdId).toBe(home);
  expect("email" in resets[0]).toBeFalsy();
  await expect(page.getByLabel("Nueva contraseña para rosa.demo")).toHaveCount(
    0,
  );
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  }
});

test("approved Google administrator enters the household without a password setup detour", async ({
  page,
  context,
}) => {
  const backend = await fixture(context);
  await seed(context, admin);
  await page.goto("/auth/google");
  await expect(
    page.getByRole("heading", { name: "Hoy en casa", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  expect(backend.claimCalls).toBe(1);
  expect(backend.privateReads).toBeGreaterThan(0);
  await expect(
    page.getByLabel("Nueva contraseña", { exact: true }),
  ).toHaveCount(0);
  await expect(page).toHaveURL("http://127.0.0.1:3003/");
});
