import { z } from "zod";

export const priorityWeightsSchema = z.object({
  coverage: z.coerce.number().min(0).max(100),
  idle: z.coerce.number().min(0).max(100),
  space: z.coerce.number().min(0).max(100),
  value: z.coerce.number().min(0).max(100),
});
export type PriorityWeightsInput = z.infer<typeof priorityWeightsSchema>;

export const alertStatusValues = ["OPEN", "RESOLVED"] as const;

export const resolveAlertSchema = z.object({
  alertId: z.string().min(1),
});
export type ResolveAlertInput = z.infer<typeof resolveAlertSchema>;
