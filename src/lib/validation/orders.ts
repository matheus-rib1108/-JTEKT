import { z } from "zod";
import { optionalText } from "@/lib/validation/shared";

export const addCartItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(1_000_000),
});
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

export const updateCartItemSchema = z.object({
  itemId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(1_000_000),
});

export const removeCartItemSchema = z.object({
  itemId: z.string().min(1),
});

export const orderIdSchema = z.object({
  orderId: z.string().min(1),
});

export const cancelOrderSchema = z.object({
  orderId: z.string().min(1),
  reason: optionalText(500),
});
