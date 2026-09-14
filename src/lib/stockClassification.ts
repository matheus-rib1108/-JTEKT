/**
 * Pure Smart Stock Engine math (§3/§4 of the product brief). No Prisma, no
 * "server-only" — this module is imported both from the Next.js server
 * (src/server/analytics/engine.ts) and directly from prisma/seed.ts via
 * tsx, which cannot resolve "server-only".
 *
 * Every function here is a straight computation over numbers the caller
 * already gathered from the database. None of them invent a result when
 * the input doesn't support one — they return `null` instead (§19: "não
 * apresentar resultados como fatos se não houver dados suficientes").
 */

export type AbcClass = "A" | "B" | "C";
export type XyzClass = "X" | "Y" | "Z";

// ---------------------------------------------------------------------------
// XYZ — demand variability, per product
// ---------------------------------------------------------------------------

const XYZ_MIN_PERIODS = 3;

/**
 * Classifies demand predictability from a series of per-period consumption
 * (e.g. monthly units sold/consumed, oldest first). Standard coefficient-of-
 * variation thresholds (CV = stddev / mean): X ≤ 0.5 (predictable), Y ≤ 1.0
 * (variable), Z > 1.0 (irregular).
 *
 * Returns null — not "Z" — when there isn't enough history to say anything:
 * fewer than XYZ_MIN_PERIODS periods, or a flat all-zero series (no
 * variability to measure is not the same as "highly irregular").
 */
export function computeXYZ(periodConsumption: number[]): XyzClass | null {
  if (periodConsumption.length < XYZ_MIN_PERIODS) return null;

  const mean = average(periodConsumption);
  if (mean === 0) return null;

  const cv = populationStdDev(periodConsumption, mean) / mean;
  if (cv <= 0.5) return "X";
  if (cv <= 1.0) return "Y";
  return "Z";
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function populationStdDev(values: number[], mean: number): number {
  const variance = average(values.map((v) => (v - mean) ** 2));
  return Math.sqrt(variance);
}

// ---------------------------------------------------------------------------
// ABC — financial impact, ranked across the whole tenant (Pareto)
// ---------------------------------------------------------------------------

const ABC_A_CUTOFF = 0.8; // cumulative share of total value
const ABC_B_CUTOFF = 0.95;

export interface AbcInputItem {
  productId: string;
  value: number; // e.g. quantityOnHand * unitCost
}

/**
 * Classic ABC/Pareto split by cumulative value share: A = top items making
 * up to 80% of total value, B = next slice up to 95%, C = the rest.
 * `items` must already exclude products with no cost data — ranking them at
 * value 0 would misclassify "unknown" as "least important" instead of
 * leaving them out of ABC entirely.
 */
export function computeABC(items: AbcInputItem[]): Map<string, AbcClass> {
  const result = new Map<string, AbcClass>();
  if (items.length === 0) return result;

  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return result;

  const sorted = [...items].sort((a, b) => b.value - a.value);

  // Classify each item by the cumulative share of everything ranked ABOVE
  // it, not including its own value. Using the post-item cumulative instead
  // would misclassify the very item that pushes past a cutoff as belonging
  // to the *next* class — e.g. a single product holding 100% of all value
  // would land in C (cumulative share 1.0 > every cutoff) instead of A,
  // and a two-item split of 99.9%/0.1% would put the dominant item in C
  // too. The item that completes the "vital few" is still one of them.
  let cumulativeBefore = 0;
  for (const item of sorted) {
    const shareBefore = cumulativeBefore / total;
    result.set(item.productId, shareBefore < ABC_A_CUTOFF ? "A" : shareBefore < ABC_B_CUTOFF ? "B" : "C");
    cumulativeBefore += item.value;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Reduction priority index (0-100) — §4
// ---------------------------------------------------------------------------

export interface PriorityWeights {
  coverage: number; // "dias de estoque" / low turnover
  idle: number; // days since last movement
  space: number; // positions occupied
  value: number; // value tied up
}

export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  coverage: 35,
  idle: 25,
  space: 20,
  value: 20,
};

export interface PriorityInput {
  /** Days of on-hand stock at current consumption rate; null when there is
   * no recorded consumption to divide by (treated as maximal coverage —
   * stock nobody has drawn down looks exactly like infinite coverage). */
  coverageDays: number | null;
  /** Days since the last inventory movement of any kind; null only for a
   * product with zero movements ever (too new to call "idle"). */
  daysSinceLastMovement: number | null;
  occupiedPositions: number;
  /** quantityOnHand * unitCost; null when unitCost is not set. */
  valueTied: number | null;
  abcClass: AbcClass | null;
}

// Normalization caps: the point past which a factor scores the full 100.
// These are fixed methodology constants (not admin-configurable) — only the
// relative weights below are.
const COVERAGE_DAYS_CAP = 180;
const IDLE_DAYS_CAP = 180;
const OCCUPIED_POSITIONS_CAP = 10;
const VALUE_TIED_CAP = 50_000;

// A-class items are usually too important to push into aggressive reduction
// (§3: "normalmente não deve receber descontos agressivos") — dampen, don't
// zero out, since a slow-moving A item can still be worth flagging.
const ABC_A_DAMPENING = 0.7;

export interface PriorityResult {
  score: number;
  factors: {
    coverageDays: number | null;
    coverageScore: number;
    daysSinceLastMovement: number | null;
    idleScore: number;
    occupiedPositions: number;
    spaceScore: number;
    valueTied: number | null;
    valueScore: number;
    weightsUsed: PriorityWeights;
    abcDampeningApplied: boolean;
    scoreBeforeDampening: number;
  };
}

function clampToPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

export function computePriorityScore(input: PriorityInput, weights: PriorityWeights): PriorityResult {
  const coverageScore =
    input.coverageDays === null ? 100 : clampToPercent((input.coverageDays / COVERAGE_DAYS_CAP) * 100);

  const idleScore =
    input.daysSinceLastMovement === null
      ? 0
      : clampToPercent((input.daysSinceLastMovement / IDLE_DAYS_CAP) * 100);

  const spaceScore = clampToPercent((input.occupiedPositions / OCCUPIED_POSITIONS_CAP) * 100);

  const valueScore = input.valueTied === null ? 0 : clampToPercent((input.valueTied / VALUE_TIED_CAP) * 100);

  const weightSum = weights.coverage + weights.idle + weights.space + weights.value;
  const normalized: PriorityWeights =
    weightSum > 0
      ? {
          coverage: weights.coverage / weightSum,
          idle: weights.idle / weightSum,
          space: weights.space / weightSum,
          value: weights.value / weightSum,
        }
      : DEFAULT_PRIORITY_WEIGHTS;

  const rawScore =
    coverageScore * normalized.coverage +
    idleScore * normalized.idle +
    spaceScore * normalized.space +
    valueScore * normalized.value;

  const abcDampeningApplied = input.abcClass === "A";
  const finalScore = Math.round(clampToPercent(abcDampeningApplied ? rawScore * ABC_A_DAMPENING : rawScore));

  return {
    score: finalScore,
    factors: {
      coverageDays: input.coverageDays,
      coverageScore,
      daysSinceLastMovement: input.daysSinceLastMovement,
      idleScore,
      occupiedPositions: input.occupiedPositions,
      spaceScore,
      valueTied: input.valueTied,
      valueScore,
      weightsUsed: weights,
      abcDampeningApplied,
      scoreBeforeDampening: Math.round(clampToPercent(rawScore)),
    },
  };
}
