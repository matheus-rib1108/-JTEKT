import { z } from "zod";
import { optionalText } from "@/lib/validation/shared";

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(150),
  description: optionalText(500),
  parentId: optionalText(200),
});
export type CategoryInput = z.infer<typeof categorySchema>;

const specificationEntrySchema = z.object({
  key: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(200),
});

export const specificationsSchema = z.array(specificationEntrySchema).max(40);
export type SpecificationEntry = z.infer<typeof specificationEntrySchema>;

export const productStatusValues = ["DRAFT", "ACTIVE", "DISCONTINUED"] as const;

export const productSchema = z.object({
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .min(2)
    .max(50)
    .regex(/^[A-Z0-9._-]+$/, "Use apenas letras, números, ponto, hífen e underscore."),
  name: z.string().trim().min(2).max(200),
  description: optionalText(2000),
  categoryId: optionalText(200),
  manufacturer: optionalText(150),
  model: optionalText(150),
  unit: z.string().trim().min(1).max(10).default("UN"),
  minCommercialQuantity: z.coerce.number().int().min(1).max(1_000_000),
  status: z.enum(productStatusValues),
  // Inventory-valuation unit cost, NOT the Phase 6 pricing engine (§3).
  // Null when empty — excluded from ABC ranking rather than guessed.
  unitCost: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().min(0).max(999_999_999).optional(),
  ),
  specifications: z
    .string()
    .optional()
    .transform((raw, ctx) => {
      if (!raw) return [] as SpecificationEntry[];
      try {
        const parsed = JSON.parse(raw);
        return specificationsSchema.parse(parsed);
      } catch {
        ctx.addIssue({ code: "custom", message: "Especificações técnicas inválidas." });
        return [] as SpecificationEntry[];
      }
    }),
});
export type ProductInput = z.infer<typeof productSchema>;

export const movementTypeValues = [
  "ENTRADA",
  "SAIDA",
  "AJUSTE",
  "RESERVA",
  "LIBERACAO_RESERVA",
  "BLOQUEIO",
  "DESBLOQUEIO",
] as const;

export const movementSchema = z
  .object({
    productId: z.string().min(1),
    type: z.enum(movementTypeValues),
    quantity: z.coerce.number().int(),
    reason: optionalText(300),
  })
  .superRefine((data, ctx) => {
    if (data.quantity === 0) {
      ctx.addIssue({ code: "custom", path: ["quantity"], message: "Informe uma quantidade diferente de zero." });
      return;
    }
    // Only AJUSTE (manual correction) may carry a negative delta — every
    // other movement type has an implied direction and must be a positive
    // magnitude, otherwise "SAIDA de -10" would silently mean "ENTRADA".
    if (data.type !== "AJUSTE" && data.quantity < 0) {
      ctx.addIssue({
        code: "custom",
        path: ["quantity"],
        message: "Apenas ajustes manuais podem ser negativos.",
      });
    }
  });
export type MovementInput = z.infer<typeof movementSchema>;

export const inventorySettingsSchema = z.object({
  productId: z.string().min(1),
  quantityAvailableToSell: z.coerce.number().int().min(0),
  reorderPoint: z.coerce.number().int().min(0).optional(),
  maxStock: z.coerce.number().int().min(0).optional(),
  safetyStock: z.coerce.number().int().min(0).optional(),
});
export type InventorySettingsInput = z.infer<typeof inventorySettingsSchema>;
