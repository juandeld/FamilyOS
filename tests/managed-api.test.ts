import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST as staffLogin } from "../app/api/auth/staff/route";
import { POST as createStaff, GET as listStaff } from "../app/api/admin/staff/route";
import { POST as resetStaff } from "../app/api/admin/staff/reset/route";
const home = "00000000-0000-4000-8000-000000000001";
const admin = "00000000-0000-4000-8000-000000000002";
const staff = "00000000-0000-4000-8000-000000000003";
const accountId = "00000000-0000-4000-8000-000000000004";
const origin = "https://familyos.example.test";
const password = "Local-fixture-password";
const account = {
  id: accountId, household_id: home, username: "rosa", display_name: "Rosa de prueba",
  permissions: ["tasks.read"], user_id: staff, status: "active", created_by: admin,
};
function request(path: string, body?: unknown, options: { origin?: string; authorization?: boolean; method?: string } = {}) {
  return new NextRequest(origin + path, {
    method: options.method || (body ? "POST" : "GET"),
    headers: {
      ...(body ? { "Content-Type": "application/json", Origin: options.origin || origin } : {}),
      ...(options.authorization === false ? {} : { Authorization: "Bearer local-test-token" }),
      "x-vercel-forwarded-for": "192.0.2.40",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}
function session() {
  const payload = Buffer.from(JSON.stringify({ sub: staff, aud: "authenticated", role: "authenticated", exp: Math.floor(Date.now()/1000)+3600 })).toString("base64url");
  return { access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.${Buffer.from('local-signature').toString('base64url')}`,
    refresh_token: "local-refresh", expires_in: 3600, token_type: "bearer", user: { id: staff, aud: "authenticated", role: "authenticated", email: `${accountId}@staff.familyos.invalid` } };
}
type Handler = (url: URL, init: RequestInit, headers: Headers, body: any) => Response | Promise<Response>;
async function withBackend(handler: Handler, run: () => Promise<void>) {
  const oldFetch = globalThis.fetch;
  const names = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SUPABASE_DB_SCHEMA"] as const;
  const before = Object.fromEntries(names.map(name => [name, process.env[name]]));
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://managed-test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "public-local-test-fixture";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "server-local-test-fixture";
  process.env.NEXT_PUBLIC_APP_URL = origin;
  process.env.NEXT_PUBLIC_SUPABASE_DB_SCHEMA = "familyos";
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url);
    assert.equal(url.origin, "https://managed-test.supabase.co");
    const headers = new Headers(init.headers);
    if (url.pathname.startsWith("/rest/v1/"))
      assert.equal(headers.get(["GET", "HEAD"].includes(init.method || "GET") ? "accept-profile" : "content-profile"), "familyos");
    const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
    return handler(url, init, headers, body);
  };
  try { await run(); }
  finally {
    globalThis.fetch = oldFetch;
    for (const name of names) {
      if (before[name] === undefined) delete process.env[name]; else process.env[name] = before[name];
    }
  }
}
function adminBase(url: URL) {
  if (url.pathname === "/auth/v1/user") return json({ id: admin, email: "admin@example.test", aud: "authenticated", role: "authenticated" });
  if (url.pathname === "/rest/v1/rpc/is_household_admin") return json(true);
  return null;
}
test("managed access endpoints protect creation, reset and username login", async t => {
  await t.test("cross-origin login and unauthorized administration cannot call privileged Auth", async () => {
    let calls = 0;
    await withBackend(url => {
      calls++;
      if (url.pathname === "/auth/v1/user") return json({ id: admin });
      if (url.pathname === "/rest/v1/rpc/is_household_admin") return json(false);
      throw new Error("Unexpected privileged access");
    }, async () => {
      const denied = await staffLogin(request("/api/auth/staff", { username: "rosa", password }, { origin: "https://untrusted.example", authorization: false }));
      assert.equal(denied.status, 403); assert.equal(calls, 0);
      const listing = await listStaff(request(`/api/admin/staff?householdId=${home}`));
      assert.equal(listing.status, 403); assert.equal(calls, 2);
    });
  });
  await t.test("persistent rate limiting fails closed before username lookup and hides account existence", async () => {
    let lookups = 0;
    let blocked = true;
    await withBackend((url, _init, _headers, body) => {
      if (url.pathname === "/rest/v1/rpc/consume_login_attempt") {
        assert.match(body.bucket, /^(ip|user):[a-f0-9]{64}$/);
        assert.ok(!body.bucket.includes("192.0.2.40") && !body.bucket.includes("rosa"));
        return json(!blocked);
      }
      if (url.pathname === "/rest/v1/managed_staff_accounts") { lookups++; return json(null); }
      throw new Error("Unexpected Auth login for unknown account");
    }, async () => {
      const limited = await staffLogin(request("/api/auth/staff", { username: " ROSA ", password }, { authorization: false }));
      assert.equal(limited.status, 429); assert.equal(limited.headers.get("Retry-After"), "900"); assert.equal(lookups, 0);
      blocked = false;
      const unknown = await staffLogin(request("/api/auth/staff", { username: "rosa", password }, { authorization: false }));
      assert.equal(unknown.status, 401); assert.equal(lookups, 1);
      assert.deepEqual(await unknown.json(), { error: "Usuario o contraseña incorrectos, o acceso desactivado." });
    });
  });
  await t.test("a normalized staff username logs in without personal email and gets only its verified session", async () => {
    let authCalls = 0;
    await withBackend((url, _init, _headers, body) => {
      if (url.pathname === "/rest/v1/rpc/consume_login_attempt") return json(true);
      if (url.pathname === "/rest/v1/managed_staff_accounts") { assert.equal(url.searchParams.get("username"), "eq.rosa"); return json(account); }
      if (url.pathname === "/rest/v1/household_members") return json({ role: "collaborator", active: true, is_principal: false });
      if (url.pathname === "/auth/v1/token") { authCalls++; assert.equal(body.email, `${accountId}@staff.familyos.invalid`); assert.equal(body.password, password); return json(session()); }
      if (url.pathname === "/rest/v1/rpc/household_session_allowed") { assert.equal(body.hid, home); return json(true); }
      throw new Error("Unexpected request");
    }, async () => {
      const result = await staffLogin(request("/api/auth/staff", { username: " ROSA ", password }, { authorization: false }));
      assert.equal(result.status, 200); assert.equal(authCalls, 1);
      const value = await result.json(); assert.equal(value.session.user.id, staff);
      assert.equal(result.headers.get("Cache-Control"), "no-store");
    });
  });
  await t.test("a disabled collaborator cannot get a new session", async () => {
    await withBackend(url => {
      if (url.pathname === "/rest/v1/rpc/consume_login_attempt") return json(true);
      if (url.pathname === "/rest/v1/managed_staff_accounts") return json(account);
      if (url.pathname === "/rest/v1/household_members") return json({ role: "collaborator", active: false, is_principal: false });
      throw new Error("Disabled account must not call Auth");
    }, async () => assert.equal((await staffLogin(request("/api/auth/staff", { username: "rosa", password }, { authorization: false }))).status, 401));
  });
  await t.test("creation is idempotent and responses never contain passwords or internal addresses", async () => {
    let authCreates = 0; let finalizations = 0; let row: any = null;
    await withBackend((url, init, _headers, body) => {
      const base = adminBase(url); if (base) return base;
      if (url.pathname === "/rest/v1/managed_staff_accounts") {
        if (init.method === "POST") { row = { ...account, ...body, user_id: null }; return new Response(null, { status: 201 }); }
        return json(row);
      }
      if (url.pathname === "/rest/v1/rpc/resolve_managed_auth_user") return json(null);
      if (url.pathname === "/auth/v1/admin/users") {
        authCreates++; assert.equal(body.email, `${accountId}@staff.familyos.invalid`);
        assert.equal(body.email_confirm, true); assert.equal(body.app_metadata.familyos_managed, true);
        return json({ id: staff });
      }
      if (url.pathname === "/rest/v1/rpc/finalize_managed_staff_account") { finalizations++; row = { ...row, user_id: staff, status: "active" }; return json(null); }
      throw new Error("Unexpected request");
    }, async () => {
      const payload = { householdId: home, id: accountId, name: "Rosa de prueba", username: "ROSA", password, permissions: ["tasks.read"] };
      const first = await createStaff(request("/api/admin/staff", payload)); assert.equal(first.status, 201);
      const body = await first.json(); assert.equal(body.account.userId, staff); assert.equal(body.created, true);
      assert.ok(!JSON.stringify(body).includes(password) && !JSON.stringify(body).includes("@staff.familyos.invalid"));
      const repeat = await createStaff(request("/api/admin/staff", payload)); assert.equal(repeat.status, 200); assert.equal((await repeat.json()).created, false);
      assert.equal(authCreates, 1); assert.equal(finalizations, 1);
    });
  });
  await t.test("uncertain provisioning is recoverable without creating duplicate identities or reporting false success", async () => {
    let row: any = null; let authUserExists = false; let authCreates = 0; let finalizeFails = true; let recoveredPassword: string | null = null;
    await withBackend((url, init, _headers, body) => {
      const base = adminBase(url); if (base) return base;
      if (url.pathname === "/rest/v1/managed_staff_accounts") {
        if (init.method === "POST") { row = { ...account, ...body, user_id: null }; return new Response(null, { status: 201 }); }
        if (init.method === "PATCH") { row.status = body.status; return new Response(null, {status:204}); }
        return json(row);
      }
      if (url.pathname === "/rest/v1/rpc/resolve_managed_auth_user") return json(authUserExists ? staff : null);
      if (url.pathname === "/auth/v1/admin/users") { authCreates++; authUserExists = true; return json({id:staff}); }
      if (url.pathname === `/auth/v1/admin/users/${staff}`) { recoveredPassword = body.password; return json({id:staff}); }
      if (url.pathname === "/rest/v1/rpc/finalize_managed_staff_account") {
        if (finalizeFails) return json({code:"XX000",message:"Temporary attach failure"},500);
        row = {...row,user_id:staff,status:"active"}; return json(null);
      }
      throw new Error("No deletes or emails should be sent during recovery");
    }, async () => {
      const payload = {householdId:home,id:accountId,name:"Rosa de prueba",username:"rosa",password,permissions:["tasks.read"]};
      const pending = await createStaff(request("/api/admin/staff",payload));
      assert.equal(pending.status,503); assert.equal(row.status,"failed");
      assert.equal((await pending.json()).created,undefined);
      finalizeFails = false;
      const replacementPassword = "A-new-local-fixture-password";
      const recovered = await createStaff(request("/api/admin/staff",{...payload,password:replacementPassword}));
      assert.equal(recovered.status,200); assert.equal((await recovered.json()).account.status,"active");
      assert.equal(authCreates,1); assert.equal(recoveredPassword,replacementPassword);
    });
  });
  await t.test("failed password reset cannot be replayed as creation to restore old permissions", async () => {
    await withBackend(url => {
      const base = adminBase(url); if (base) return base;
      if (url.pathname === "/rest/v1/managed_staff_accounts") return json({...account,status:"failed"});
      throw new Error("Existing collaborator must use password reset, without Auth or permission mutation");
    }, async () => {
      const result = await createStaff(request("/api/admin/staff",{householdId:home,id:accountId,name:"Rosa de prueba",username:"rosa",password,permissions:["tasks.read"]}));
      assert.equal(result.status,409);
    });
  });
  await t.test("password reset rejects principals before any Auth mutation", async () => {
    await withBackend(url => {
      const base = adminBase(url); if (base) return base;
      if (url.pathname === "/rest/v1/managed_staff_accounts") return json(account);
      if (url.pathname === "/rest/v1/household_members") return json({ role: "admin", active: true, is_principal: true });
      throw new Error("Principal password must not be changed by collaborator API");
    }, async () => {
      const result = await resetStaff(request("/api/admin/staff/reset", { householdId: home, userId: staff, password }));
      assert.equal(result.status, 403);
    });
  });
  await t.test("reset uses the database session epoch and a failed Auth change stays disabled", async () => {
    const calls: string[] = []; let fail = false;
    await withBackend((url, init, _headers, body) => {
      const base = adminBase(url); if (base) return base;
      calls.push(url.pathname + ":" + (init.method || "GET"));
      if (url.pathname === "/rest/v1/managed_staff_accounts") {
        if (init.method === "PATCH") { assert.equal(body.status, "failed"); return new Response(null, { status: 204 }); }
        return json(account);
      }
      if (url.pathname === "/rest/v1/household_members") {
        if (init.method === "PATCH") { assert.equal(body.active, false); return new Response(null, { status: 204 }); }
        return json({ role: "collaborator", active: true, is_principal: false });
      }
      if (url.pathname === "/rest/v1/rpc/begin_managed_password_reset") return json(true);
      if (url.pathname === `/auth/v1/admin/users/${staff}`) return fail ? json({ msg: "Provider unavailable" }, 503) : json({ id: staff });
      if (url.pathname === "/rest/v1/rpc/finish_managed_password_reset") { assert.equal(body.actor_id, admin); return json(null); }
      throw new Error("Unexpected request");
    }, async () => {
      const payload = { householdId: home, userId: staff, password };
      const good = await resetStaff(request("/api/admin/staff/reset", payload)); assert.equal(good.status, 200); assert.deepEqual(await good.json(), { reset: true });
      assert.ok(calls.indexOf("/rest/v1/rpc/begin_managed_password_reset:POST") < calls.indexOf(`/auth/v1/admin/users/${staff}:PUT`));
      fail = true; calls.length = 0;
      const bad = await resetStaff(request("/api/admin/staff/reset", payload)); assert.equal(bad.status, 502);
      assert.ok(calls.includes("/rest/v1/managed_staff_accounts:PATCH") && calls.includes("/rest/v1/household_members:PATCH"));
      assert.ok(!calls.includes("/rest/v1/rpc/finish_managed_password_reset:POST"));
    });
  });
});
