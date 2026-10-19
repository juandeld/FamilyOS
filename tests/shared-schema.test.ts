import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test("shared Supabase project preserves the other app and isolates FamilyOS", async (t) => {
  const db = new PGlite();
  const rows = async <
    T extends Record<string, unknown> = Record<string, unknown>,
  >(
    sql: string,
    params: unknown[] = [],
  ) => (await db.query<T>(sql, params)).rows;
  async function asUser<T>(n: number, fn: () => Promise<T>): Promise<T> {
    await db.exec("set role authenticated; set search_path=public,pg_temp");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      uid(n),
    ]);
    try {
      return await fn();
    } finally {
      await db.exec("reset role; reset search_path");
    }
  }
  async function otherAppSnapshot() {
    return {
      publicSchema: await rows(
        "select nspname,nspacl::text from pg_namespace where nspname='public'",
      ),
      tables: await rows(
        "select c.relname,c.relacl::text,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by c.relname",
      ),
      functions: await rows(
        "select p.proname,p.proacl::text,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by p.proname",
      ),
      policies: await rows(
        "select polname,polroles::text,pg_get_expr(polqual,polrelid) expression from pg_policy where polrelid='public.profiles'::regclass order by polname",
      ),
      profiles: await rows("select * from public.profiles order by id"),
      authUsers: await rows("select * from auth.users order by id"),
    };
  }

  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
      $$;
      grant usage on schema auth,public to anon,authenticated,service_role;
      grant execute on function auth.uid() to authenticated,service_role;
      grant create on schema public to public;

      create table public.profiles(id uuid primary key,payload jsonb not null);
      alter table public.profiles enable row level security;
      create policy other_app_own_profile on public.profiles for select to authenticated using(id=auth.uid());
      grant select on public.profiles to authenticated;
      create function public.is_household_admin(uuid) returns boolean language sql as $$select true$$;
      create function public.has_household_permission(uuid,text) returns boolean language sql as $$select true$$;
      create function public.save_household_state(uuid,bigint,jsonb) returns bigint language sql as $$select -999::bigint$$;
    `);
    for (let n = 1; n <= 6; n++) {
      await db.query("insert into auth.users values($1,$2,now())", [
        uid(n),
        `shared${n}@example.test`,
      ]);
    }
    await db.query("insert into public.profiles values($1,$2::jsonb)", [
      uid(1),
      JSON.stringify({ application: "UNRELATED_APP", preserved: true }),
    ]);
    const before = await otherAppSnapshot();
    await db.exec(readFileSync("supabase/shared-setup.sql", "utf8"));

    await t.test(
      "installs only in familyos without changing existing tables, functions, grants, policies or Auth identities",
      async () => {
        assert.deepEqual(await otherAppSnapshot(), before);
        const tables = await rows<{ relname: string; relrowsecurity: boolean }>(
          "select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='familyos' and c.relkind='r' order by c.relname",
        );
        assert.equal(tables.length, 10);
        assert.ok(tables.every((table) => table.relrowsecurity));
        assert.deepEqual(
          (
            await rows(
              "select tablename from pg_tables where schemaname='public' order by tablename",
            )
          ).map((table) => table.tablename),
          ["profiles"],
        );
        assert.equal(
          Number((await rows("select count(*) n from familyos.recipes"))[0].n),
          30,
        );
        await asUser(1, async () => {
          assert.deepEqual(await rows("select payload from public.profiles"), [
            { payload: { application: "UNRELATED_APP", preserved: true } },
          ]);
        });
        await asUser(6, async () => {
          assert.deepEqual(await rows("select * from public.profiles"), []);
        });
      },
    );

    const h1 = (
      await rows<{ id: string }>(
        "select familyos.bootstrap_household('shared1@example.test','shared2@example.test') id",
      )
    )[0].id;
    const h2 = (
      await rows<{ id: string }>(
        "select familyos.bootstrap_household('shared3@example.test','shared4@example.test') id",
      )
    )[0].id;
    await db.query(
      "insert into familyos.household_members(household_id,user_id,display_name,role,permissions) values($1,$2,'Equipo','collaborator',array['kitchen.read','tasks.read','tasks.update'])",
      [h1, uid(5)],
    );
    const state = {
      plan: { "Juan|Lunes|Almuerzo": "1-0" },
      goals: { Juan: { protein: 99123 } },
      staff: [{ id: "s1", note: "PRIVATE_STAFF_NOTE" }],
      staffMemories: [{ id: "m1", text: "PRIVATE_STAFF_MEMORY" }],
      notes: ["PRIVATE_HOUSEHOLD_NOTE"],
      history: [],
      stockPolicies: {},
      stockMovements: [],
      assets: [],
      tasks: [
        {
          id: "assigned",
          title: "Preparar cocina",
          assigneeId: uid(5),
          done: false,
        },
        {
          id: "private",
          title: "PRIVATE_ADMIN_TASK",
          assigneeId: uid(2),
          done: false,
        },
        {
          id: "maintenance:example:2026-01-01",
          title: "Inspección asignada",
          assigneeId: uid(5),
          done: false,
          instructions: "Revisar visualmente sin desmontar",
          dueDate: "2026-01-01",
          maintenance: { planId: "example", dueDate: "2026-01-01" },
        },
      ],
      maintenance: {
        plans: [],
        history: [],
        sourceName: "PRIVATE_MAINTENANCE_IMPORT",
        analysis: ["PRIVATE_PROVIDER_REFERENCE"],
      },
    };
    await db.query(
      "update familyos.household_state set data=$1::jsonb where household_id=$2",
      [JSON.stringify(state), h1],
    );

    await t.test(
      "both principal admins share changes and cannot overwrite a stale revision",
      async () => {
        await asUser(1, async () => {
          assert.equal(
            (await rows("select * from familyos.household_state")).length,
            1,
          );
          assert.equal(
            (
              await rows(
                "select familyos.save_household_state($1,0,$2::jsonb) revision",
                [
                  h1,
                  JSON.stringify({ ...state, notes: ["Juan shared change"] }),
                ],
              )
            )[0].revision,
            1,
          );
        });
        await asUser(2, async () => {
          const doc = (
            await rows<{ data: { notes: string[] }; revision: number }>(
              "select data,revision from familyos.household_state where household_id=$1",
              [h1],
            )
          )[0];
          assert.equal(doc.revision, 1);
          assert.deepEqual(doc.data.notes, ["Juan shared change"]);
          await assert.rejects(
            () => rows("select familyos.save_household_state($1,0,'{}')", [h1]),
            (error: unknown) => {
              assert.equal((error as {code: string}).code, "PT409");
              return true;
            },
          );
          assert.equal(
            (
              await rows(
                "select familyos.save_household_state($1,1,$2::jsonb) revision",
                [
                  h1,
                  JSON.stringify({ ...state, notes: ["Pamela shared change"] }),
                ],
              )
            )[0].revision,
            2,
          );
          await assert.rejects(
            () =>
              rows(
                "update familyos.household_state set data='{}' where household_id=$1",
                [h1],
              ),
            /permission denied/,
          );
        });
        await asUser(1, async () => {
          assert.deepEqual(
            (
              await rows<{ data: { notes: string[] } }>(
                "select data from familyos.household_state",
              )
            )[0].data.notes,
            ["Pamela shared change"],
          );
        });
      },
    );

    await t.test(
      "collaborators receive assigned operational snapshots and cannot read private state, targets, memories or other tasks",
      async () => {
        await asUser(5, async () => {
          for (const table of [
            "household_state",
            "recipe_nutrition",
            "family_people",
            "household_invitations",
            "audit_events",
          ]) {
            assert.deepEqual(
              await rows(`select * from familyos.${table}`),
              [],
              table,
            );
          }
          const data = (
            await rows<{ data: { plan: unknown[]; tasks: { id: string }[] } }>(
              "select familyos.get_collaborator_workspace($1) data",
              [h1],
            )
          )[0].data;
          assert.equal(data.plan.length, 1);
          assert.deepEqual(
            data.tasks.map((task) => task.id),
            ["assigned", "maintenance:example:2026-01-01"],
          );
          const maintenance = (
            await rows<{ data: { id: string; instructions: string }[] }>(
              "select familyos.get_maintenance_tasks($1) data",
              [h1],
            )
          )[0].data;
          assert.equal(maintenance.length, 1);
          assert.equal(
            maintenance[0].instructions,
            "Revisar visualmente sin desmontar",
          );
          const serialized = JSON.stringify({ data, maintenance });
          for (const marker of [
            "PRIVATE_",
            "99123",
            "goals",
            "macros",
            "staffMemories",
            "sourceName",
          ]) {
            assert.ok(!serialized.includes(marker), marker);
          }
          await assert.rejects(
            () => rows("select familyos.save_household_state($1,2,'{}')", [h1]),
            /Forbidden/,
          );
          await assert.rejects(
            () =>
              rows("select familyos.set_my_task_done($1,'private',true)", [h1]),
            /Forbidden/,
          );
          await rows("select familyos.set_my_task_done($1,'assigned',true)", [
            h1,
          ]);
        });
        const updated = (
          await rows<{
            data: { tasks: { id: string; done: boolean }[] };
            revision: number;
          }>(
            "select data,revision from familyos.household_state where household_id=$1",
            [h1],
          )
        )[0];
        assert.equal(updated.revision, 3);
        assert.deepEqual(
          updated.data.tasks.map((task) => [task.id, task.done]),
          [
            ["assigned", true],
            ["private", false],
            ["maintenance:example:2026-01-01", false],
          ],
        );
      },
    );

    await t.test(
      "another app Auth user and another household administrator cannot read or mutate this household",
      async () => {
        for (const n of [3, 5, 6]) {
          const inaccessible = n === 5 ? h2 : h1;
          await asUser(n, async () => {
            assert.deepEqual(
              await rows(
                "select * from familyos.household_state where household_id=$1",
                [inaccessible],
              ),
              [],
            );
            await assert.rejects(
              () =>
                rows("select familyos.save_household_state($1,3,'{}')", [
                  inaccessible,
                ]),
              /Forbidden/,
            );
            await assert.rejects(
              () =>
                rows("select familyos.get_collaborator_workspace($1)", [
                  inaccessible,
                ]),
              /Forbidden/,
            );
            await assert.rejects(
              () =>
                rows("select familyos.get_maintenance_tasks($1)", [
                  inaccessible,
                ]),
              /Forbidden/,
            );
            await assert.rejects(
              () =>
                rows("select familyos.set_my_task_done($1,'assigned',true)", [
                  inaccessible,
                ]),
              /Forbidden/,
            );
          });
        }
        await asUser(6, async () => {
          assert.deepEqual(
            await rows("select * from familyos.household_members"),
            [],
          );
          assert.deepEqual(
            await rows("select * from familyos.recipe_nutrition"),
            [],
          );
        });
      },
    );

    await t.test(
      "every FamilyOS function has a fixed schema path and public name collisions cannot bypass authorization",
      async () => {
        const functions = await rows<{
          proname: string;
          proconfig: string[];
          definition: string;
        }>(
          "select p.proname,p.proconfig,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='familyos' order by p.proname",
        );
        assert.equal(functions.length, 22);
        for (const fn of functions) {
          assert.deepEqual(
            fn.proconfig,
            ["search_path=familyos, pg_temp"],
            fn.proname,
          );
          assert.ok(!/\bpublic\./i.test(fn.definition), fn.proname);
        }
        await asUser(6, async () => {
          assert.equal(
            (
              await rows("select public.is_household_admin($1) allowed", [h1])
            )[0].allowed,
            true,
          );
          assert.equal(
            (
              await rows(
                "select public.save_household_state($1,0,'{}') revision",
                [h1],
              )
            )[0].revision,
            -999,
          );
          assert.equal(
            (
              await rows("select familyos.is_household_admin($1) allowed", [h1])
            )[0].allowed,
            false,
          );
          await assert.rejects(
            () => rows("select familyos.save_household_state($1,3,'{}')", [h1]),
            /Forbidden/,
          );
          await assert.rejects(
            () => rows("create table familyos.attacker(id int)"),
            /permission denied/,
          );
        });
      },
    );

    await t.test(
      "anonymous access and privileged helper execution stay denied despite the existing public schema grants",
      async () => {
        const grants = (
          await rows<{
            anon_usage: boolean;
            authenticated_usage: boolean;
            authenticated_create: boolean;
          }>(
            "select has_schema_privilege('anon','familyos','usage') anon_usage,has_schema_privilege('authenticated','familyos','usage') authenticated_usage,has_schema_privilege('authenticated','familyos','create') authenticated_create",
          )
        )[0];
        assert.deepEqual(grants, {
          anon_usage: false,
          authenticated_usage: true,
          authenticated_create: false,
        });
        assert.deepEqual(
          await rows(
            "select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='familyos' and has_function_privilege('anon',p.oid,'execute')",
          ),
          [],
        );
        await db.exec("set role anon");
        try {
          await assert.rejects(
            () => rows("select * from familyos.household_state"),
            /permission denied/,
          );
          await assert.rejects(
            () => rows("select familyos.get_collaborator_workspace($1)", [h1]),
            /permission denied/,
          );
        } finally {
          await db.exec("reset role");
        }
        await asUser(1, async () => {
          for (const query of [
            "select familyos.bootstrap_household('shared5@example.test','shared6@example.test')",
            "select familyos.stock_key('Pollo','g')",
            "select familyos.stock_mode('{}','Pollo','g')",
            "select familyos.stock_balance('{}','Pollo','g')",
            "select familyos.next_maintenance_due('{}','2026-01-01')",
            "select familyos.complete_maintenance_state('{}','{}','x',now())",
            "select * from familyos.medical_records",
          ]) {
            await assert.rejects(() => rows(query), /permission denied/, query);
          }
        });
      },
    );

    await t.test(
      "FamilyOS writes leave other-app data and Auth identities unchanged and a duplicate install rolls back",
      async () => {
        assert.deepEqual(await otherAppSnapshot(), before);
        await assert.rejects(
          () => db.exec(readFileSync("supabase/shared-setup.sql", "utf8")),
          /already exists/,
        );
        await db.exec("rollback");
        assert.deepEqual(await otherAppSnapshot(), before);
        const counts = (
          await rows<{ households: number; revisions: number }>(
            "select (select count(*)::int from familyos.households) households,(select revision::int from familyos.household_state where household_id=$1) revisions",
            [h1],
          )
        )[0];
        assert.deepEqual(counts, { households: 2, revisions: 3 });
      },
    );
  } finally {
    await db.close();
  }
});
