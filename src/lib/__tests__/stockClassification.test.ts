import { describe, expect, it } from "vitest";
import {
  computeXYZ,
  computeABC,
  computePriorityScore,
  DEFAULT_PRIORITY_WEIGHTS,
} from "@/lib/stockClassification";

describe("computeXYZ", () => {
  it("returns null with fewer than 3 periods (never fabricates a class)", () => {
    expect(computeXYZ([10, 12])).toBeNull();
  });

  it("returns null for a flat all-zero series (no demand to measure variability from)", () => {
    expect(computeXYZ([0, 0, 0, 0])).toBeNull();
  });

  it("classifies a stable series as X (low coefficient of variation)", () => {
    expect(computeXYZ([100, 105, 98, 102])).toBe("X");
  });

  it("classifies a moderately variable series as Y", () => {
    expect(computeXYZ([100, 40, 160, 60])).toBe("Y");
  });

  it("classifies a wildly irregular series as Z", () => {
    expect(computeXYZ([500, 5, 300, 10])).toBe("Z");
  });
});

describe("computeABC", () => {
  it("returns an empty map for no items", () => {
    expect(computeABC([]).size).toBe(0);
  });

  it("returns an empty map when total value is zero (nothing to rank)", () => {
    const result = computeABC([{ productId: "p1", value: 0 }, { productId: "p2", value: 0 }]);
    expect(result.size).toBe(0);
  });

  it("puts the single dominant item in A and small items in C (classic Pareto)", () => {
    const result = computeABC([
      { productId: "big", value: 8000 },
      { productId: "medium", value: 1500 },
      { productId: "small", value: 500 },
    ]);
    expect(result.get("big")).toBe("A");
    expect(result.get("small")).toBe("C");
  });

  it("classifies every item when there is only one (100% of value, still A)", () => {
    const result = computeABC([{ productId: "only", value: 100 }]);
    expect(result.get("only")).toBe("A");
  });

  it("regression: the single most valuable item stays A even when it alone dominates the total", () => {
    // Before the fix, using post-item cumulative share, this item's own
    // 99.9% share would push it past every cutoff and misclassify it C —
    // exactly backwards for the item that IS almost all of the inventory.
    const result = computeABC([
      { productId: "dominant", value: 9990 },
      { productId: "tiny", value: 10 },
    ]);
    expect(result.get("dominant")).toBe("A");
    expect(result.get("tiny")).toBe("C");
  });
});

describe("computePriorityScore", () => {
  it("scores a high-coverage, long-idle, space-heavy product near the top", () => {
    const result = computePriorityScore(
      {
        coverageDays: 200,
        daysSinceLastMovement: 200,
        occupiedPositions: 10,
        valueTied: 50_000,
        abcClass: null,
      },
      DEFAULT_PRIORITY_WEIGHTS,
    );
    expect(result.score).toBeGreaterThanOrEqual(95);
  });

  it("scores a fresh, fast-moving, single-position product near the bottom", () => {
    const result = computePriorityScore(
      {
        coverageDays: 5,
        daysSinceLastMovement: 1,
        occupiedPositions: 1,
        valueTied: 100,
        abcClass: null,
      },
      DEFAULT_PRIORITY_WEIGHTS,
    );
    expect(result.score).toBeLessThan(20);
  });

  it("treats null coverageDays (no consumption ever recorded) as maximal coverage concern", () => {
    const result = computePriorityScore(
      { coverageDays: null, daysSinceLastMovement: 1, occupiedPositions: 1, valueTied: null, abcClass: null },
      DEFAULT_PRIORITY_WEIGHTS,
    );
    expect(result.factors.coverageScore).toBe(100);
  });

  it("treats null daysSinceLastMovement (brand new product) as not idle", () => {
    const result = computePriorityScore(
      { coverageDays: 0, daysSinceLastMovement: null, occupiedPositions: 0, valueTied: null, abcClass: null },
      DEFAULT_PRIORITY_WEIGHTS,
    );
    expect(result.factors.idleScore).toBe(0);
  });

  it("dampens the score for ABC-A products (brief: don't push critical items into aggressive reduction)", () => {
    const base = { coverageDays: 200, daysSinceLastMovement: 200, occupiedPositions: 10, valueTied: 50_000 };
    const withoutA = computePriorityScore({ ...base, abcClass: "C" }, DEFAULT_PRIORITY_WEIGHTS);
    const withA = computePriorityScore({ ...base, abcClass: "A" }, DEFAULT_PRIORITY_WEIGHTS);
    expect(withA.score).toBeLessThan(withoutA.score);
    expect(withA.factors.abcDampeningApplied).toBe(true);
  });

  it("normalizes weights that don't sum to 100 rather than distorting the score", () => {
    const a = computePriorityScore(
      { coverageDays: 100, daysSinceLastMovement: 100, occupiedPositions: 5, valueTied: 25_000, abcClass: null },
      { coverage: 35, idle: 25, space: 20, value: 20 },
    );
    const b = computePriorityScore(
      { coverageDays: 100, daysSinceLastMovement: 100, occupiedPositions: 5, valueTied: 25_000, abcClass: null },
      { coverage: 70, idle: 50, space: 40, value: 40 }, // same ratios, doubled
    );
    expect(a.score).toBe(b.score);
  });
});
