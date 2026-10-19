import { initial, type State } from "./domain";
import { stockKey } from "./pantry";
export function normalizeState(value: Partial<State>): State {
  const state = { ...structuredClone(initial), ...value };
  // Preserve products explicitly counted in older versions. Auto-generated
  // preparation movements alone never opt a basic ingredient into tracking.
  state.stockPolicies = { ...state.stockPolicies };
  for (const m of state.stockMovements)
    if (m.kind === "opening" && !state.stockPolicies[stockKey(m.name, m.unit)])
      state.stockPolicies[stockKey(m.name, m.unit)] = { mode: "tracked" };
  return state;
}
export function emptyHouseholdState(): State {
  return {
    ...structuredClone(initial),
    plan: {},
    favorites: [],
    history: [],
    staff: [],
    staffMemories: [],
    tasks: [],
    assets: [],
    maintenance: structuredClone(initial.maintenance),
    notes: [],
    stockMovements: [],
    checkedItems: [],
    stockPolicies: {},
    goals: {
      Juan: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      Pamela: { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    },
    preferences: { Juan: "", Pamela: "", Manuela: "", "Juan de Dios": "" },
  };
}
export function mergeStateChanges(
  base: State,
  local: State,
  remote: State,
): State {
  const merged = { ...remote };
  for (const key of Object.keys(local) as (keyof State)[]) {
    if (JSON.stringify(local[key]) === JSON.stringify(base[key])) continue;
    if (
      JSON.stringify(remote[key]) !== JSON.stringify(base[key]) &&
      JSON.stringify(remote[key]) !== JSON.stringify(local[key])
    )
      throw new Error(
        `Otra persona cambió ${({ plan: "el menú", goals: "los objetivos", notes: "las notas", history: "el historial", staff: "el personal", staffMemories: "la memoria del personal", tasks: "las tareas", maintenance: "el mantenimiento", stockMovements: "la despensa", stockPolicies: "el control de inventario", assets: "los activos", preferences: "las preferencias", favorites: "el recetario", checkedItems: "la lista de compras", purchasePeriod: "el período de compra" } as Record<string, string>)[key] || "esta información"}. Revisa los cambios compartidos antes de volver a guardar.`,
      );
    Object.assign(merged, { [key]: local[key] });
  }
  return merged;
}
