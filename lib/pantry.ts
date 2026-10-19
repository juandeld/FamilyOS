import { stockMode, type StockPolicies } from "./stock-policy";
export type StockKind = "opening" | "purchase" | "preparation" | "correction";
export type StockMovement = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  kind: StockKind;
  occurredAt: string;
  sourceId?: string;
  countedQuantity?: number;
  note?: string;
};
export type StockBalance = {
  key: string;
  name: string;
  unit: string;
  opening: number | null;
  purchases: number;
  used: number;
  corrections: number;
  balance: number | null;
  movements: StockMovement[];
};
const unitAliases: Record<string, string> = {
  unidad: "unidades",
  unidades: "unidades",
  rebanada: "rebanadas",
  rebanadas: "rebanadas",
  g: "g",
  ml: "ml",
};
export function stockKey(name: string, unit: string) {
  return `${name
    .trim()
    .toLocaleLowerCase("es-GT")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")}|${unitAliases[unit] || unit}`;
}
export function pantryBalances(movements: StockMovement[]): StockBalance[] {
  const items = new Map<string, StockBalance>();
  const seen = new Set<string>();
  for (const m of movements) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    if (!m.name.trim() || !Number.isFinite(m.quantity)) continue;
    const key = stockKey(m.name, m.unit);
    if (!items.has(key))
      items.set(key, {
        key,
        name: m.name,
        unit: unitAliases[m.unit] || m.unit,
        opening: null,
        purchases: 0,
        used: 0,
        corrections: 0,
        balance: null,
        movements: [],
      });
    const item = items.get(key)!;
    item.movements.push(m);
    if (m.kind === "opening") {
      // The first physical count is the baseline. Older untracked movements
      // are already reflected in this count and must not be replayed.
      if (item.opening === null && m.quantity >= 0) {
        item.opening = m.quantity;
        item.purchases = 0;
        item.used = 0;
        item.corrections = 0;
        item.balance = m.quantity;
      }
      continue;
    }
    if (item.opening === null) continue;
    if (m.kind === "purchase" && m.quantity > 0) item.purchases += m.quantity;
    else if (m.kind === "preparation" && m.quantity < 0)
      item.used -= m.quantity;
    else if (m.kind === "correction") item.corrections += m.quantity;
    item.balance = item.opening + item.purchases - item.used + item.corrections;
  }
  return [...items.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "es-GT"),
  );
}
export function preparationMovements(
  sourceId: string,
  occurredAt: string,
  ingredients: { name: string; quantity: number; unit: string }[],
  previous: StockMovement[],
  policies?: StockPolicies,
): StockMovement[] {
  if (previous.some((m) => m.kind === "preparation" && m.sourceId === sourceId))
    return [];
  return ingredients
    .filter(
      (i) =>
        Number.isFinite(i.quantity) &&
        i.quantity > 0 &&
        (!policies || stockMode(i.name, i.unit, policies) === "tracked"),
    )
    .map((i, index) => ({
      id: `${sourceId}:ingredient:${index}`,
      name: i.name,
      quantity: -i.quantity,
      unit: i.unit,
      kind: "preparation" as const,
      sourceId,
      occurredAt,
    }));
}
// Subtract confirmed, comparable stock AFTER adding the safety margin.
// Missing or negative stock is never represented as available.
export function purchaseNeeded(
  grossGrams: number,
  name: string,
  movements: StockMovement[],
) {
  const stock = pantryBalances(movements).find(
    (i) => i.key === stockKey(name, "g"),
  );
  const available = stock?.balance == null ? null : Math.max(0, stock.balance);
  return {
    available,
    needed: Math.ceil(Math.max(0, grossGrams - (available ?? 0))),
    deficit: stock?.balance != null && stock.balance < 0,
  };
}
