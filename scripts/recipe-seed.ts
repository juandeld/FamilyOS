import { writeFileSync } from "node:fs";
import { recipes } from "../lib/domain";
const q = (value: unknown) =>
  "'" +
  String(typeof value === "string" ? value : JSON.stringify(value)).replaceAll(
    "'",
    "''",
  ) +
  "'";
const sql =
  "-- Built-in illustrative recipe catalogue; no personal household data.\n" +
  recipes
    .map(
      (r) =>
        `insert into public.recipes(id,name,meal,ingredients,instructions) values(${q(r.id)},${q(r.name)},${q(r.meal)},${q(r.ingredients)}::jsonb,${q(r.steps)}::jsonb);\ninsert into public.recipe_nutrition(recipe_id,macros) values(${q(r.id)},${q(r.macros)}::jsonb);`,
    )
    .join("\n") +
  "\n";
writeFileSync("supabase/migrations/202610190003_recipe_catalog.sql", sql);
