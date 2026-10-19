import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
test("PostgreSQL RLS, RPC permissions, private data and cross-admin synchronization", async (t) => {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid; $$;grant usage on schema auth,public to anon,authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;`,
  );
  await db.exec(readFileSync("supabase/setup.sql", "utf8"));
  for (let n = 1; n <= 8; n++)
    await db.query("insert into auth.users values($1,$2,now())", [
      uid(n),
      `user${n}@example.test`,
    ]);
  const h1 = (
    await db.query<{ id: string }>(
      "select public.bootstrap_household('user1@example.test','user2@example.test') id",
    )
  ).rows[0].id;
  const h2 = (
    await db.query<{ id: string }>(
      "select public.bootstrap_household('user3@example.test','user4@example.test') id",
    )
  ).rows[0].id;
  await db.query(
    "insert into public.household_members(household_id,user_id,display_name,role,permissions) values($1,$2,'Cocina','collaborator',array['kitchen.read','kitchen.confirm','tasks.read','tasks.update','inventory.read','inventory.write'])",
    [h1, uid(5)],
  );
  const state = {
    plan: { "Juan|Lunes|Almuerzo": "1-0" },
    goals: { Juan: { protein: 9999 } },
    history: [],
    stockMovements: [],
    stockPolicies: {},
    staff: [{ note: "PRIVATE_STAFF" }],
    notes: ["PRIVATE_NOTE"],
    staffMemories: [{id:"memory-private",staffId:"s1",text:"PRIVATE_MEMORY",dates:[{title:"PRIVATE_BIRTHDAY",day:12,month:5,annual:true}]}],
    tasks: [
      { id: "assigned", title: "Mi tarea", assigneeId: uid(5), done: false },
      { id: "other", title: "PRIVATE_TASK", assigneeId: uid(2), done: false },
    ],
    assets: [],
  };
  await db.query(
    "update public.household_state set data=$1::jsonb where household_id=$2",
    [JSON.stringify(state), h1],
  );
  async function asUser<T>(n: number, fn: () => Promise<T>): Promise<T> {
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      uid(n),
    ]);
    try {
      return await fn();
    } finally {
      await db.exec("reset role");
    }
  }
  const rows = async (sql: string, params: unknown[] = []) =>
    (await db.query<Record<string, unknown>>(sql, params)).rows;
  await t.test(
    "both principals read/write shared data; stale revisions cannot overwrite a concurrent change",
    async () => {
      await asUser(1, async () => {
        assert.equal(
          (await rows("select * from public.household_state")).length,
          1,
        );
        assert.equal(
          (
            await rows(
              "select public.save_household_state($1,0,$2::jsonb) revision",
              [h1, JSON.stringify({ ...state, notes: ["shared by Juan"] })],
            )
          )[0].revision,
          1,
        );
      });
      await asUser(2, async () => {
        const row = (
          await rows(
            "select data,revision from public.household_state where household_id=$1",
            [h1],
          )
        )[0] as { data: { notes: string[] }; revision: number };
        assert.deepEqual(row.data.notes, ["shared by Juan"]);
        assert.equal(row.revision, 1);
        await assert.rejects(
          () => rows("select public.save_household_state($1,0,'{}')", [h1]),
          /State conflict/,
        );
      });
      await asUser(2, async () => {
        await rows("select public.save_household_state($1,1,$2::jsonb)", [
          h1,
          JSON.stringify({ ...state, notes: ["shared by Pamela"] }),
        ]);
      });
      await asUser(1, async () =>
        assert.deepEqual(
          (
            (await rows("select data from public.household_state"))[0].data as {
              notes: string[];
            }
          ).notes,
          ["shared by Pamela"],
        ),
      );
    },
  );
  await t.test(
    "kitchen cannot query private state, macros, invitations, staff notes, audit or another household",
    async () =>
      asUser(5, async () => {
        for (const table of [
          "household_state",
          "recipe_nutrition",
          "household_invitations",
          "audit_events",
          "family_people",
        ])
          assert.equal(
            (await rows("select * from public." + table)).length,
            0,
            table,
          );
        await assert.rejects(
          () => rows("select public.save_household_state($1,2,'{}')", [h1]),
          /Forbidden/,
        );
        const op = (
          await rows("select public.get_collaborator_workspace($1) data", [h1])
        )[0].data as { plan: unknown[]; tasks: { id: string }[] };
        assert.equal(op.plan.length, 1);
        assert.deepEqual(
          op.tasks.map((t) => t.id),
          ["assigned"],
        );
        const serialized = JSON.stringify(op);
        for (const secret of ["9999", "macros", "PRIVATE", "goals", "staff"])
          assert.ok(!serialized.includes(secret), secret);
        await assert.rejects(
          () => rows("select public.get_collaborator_workspace($1)", [h2]),
          /Forbidden/,
        );
        await assert.rejects(
          () => rows("select public.set_my_task_done($1,'other',true)", [h1]),
          /Forbidden/,
        );
        await assert.rejects(
          () =>
            rows("select public.set_my_task_done($1,'assigned',null)", [h1]),
          /Invalid task/,
        );
        await rows("select public.set_my_task_done($1,'assigned',true)", [h1]);
      }),
  );
  await t.test(
    "RPC preparation is atomic, idempotent and consumes only tracked products",
    async () => {
      await asUser(5, async () => {
        await assert.rejects(
          () =>
            rows(
              "select public.confirm_kitchen_preparation($1,'Juan|Lunes|Almuerzo','1-0',null)",
              [h1],
            ),
          /Invalid preparation/,
        );
      });
      const event = uid(70);
      await asUser(5, async () => {
        await rows(
          "select public.confirm_kitchen_preparation($1,'Juan|Lunes|Almuerzo','1-0',$2)",
          [h1, event],
        );
        await rows(
          "select public.confirm_kitchen_preparation($1,'Juan|Lunes|Almuerzo','1-0',$2)",
          [h1, event],
        );
      });
      const doc = (
        await rows(
          "select data from public.household_state where household_id=$1",
          [h1],
        )
      )[0].data as {
        history: unknown[];
        stockMovements: { name: string; quantity: number }[];
      };
      assert.equal(doc.history.length, 1);
      assert.equal(doc.stockMovements.length, 1);
      assert.equal(doc.stockMovements[0].name, "Pollo");
      assert.equal(doc.stockMovements[0].quantity, -180);
      await asUser(5, async () => {
        await assert.rejects(
          () =>
            rows(
              "select public.confirm_kitchen_preparation($1,'Juan|Martes|Almuerzo','1-0',$2)",
              [h1, uid(71)],
            ),
          /Plan changed/,
        );
      });
    },
  );
  await t.test(
    "inventory writes require permission, tracked products and an opening count",
    async () =>
      asUser(5, async () => {
        await assert.rejects(
          () =>
            rows(
              "select public.record_stock_movement($1,$2,'Aguacate','g','opening',100)",
              [h1, uid(72)],
            ),
          /not tracked/,
        );
        await assert.rejects(
          () =>
            rows(
              "select public.record_stock_movement($1,$2,'Pollo','g','purchase',100)",
              [h1, uid(73)],
            ),
          /Initial count/,
        );
        await assert.rejects(
          () =>
            rows(
              "select public.record_stock_movement($1,$2,'Pollo','g','opening',null)",
              [h1, uid(74)],
            ),
          /Invalid movement/,
        );
        await rows(
          "select public.record_stock_movement($1,$2,'Pollo','g','opening',453.59237)",
          [h1, uid(75)],
        );
        await rows(
          "select public.record_stock_movement($1,$2,'Pollo','g','purchase',28.349523125)",
          [h1, uid(76)],
        );
      }),
  );
  await t.test(
    "no self elevation, principal deactivation or public bootstrap",
    async () => {
      await asUser(5, async () => {
        await assert.rejects(
          () =>
            rows(
              "update public.household_members set role='admin' where user_id=$1",
              [uid(5)],
            ),
          /permission denied/,
        );
        await assert.rejects(
          () =>
            rows(
              "select public.reserve_household_invitation($1,'x@example.test','x','{}')",
              [h1],
            ),
          /Forbidden/,
        );
        await assert.rejects(
          () =>
            rows(
              "select public.bootstrap_household('user5@example.test','user6@example.test')",
            ),
          /permission denied/,
        );
      });
      await asUser(1, async () => {
        await assert.rejects(
          () =>
            rows("select public.manage_household_member($1,$2,false,'{}')", [
              h1,
              uid(2),
            ]),
          /Principal/,
        );
        await assert.rejects(
          () =>
            rows(
              "select public.reserve_household_invitation($1,'x@example.test','x',array['admin'])",
              [h1],
            ),
          /check constraint/,
        );
      });
    },
  );
  await t.test(
    "invitation acceptance uses confirmed email identity and expiry, never public registration",
    async () => {
      await asUser(1, async () => {
        await rows(
          "select public.reserve_household_invitation($1,'user6@example.test','Invitado',array['tasks.read'])",
          [h1],
        );
      });
      await asUser(7, async () =>
        assert.equal(
          (await rows("select public.accept_my_invitations() n"))[0].n,
          0,
        ),
      );
      await asUser(6, async () =>
        assert.equal(
          (await rows("select public.accept_my_invitations() n"))[0].n,
          1,
        ),
      );
      await asUser(6, async () => {
        const m = (
          await rows(
            "select * from public.household_members where user_id=$1",
            [uid(6)],
          )
        )[0];
        assert.equal(m.role, "collaborator");
        assert.equal(m.is_principal, false);
      });
      await asUser(1, async () => {
        await rows(
          "select public.reserve_household_invitation($1,'user8@example.test','Vencido','{}')",
          [h1],
        );
      });
      await db.query(
        "update public.household_invitations set expires_at=now()-interval '1 day' where email='user8@example.test'",
      );
      await asUser(8, async () =>
        assert.equal(
          (await rows("select public.accept_my_invitations() n"))[0].n,
          0,
        ),
      );
    },
  );
  await t.test(
    "disabled collaborator immediately loses all operational access even with an existing session identity",
    async () => {
      await asUser(2, async () => {
        await rows(
          "select public.manage_household_member($1,$2,false,array['kitchen.read'])",
          [h1, uid(5)],
        );
      });
      await asUser(5, async () => {
        await assert.rejects(
          () => rows("select public.get_collaborator_workspace($1)", [h1]),
          /Forbidden/,
        );
        assert.equal((await rows("select * from public.recipes")).length, 0);
      });
    },
  );
  await t.test(
    "tenant B cannot read or mutate A, even as administrator",
    async () =>
      asUser(3, async () => {
        assert.equal(
          (
            await rows(
              "select * from public.household_state where household_id=$1",
              [h1],
            )
          ).length,
          0,
        );
        await assert.rejects(
          () => rows("select public.save_household_state($1,0,'{}')", [h1]),
          /Forbidden/,
        );
        await assert.rejects(
          () =>
            rows("select public.manage_household_member($1,$2,false,'{}')", [
              h1,
              uid(5),
            ]),
          /Forbidden/,
        );
      }),
  );
  await t.test(
    "medical data defaults to denied even for admins; explicit person grant plus audit is required",
    async () => {
      const person = (
        await rows(
          "select id from public.family_people where household_id=$1 and name='Manuela'",
          [h1],
        )
      )[0].id;
      await db.query(
        "insert into public.medical_records(household_id,person_id,payload) values($1,$2,'{\"private\":true}')",
        [h1, person],
      );
      await asUser(1, async () => {
        await assert.rejects(
          () => rows("select * from public.medical_records"),
          /permission denied/,
        );
        await assert.rejects(
          () =>
            rows("select * from public.read_medical_records($1,$2)", [
              h1,
              person,
            ]),
          /Forbidden/,
        );
      });
      await db.query(
        "insert into public.person_access(household_id,person_id,user_id,can_read_medical) values($1,$2,$3,true)",
        [h1, person, uid(1)],
      );
      await asUser(1, async () =>
        assert.equal(
          (
            await rows("select * from public.read_medical_records($1,$2)", [
              h1,
              person,
            ])
          ).length,
          1,
        ),
      );
      await asUser(2, async () => {
        await assert.rejects(
          () =>
            rows("select * from public.read_medical_records($1,$2)", [
              h1,
              person,
            ]),
          /Forbidden/,
        );
      });
      assert.equal(
        (
          await rows(
            "select * from public.audit_events where action='medical.read'",
          )
        ).length,
        1,
      );
      const children = await rows(
        "select user_id from public.family_people where kind='child'",
      );
      assert.ok(children.every((c) => c.user_id === null));
    },
  );
  await t.test(
    "maintenance completion is assigned, atomic and private; recurrence helpers cannot be called directly",
    async () => {
      await db.query(
        "update public.household_members set active=true,permissions=array['tasks.read','tasks.update'] where household_id=$1 and user_id=$2",
        [h1, uid(5)],
      );
      const plan = {
        id: "routine-a",
        title: "Inspección de ejemplo",
        area: "Exterior",
        frequency: "monthly",
        months: Array.from({ length: 12 }, (_, i) => i + 1),
        anchorDay: 31,
        nextDue: "2026-01-31",
        status: "active",
        owner: "Equipo",
        assigneeId: uid(5),
        instructions: "Inspección accesible",
        materials: [{ name: "Utensilio", quantity: "1", verified: true }],
        review: [],
        references: ["PRIVATE_PROVIDER_REFERENCE"],
      };
      const task = {
        id: "maintenance:routine-a:2026-01-31",
        title: plan.title,
        frequency: "Mensual",
        owner: "Equipo",
        assigneeId: uid(5),
        done: false,
        dueDate: plan.nextDue,
        instructions: plan.instructions,
        maintenance: { planId: plan.id, dueDate: plan.nextDue },
      };
      await db.query(
        "update public.household_state set data=$1::jsonb where household_id=$2",
        [
          JSON.stringify({
            ...state,
            tasks: [task],
            maintenance: {
              version: 1,
              sourceName: "PRIVATE_IMPORT",
              plans: [plan],
              history: [],
              analysis: ["PRIVATE_ANALYSIS"],
            },
          }),
          h1,
        ],
      );
      const dates = await rows(
        "select public.next_maintenance_due($1::jsonb,'2028-01-31')::text due",
        [JSON.stringify(plan)],
      );
      assert.equal(String(dates[0].due).slice(0, 10), "2028-02-29");
      await asUser(5, async () => {
        const data = (
          await rows("select public.get_maintenance_tasks($1) data", [h1])
        )[0].data as { id: string; instructions: string }[];
        assert.equal(data.length, 1);
        assert.equal(data[0].instructions, plan.instructions);
        assert.ok(!JSON.stringify(data).includes("PRIVATE_"));
        await assert.rejects(
          () => rows("select public.get_maintenance_tasks($1)", [h2]),
          /Forbidden/,
        );
        await assert.rejects(
          () =>
            rows(
              "select public.complete_maintenance_state('{}','{}','x',now())",
            ),
          /permission denied/,
        );
        await rows("select public.set_my_task_done($1,$2,true)", [h1, task.id]);
        await rows("select public.set_my_task_done($1,$2,true)", [h1, task.id]);
        await assert.rejects(
          () =>
            rows("select public.set_my_task_done($1,$2,false)", [h1, task.id]),
          /cannot be undone/,
        );
        await assert.rejects(
          () =>
            rows("select public.set_my_task_done($1,'unassigned',true)", [h1]),
          /Forbidden/,
        );
      });
      const doc = (
        await rows(
          "select data from public.household_state where household_id=$1",
          [h1],
        )
      )[0].data as {
        maintenance: {
          plans: { nextDue: string }[];
          history: { cost: null; by: string; actorId: string }[];
        };
        tasks: { done: boolean }[];
      };
      assert.equal(doc.maintenance.history.length, 1);
      assert.equal(doc.maintenance.history[0].cost, null);
      assert.equal(doc.maintenance.history[0].by, "Cocina");
      assert.equal(doc.maintenance.history[0].actorId,uid(5));
      assert.ok(doc.maintenance.plans[0].nextDue > "2026-01-31");
      assert.equal(doc.tasks.filter((t) => !t.done).length, 1);
      await asUser(6, async () =>
        assert.deepEqual(
          (await rows("select public.get_maintenance_tasks($1) data", [h1]))[0]
            .data,
          [],
        ),
      );
      await asUser(
        8,
        async () =>
          await assert.rejects(
            () => rows("select public.get_maintenance_tasks($1)", [h1]),
            /Forbidden/,
          ),
      );
    },
  );
  await db.exec("set role anon");
  await assert.rejects(
    () => rows("select * from public.household_state"),
    /permission denied/,
  );
  await db.exec("reset role");
  await db.close();
});
