import "server-only";
import { prisma } from "@/server/db/client";
import type { InventoryMovementType } from "@prisma/client";

export class InventoryError extends Error {}

export interface InventorySnapshot {
  quantityOnHand: number;
  quantityReserved: number;
  quantityBlocked: number;
  quantityAvailableToSell: number;
}

/** Free stock: physically on hand, minus whatever is already promised
 * (reserved for an order) or set aside (blocked, e.g. quality hold). This
 * is the ceiling for both new reservations/blocks and commercial exposure
 * (§9 — quantityAvailableToSell can never exceed it). */
function freeStock(snapshot: InventorySnapshot): number {
  return snapshot.quantityOnHand - snapshot.quantityReserved - snapshot.quantityBlocked;
}

export function applyMovementToSnapshot(
  snapshot: InventorySnapshot,
  type: InventoryMovementType,
  quantity: number,
): InventorySnapshot {
  const next = { ...snapshot };

  switch (type) {
    case "ENTRADA":
      next.quantityOnHand += quantity;
      break;
    case "SAIDA":
      if (quantity > freeStock(snapshot)) {
        throw new InventoryError("Saída maior que o estoque livre (não reservado/bloqueado).");
      }
      next.quantityOnHand -= quantity;
      break;
    case "AJUSTE":
      if (snapshot.quantityOnHand + quantity < 0) {
        throw new InventoryError("Ajuste resultaria em estoque negativo.");
      }
      next.quantityOnHand += quantity;
      break;
    case "RESERVA":
      if (quantity > freeStock(snapshot)) {
        throw new InventoryError("Quantidade maior que o estoque livre para reserva.");
      }
      next.quantityReserved += quantity;
      break;
    case "LIBERACAO_RESERVA":
      if (quantity > snapshot.quantityReserved) {
        throw new InventoryError("Quantidade maior que a reserva atual.");
      }
      next.quantityReserved -= quantity;
      break;
    case "BLOQUEIO":
      if (quantity > freeStock(snapshot)) {
        throw new InventoryError("Quantidade maior que o estoque livre para bloqueio.");
      }
      next.quantityBlocked += quantity;
      break;
    case "DESBLOQUEIO":
      if (quantity > snapshot.quantityBlocked) {
        throw new InventoryError("Quantidade maior que o bloqueio atual.");
      }
      next.quantityBlocked -= quantity;
      break;
  }

  // Commercial availability can never outrun physically free stock — if a
  // movement shrinks free stock below what was exposed for sale, clamp it
  // down automatically rather than let the storefront oversell.
  const newFreeStock = freeStock(next);
  if (next.quantityAvailableToSell > newFreeStock) {
    next.quantityAvailableToSell = Math.max(0, newFreeStock);
  }

  return next;
}

export interface RegisterMovementInput {
  tenantId: string;
  productId: string;
  type: InventoryMovementType;
  quantity: number;
  reason?: string | null;
  performedById?: string | null;
}

export interface RegisterMovementResult {
  before: InventorySnapshot;
  after: InventorySnapshot;
}

/** Applies a stock movement atomically and appends it to the audit ledger.
 * `quantity` is a positive magnitude for every type except AJUSTE, where it
 * is a signed delta applied directly to quantityOnHand (validated in
 * src/lib/validation/catalog.ts before this is called). */
export async function registerMovement(input: RegisterMovementInput): Promise<RegisterMovementResult> {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: input.productId, tenantId: input.tenantId },
      include: { inventory: true },
    });
    if (!product) throw new InventoryError("Produto não encontrado.");

    const before: InventorySnapshot = product.inventory ?? {
      quantityOnHand: 0,
      quantityReserved: 0,
      quantityBlocked: 0,
      quantityAvailableToSell: 0,
    };

    const after = applyMovementToSnapshot(before, input.type, input.quantity);

    await tx.inventory.upsert({
      where: { productId: input.productId },
      create: { productId: input.productId, ...after, lastMovementAt: new Date() },
      update: { ...after, lastMovementAt: new Date() },
    });

    await tx.inventoryMovement.create({
      data: {
        productId: input.productId,
        type: input.type,
        quantity: input.quantity,
        reason: input.reason || undefined,
        resultingQuantityOnHand: after.quantityOnHand,
        performedById: input.performedById ?? undefined,
      },
    });

    return { before, after };
  });
}

export interface UpdateCommercialAvailabilityInput {
  tenantId: string;
  productId: string;
  quantityAvailableToSell: number;
  reorderPoint?: number | null;
  maxStock?: number | null;
  safetyStock?: number | null;
}

/** Sets how much of the free stock is exposed for sale (§9) — a business
 * decision distinct from a physical movement, so it does not create an
 * InventoryMovement row, but is still audit-logged by the caller. */
export async function updateCommercialAvailability(
  input: UpdateCommercialAvailabilityInput,
): Promise<{ before: InventorySnapshot; after: InventorySnapshot }> {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: input.productId, tenantId: input.tenantId },
      include: { inventory: true },
    });
    if (!product) throw new InventoryError("Produto não encontrado.");

    const before: InventorySnapshot = product.inventory ?? {
      quantityOnHand: 0,
      quantityReserved: 0,
      quantityBlocked: 0,
      quantityAvailableToSell: 0,
    };

    const ceiling = freeStock(before);
    if (input.quantityAvailableToSell > ceiling) {
      throw new InventoryError(
        `Disponível para venda não pode exceder o estoque livre (${ceiling} un.).`,
      );
    }

    const after: InventorySnapshot = { ...before, quantityAvailableToSell: input.quantityAvailableToSell };

    await tx.inventory.upsert({
      where: { productId: input.productId },
      create: {
        productId: input.productId,
        ...after,
        reorderPoint: input.reorderPoint ?? undefined,
        maxStock: input.maxStock ?? undefined,
        safetyStock: input.safetyStock ?? undefined,
      },
      update: {
        quantityAvailableToSell: after.quantityAvailableToSell,
        reorderPoint: input.reorderPoint ?? undefined,
        maxStock: input.maxStock ?? undefined,
        safetyStock: input.safetyStock ?? undefined,
      },
    });

    return { before, after };
  });
}
