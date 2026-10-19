import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const accountId = "b0000000-0000-4000-8000-000000000001";
const staffSession = "c0000000-0000-4000-8000-000000000001";
const nextStaffSession = "c0000000-0000-4000-8000-000000000002";
const preActivationSession = "c0000000-0000-4000-8000-000000000003";

test("managed access separates Google principals from staff logins without personal email", async (t) => {
  const db = new PGlite();
  const rows = async <
    T extends Record<string, unknown> = Record<string, unknown>,
  >(
    sql: string,
    params: unknown[] = [],
  ) => (await db.query<T>(sql, params)).rows;
  async function asUser<T>(
    n: number,
    claims: Record<string, unknown>,
    run: () => Promise<T>,
  ) {
    await db.exec("set role authenticated");
    await db.query(
      "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
      [uid(n), JSON.stringify({ sub: uid(n), ...claims })],
    );
    try {
      return await run();
    } finally {
      await db.exec("reset role");
    }
  }
  async function service<T>(run: () => Promise<T>) {
    await db.exec("set role service_role");
    try {
      return await run();
    } finally {
      await db.exec("reset role");
    }
  }
  const oauth = { amr: [{ method: "oauth", timestamp: 1790000000 }] };
  const password = { amr: [{ method: "password", timestamp: 1790000000 }] };
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_app_meta_data jsonb not null default '{}');
      create table auth.identities(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),provider text not null,identity_data jsonb not null);
      create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id),created_at timestamptz not null default now());
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid; $$;
      grant usage on schema auth,public to anon,authenticated,service_role;
      grant execute on function auth.uid() to anon,authenticated,service_role;
    `);
    await db.exec(readFileSync("supabase/shared-setup.sql", "utf8"));
    for (let n = 1; n <= 8; n++) {
      await db.query(
        "insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)",
        [
          uid(n),
          n === 5
            ? `${accountId}@staff.familyos.invalid`
            : `managed${n}@example.test`,
          n === 7 ? null : "2026-01-01T00:00:00Z",
        ],
      );
    }
    await db.query("update auth.users set raw_app_meta_data=$1 where id=$2", [
      { familyos_managed: true },
      uid(5),
    ]);
    await db.query(
      "insert into auth.sessions(id,user_id,created_at) values($1,$2,clock_timestamp()-interval '1 minute')",
      [preActivationSession, uid(5)],
    );
    for (const n of [3, 4, 7]) {
      await db.query(
        "insert into auth.identities(user_id,provider,identity_data) values($1,'google',$2)",
        [uid(n), { email: `managed${n}@example.test`, email_verified: true }],
      );
    }
    const h1 = (
      await rows<{ id: string }>(
        "select familyos.bootstrap_household('managed1@example.test','managed2@example.test') id",
      )
    )[0].id;
    const h2 = (
      await rows<{ id: string }>(
        "select familyos.bootstrap_household('managed6@example.test','managed8@example.test') id",
      )
    )[0].id;
    await db.query(
      "update familyos.household_state set data=$1 where household_id=$2",
      [
        {
          goals: { Juan: { protein: 9999 } },
          staffMemories: [{ text: "PRIVATE_MEMORY" }],
          tasks: [
            {
              id: "staff-task",
              title: "Preparar cocina",
              assigneeId: uid(5),
              done: false,
            },
          ],
        },
        h1,
      ],
    );
    await db.query(
      "insert into familyos.medical_records(household_id,person_id,payload) select $1,id,'{\"private\":true}' from familyos.family_people where household_id=$1 and name='Juan'",
      [h1],
    );

    await t.test(
      "registry, approvals and rate limits are service-only; staff identities are opaque and passwords are absent",
      async () => {
        for (const table of [
          "managed_staff_accounts",
          "google_admin_approvals",
          "login_rate_limits",
        ]) {
          await asUser(1, password, async () =>
            assert.rejects(
              () => rows(`select * from familyos.${table}`),
              /permission denied/,
            ),
          );
        }
        await db.exec("set role anon");
        await assert.rejects(
          () => rows("select * from familyos.managed_staff_accounts"),
          /permission denied/,
        );
        await assert.rejects(
          () =>
            rows(
              "select familyos.consume_login_attempt('ip:opaquehash',10,900)",
            ),
          /permission denied/,
        );
        await db.exec("reset role");
        const columns = (
          await rows<{ column_name: string }>(
            "select column_name from information_schema.columns where table_schema='familyos' and table_name='managed_staff_accounts'",
          )
        ).map((r) => r.column_name);
        assert.ok(!columns.some((c) => /password|email|secret/.test(c)));
        await service(async () => {
          await db.query(
            "insert into familyos.managed_staff_accounts(id,household_id,username,display_name,permissions,created_by,sessions_valid_after) values($1,$2,'rosa.demo','Rosa Demo',array['tasks.read','tasks.update'],$3,clock_timestamp()-interval '2 minutes')",
            [accountId, h1, uid(1)],
          );
          assert.equal(
            (
              await rows("select familyos.resolve_managed_auth_user($1) id", [
                accountId,
              ])
            )[0].id,
            uid(5),
          );
          await assert.rejects(
            () =>
              db.query(
                "insert into familyos.managed_staff_accounts(id,household_id,username,display_name,created_by) values($1,$2,'ROSA','Invalid',$3)",
                [uid(100), h1, uid(1)],
              ),
            /check constraint/,
          );
        });
        await asUser(1, password, async () =>
          assert.rejects(
            () =>
              rows("select familyos.resolve_managed_auth_user($1)", [
                accountId,
              ]),
            /permission denied/,
          ),
        );
      },
    );

    await t.test(
      "provisioning is finalized atomically, cannot attach another identity, and retries do not duplicate audit or reactivate",
      async () => {
        await service(async () => {
          await assert.rejects(
            () =>
              rows("select familyos.finalize_managed_staff_account($1,$2)", [
                accountId,
                uid(2),
              ]),
            /identity does not match/,
          );
          await rows("select familyos.finalize_managed_staff_account($1,$2)", [
            accountId,
            uid(5),
          ]);
          assert.equal(
            (
              await rows(
                "select status,user_id from familyos.managed_staff_accounts where id=$1",
                [accountId],
              )
            )[0].status,
            "active",
          );
          assert.equal(
            (
              await rows(
                "select role,is_principal from familyos.household_members where household_id=$1 and user_id=$2",
                [h1, uid(5)],
              )
            )[0].role,
            "collaborator",
          );
          await db.query(
            "update familyos.household_members set active=false where household_id=$1 and user_id=$2",
            [h1, uid(5)],
          );
          await rows("select familyos.finalize_managed_staff_account($1,$2)", [
            accountId,
            uid(5),
          ]);
          // Recovery after an uncertain response must preserve deactivation and
          // must not count the same account as a second creation.
          await db.query(
            "update familyos.managed_staff_accounts set status='failed' where id=$1",
            [accountId],
          );
          await rows("select familyos.finalize_managed_staff_account($1,$2)", [
            accountId,
            uid(5),
          ]);
          assert.equal(
            (
              await rows(
                "select active from familyos.household_members where household_id=$1 and user_id=$2",
                [h1, uid(5)],
              )
            )[0].active,
            false,
          );
        });
        assert.equal(
          Number(
            (
              await rows(
                "select count(*) n from familyos.audit_events where action='staff.created'",
              )
            )[0].n,
          ),
          1,
        );
        await db.query(
          "update familyos.household_members set active=true where household_id=$1 and user_id=$2",
          [h1, uid(5)],
        );
        await asUser(
          5,
          { ...password, session_id: preActivationSession },
          async () =>
            assert.equal(
              (
                await rows(
                  "select familyos.household_session_allowed($1) allowed",
                  [h1],
                )
              )[0].allowed,
              false,
            ),
        );
        await db.query(
          "insert into auth.sessions(id,user_id,created_at) values($1,$2,clock_timestamp())",
          [staffSession, uid(5)],
        );
        await asUser(5, { ...password, session_id: staffSession }, async () => {
          assert.equal(
            (
              await rows(
                "select familyos.household_session_allowed($1) allowed",
                [h1],
              )
            )[0].allowed,
            true,
          );
          assert.deepEqual(
            await rows("select * from familyos.household_state"),
            [],
          );
          assert.deepEqual(
            await rows("select * from familyos.recipe_nutrition"),
            [],
          );
          const workspace = (
            await rows("select familyos.get_collaborator_workspace($1) data", [
              h1,
            ])
          )[0].data;
          assert.ok(!JSON.stringify(workspace).includes("PRIVATE"));
          assert.equal((workspace as { tasks: unknown[] }).tasks.length, 1);
        });
        await asUser(
          5,
          { ...password, session_id: "malformed-session" },
          async () =>
            assert.equal(
              (
                await rows(
                  "select familyos.household_session_allowed($1) allowed",
                  [h1],
                )
              )[0].allowed,
              false,
            ),
        );
      },
    );

    await t.test(
      "password reset immediately blocks old JWTs, preserves concurrent deactivation, and admits only new sessions",
      async () => {
        await service(async () => {
          assert.equal(
            (
              await rows(
                "select familyos.begin_managed_password_reset($1) was_active",
                [accountId],
              )
            )[0].was_active,
            true,
          );
          await assert.rejects(
            () =>
              rows("select familyos.begin_managed_password_reset($1)", [
                accountId,
              ]),
            /operation conflicts/,
          );
        });
        await asUser(5, { ...password, session_id: staffSession }, async () => {
          assert.equal(
            (
              await rows(
                "select familyos.household_session_allowed($1) allowed",
                [h1],
              )
            )[0].allowed,
            false,
          );
          await assert.rejects(
            () =>
              rows("select familyos.set_my_task_done($1,'staff-task',true)", [
                h1,
              ]),
            /Forbidden/,
          );
        });
        await db.query(
          "update familyos.household_members set active=false where household_id=$1 and user_id=$2",
          [h1, uid(5)],
        );
        await service(async () => {
          await assert.rejects(
            () =>
              rows("select familyos.finish_managed_password_reset($1,$2)", [
                accountId,
                uid(5),
              ]),
            /administrator no longer has access/,
          );
          await rows("select familyos.finish_managed_password_reset($1,$2)", [
            accountId,
            uid(1),
          ]);
          assert.equal(
            (
              await rows(
                "select active from familyos.household_members where household_id=$1 and user_id=$2",
                [h1, uid(5)],
              )
            )[0].active,
            false,
          );
        });
        await db.query(
          "update familyos.household_members set active=true where household_id=$1 and user_id=$2",
          [h1, uid(5)],
        );
        await asUser(5, { ...password, session_id: staffSession }, async () =>
          assert.equal(
            (
              await rows(
                "select familyos.household_session_allowed($1) allowed",
                [h1],
              )
            )[0].allowed,
            false,
          ),
        );
        await db.query(
          "insert into auth.sessions(id,user_id,created_at) values($1,$2,clock_timestamp())",
          [nextStaffSession, uid(5)],
        );
        await asUser(
          5,
          { ...password, session_id: nextStaffSession },
          async () =>
            assert.equal(
              (
                await rows(
                  "select familyos.household_session_allowed($1) allowed",
                  [h1],
                )
              )[0].allowed,
              true,
            ),
        );
        assert.equal(
          Number(
            (
              await rows(
                "select count(*) n from familyos.audit_events where action='staff.password_reset' and actor_id=$1",
                [uid(1)],
              )
            )[0].n,
          ),
          1,
        );
        await asUser(1, password, async () =>
          assert.rejects(
            () =>
              rows("select familyos.begin_managed_password_reset($1)", [
                accountId,
              ]),
            /permission denied/,
          ),
        );
      },
    );

    await t.test(
      "persistent rate limits count atomically, deny excess attempts, reset by window and cannot be bypassed by clients",
      async () => {
        await service(async () => {
          const allowed = [];
          for (let n = 0; n < 5; n++)
            allowed.push(
              (
                await rows(
                  "select familyos.consume_login_attempt('user:hashed-demo',3,900) allowed",
                )
              )[0].allowed,
            );
          assert.deepEqual(allowed, [true, true, true, false, false]);
          await assert.rejects(
            () =>
              rows(
                "select familyos.consume_login_attempt('user:hashed-demo',0,900)",
              ),
            /Invalid limiter/,
          );
        });
        await db.exec(
          "update familyos.login_rate_limits set window_start=clock_timestamp()-interval '16 minutes' where key_hash='user:hashed-demo'",
        );
        await service(async () =>
          assert.equal(
            (
              await rows(
                "select familyos.consume_login_attempt('user:hashed-demo',3,900) allowed",
              )
            )[0].allowed,
            true,
          ),
        );
        await asUser(5, password, async () =>
          assert.rejects(
            () =>
              rows(
                "select familyos.consume_login_attempt('user:hashed-demo',200,1)",
              ),
            /permission denied/,
          ),
        );
      },
    );

    await t.test(
      "Google principal activation requires OAuth, a matching verified Google identity and a preapproved email",
      async () => {
        await db.query(
          "insert into familyos.google_admin_approvals(household_id,email,legacy_user_id) values($1,'managed3@example.test',$2)",
          [h1, uid(1)],
        );
        await asUser(1, password, async () =>
          assert.equal(
            (
              await rows("select familyos.is_household_admin($1) allowed", [h1])
            )[0].allowed,
            true,
          ),
        );
        await asUser(3, password, async () =>
          assert.rejects(
            () => rows("select familyos.claim_google_principal()"),
            /Verified Google session required/,
          ),
        );
        await asUser(7, oauth, async () =>
          assert.rejects(
            () => rows("select familyos.claim_google_principal()"),
            /Verified Google session required/,
          ),
        );
        await asUser(4, oauth, async () => {
          assert.equal(
            (await rows("select familyos.claim_google_principal() n"))[0].n,
            0,
          );
          assert.deepEqual(
            await rows("select * from familyos.household_state"),
            [],
          );
        });
        await db.query(
          "insert into auth.identities(user_id,provider,identity_data) values($1,'github','{}')",
          [uid(3)],
        );
        await asUser(3, oauth, async () =>
          assert.rejects(
            () => rows("select familyos.claim_google_principal()"),
            /Verified Google session required/,
          ),
        );
        await db.query(
          "delete from auth.identities where user_id=$1 and provider='github'",
          [uid(3)],
        );
        await db.query(
          "update auth.identities set identity_data=identity_data||'{\"email_verified\":false}' where user_id=$1 and provider='google'",
          [uid(3)],
        );
        await asUser(3, oauth, async () =>
          assert.rejects(
            () => rows("select familyos.claim_google_principal()"),
            /Verified Google session required/,
          ),
        );
        await db.query(
          "update auth.identities set identity_data=identity_data||'{\"email_verified\":true}' where user_id=$1 and provider='google'",
          [uid(3)],
        );
        await asUser(3, oauth, async () => {
          assert.equal(
            (await rows("select familyos.claim_google_principal() n"))[0].n,
            1,
          );
          assert.equal(
            (await rows("select familyos.claim_google_principal() n"))[0].n,
            0,
          );
          assert.equal(
            (
              await rows("select familyos.is_household_admin($1) allowed", [h1])
            )[0].allowed,
            true,
          );
          assert.equal(
            (await rows("select * from familyos.household_state")).length,
            1,
          );
        });
        assert.equal(
          (
            await rows(
              "select google_admin_required from familyos.households where id=$1",
              [h1],
            )
          )[0].google_admin_required,
          true,
        );
        assert.equal(
          (
            await rows(
              "select user_id from familyos.family_people where household_id=$1 and name='Juan'",
              [h1],
            )
          )[0].user_id,
          uid(3),
        );
        assert.equal(
          (
            await rows(
              "select active from familyos.household_members where household_id=$1 and user_id=$2",
              [h1, uid(1)],
            )
          )[0].active,
          false,
        );
        assert.equal(
          Number(
            (
              await rows(
                "select count(*) n from familyos.audit_events where action='principal.google_activated'",
              )
            )[0].n,
          ),
          1,
        );
      },
    );

    await t.test(
      "Google-required households reject password sessions in every private and recipe policy while preserving other homes",
      async () => {
        await asUser(3, password, async () => {
          assert.equal(
            (
              await rows("select familyos.is_household_admin($1) allowed", [h1])
            )[0].allowed,
            false,
          );
          assert.equal(
            (
              await rows("select familyos.is_household_member($1) allowed", [
                h1,
              ])
            )[0].allowed,
            false,
          );
          assert.equal(
            (
              await rows(
                "select familyos.has_household_permission($1,'kitchen.read') allowed",
                [h1],
              )
            )[0].allowed,
            false,
          );
          assert.deepEqual(
            await rows("select * from familyos.household_state"),
            [],
          );
          assert.deepEqual(
            await rows("select * from familyos.recipe_nutrition"),
            [],
          );
          assert.deepEqual(await rows("select * from familyos.recipes"), []);
          await assert.rejects(
            () => rows("select familyos.save_household_state($1,0,'{}')", [h1]),
            /Forbidden/,
          );
        });
        await asUser(1, password, async () =>
          assert.deepEqual(
            await rows("select * from familyos.household_state"),
            [],
          ),
        );
        await asUser(6, password, async () =>
          assert.equal(
            (
              await rows("select familyos.is_household_admin($1) allowed", [h2])
            )[0].allowed,
            true,
          ),
        );
        await asUser(
          5,
          { ...password, session_id: nextStaffSession },
          async () => {
            assert.equal(
              (
                await rows(
                  "select familyos.household_session_allowed($1) allowed",
                  [h1],
                )
              )[0].allowed,
              true,
            );
            await assert.rejects(
              () =>
                rows(
                  "select familyos.manage_household_member($1,$2,false,'{}')",
                  [h1, uid(3)],
                ),
              /Forbidden/,
            );
          },
        );
        await asUser(3, oauth, async () =>
          assert.rejects(
            () =>
              rows(
                "select familyos.manage_household_member($1,$2,false,'{}')",
                [h1, uid(2)],
              ),
            /Principal administrators cannot be changed/,
          ),
        );
      },
    );

    await t.test(
      "inactive, failed or malformed sessions stay denied and no client can alter Google approvals or identities",
      async () => {
        await asUser(3, oauth, async () => {
          await assert.rejects(
            () =>
              rows(
                "insert into familyos.google_admin_approvals(household_id,email) values($1,'attacker@example.test')",
                [h1],
              ),
            /permission denied/,
          );
          await assert.rejects(
            () =>
              rows("select familyos.finalize_managed_staff_account($1,$2)", [
                accountId,
                uid(5),
              ]),
            /permission denied/,
          );
          assert.deepEqual(
            await rows("select * from familyos.person_access"),
            [],
          );
          await assert.rejects(
            () => rows("select * from familyos.medical_records"),
            /permission denied/,
          );
        });
        await db.query(
          "update familyos.managed_staff_accounts set status='failed' where id=$1",
          [accountId],
        );
        await asUser(
          5,
          { ...password, session_id: nextStaffSession },
          async () =>
            assert.equal(
              (
                await rows(
                  "select familyos.household_session_allowed($1) allowed",
                  [h1],
                )
              )[0].allowed,
              false,
            ),
        );
        await db.query(
          "update familyos.managed_staff_accounts set status='active' where id=$1",
          [accountId],
        );
        await db.query(
          "update familyos.household_members set active=false where household_id=$1 and user_id=$2",
          [h1, uid(5)],
        );
        await asUser(
          5,
          { ...password, session_id: nextStaffSession },
          async () =>
            assert.equal(
              (
                await rows(
                  "select familyos.household_session_allowed($1) allowed",
                  [h1],
                )
              )[0].allowed,
              false,
            ),
        );
        await asUser(3, { amr: "oauth" }, async () =>
          assert.equal(
            (
              await rows(
                "select familyos.household_session_allowed($1) allowed",
                [h1],
              )
            )[0].allowed,
            false,
          ),
        );
      },
    );
  } finally {
    await db.close();
  }
});
