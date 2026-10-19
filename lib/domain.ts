import type { StaffMemory } from "./staff-memory";
import type { StockPolicies } from "./stock-policy";
import type { StockMovement } from "./pantry";
import type { Preparation } from "./meat-shopping";
import { details } from "./catalog";
import { emptyMaintenance, type HouseTask } from "./maintenance";
export type Profile = "Juan" | "Pamela" | "Manuela" | "Juan de Dios";
export const profiles: Profile[] = [
  "Juan",
  "Pamela",
  "Manuela",
  "Juan de Dios",
];
export const days = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];
export const meals = ["Desayuno", "Almuerzo", "Cena"];
const titles = [
  [
    "Huevos con frijoles",
    "Avena con banano",
    "Tostadas con aguacate",
    "Yogur con fruta",
    "Omelette de espinaca",
    "Panqueques de avena",
    "Molletes con queso",
    "Bowl de papaya",
    "Huevos rancheros",
    "Tostada con requesón",
  ],
  [
    "Pollo al limón",
    "Pepián de pollo",
    "Pescado con arroz",
    "Bowl de quinoa",
    "Carne con vegetales",
    "Pollo con elote",
    "Lentejas con arroz",
    "Pasta con pollo",
    "Tacos de pescado",
    "Garbanzos salteados",
  ],
  [
    "Sopa de tortilla",
    "Quesadillas de frijol",
    "Crema de güicoy",
    "Ensalada con pollo",
    "Tostadas de atún",
    "Sopa de lentejas",
    "Pita con vegetales",
    "Tortilla española",
    "Caldo de pollo",
    "Pasta con tomate",
  ],
];
export const recipes = titles.flatMap((group, m) =>
  group.map((name, i) => ({
    id: `${m}-${i}`,
    name,
    meal: meals[m],
    minutes: 15 + i * 3,
    ...details(m * 10 + i),
    macros: {
      kcal: 350 + i * 22,
      protein: 22 + i * 2,
      carbs: 35 + i * 2,
      fat: 12 + i,
    },
  })),
);
export type Plan = Record<string, string>;
export const slot = (p: string, d: string, m: string) => `${p}|${d}|${m}`;
export function shopping(plan: Plan) {
  const result: Record<string, { quantity: number; unit: string }> = {};
  Object.values(plan).forEach((id) => {
    recipes
      .find((r) => r.id === id)
      ?.ingredients.forEach((i) => {
        result[i.name] ??= { quantity: 0, unit: i.unit };
        result[i.name].quantity += i.quantity;
      });
  });
  return result;
}
export const initial = {
  plan: {} as Plan,
  favorites: [] as string[],
  history: [] as Preparation[],
  goals: {
    Juan: { kcal: 2200, protein: 150, carbs: 240, fat: 70 },
    Pamela: { kcal: 1800, protein: 110, carbs: 200, fat: 60 },
  },
  staffMemories: [] as StaffMemory[],
  staff: [
    {
      id: "s1",
      name: "Rosa López",
      role: "Cocina",
      note: "Prefiere recibir el menú la tarde anterior. Ingreso: enero 2024.",
    },
    {
      id: "s2",
      name: "Carlos Pérez",
      role: "Jardín y mantenimiento",
      note: "Uniforme entregado en septiembre.",
    },
  ],
  tasks: [
    {
      id: "t1",
      title: "Preparar almuerzo familiar",
      owner: "Rosa López",
      frequency: "Diaria",
      assigneeId: "",
      done: false,
    },
    {
      id: "t2",
      title: "Revisar filtro de aire acondicionado",
      owner: "Carlos Pérez",
      frequency: "Mensual · propuesta sin manual verificado",
      assigneeId: "",
      done: false,
    },
  ] as HouseTask[],
  maintenance: emptyMaintenance(),
  assets: [
    {
      id: "a1",
      name: "Aire acondicionado · sala",
      detail: "Marca y modelo pendientes de verificar. No hay manual cargado.",
    },
  ],
  preferences: {
    Juan: "",
    Pamela: "",
    Manuela: "",
    "Juan de Dios": "",
  } as Record<Profile, string>,
  stockPolicies: {} as StockPolicies,
  stockMovements: [] as StockMovement[],
  purchasePeriod: 10 as 10 | 15 | 30,
  checkedItems: [] as string[],
  notes: [] as string[],
};
export type State = typeof initial;
export function rankedRecipes(
  list: typeof recipes,
  person: Profile,
  preferences: string,
  history: State["history"],
) {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  const words = normalize(preferences)
    .split(/[,\s]+/)
    .filter((w) => w.length > 3);
  const score = (r: (typeof recipes)[number]) => {
    const haystack = normalize(
      r.name + " " + r.ingredients.map((i) => i.name).join(" "),
    );
    const likes = words.reduce((n, w) => n + (haystack.includes(w) ? 1 : 0), 0);
    const opinions = history.filter(
      (h) => h.person === person && h.name === r.name,
    );
    return (
      likes +
      opinions.reduce(
        (n, h) =>
          n +
          (/encanto|gusto|favorit/.test(normalize(h.feedback)) &&
          !/no me/.test(normalize(h.feedback))
            ? 2
            : /no me gusto/.test(normalize(h.feedback))
              ? -2
              : 0),
        0,
      )
    );
  };
  return [...list].sort((a, b) => score(b) - score(a));
}
