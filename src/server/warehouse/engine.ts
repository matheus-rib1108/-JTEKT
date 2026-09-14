import "server-only";
import { prisma } from "@/server/db/client";
import type { StorageLocationStatus } from "@prisma/client";

export class WarehouseError extends Error {}

/** Address code exactly matching the brief's example format
 * (A-03-R12-N04-P08): warehouse code, then corridor, rack, level, position. */
export function buildLocationCode(
  warehouseCode: string,
  corridor: string,
  rack: string,
  level: string,
  position: string,
): string {
  return [warehouseCode, corridor, rack, level, position].join("-").toUpperCase();
}

/**
 * AVAILABLE/OCCUPIED are derived from whether anything is allocated at the
 * position — never set by hand. RESERVED/BLOCKED are administrative
 * decisions and are left untouched by allocation changes (§16 status list).
 */
export function deriveStatusAfterAllocationChange(
  currentStatus: StorageLocationStatus,
  totalAllocatedAtLocation: number,
): StorageLocationStatus {
  if (currentStatus === "RESERVED" || currentStatus === "BLOCKED") return currentStatus;
  return totalAllocatedAtLocation > 0 ? "OCCUPIED" : "AVAILABLE";
}

export interface AllocateProductInput {
  tenantId: string;
  productId: string;
  storageLocationId: string;
  quantity: number;
}

export interface AllocateProductResult {
  code: string;
  previousQuantity: number;
  newQuantity: number;
  locationStatusBefore: StorageLocationStatus;
  locationStatusAfter: StorageLocationStatus;
}

/** Sets how much of a product sits at a given position. Quantity 0 removes
 * the allocation. The sum of a product's allocations across every position
 * can never exceed Inventory.quantityOnHand — this is a breakdown of that
 * number, not an independent count. */
export async function allocateProduct(input: AllocateProductInput): Promise<AllocateProductResult> {
  return prisma.$transaction(async (tx) => {
    const location = await tx.storageLocation.findFirst({
      where: { id: input.storageLocationId, tenantId: input.tenantId },
      include: { allocations: true },
    });
    if (!location) throw new WarehouseError("Posição não encontrada.");

    const product = await tx.product.findFirst({
      where: { id: input.productId, tenantId: input.tenantId },
      include: { inventory: true, storageAllocations: true },
    });
    if (!product) throw new WarehouseError("Produto não encontrado.");

    const onHand = product.inventory?.quantityOnHand ?? 0;
    const existingAllocation = product.storageAllocations.find(
      (a) => a.storageLocationId === input.storageLocationId,
    );
    const previousQuantity = existingAllocation?.quantity ?? 0;

    const otherLocationsTotal = product.storageAllocations
      .filter((a) => a.storageLocationId !== input.storageLocationId)
      .reduce((sum, a) => sum + a.quantity, 0);

    if (otherLocationsTotal + input.quantity > onHand) {
      throw new WarehouseError(
        `Quantidade alocada (${otherLocationsTotal + input.quantity}) excede o estoque em mãos (${onHand}).`,
      );
    }

    if (input.quantity === 0) {
      if (existingAllocation) {
        await tx.productStorageLocation.delete({ where: { id: existingAllocation.id } });
      }
    } else if (existingAllocation) {
      await tx.productStorageLocation.update({
        where: { id: existingAllocation.id },
        data: { quantity: input.quantity },
      });
    } else {
      await tx.productStorageLocation.create({
        data: { productId: input.productId, storageLocationId: input.storageLocationId, quantity: input.quantity },
      });
    }

    const remainingAllocationsAtLocation = location.allocations
      .filter((a) => a.productId !== input.productId)
      .reduce((sum, a) => sum + a.quantity, 0);
    const totalAtLocation = remainingAllocationsAtLocation + input.quantity;

    const nextStatus = deriveStatusAfterAllocationChange(location.status, totalAtLocation);
    if (nextStatus !== location.status) {
      await tx.storageLocation.update({ where: { id: location.id }, data: { status: nextStatus } });
    }

    return {
      code: location.code,
      previousQuantity,
      newQuantity: input.quantity,
      locationStatusBefore: location.status,
      locationStatusAfter: nextStatus,
    };
  });
}

export interface SetManualStatusInput {
  tenantId: string;
  storageLocationId: string;
  status: "AVAILABLE" | "RESERVED" | "BLOCKED";
}

/** AVAILABLE/RESERVED/BLOCKED are the only statuses an admin sets directly.
 * Forcing AVAILABLE on an occupied position would desync the map from
 * reality, so it is refused — release the allocations first. */
export async function setManualStatus(input: SetManualStatusInput): Promise<{ before: StorageLocationStatus }> {
  const location = await prisma.storageLocation.findFirst({
    where: { id: input.storageLocationId, tenantId: input.tenantId },
    include: { allocations: true },
  });
  if (!location) throw new WarehouseError("Posição não encontrada.");

  const totalAllocated = location.allocations.reduce((sum, a) => sum + a.quantity, 0);
  if (input.status === "AVAILABLE" && totalAllocated > 0) {
    throw new WarehouseError("Posição possui produto alocado — remova a alocação antes de liberar.");
  }

  await prisma.storageLocation.update({ where: { id: location.id }, data: { status: input.status } });
  return { before: location.status };
}

export interface SetNonStandardInput {
  tenantId: string;
  storageLocationId: string;
  isNonStandard: boolean;
  note?: string | null;
}

export async function setNonStandard(
  input: SetNonStandardInput,
): Promise<{ before: boolean; code: string }> {
  const location = await prisma.storageLocation.findFirst({
    where: { id: input.storageLocationId, tenantId: input.tenantId },
  });
  if (!location) throw new WarehouseError("Posição não encontrada.");

  await prisma.storageLocation.update({
    where: { id: location.id },
    data: {
      isNonStandard: input.isNonStandard,
      nonStandardNote: input.isNonStandard ? input.note || null : null,
    },
  });

  return { before: location.isNonStandard, code: location.code };
}

export interface BulkGenerateInput {
  tenantId: string;
  warehouseId: string;
  area?: string | null;
  corridor: string;
  rack: string;
  levelCount: number;
  positionsPerLevel: number;
}

/** Provisions a rack's worth of addresses in one go — e.g. 4 levels x 8
 * positions = 32 slots named N01..N04 / P01..P08. Idempotent: codes that
 * already exist are skipped rather than erroring, so re-running with a
 * larger count only adds the new ones. */
export async function bulkGeneratePositions(input: BulkGenerateInput): Promise<{ created: number; skipped: number }> {
  const warehouse = await prisma.warehouse.findFirst({
    where: { id: input.warehouseId, tenantId: input.tenantId },
  });
  if (!warehouse) throw new WarehouseError("Galpão não encontrado.");

  let created = 0;
  let skipped = 0;

  for (let levelIndex = 1; levelIndex <= input.levelCount; levelIndex += 1) {
    const level = `N${String(levelIndex).padStart(2, "0")}`;
    for (let positionIndex = 1; positionIndex <= input.positionsPerLevel; positionIndex += 1) {
      const position = `P${String(positionIndex).padStart(2, "0")}`;
      const code = buildLocationCode(warehouse.code, input.corridor, input.rack, level, position);

      const existing = await prisma.storageLocation.findUnique({
        where: { tenantId_code: { tenantId: input.tenantId, code } },
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      await prisma.storageLocation.create({
        data: {
          tenantId: input.tenantId,
          warehouseId: warehouse.id,
          area: input.area || null,
          corridor: input.corridor.toUpperCase(),
          rack: input.rack.toUpperCase(),
          level,
          position,
          code,
        },
      });
      created += 1;
    }
  }

  return { created, skipped };
}
