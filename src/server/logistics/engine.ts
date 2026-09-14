import "server-only";
import { prisma } from "@/server/db/client";
import { applyMovementToSnapshot, InventoryError, type InventorySnapshot } from "@/server/inventory/engine";
import type { Shipment } from "@prisma/client";

export class LogisticsError extends Error {}

const EMPTY_SNAPSHOT: InventorySnapshot = {
  quantityOnHand: 0,
  quantityReserved: 0,
  quantityBlocked: 0,
  quantityAvailableToSell: 0,
};

/** A Shipment is only ever created here, by an explicit logistics action —
 * never automatically when an order is confirmed. Picking is a real
 * physical action someone has to begin, not a side effect of a status
 * change. */
export async function startPicking(tenantId: string, orderId: string, userId: string): Promise<Shipment> {
  const order = await prisma.order.findFirst({ where: { id: orderId, tenantId }, include: { shipment: true } });
  if (!order) throw new LogisticsError("Pedido não encontrado.");
  if (order.status !== "CONFIRMED") throw new LogisticsError("Apenas pedidos confirmados podem iniciar separação.");
  if (order.shipment) throw new LogisticsError("Este pedido já tem uma separação em andamento.");

  return prisma.shipment.create({
    data: { tenantId, orderId, status: "PICKING", pickedAt: new Date(), createdById: userId },
  });
}

async function findShipmentOrThrow(tenantId: string, shipmentId: string) {
  const shipment = await prisma.shipment.findFirst({ where: { id: shipmentId, tenantId } });
  if (!shipment) throw new LogisticsError("Separação não encontrada.");
  return shipment;
}

export async function markPacked(tenantId: string, shipmentId: string): Promise<Shipment> {
  const shipment = await findShipmentOrThrow(tenantId, shipmentId);
  if (shipment.status !== "PICKING") throw new LogisticsError("Apenas separações em andamento podem ser marcadas como embaladas.");
  return prisma.shipment.update({ where: { id: shipment.id }, data: { status: "PACKED", packedAt: new Date() } });
}

export interface MarkShippedInput {
  tenantId: string;
  shipmentId: string;
  carrierName?: string;
  trackingCode?: string;
  performedById: string;
}

/**
 * Dispatch is the point the goods physically leave the warehouse, so this
 * is where the reservation taken at order submission (RESERVA) finally
 * converts into a real outbound movement: release the hold
 * (LIBERACAO_RESERVA) and record the actual departure (SAIDA) for each
 * item, in one transaction alongside the shipment's own status change.
 * Net effect on quantityOnHand/quantityReserved cancels out on
 * quantityAvailableToSell (both drop by the same amount the reservation
 * already carved out) — this is the one deliberate reason to touch
 * inventory outside src/server/inventory/engine.ts's own callers: without
 * it, a delivered order's stock would stay reserved forever and never
 * actually leave quantityOnHand.
 */
export async function markShipped(input: MarkShippedInput): Promise<Shipment> {
  return prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.findFirst({
      where: { id: input.shipmentId, tenantId: input.tenantId },
      include: { order: { include: { items: { include: { product: { include: { inventory: true } } } } } } },
    });
    if (!shipment) throw new LogisticsError("Separação não encontrada.");
    if (shipment.status !== "PACKED") throw new LogisticsError("Apenas separações embaladas podem ser despachadas.");

    for (const item of shipment.order.items) {
      const before: InventorySnapshot = item.product.inventory ?? EMPTY_SNAPSHOT;

      let afterRelease: InventorySnapshot;
      let afterOut: InventorySnapshot;
      try {
        afterRelease = applyMovementToSnapshot(before, "LIBERACAO_RESERVA", item.quantity);
        afterOut = applyMovementToSnapshot(afterRelease, "SAIDA", item.quantity);
      } catch (error) {
        if (error instanceof InventoryError) throw new LogisticsError(error.message);
        throw error;
      }

      await tx.inventory.upsert({
        where: { productId: item.productId },
        create: { productId: item.productId, ...afterOut },
        update: afterOut,
      });
      await tx.inventoryMovement.createMany({
        data: [
          {
            productId: item.productId,
            type: "LIBERACAO_RESERVA",
            quantity: item.quantity,
            reason: `Despacho do pedido ${shipment.order.id} — reserva convertida em saída`,
            resultingQuantityOnHand: afterRelease.quantityOnHand,
            performedById: input.performedById,
          },
          {
            productId: item.productId,
            type: "SAIDA",
            quantity: item.quantity,
            reason: `Despacho do pedido ${shipment.order.id}`,
            resultingQuantityOnHand: afterOut.quantityOnHand,
            performedById: input.performedById,
          },
        ],
      });
    }

    return tx.shipment.update({
      where: { id: shipment.id },
      data: {
        status: "SHIPPED",
        shippedAt: new Date(),
        carrierName: input.carrierName || null,
        trackingCode: input.trackingCode || null,
      },
    });
  });
}

export async function markDelivered(tenantId: string, shipmentId: string): Promise<Shipment> {
  const shipment = await findShipmentOrThrow(tenantId, shipmentId);
  if (shipment.status !== "SHIPPED") throw new LogisticsError("Apenas separações despachadas podem ser marcadas como entregues.");
  return prisma.shipment.update({ where: { id: shipment.id }, data: { status: "DELIVERED", deliveredAt: new Date() } });
}
