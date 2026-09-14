import { z } from "zod";
import { optionalText } from "@/lib/validation/shared";

export const warehouseSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(1)
    .max(10)
    .regex(/^[A-Z0-9]+$/, "Use apenas letras e números."),
  name: z.string().trim().min(2).max(150),
});
export type WarehouseInput = z.infer<typeof warehouseSchema>;

const addressSegment = z
  .string()
  .trim()
  .toUpperCase()
  .min(1)
  .max(10)
  .regex(/^[A-Z0-9]+$/, "Use apenas letras e números.");

export const storageLocationSchema = z.object({
  warehouseId: z.string().min(1),
  area: optionalText(100),
  corridor: addressSegment,
  rack: addressSegment,
  level: addressSegment,
  position: addressSegment,
  notes: optionalText(300),
});
export type StorageLocationInput = z.infer<typeof storageLocationSchema>;

export const bulkGenerateSchema = z.object({
  warehouseId: z.string().min(1),
  area: optionalText(100),
  corridor: addressSegment,
  rack: addressSegment,
  levelCount: z.coerce.number().int().min(1).max(50),
  positionsPerLevel: z.coerce.number().int().min(1).max(50),
});
export type BulkGenerateInput = z.infer<typeof bulkGenerateSchema>;

export const allocationSchema = z.object({
  productId: z.string().min(1),
  storageLocationId: z.string().min(1),
  quantity: z.coerce.number().int().min(0),
});
export type AllocationInput = z.infer<typeof allocationSchema>;

export const manualStatusValues = ["AVAILABLE", "RESERVED", "BLOCKED"] as const;

export const statusChangeSchema = z.object({
  storageLocationId: z.string().min(1),
  status: z.enum(manualStatusValues),
});
export type StatusChangeInput = z.infer<typeof statusChangeSchema>;

export const nonStandardSchema = z.object({
  storageLocationId: z.string().min(1),
  // NOT z.coerce.boolean(): that runs JS's Boolean(value), and Boolean("false")
  // is true (any non-empty string is truthy) — silently ignoring an
  // explicit "unmark" request from a <form> field, which only ever sends
  // strings. Parse the literal "true"/"false" the form sends instead.
  isNonStandard: z.enum(["true", "false"]).transform((v) => v === "true"),
  note: optionalText(300),
});
export type NonStandardInput = z.infer<typeof nonStandardSchema>;

export const baselineSchema = z.object({
  count: z.coerce.number().int().min(0),
});
export type BaselineInput = z.infer<typeof baselineSchema>;
