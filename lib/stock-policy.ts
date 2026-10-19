import { stockKey, type StockMovement } from "./pantry";
export type StockMode = "tracked" | "always_available" | "untracked";
export type StockPolicies = Record<string, { mode: StockMode; since?: string }>;
export const GRAMS_PER_OUNCE = 28.349523125;
export const GRAMS_PER_POUND = 453.59237;
const meatNames = new Set([
  "pollo",
  "pescado",
  "carne de res",
  "atun escurrido",
]);
export function isMeat(name: string) {
  return meatNames.has(stockKey(name, "g").split("|")[0]);
}
export function stockMode(name: string, unit: string, policies: StockPolicies) {
  return (
    policies[stockKey(name, unit)]?.mode ??
    (isMeat(name) ? "tracked" : "always_available")
  );
}
export function controlledMovements(
  movements: StockMovement[],
  policies: StockPolicies,
) {
  return movements.filter((m) => {
    const policy = policies[stockKey(m.name, m.unit)];
    return (
      stockMode(m.name, m.unit, policies) === "tracked" &&
      (!policy?.since || m.occurredAt >= policy.since)
    );
  });
}
export function toGrams(value: number, unit: "g" | "lb" | "oz") {
  return (
    value *
    (unit === "lb" ? GRAMS_PER_POUND : unit === "oz" ? GRAMS_PER_OUNCE : 1)
  );
}
export function imperial(grams: number) {
  const sign = grams < 0 ? "-" : "";
  const ounces = Math.round((Math.abs(grams) / GRAMS_PER_OUNCE) * 10) / 10;
  const pounds = Math.floor(ounces / 16);
  return `${sign}${pounds} lb ${new Intl.NumberFormat("es-GT", { maximumFractionDigits: 1 }).format(ounces - pounds * 16)} oz`;
}
