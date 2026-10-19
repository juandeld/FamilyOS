import { test } from "node:test";
import assert from "node:assert/strict";
import {
  stockMode,
  controlledMovements,
  toGrams,
  imperial,
} from "../lib/stock-policy";
import { preparationMovements } from "../lib/pantry";
import {
  normalizeState,
  emptyHouseholdState,
  mergeStateChanges,
} from "../lib/state";
test("meat is tracked by default; avocado and basics stay available without daily administration", () => {
  assert.equal(stockMode("Pollo", "g", {}), "tracked");
  assert.equal(stockMode("Aguacate", "g", {}), "always_available");
  const movements = preparationMovements(
    "p",
    "today",
    [
      { name: "Pollo", quantity: 180, unit: "g" },
      { name: "Aguacate", quantity: 80, unit: "g" },
    ],
    [],
    {},
  );
  assert.deepEqual(
    movements.map((m) => m.name),
    ["Pollo"],
  );
  assert.equal(
    stockMode("Aguacate", "g", { "aguacate|g": { mode: "tracked" } }),
    "tracked",
  );
});
test("pounds and ounces are exact internally and displayed in familiar units", () => {
  assert.equal(toGrams(1, "lb"), toGrams(16, "oz"));
  assert.equal(imperial(toGrams(5.5, "lb")), "5 lb 8 oz");
  assert.equal(imperial(toGrams(-1, "oz")), "-0 lb 1 oz");
});
test("reactivating tracking requires a fresh count; old events are retained, not replayed", () => {
  const movements = [
    {
      id: "1",
      name: "Pollo",
      unit: "g",
      kind: "opening" as const,
      quantity: 100,
      occurredAt: "2026-10-01T00:00:00Z",
    },
    {
      id: "2",
      name: "Pollo",
      unit: "g",
      kind: "opening" as const,
      quantity: 200,
      occurredAt: "2026-10-19T00:00:00Z",
    },
  ];
  assert.equal(
    controlledMovements(movements, {
      "pollo|g": { mode: "tracked", since: "2026-10-18T00:00:00Z" },
    }).length,
    1,
  );
  assert.equal(
    controlledMovements(movements, { "pollo|g": { mode: "always_available" } })
      .length,
    0,
  );
  assert.equal(movements.length, 2);
  const migrated = normalizeState({
    stockMovements: [{ ...movements[0], name: "Aguacate" }],
  });
  assert.equal(migrated.stockPolicies["aguacate|g"].mode, "tracked");
});
test("new household is empty and cannot inherit demo data; concurrent edits merge or explicitly conflict", () => {
  const base = emptyHouseholdState();
  assert.equal(base.staff.length, 0);
  assert.equal(base.tasks.length, 0);
  assert.equal(base.goals.Juan.protein, 0);
  const local = { ...base, notes: ["local"] };
  const remote = { ...base, purchasePeriod: 15 as const };
  assert.deepEqual(mergeStateChanges(base, local, remote).notes, ["local"]);
  assert.equal(mergeStateChanges(base, local, remote).purchasePeriod, 15);
  assert.throws(
    () => mergeStateChanges(base, local, { ...base, notes: ["remote"] }),
    /Otra persona/,
  );
});
