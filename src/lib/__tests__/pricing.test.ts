import { describe, expect, it } from "vitest";
import {
  computeUnitPrice,
  computeOfferPrice,
  computeOfferProgress,
  isBelowFloor,
} from "@/lib/pricing";

describe("computeUnitPrice", () => {
  const tiers = [
    { minQuantity: 10, discountPercent: 5 },
    { minQuantity: 50, discountPercent: 12 },
    { minQuantity: 100, discountPercent: 20 },
  ];

  it("returns list price with no discount below every tier", () => {
    expect(computeUnitPrice(100, tiers, 5)).toEqual({
      unitPrice: 100,
      discountPercent: 0,
      appliedTierMinQuantity: null,
    });
  });

  it("applies the matching tier at its exact threshold", () => {
    expect(computeUnitPrice(100, tiers, 10)).toEqual({
      unitPrice: 95,
      discountPercent: 5,
      appliedTierMinQuantity: 10,
    });
  });

  it("applies the highest tier whose minQuantity is still <= quantity", () => {
    expect(computeUnitPrice(100, tiers, 75)).toEqual({
      unitPrice: 88,
      discountPercent: 12,
      appliedTierMinQuantity: 50,
    });
  });

  it("does not require tiers to be pre-sorted", () => {
    const shuffled = [tiers[2], tiers[0], tiers[1]];
    expect(computeUnitPrice(100, shuffled, 200).appliedTierMinQuantity).toBe(100);
  });

  it("rounds to 2 decimal places", () => {
    const result = computeUnitPrice(9.99, [{ minQuantity: 1, discountPercent: 10 }], 1);
    expect(result.unitPrice).toBe(8.99);
  });
});

describe("computeOfferPrice", () => {
  it("applies the discount to the list price", () => {
    expect(computeOfferPrice(200, 15)).toBe(170);
  });

  it("returns the list price unchanged at 0% discount", () => {
    expect(computeOfferPrice(200, 0)).toBe(200);
  });
});

describe("isBelowFloor", () => {
  it("is never below floor when no floor is configured", () => {
    expect(isBelowFloor(1, null)).toBe(false);
  });

  it("flags a price strictly below the floor", () => {
    expect(isBelowFloor(49.99, 50)).toBe(true);
  });

  it("does not flag a price exactly at the floor", () => {
    expect(isBelowFloor(50, 50)).toBe(false);
  });
});

describe("computeOfferProgress", () => {
  it("computes reduced quantity and progress toward the target", () => {
    const result = computeOfferProgress({
      initialQuantityOnHand: 300,
      currentQuantityOnHand: 220,
      targetReduceQuantity: 100,
    });
    expect(result.reducedQuantity).toBe(80);
    expect(result.progressPercent).toBe(80);
  });

  it("clamps progress at 100% even if reduction overshoots the target", () => {
    const result = computeOfferProgress({
      initialQuantityOnHand: 300,
      currentQuantityOnHand: 50,
      targetReduceQuantity: 100,
    });
    expect(result.progressPercent).toBe(100);
  });

  it("never reports negative reduction when stock grew (e.g. a restock)", () => {
    const result = computeOfferProgress({
      initialQuantityOnHand: 100,
      currentQuantityOnHand: 150,
      targetReduceQuantity: 50,
    });
    expect(result.reducedQuantity).toBe(0);
    expect(result.progressPercent).toBe(0);
  });

  it("returns 0% progress when no target was set", () => {
    const result = computeOfferProgress({
      initialQuantityOnHand: 100,
      currentQuantityOnHand: 50,
      targetReduceQuantity: 0,
    });
    expect(result.progressPercent).toBe(0);
  });
});
