import type { State } from "./domain";
export type MaintenanceFrequency =
  | "weekly"
  | "monthly"
  | "quarterly"
  | "semiannual"
  | "annual";
export type MaintenanceMaterial = {
  name: string;
  quantity: string;
  verified: boolean;
};
export type MaintenancePlan = {
  id: string;
  title: string;
  area: string;
  frequency: MaintenanceFrequency;
  months: number[];
  estimatedHours: number | null;
  materials: MaintenanceMaterial[];
  references: string[];
  instructions: string;
  sourceRows: string[];
  review: string[];
  priority: "high" | "normal";
  conditionBased: boolean;
  status: "draft" | "active" | "paused";
  nextDue: string | null;
  anchorDay: number;
  owner: string;
  assigneeId: string;
};
export type MaintenanceEvent = {
  id: string;
  planId: string;
  title: string;
  area: string;
  dueOn: string;
  completedOn: string;
  confirmedAt: string;
  by: string;
  actorId?: string;
  note: string;
  cost: number | null;
};
export type MaintenanceData = {
  version: 1;
  sourceId: string;
  sourceName: string;
  importedAt: string | null;
  analysis: string[];
  plans: MaintenancePlan[];
  history: MaintenanceEvent[];
};
export type HouseTask = {
  id: string;
  title: string;
  owner: string;
  frequency: string;
  assigneeId: string;
  done: boolean;
  dueDate?: string;
  instructions?: string;
  maintenance?: { planId: string; dueDate: string };
};
export const emptyMaintenance = (): MaintenanceData => ({
  version: 1,
  sourceId: "",
  sourceName: "",
  importedAt: null,
  analysis: [],
  plans: [],
  history: [],
});
export const frequencyNames: Record<MaintenanceFrequency, string> = {
  weekly: "Semanal",
  monthly: "Mensual",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
};
export const monthNames = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
export function localDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guatemala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function validDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value + "T12:00:00Z")) &&
    new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value
  );
}
function dateAt(year: number, month: number, day: number): string {
  const max = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(Math.min(day, max)).padStart(2, "0")}`;
}
function addDays(value: string, days: number): string {
  const d = new Date(value + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function nextMaintenanceDate(
  plan: MaintenancePlan,
  after: string,
  inclusive = false,
): string {
  if (!validDate(after)) throw new Error("Fecha inválida");
  const anchor = Math.max(1, Math.min(31, plan.anchorDay));
  if (plan.frequency === "weekly") {
    if (inclusive) return after;
    let candidate =
      plan.nextDue && validDate(plan.nextDue) ? plan.nextDue : after;
    const gap = Math.floor(
      (Date.parse(after + "T12:00:00Z") -
        Date.parse(candidate + "T12:00:00Z")) /
        86400000,
    );
    return addDays(candidate, Math.max(1, Math.floor(gap / 7) + 1) * 7);
  }
  const [year, month] = after.split("-").map(Number);
  const interval = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 }[
    plan.frequency
  ];
  const slots = plan.months.length
    ? plan.months
    : Array.from(
        { length: 12 / interval },
        (_, i) => ((month - 1 + i * interval) % 12) + 1,
      );
  for (let offset = 0; offset <= 24; offset++) {
    const d = new Date(Date.UTC(year, month - 1 + offset, 1));
    if (!slots.includes(d.getUTCMonth() + 1)) continue;
    const candidate = dateAt(d.getUTCFullYear(), d.getUTCMonth() + 1, anchor);
    if (candidate > after || (inclusive && candidate === after))
      return candidate;
  }
  throw new Error("Revisa los meses programados");
}
export function maintenanceTask(plan: MaintenancePlan): HouseTask {
  if (!plan.nextDue) throw new Error("La rutina necesita una fecha");
  const materials = plan.materials
    .filter((m) => m.verified)
    .map((m) => `${m.name}: ${m.quantity || "cantidad por confirmar"}`)
    .join("; ");
  return {
    id: `maintenance:${plan.id}:${plan.nextDue}`,
    title: plan.title,
    owner: plan.owner,
    frequency: frequencyNames[plan.frequency],
    assigneeId: plan.assigneeId,
    done: false,
    dueDate: plan.nextDue,
    maintenance: { planId: plan.id, dueDate: plan.nextDue },
    instructions: [
      plan.instructions,
      materials && `Insumos validados: ${materials}`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}
export function syncMaintenanceTasks(state: State): State {
  const tasks = state.tasks.filter(
    (t) =>
      !t.maintenance ||
      t.done ||
      state.maintenance.plans.some(
        (p) =>
          p.id === t.maintenance?.planId &&
          p.status === "active" &&
          p.nextDue === t.maintenance.dueDate,
      ),
  );
  for (const plan of state.maintenance.plans.filter(
    (p) => p.status === "active" && p.nextDue,
  )) {
    const fresh = maintenanceTask(plan),
      index = tasks.findIndex((t) => t.id === fresh.id);
    if (index < 0) tasks.push(fresh);
    else if (!tasks[index].done) tasks[index] = fresh;
  }
  return { ...state, tasks };
}
export function activateMaintenance(state: State, start: string): State {
  if (!validDate(start)) throw new Error("Elige una fecha de inicio válida");
  const plans = state.maintenance.plans.map((p) => {
    if (p.status !== "draft" || p.review.length) return p;
    const active: MaintenancePlan = {
      ...p,
      status: "active",
      anchorDay: Number(start.slice(8)),
      months: [...p.months],
    };
    if (!active.months.length && p.frequency !== "weekly") {
      const interval = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12 }[
          p.frequency
        ],
        month = Number(start.slice(5, 7));
      active.months = Array.from(
        { length: 12 / interval },
        (_, i) => ((month - 1 + i * interval) % 12) + 1,
      ).sort((a, b) => a - b);
    }
    active.nextDue = nextMaintenanceDate(active, start, true);
    return active;
  });
  return syncMaintenanceTasks({
    ...state,
    maintenance: { ...state.maintenance, plans },
  });
}
export function completeMaintenance(
  state: State,
  planId: string,
  now: Date,
  by: string,
  note = "",
  cost: number | null = null,
): State {
  const plan = state.maintenance.plans.find((p) => p.id === planId);
  if (!plan?.nextDue || plan.status === "draft")
    throw new Error("Activa la rutina antes de confirmarla");
  const doneOn = localDate(now);
  if (doneOn < plan.nextDue)
    throw new Error(
      "La fecha es futura. Ajusta la programación antes de confirmar un trabajo anticipado.",
    );
  if (cost !== null && (!Number.isFinite(cost) || cost < 0))
    throw new Error("Costo inválido");
  const id = `maintenance:${plan.id}:${plan.nextDue}`;
  if (state.maintenance.history.some((e) => e.id === id)) return state;
  const event: MaintenanceEvent = {
    id,
    planId,
    title: plan.title,
    area: plan.area,
    dueOn: plan.nextDue,
    completedOn: doneOn,
    confirmedAt: now.toISOString(),
    by,
    note,
    cost,
  };
  const updated = { ...plan, nextDue: nextMaintenanceDate(plan, doneOn) };
  return syncMaintenanceTasks({
    ...state,
    tasks: state.tasks.map((t) => (t.id === id ? { ...t, done: true } : t)),
    maintenance: {
      ...state.maintenance,
      plans: state.maintenance.plans.map((p) =>
        p.id === planId ? updated : p,
      ),
      history: [event, ...state.maintenance.history],
    },
  });
}
export function maintenanceMaterials(data: MaintenanceData, through: string) {
  const result: {
    name: string;
    quantity: string;
    verified: boolean;
    plan: string;
    due: string;
  }[] = [];
  for (const p of data.plans)
    if (p.status === "active" && p.nextDue && p.nextDue <= through)
      for (const m of p.materials)
        result.push({ ...m, plan: p.title, due: p.nextDue });
  return result.sort((a, b) => a.due.localeCompare(b.due));
}
export function demoMaintenance(): MaintenanceData {
  const d = emptyMaintenance();
  d.sourceId = "demo-maintenance-v1";
  d.sourceName = "Plan de ejemplo · datos ficticios";
  d.analysis = [
    "Ejemplos genéricos. El archivo familiar no está incluido en la demo pública.",
    "Al activar eliges el inicio; no se importan trabajos realizados ni fechas históricas como vencidas.",
  ];
  const items: [string, string, MaintenanceFrequency, boolean][] = [
    ["Revisar canales de lluvia", "Exterior", "semiannual", false],
    ["Revisar pintura exterior", "Exterior", "annual", true],
    ["Limpieza profunda de cocina", "Limpieza", "quarterly", false],
    ["Revisar bisagras y puertas", "Interior", "semiannual", false],
    ["Cuidado del jardín", "Jardín", "weekly", false],
    ["Limpieza de un vehículo de ejemplo", "Vehículos", "monthly", false],
    ["Inspección visual del deck", "Exterior", "annual", true],
    ["Revisar refrigeradora", "Equipos", "quarterly", false],
  ];
  d.plans = items.map(([title, area, frequency, conditionBased], i) => ({
    id: `demo-routine-${i + 1}`,
    title,
    area,
    frequency,
    months: [],
    estimatedHours: null,
    materials:
      i === 0
        ? [
            {
              name: "Utensilios de limpieza compatibles",
              quantity: "Por confirmar",
              verified: false,
            },
          ]
        : [],
    references: [],
    instructions:
      "Inspección y limpieza accesibles. Cualquier desmontaje, lubricación o producto técnico requiere confirmar el manual y el material de la superficie.",
    sourceRows: [],
    review: [],
    priority: i === 0 ? "high" : "normal",
    conditionBased,
    status: "draft",
    nextDue: null,
    anchorDay: 1,
    owner: "Sin asignar",
    assigneeId: "",
  }));
  return d;
}
