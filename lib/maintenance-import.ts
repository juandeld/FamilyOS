import { z } from "zod";
import type { MaintenanceData } from "./maintenance";
const short = z.string().max(500);
const plan = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  title: z.string().min(1).max(200),
  area: z.string().min(1).max(80),
  frequency: z.enum(["weekly", "monthly", "quarterly", "semiannual", "annual"]),
  months: z.array(z.number().int().min(1).max(12)).max(12),
  estimatedHours: z.number().finite().positive().max(1000).nullable(),
  materials: z
    .array(
      z.object({ name: short, quantity: short, verified: z.literal(false) }),
    )
    .max(50),
  references: z.array(short).max(50),
  instructions: z.string().max(5000),
  sourceRows: z.array(short).max(100),
  review: z.array(short).max(30),
  priority: z.enum(["high", "normal"]),
  conditionBased: z.boolean(),
  status: z.literal("draft"),
  nextDue: z.null(),
  anchorDay: z.number().int().min(1).max(31),
  owner: z.string().max(120),
  assigneeId: z.literal(""),
});
const schema = z
  .object({
    version: z.literal(1),
    sourceId: z.string().min(1).max(120),
    sourceName: z.string().min(1).max(200),
    importedAt: z.null(),
    analysis: z.array(z.string().max(2000)).max(100),
    plans: z.array(plan).min(1).max(250),
    history: z.array(z.never()).length(0),
  })
  .superRefine((v, ctx) => {
    if (new Set(v.plans.map((p) => p.id)).size !== v.plans.length)
      ctx.addIssue({ code: "custom", message: "Rutinas duplicadas" });
  });
export function parseMaintenanceImport(value: unknown): MaintenanceData {
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new Error(
      "El archivo no es un plan preparado válido. No se importó nada.",
    );
  return {
    ...parsed.data,
    importedAt: new Date().toISOString(),
    plans: parsed.data.plans.map((p) => ({
      ...p,
      owner: "Sin asignar",
      assigneeId: "",
      months: [...new Set(p.months)].sort((a, b) => a - b),
    })),
  };
}
