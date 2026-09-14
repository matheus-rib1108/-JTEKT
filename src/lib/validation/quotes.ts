import { z } from "zod";
import { optionalText } from "@/lib/validation/shared";

const optionalDecimal = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number().min(0.01).max(999_999_999).optional(),
);

export const requestQuoteSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(1_000_000),
  requestedPrice: optionalDecimal,
  message: optionalText(1000),
});
export type RequestQuoteInput = z.infer<typeof requestQuoteSchema>;

export const proposeQuoteSchema = z.object({
  quoteId: z.string().min(1),
  proposedUnitPrice: z.coerce.number().min(0.01).max(999_999_999),
  responseMessage: optionalText(1000),
});
export type ProposeQuoteInput = z.infer<typeof proposeQuoteSchema>;

export const quoteIdSchema = z.object({
  quoteId: z.string().min(1),
});
