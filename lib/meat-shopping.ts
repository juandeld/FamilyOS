import { meals, profiles, recipes, type Profile, type State } from './domain';

export type PurchasePeriod = 10 | 15 | 30;
export type Macros = { kcal: number; protein: number; carbs: number; fat: number };
export type RecipeSnapshot = Pick<(typeof recipes)[number], 'id' | 'name' | 'meal' | 'ingredients' | 'macros'>;
export type Preparation = {
  id: string; name: string; person: string; date: string; feedback: string;
  recipeId?: string; preparedAt?: string; recipeSnapshot?: RecipeSnapshot;
};
export const SAFETY_MARGIN = 0.15;
// Explicit planning assumption: one occurrence of each meal per day.
export const MEAL_SHARES: Record<string, number> = { Desayuno: .25, Almuerzo: .4, Cena: .35 };
const meats: Record<string, { label: string; basis: string }> = {
  Pollo: { label: 'Pollo', basis: 'Peso crudo de la receta; corte y hueso sin especificar' },
  Pescado: { label: 'Pescado', basis: 'Peso crudo de la receta; especie y corte sin especificar' },
  'Carne de res': { label: 'Carne de res', basis: 'Peso crudo de la receta; corte sin especificar' },
  'Atún escurrido': { label: 'Atún en conserva', basis: 'Peso escurrido; no equivale al peso bruto de la lata' },
};

/** Best proportional fit to all four meal targets, using relative squared error.
 * This scales a whole recipe, not just its meat. It does not solve a diet or
 * promise that four independent targets can be met with a single multiplier. */
export function portionScale(base: Macros, daily: Macros, share: number): number | null {
  const keys = ['kcal', 'protein', 'carbs', 'fat'] as const;
  if (!base || !daily) return null;
  if (!Number.isFinite(share) || share <= 0) return null;
  if (keys.some(k => !Number.isFinite(base[k]) || base[k] <= 0 || !Number.isFinite(daily[k]) || daily[k] <= 0)) return null;
  const ratios = keys.map(k => base[k] / (daily[k] * share));
  const scale = ratios.reduce((a,b) => a+b,0) / ratios.reduce((a,b) => a+b*b,0);
  return Number.isFinite(scale) && scale > 0 ? scale : null;
}

function resolveRecipe(event: Preparation): RecipeSnapshot | undefined {
  // Immutable snapshot takes priority. Legacy entries can be matched exactly,
  // without trying to parse locale-dependent dates or inventing timestamps.
  if (event.recipeSnapshot) return event.recipeSnapshot;
  return event.recipeId ? recipes.find(r => r.id === event.recipeId) : recipes.find(r => r.name === event.name);
}

export function forecastMeat(history: Preparation[], goals: State['goals'], period: PurchasePeriod) {
  if (![10,15,30].includes(period)) throw new Error('Período de compra inválido');
  const grouped = new Map<string, { recipe: RecipeSnapshot; scale: number; eventId: string }[]>();
  const warnings = new Set<string>();
  const missing: string[] = [];
  let legacyEvents = 0;
  let ignoredEvents = 0;
  for (const event of history) {
    if (!profiles.includes(event.person as Profile)) { ignoredEvents++; continue; }
    const recipe = resolveRecipe(event);
    if (!recipe || !meals.includes(recipe.meal) || recipe.ingredients.some(i => !Number.isFinite(i.quantity) || i.quantity <= 0)) {
      warnings.add(`Preparación de ${event.person} sin receta o cantidades utilizables: ${event.name}.`);
      ignoredEvents++; continue;
    }
    const person = event.person as Profile;
    let scale = 1;
    if (person === 'Juan' || person === 'Pamela') {
      const calculated = portionScale(recipe.macros, goals[person], MEAL_SHARES[recipe.meal]);
      if (calculated === null) { warnings.add(`Revisa los cuatro objetivos positivos de ${person} y los macros de ${recipe.name}.`); ignoredEvents++; continue; }
      scale = calculated;
    }
    if (!event.recipeSnapshot) legacyEvents++;
    const key = `${person}|${recipe.meal}`;
    const samples = grouped.get(key) || [];
    samples.push({ recipe, scale, eventId: event.id });
    grouped.set(key, samples);
  }
  const byMeat: Record<string, { name: string; stockName: string; basis: string; baseGrams: number; safetyGrams: number; purchaseGrams: number; people: Partial<Record<Profile, number>>; sources: { person: Profile; recipe: string; meal: string; samples: number; totalSamples: number; scale: number; grams: number }[] }> = {};
  for (const person of profiles) for (const meal of meals) {
    const samples = grouped.get(`${person}|${meal}`);
    if (!samples?.length) { missing.push(`${person} · ${meal}`); continue; }
    // Every recorded recipe (including vegetarian dishes) contributes to the
    // denominator. No inferred eating frequency from incomplete dated logs.
    const recipeGroups = new Map<string, { recipe: RecipeSnapshot; scale: number; samples: number }>();
    for (const sample of samples) {
      const key = JSON.stringify(sample.recipe);
      const existing = recipeGroups.get(key);
      if (existing) existing.samples++;
      else recipeGroups.set(key, { recipe: sample.recipe, scale: sample.scale, samples: 1 });
    }
    for (const {recipe, scale, samples: count} of recipeGroups.values()) {
      for (const ingredient of recipe.ingredients) {
        const meat = meats[ingredient.name];
        if (!meat) continue; // Eggs/dairy/legumes are not classified as meat.
        if (ingredient.unit !== 'g') { warnings.add(`Unidad de ${ingredient.name} sin conversión verificada; cantidad excluida.`); continue; }
        const grams = ingredient.quantity * scale * period * count / samples.length;
        byMeat[ingredient.name] ??= { name: meat.label, stockName: ingredient.name, basis: meat.basis, baseGrams: 0, safetyGrams: 0, purchaseGrams: 0, people: {}, sources: [] };
        const row = byMeat[ingredient.name];
        row.baseGrams += grams;
        row.people[person] = (row.people[person] || 0) + grams;
        row.sources.push({ person, recipe: recipe.name, meal, samples: count, totalSamples: samples.length, scale, grams });
      }
    }
  }
  for (const row of Object.values(byMeat)) {
    row.safetyGrams = row.baseGrams * SAFETY_MARGIN;
    row.purchaseGrams = Math.ceil(row.baseGrams * (1 + SAFETY_MARGIN) - 1e-9);
  }
  return { items: Object.values(byMeat), missing, warnings: [...warnings], legacyEvents, ignoredEvents,
    usableEvents: [...grouped.values()].reduce((n,samples)=>n+samples.length,0),
    coveredMeals: grouped.size, totalMeals: profiles.length * meals.length, period,
    partial: missing.length > 0 || warnings.size > 0,
  };
}
