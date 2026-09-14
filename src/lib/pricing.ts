/**
 * Pure pricing math (docs/ARCHITECTURE.md §9/§10 — pricing engine and
 * offers). No Prisma, no "server-only": imported both from Next.js server
 * code and directly from prisma/seed.ts via tsx.
 *
 * Every function here is a straight computation over numbers the caller
 * already has. None of them decide whether a price is *allowed* to be
 * saved below the margin floor — that policy call (who may override it,
 * and that it must be audited) lives in src/app/admin/precos/actions.ts,
 * not here.
 */

export interface PriceTierInput {
  minQuantity: number;
  discountPercent: number;
}

export interface UnitPriceResult {
  unitPrice: number;
  discountPercent: number;
  /** The tier that was applied, or null when buying at list price (no tier
   * matched, e.g. quantity below every tier's minQuantity). */
  appliedTierMinQuantity: number | null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function applyDiscount(listPrice: number, discountPercent: number): number {
  return round2(listPrice * (1 - discountPercent / 100));
}

/**
 * Resolves the unit price for buying `quantity` units at `listPrice`,
 * applying the best-matching quantity tier: the tier with the highest
 * `minQuantity` that is still `<= quantity`. Tiers are not required to be
 * pre-sorted.
 */
export function computeUnitPrice(
  listPrice: number,
  tiers: PriceTierInput[],
  quantity: number,
): UnitPriceResult {
  const applicable = tiers
    .filter((tier) => tier.minQuantity <= quantity)
    .sort((a, b) => b.minQuantity - a.minQuantity)[0];

  if (!applicable) {
    return { unitPrice: round2(listPrice), discountPercent: 0, appliedTierMinQuantity: null };
  }

  return {
    unitPrice: applyDiscount(listPrice, applicable.discountPercent),
    discountPercent: applicable.discountPercent,
    appliedTierMinQuantity: applicable.minQuantity,
  };
}

/** The price a promotional offer results in — same discount formula as a
 * quantity tier, just keyed by the offer's own discountPercent instead of a
 * quantity threshold. */
export function computeOfferPrice(listPrice: number, discountPercent: number): number {
  return applyDiscount(listPrice, discountPercent);
}

/** True when `price` sits strictly below the configured floor. A null
 * `minPrice` means no floor has been configured yet — never treated as "no
 * floor at all" by silently allowing anything, only by the caller deciding
 * what to do about a missing floor (typically: block anyway, see
 * src/app/admin/ofertas/actions.ts). */
export function isBelowFloor(price: number, minPrice: number | null): boolean {
  if (minPrice === null) return false;
  return price < minPrice;
}

export interface OfferProgressInput {
  initialQuantityOnHand: number;
  currentQuantityOnHand: number;
  targetReduceQuantity: number;
}

export interface OfferProgressResult {
  /** Units actually drawn down since the offer started — never negative,
   * even if on-hand stock grew (e.g. a restock) after the offer began. */
  reducedQuantity: number;
  progressPercent: number;
}

/**
 * Progress toward an offer's reduction target, computed purely from real
 * on-hand snapshots (never estimated from the discount or from time
 * elapsed) — consistent with the Smart Stock Engine's "never invent a
 * number" rule (§4/§19).
 */
export function computeOfferProgress(input: OfferProgressInput): OfferProgressResult {
  const reducedQuantity = Math.max(0, input.initialQuantityOnHand - input.currentQuantityOnHand);
  const progressPercent =
    input.targetReduceQuantity > 0
      ? Math.max(0, Math.min(100, Math.round((reducedQuantity / input.targetReduceQuantity) * 100)))
      : 0;
  return { reducedQuantity, progressPercent };
}
