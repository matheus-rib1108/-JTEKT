import { z } from "zod";
import { optionalText } from "@/lib/validation/shared";

const optionalDecimal = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number().min(0).max(999_999_999).optional(),
);

export const productPricingSchema = z.object({
  productId: z.string().min(1),
  listPrice: z.coerce.number().min(0.01).max(999_999_999),
  minPrice: optionalDecimal,
  /** Required only when the caller is exercising the below-floor exception
   * (checked server-side against the current minPrice, not here) — kept
   * optional at the schema level so a normal, non-exception save doesn't
   * need it. */
  exceptionReason: optionalText(500),
});
export type ProductPricingInput = z.infer<typeof productPricingSchema>;

export const priceTierSchema = z.object({
  productId: z.string().min(1),
  minQuantity: z.coerce.number().int().min(1).max(1_000_000),
  discountPercent: z.coerce.number().min(0).max(90),
});
export type PriceTierInput = z.infer<typeof priceTierSchema>;

export const removePriceTierSchema = z.object({
  tierId: z.string().min(1),
});

export const createOfferSchema = z.object({
  productId: z.string().min(1),
  discountPercent: z.coerce.number().min(0.01).max(90),
  targetReduceQuantity: z.coerce.number().int().min(1).max(1_000_000),
  internalReason: optionalText(500),
});
export type CreateOfferInput = z.infer<typeof createOfferSchema>;

export const offerIdSchema = z.object({
  offerId: z.string().min(1),
});
