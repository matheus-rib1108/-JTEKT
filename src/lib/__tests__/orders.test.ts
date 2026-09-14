import { describe, expect, it } from "vitest";
import { resolveLineUnitPrice, computeOrderTotals } from "@/lib/orders";

describe("resolveLineUnitPrice", () => {
  const tiers = [
    { minQuantity: 10, discountPercent: 5 },
    { minQuantity: 50, discountPercent: 12 },
  ];

  it("applies list price with no discount below every tier and no offer", () => {
    expect(resolveLineUnitPrice(100, tiers, 5, null)).toEqual({
      unitPrice: 100,
      listPriceUnitPrice: 100,
      discountPercent: 0,
      discountSource: "NONE",
    });
  });

  it("applies the matching tier when there is no active offer", () => {
    expect(resolveLineUnitPrice(100, tiers, 50, null)).toEqual({
      unitPrice: 88,
      listPriceUnitPrice: 100,
      discountPercent: 12,
      discountSource: "TIER",
    });
  });

  it("an active offer always wins over a quantity tier, even a better one", () => {
    // The tier at qty=50 (12%) would be a bigger discount than the 8% offer,
    // but the offer still applies — it's a deliberate override, not "best of".
    expect(resolveLineUnitPrice(100, tiers, 50, 8)).toEqual({
      unitPrice: 92,
      listPriceUnitPrice: 100,
      discountPercent: 8,
      discountSource: "OFFER",
    });
  });

  it("an active offer applies even below every tier's minQuantity", () => {
    expect(resolveLineUnitPrice(100, tiers, 1, 20)).toEqual({
      unitPrice: 80,
      listPriceUnitPrice: 100,
      discountPercent: 20,
      discountSource: "OFFER",
    });
  });
});

describe("computeOrderTotals", () => {
  it("sums quantity-weighted subtotal, list subtotal and savings", () => {
    const totals = computeOrderTotals([
      { quantity: 10, unitPrice: 9, listPriceUnitPrice: 10 },
      { quantity: 2, unitPrice: 50, listPriceUnitPrice: 50 },
    ]);
    expect(totals.subtotal).toBe(190);
    expect(totals.listSubtotal).toBe(200);
    expect(totals.savings).toBe(10);
  });

  it("returns zero totals for an empty cart", () => {
    expect(computeOrderTotals([])).toEqual({ subtotal: 0, listSubtotal: 0, savings: 0 });
  });

  it("reports zero savings when nothing was discounted", () => {
    const totals = computeOrderTotals([{ quantity: 3, unitPrice: 20, listPriceUnitPrice: 20 }]);
    expect(totals.savings).toBe(0);
  });
});
