import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyHouseholdState, normalizeState } from "../lib/state";
import {
  activateMaintenance,
  completeMaintenance,
  demoMaintenance,
  localDate,
  maintenanceMaterials,
  nextMaintenanceDate,
  syncMaintenanceTasks,
} from "../lib/maintenance";
import { parseMaintenanceImport } from "../lib/maintenance-import";

test("legacy state stays compatible and imports are drafts without fabricated execution or assignments", () => {
  const old = normalizeState({ notes: ["keep"], plan: {} });
  assert.equal(old.maintenance.plans.length, 0);
  assert.deepEqual(old.notes, ["keep"]);
  const prepared = demoMaintenance();
  const imported = parseMaintenanceImport(prepared);
  assert.equal(imported.plans.length, 8);
  assert.ok(
    imported.plans.every(
      (p) =>
        p.status === "draft" &&
        p.nextDue === null &&
        p.owner === "Sin asignar" &&
        p.assigneeId === "",
    ),
  );
  assert.equal(imported.history.length, 0);
  assert.throws(
    () =>
      parseMaintenanceImport({ ...prepared, history: [{ id: "fake-done" }] }),
    /No se importó/,
  );
  assert.throws(
    () =>
      parseMaintenanceImport({
        ...prepared,
        plans: [prepared.plans[0], prepared.plans[0]],
      }),
    /No se importó/,
  );
});
test("activation is explicit, skips unresolved routines and does not overwrite other tasks or history", () => {
  const base = emptyHouseholdState();
  base.maintenance = demoMaintenance();
  base.maintenance.plans[0].review = ["Confirmar meses"];
  base.tasks = [
    {
      id: "original",
      title: "Preservar",
      owner: "Sin asignar",
      frequency: "Diaria",
      done: false,
      assigneeId: "",
    },
  ];
  const active = activateMaintenance(base, "2026-10-18");
  assert.equal(base.maintenance.plans[0].status, "draft");
  assert.equal(active.maintenance.plans[0].status, "draft");
  assert.equal(active.maintenance.plans[1].nextDue, "2026-10-18");
  assert.equal(active.maintenance.history.length, 0);
  assert.ok(active.tasks.some((t) => t.id === "original"));
  assert.equal(active.tasks.length, 8);
  assert.deepEqual(activateMaintenance(active, "2026-10-18"), active);
  assert.throws(() => activateMaintenance(base, "2026-02-30"), /válida/);
});
test("month-end anchors survive February, leap years and the December boundary", () => {
  const p = {
    ...demoMaintenance().plans[0],
    frequency: "monthly" as const,
    months: Array.from({ length: 12 }, (_, i) => i + 1),
    anchorDay: 31,
    nextDue: "2028-01-31",
  };
  assert.equal(nextMaintenanceDate(p, "2028-01-31"), "2028-02-29");
  assert.equal(
    nextMaintenanceDate({ ...p, nextDue: "2028-02-29" }, "2028-02-29"),
    "2028-03-31",
  );
  assert.equal(nextMaintenanceDate(p, "2026-12-31"), "2027-01-31");
  assert.equal(
    nextMaintenanceDate(
      { ...p, frequency: "annual", months: [9], anchorDay: 18 },
      "2026-10-18",
      true,
    ),
    "2027-09-18",
  );
});
test("confirmed work advances recurrence once, records actual versus due date and never invents missed completions", () => {
  const base = emptyHouseholdState();
  base.maintenance = demoMaintenance();
  let state = activateMaintenance(base, "2026-01-01");
  const p = state.maintenance.plans.find((p) => p.frequency === "weekly")!;
  state = completeMaintenance(
    state,
    p.id,
    new Date("2026-01-20T18:00:00Z"),
    "Admin",
    "Se retiró basura",
    null,
  );
  const event = state.maintenance.history[0],
    current = state.maintenance.plans.find((x) => x.id === p.id)!;
  assert.equal(event.dueOn, "2026-01-01");
  assert.equal(event.completedOn, "2026-01-20");
  assert.equal(event.cost, null);
  assert.equal(state.maintenance.history.length, 1);
  assert.equal(current.nextDue, "2026-01-22");
  assert.equal(
    state.tasks.filter((t) => t.maintenance?.planId === p.id && !t.done).length,
    1,
  );
  assert.ok(state.tasks.find((t) => t.id === event.id)?.done);
  assert.throws(
    () =>
      completeMaintenance(
        state,
        p.id,
        new Date("2026-01-20T18:00:00Z"),
        "Admin",
      ),
    /futura/,
  );
  assert.equal(localDate(new Date("2026-01-02T02:00:00Z")), "2026-01-01");
});
test("material planning preserves unknown quantities and validation, and pausing removes only pending occurrences", () => {
  const base = emptyHouseholdState();
  base.maintenance = demoMaintenance();
  let s = activateMaintenance(base, "2026-10-18");
  const p = s.maintenance.plans[0];
  const materials = maintenanceMaterials(s.maintenance, "2026-10-31");
  assert.equal(materials.length, 1);
  assert.equal(materials[0].verified, false);
  assert.equal(materials[0].quantity, "Por confirmar");
  s = completeMaintenance(
    s,
    p.id,
    new Date("2026-10-18T18:00:00Z"),
    "Admin",
    "",
    125.5,
  );
  const event = s.maintenance.history[0];
  assert.equal(event.cost, 125.5);
  s = syncMaintenanceTasks({
    ...s,
    maintenance: {
      ...s.maintenance,
      plans: s.maintenance.plans.map((x) =>
        x.id === p.id ? { ...x, status: "paused" } : x,
      ),
    },
  });
  assert.equal(
    s.tasks.filter((t) => t.maintenance?.planId === p.id && !t.done).length,
    0,
  );
  assert.ok(s.tasks.some((t) => t.id === event.id && t.done));
  assert.equal(s.maintenance.history.length, 1);
});
