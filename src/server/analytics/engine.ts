import "server-only";
import { prisma } from "@/server/db/client";
import {
  computeABC,
  computeXYZ,
  computePriorityScore,
  DEFAULT_PRIORITY_WEIGHTS,
  type PriorityWeights,
  type AbcClass,
} from "@/lib/stockClassification";
import { PRIORITY_WEIGHTS_SETTING_KEY } from "@/lib/analytics-constants";
import type { Prisma, AlertType, AlertSeverity } from "@prisma/client";

const CONSUMPTION_WINDOW_MONTHS = 6;
const IDLE_DAYS_THRESHOLD = 90;
const IDLE_DAYS_CRITICAL = 180;
const MANY_POSITIONS_THRESHOLD = 5;

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function lastMonthKeys(count: number, now: Date): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(monthKey(d));
  }
  return keys;
}

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
}

async function getPriorityWeights(tenantId: string): Promise<PriorityWeights> {
  const setting = await prisma.systemSetting.findUnique({
    where: { tenantId_key: { tenantId, key: PRIORITY_WEIGHTS_SETTING_KEY } },
  });
  const value = setting?.value as Partial<PriorityWeights> | undefined;
  if (!value) return DEFAULT_PRIORITY_WEIGHTS;
  return {
    coverage: value.coverage ?? DEFAULT_PRIORITY_WEIGHTS.coverage,
    idle: value.idle ?? DEFAULT_PRIORITY_WEIGHTS.idle,
    space: value.space ?? DEFAULT_PRIORITY_WEIGHTS.space,
    value: value.value ?? DEFAULT_PRIORITY_WEIGHTS.value,
  };
}

export interface RunSummary {
  productsClassified: number;
  alertsOpened: number;
  alertsResolved: number;
  abcCounted: number;
}

/**
 * Recomputes ABC/XYZ/priority for every product in the tenant and
 * regenerates the alert list (§4/§22), in one pass since both need the
 * same underlying data. Never invents a value: XYZ/ABC/coverage stay null
 * wherever the real data doesn't support them (see stockClassification.ts).
 */
export async function runSmartStockEngine(tenantId: string): Promise<RunSummary> {
  const now = new Date();
  const weights = await getPriorityWeights(tenantId);
  const monthKeys = lastMonthKeys(CONSUMPTION_WINDOW_MONTHS, now);
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (CONSUMPTION_WINDOW_MONTHS - 1), 1));

  const products = await prisma.product.findMany({
    where: { tenantId },
    include: {
      inventory: true,
      storageAllocations: true,
      movements: {
        where: { type: "SAIDA", createdAt: { gte: windowStart } },
        select: { quantity: true, createdAt: true },
      },
    },
  });

  // Pass 1: ABC needs value ranked across every product in the tenant at once.
  const abcInputs = products
    .filter((p) => p.unitCost !== null && p.inventory)
    .map((p) => ({
      productId: p.id,
      value: p.inventory!.quantityOnHand * Number(p.unitCost),
    }));
  const abcByProduct = computeABC(abcInputs);

  // Compute every product's classification first (pure, no I/O), then fire
  // all the upserts concurrently instead of one sequential round trip per
  // product — a tenant with a large catalog would otherwise turn a single
  // "recalcular" click into thousands of serial DB round trips.
  const classificationWrites = products
    .filter((product) => product.inventory !== null)
    .map((product) => {
      const consumptionByMonth = new Map(monthKeys.map((k) => [k, 0]));
      for (const movement of product.movements) {
        const key = monthKey(movement.createdAt);
        if (consumptionByMonth.has(key)) {
          consumptionByMonth.set(key, (consumptionByMonth.get(key) ?? 0) + movement.quantity);
        }
      }
      const periodConsumption = monthKeys.map((k) => consumptionByMonth.get(k) ?? 0);
      const totalConsumption = periodConsumption.reduce((s, v) => s + v, 0);
      const avgMonthlyConsumption = totalConsumption / CONSUMPTION_WINDOW_MONTHS;

      const coverageDays =
        avgMonthlyConsumption > 0 ? product.inventory!.quantityOnHand / (avgMonthlyConsumption / 30) : null;

      const daysSinceLastMovement = product.inventory!.lastMovementAt
        ? daysBetween(product.inventory!.lastMovementAt, now)
        : null;

      const occupiedPositions = product.storageAllocations.length;
      const valueTied =
        product.unitCost !== null ? product.inventory!.quantityOnHand * Number(product.unitCost) : null;
      const abcClass: AbcClass | null = abcByProduct.get(product.id) ?? null;
      const xyzClass = computeXYZ(periodConsumption);

      const priority = computePriorityScore(
        { coverageDays, daysSinceLastMovement, occupiedPositions, valueTied, abcClass },
        weights,
      );

      const data = {
        abcClass,
        xyzClass,
        priorityScore: priority.score,
        factors: { ...priority.factors, periodConsumption, monthKeys } as unknown as Prisma.InputJsonObject,
        computedAt: now,
      };

      return prisma.stockClassification.upsert({
        where: { productId: product.id },
        create: { productId: product.id, ...data },
        update: data,
      });
    });

  await Promise.all(classificationWrites);
  const productsClassified = classificationWrites.length;

  const alertResult = await generateAlerts(tenantId, products, now);

  return { productsClassified, abcCounted: abcInputs.length, ...alertResult };
}

interface ProductForAlerts {
  id: string;
  name: string;
  sku: string;
  inventory: { quantityOnHand: number; reorderPoint: number | null; maxStock: number | null; safetyStock: number | null; lastMovementAt: Date | null } | null;
  storageAllocations: { id: string }[];
}

interface DesiredAlert {
  type: AlertType;
  targetKey: string;
  severity: AlertSeverity;
  productId?: string;
  storageLocationId?: string;
  message: string;
  details?: Prisma.InputJsonObject;
}

async function generateAlerts(
  tenantId: string,
  products: ProductForAlerts[],
  now: Date,
): Promise<{ alertsOpened: number; alertsResolved: number }> {
  const desired: DesiredAlert[] = [];

  for (const product of products) {
    if (!product.inventory) continue;
    const inv = product.inventory;

    if (inv.reorderPoint !== null && inv.quantityOnHand < inv.reorderPoint) {
      const critical = inv.safetyStock !== null && inv.quantityOnHand < inv.safetyStock;
      desired.push({
        type: "BELOW_REORDER_POINT",
        targetKey: product.id,
        severity: critical ? "CRITICAL" : "WARNING",
        productId: product.id,
        message: `${product.sku} — estoque (${inv.quantityOnHand}) abaixo do mínimo (${inv.reorderPoint}).`,
        details: { quantityOnHand: inv.quantityOnHand, reorderPoint: inv.reorderPoint },
      });
    }

    if (inv.maxStock !== null && inv.quantityOnHand > inv.maxStock) {
      desired.push({
        type: "ABOVE_MAX_STOCK",
        targetKey: product.id,
        severity: "WARNING",
        productId: product.id,
        message: `${product.sku} — estoque (${inv.quantityOnHand}) acima do máximo (${inv.maxStock}).`,
        details: { quantityOnHand: inv.quantityOnHand, maxStock: inv.maxStock },
      });
    }

    if (inv.lastMovementAt) {
      const idleDays = daysBetween(inv.lastMovementAt, now);
      if (idleDays > IDLE_DAYS_THRESHOLD) {
        desired.push({
          type: "IDLE_STOCK",
          targetKey: product.id,
          severity: idleDays > IDLE_DAYS_CRITICAL ? "CRITICAL" : "WARNING",
          productId: product.id,
          message: `${product.sku} — sem movimentação há ${idleDays} dias.`,
          details: { idleDays },
        });
      }
    }

    if (product.storageAllocations.length > MANY_POSITIONS_THRESHOLD) {
      desired.push({
        type: "MANY_POSITIONS_OCCUPIED",
        targetKey: product.id,
        severity: "INFO",
        productId: product.id,
        message: `${product.sku} — ocupa ${product.storageAllocations.length} posições no armazém.`,
        details: { occupiedPositions: product.storageAllocations.length },
      });
    }
  }

  const nonStandardLocations = await prisma.storageLocation.findMany({
    where: { tenantId, isNonStandard: true },
    select: { id: true, code: true },
  });
  for (const location of nonStandardLocations) {
    desired.push({
      type: "NON_STANDARD_POSITION",
      targetKey: location.id,
      severity: "INFO",
      storageLocationId: location.id,
      message: `Posição ${location.code} fora do padrão de endereçamento.`,
    });
  }

  const desiredKeys = new Set(desired.map((d) => `${d.type}:${d.targetKey}`));

  const existingOpen = await prisma.alert.findMany({
    where: { tenantId, status: "OPEN" },
    select: { id: true, type: true, targetKey: true },
  });

  const toResolve = existingOpen.filter((a) => !desiredKeys.has(`${a.type}:${a.targetKey}`));
  if (toResolve.length > 0) {
    await prisma.alert.updateMany({
      where: { id: { in: toResolve.map((a) => a.id) } },
      data: { status: "RESOLVED", resolvedAt: now },
    });
  }

  // Same reasoning as the classification writes above: fire every alert
  // upsert concurrently rather than one sequential round trip per alert.
  const alertResults = await Promise.all(
    desired.map((d) =>
      prisma.alert.upsert({
        where: { tenantId_type_targetKey: { tenantId, type: d.type, targetKey: d.targetKey } },
        create: {
          tenantId,
          type: d.type,
          targetKey: d.targetKey,
          severity: d.severity,
          productId: d.productId,
          storageLocationId: d.storageLocationId,
          message: d.message,
          details: d.details,
          status: "OPEN",
        },
        update: {
          severity: d.severity,
          message: d.message,
          details: d.details,
          status: "OPEN",
          resolvedAt: null,
        },
      }),
    ),
  );
  const alertsOpened = alertResults.filter((r) => r.createdAt.getTime() === r.updatedAt.getTime()).length;

  return { alertsOpened, alertsResolved: toResolve.length };
}
