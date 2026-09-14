import "server-only";
import { prisma } from "@/server/db/client";
import { resolveLineUnitPrice, computeOrderTotals, type OrderTotals } from "@/lib/orders";
import { applyMovementToSnapshot, InventoryError, type InventorySnapshot } from "@/server/inventory/engine";
import type { Order } from "@prisma/client";

export class OrderError extends Error {}

const EMPTY_SNAPSHOT: InventorySnapshot = {
  quantityOnHand: 0,
  quantityReserved: 0,
  quantityBlocked: 0,
  quantityAvailableToSell: 0,
};

/** Exactly one DRAFT order (the cart) exists per CustomerCompany — every
 * user from that company shares it, so this always reuses the existing one
 * rather than creating a second. */
export async function getOrCreateCart(tenantId: string, customerCompanyId: string, actingUserId?: string): Promise<Order> {
  const existing = await prisma.order.findFirst({ where: { tenantId, customerCompanyId, status: "DRAFT" } });
  if (existing) return existing;
  return prisma.order.create({
    data: { tenantId, customerCompanyId, status: "DRAFT", createdByUserId: actingUserId ?? null },
  });
}

interface PricedProduct {
  id: string;
  name: string;
  unit: string;
  minCommercialQuantity: number;
  pricing: { listPrice: unknown; tiers: { minQuantity: number; discountPercent: unknown }[] } | null;
  inventory: { quantityAvailableToSell: number } | null;
  offers: { discountPercent: unknown }[];
}

function priceLine(product: PricedProduct, quantity: number) {
  if (!product.pricing) throw new OrderError(`"${product.name}" ainda não tem preço configurado.`);
  const activeOffer = product.offers[0] ?? null;
  return resolveLineUnitPrice(
    Number(product.pricing.listPrice),
    product.pricing.tiers.map((t) => ({ minQuantity: t.minQuantity, discountPercent: Number(t.discountPercent) })),
    quantity,
    activeOffer ? Number(activeOffer.discountPercent) : null,
  );
}

function assertPurchasable(product: PricedProduct, quantity: number) {
  if (quantity < product.minCommercialQuantity) {
    throw new OrderError(`Quantidade mínima de compra de "${product.name}": ${product.minCommercialQuantity} ${product.unit}.`);
  }
  const availableToSell = product.inventory?.quantityAvailableToSell ?? 0;
  if (quantity > availableToSell) {
    throw new OrderError(`Apenas ${availableToSell} ${product.unit} de "${product.name}" disponíveis para compra.`);
  }
}

export interface AddCartItemInput {
  tenantId: string;
  customerCompanyId: string;
  productId: string;
  quantity: number;
  userId: string;
}

export async function addCartItem(input: AddCartItemInput): Promise<void> {
  const product = await prisma.product.findFirst({
    where: { id: input.productId, tenantId: input.tenantId, status: "ACTIVE" },
    include: {
      pricing: { include: { tiers: true } },
      inventory: { select: { quantityAvailableToSell: true } },
      offers: { where: { status: "ACTIVE" }, take: 1 },
    },
  });
  if (!product) throw new OrderError("Produto não encontrado ou indisponível.");

  assertPurchasable(product, input.quantity);
  const line = priceLine(product, input.quantity);

  const cart = await getOrCreateCart(input.tenantId, input.customerCompanyId, input.userId);

  await prisma.orderItem.upsert({
    where: { orderId_productId: { orderId: cart.id, productId: input.productId } },
    create: {
      orderId: cart.id,
      productId: input.productId,
      quantity: input.quantity,
      unitPrice: line.unitPrice,
      listPriceUnitPrice: line.listPriceUnitPrice,
      discountPercent: line.discountPercent,
      discountSource: line.discountSource,
    },
    update: {
      quantity: input.quantity,
      unitPrice: line.unitPrice,
      listPriceUnitPrice: line.listPriceUnitPrice,
      discountPercent: line.discountPercent,
      discountSource: line.discountSource,
    },
  });
}

export interface UpdateCartItemInput {
  tenantId: string;
  customerCompanyId: string;
  itemId: string;
  quantity: number;
}

export async function updateCartItemQuantity(input: UpdateCartItemInput): Promise<void> {
  const item = await prisma.orderItem.findFirst({
    where: { id: input.itemId, order: { tenantId: input.tenantId, customerCompanyId: input.customerCompanyId, status: "DRAFT" } },
    include: {
      product: {
        include: {
          pricing: { include: { tiers: true } },
          inventory: { select: { quantityAvailableToSell: true } },
          offers: { where: { status: "ACTIVE" }, take: 1 },
        },
      },
    },
  });
  if (!item) throw new OrderError("Item não encontrado no carrinho.");

  assertPurchasable(item.product, input.quantity);
  const line = priceLine(item.product, input.quantity);

  await prisma.orderItem.update({
    where: { id: item.id },
    data: {
      quantity: input.quantity,
      unitPrice: line.unitPrice,
      listPriceUnitPrice: line.listPriceUnitPrice,
      discountPercent: line.discountPercent,
      discountSource: line.discountSource,
    },
  });
}

/** Removes a cart line; deletes the cart itself too once it has no items
 * left, so an abandoned cart never lingers as an empty DRAFT row. */
export async function removeCartItem(tenantId: string, customerCompanyId: string, itemId: string): Promise<void> {
  const item = await prisma.orderItem.findFirst({
    where: { id: itemId, order: { tenantId, customerCompanyId, status: "DRAFT" } },
  });
  if (!item) throw new OrderError("Item não encontrado no carrinho.");

  await prisma.orderItem.delete({ where: { id: item.id } });

  const remaining = await prisma.orderItem.count({ where: { orderId: item.orderId } });
  if (remaining === 0) {
    await prisma.order.delete({ where: { id: item.orderId } });
  }
}

export interface SubmitOrderResult {
  order: Order;
  totals: OrderTotals;
}

/** Submitting the cart reserves real stock via the same movement type the
 * inventory ledger already defines (RESERVA) — one atomic transaction
 * across every line, so a shortfall on any single item fails the whole
 * submission rather than partially reserving the order. */
export async function submitOrder(tenantId: string, customerCompanyId: string, userId: string): Promise<SubmitOrderResult> {
  return prisma.$transaction(async (tx) => {
    const cart = await tx.order.findFirst({
      where: { tenantId, customerCompanyId, status: "DRAFT" },
      include: { items: { include: { product: { include: { inventory: true } } } } },
    });
    if (!cart || cart.items.length === 0) throw new OrderError("Carrinho vazio.");

    for (const item of cart.items) {
      const snapshot: InventorySnapshot = item.product.inventory ?? EMPTY_SNAPSHOT;
      if (item.quantity > snapshot.quantityAvailableToSell) {
        throw new OrderError(
          `"${item.product.name}": apenas ${snapshot.quantityAvailableToSell} ${item.product.unit} disponíveis agora (o carrinho pode estar desatualizado).`,
        );
      }

      let after: InventorySnapshot;
      try {
        after = applyMovementToSnapshot(snapshot, "RESERVA", item.quantity);
      } catch (error) {
        if (error instanceof InventoryError) throw new OrderError(error.message);
        throw error;
      }

      await tx.inventory.upsert({
        where: { productId: item.productId },
        create: { productId: item.productId, ...after },
        update: after,
      });
      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          type: "RESERVA",
          quantity: item.quantity,
          reason: `Reserva para pedido ${cart.id}`,
          resultingQuantityOnHand: after.quantityOnHand,
          performedById: userId,
        },
      });
    }

    const updated = await tx.order.update({
      where: { id: cart.id },
      data: { status: "SUBMITTED", submittedAt: new Date(), createdByUserId: cart.createdByUserId ?? userId },
      include: { items: true },
    });

    const totals = computeOrderTotals(
      updated.items.map((i) => ({ quantity: i.quantity, unitPrice: Number(i.unitPrice), listPriceUnitPrice: Number(i.listPriceUnitPrice) })),
    );

    return { order: updated, totals };
  });
}

export async function confirmOrder(tenantId: string, orderId: string, confirmedById: string): Promise<Order> {
  const order = await prisma.order.findFirst({ where: { id: orderId, tenantId } });
  if (!order) throw new OrderError("Pedido não encontrado.");
  if (order.status !== "SUBMITTED") throw new OrderError("Apenas pedidos enviados podem ser confirmados.");
  return prisma.order.update({
    where: { id: order.id },
    data: { status: "CONFIRMED", confirmedAt: new Date(), confirmedById },
  });
}

/** Cancelling releases the reservation (LIBERACAO_RESERVA) for every line.
 * Known limitation (see docs/ROADMAP.md): `quantityAvailableToSell` is
 * never automatically raised back up afterward — only the generic
 * clamp-DOWN in applyMovementToSnapshot applies here, same as every other
 * movement type. Auto-restoring it would need to know what the value was
 * *before* this specific reservation touched it, which nothing records; a
 * naive "add back the released quantity" undoes the clamp but can overshoot
 * past whatever an admin had deliberately capped it at (verified while
 * testing this: a product with slack between availableToSell and free
 * stock before the reservation ends up exposed for *more* than it started
 * with). Understating is the safe default — never oversells, and any admin
 * can correct it immediately via "Disponibilidade comercial" on the
 * product page. */
export async function cancelOrder(
  tenantId: string,
  orderId: string,
  cancelledById: string,
  reason?: string,
): Promise<Order> {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, tenantId },
      include: { items: { include: { product: { include: { inventory: true } } } } },
    });
    if (!order) throw new OrderError("Pedido não encontrado.");
    if (order.status !== "SUBMITTED" && order.status !== "CONFIRMED") {
      throw new OrderError("Apenas pedidos enviados ou confirmados podem ser cancelados.");
    }

    for (const item of order.items) {
      const before: InventorySnapshot = item.product.inventory ?? EMPTY_SNAPSHOT;

      let after: InventorySnapshot;
      try {
        after = applyMovementToSnapshot(before, "LIBERACAO_RESERVA", item.quantity);
      } catch (error) {
        if (error instanceof InventoryError) throw new OrderError(error.message);
        throw error;
      }

      await tx.inventory.upsert({
        where: { productId: item.productId },
        create: { productId: item.productId, ...after },
        update: after,
      });
      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          type: "LIBERACAO_RESERVA",
          quantity: item.quantity,
          reason: `Cancelamento do pedido ${order.id}`,
          resultingQuantityOnHand: after.quantityOnHand,
          performedById: cancelledById,
        },
      });
    }

    return tx.order.update({
      where: { id: order.id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelledById, cancellationReason: reason || null },
    });
  });
}
