/**
 * Pure order/cart math (docs/ARCHITECTURE.md §9/§29 — "economia calculada").
 * No Prisma, no "server-only" — importable from Next.js server code and
 * directly from prisma/seed.ts via tsx.
 */

import { computeUnitPrice, computeOfferPrice, type PriceTierInput } from "@/lib/pricing";

export type DiscountSource = "NONE" | "TIER" | "OFFER";

export interface LineUnitPriceResult {
  unitPrice: number;
  listPriceUnitPrice: number;
  discountPercent: number;
  discountSource: DiscountSource;
}

/**
 * Resolves the unit price for one cart line. An active offer always wins
 * over a quantity tier — a promotional discount is a deliberate override of
 * the normal pricing table, not something a bulk-quantity tier should be
 * allowed to beat or stack with (kept as an explicit, documented rule
 * rather than an implicit "whichever is lower").
 */
export function resolveLineUnitPrice(
  listPrice: number,
  tiers: PriceTierInput[],
  quantity: number,
  activeOfferDiscountPercent: number | null,
): LineUnitPriceResult {
  if (activeOfferDiscountPercent !== null) {
    return {
      unitPrice: computeOfferPrice(listPrice, activeOfferDiscountPercent),
      listPriceUnitPrice: listPrice,
      discountPercent: activeOfferDiscountPercent,
      discountSource: "OFFER",
    };
  }

  const tierResult = computeUnitPrice(listPrice, tiers, quantity);
  return {
    unitPrice: tierResult.unitPrice,
    listPriceUnitPrice: listPrice,
    discountPercent: tierResult.discountPercent,
    discountSource: tierResult.appliedTierMinQuantity !== null ? "TIER" : "NONE",
  };
}

export interface OrderLineTotals {
  quantity: number;
  unitPrice: number;
  listPriceUnitPrice: number;
}

export interface OrderTotals {
  subtotal: number;
  listSubtotal: number;
  savings: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Aggregate totals across an order/cart's lines. `savings` is a plain
 * subtraction of two real sums, never a separately-estimated number —
 * the same "don't invent a figure that isn't a computation over data you
 * already have" rule as the Smart Stock Engine (§4/§19).
 */
export function computeOrderTotals(lines: OrderLineTotals[]): OrderTotals {
  const subtotal = round2(lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0));
  const listSubtotal = round2(lines.reduce((sum, line) => sum + line.listPriceUnitPrice * line.quantity, 0));
  return { subtotal, listSubtotal, savings: round2(listSubtotal - subtotal) };
}
