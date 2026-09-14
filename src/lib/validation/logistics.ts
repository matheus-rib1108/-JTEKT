import { z } from "zod";
import { optionalText } from "@/lib/validation/shared";

export const orderIdSchema = z.object({
  orderId: z.string().min(1),
});

export const shipmentIdSchema = z.object({
  shipmentId: z.string().min(1),
});

export const markShippedSchema = z.object({
  shipmentId: z.string().min(1),
  carrierName: optionalText(150),
  trackingCode: optionalText(150),
});
