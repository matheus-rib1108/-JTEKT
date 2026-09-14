import "server-only";
import { prisma } from "@/server/db/client";
import { isBelowFloor } from "@/lib/pricing";
import { applyMovementToSnapshot, InventoryError, type InventorySnapshot } from "@/server/inventory/engine";
import type { Quote } from "@prisma/client";

export class QuoteError extends Error {}

const EMPTY_SNAPSHOT: InventorySnapshot = {
  quantityOnHand: 0,
  quantityReserved: 0,
  quantityBlocked: 0,
  quantityAvailableToSell: 0,
};

export interface RequestQuoteInput {
  tenantId: string;
  customerCompanyId: string;
  productId: string;
  quantity: number;
  requestedPrice?: number;
  message?: string;
  userId: string;
}

export async function requestQuote(input: RequestQuoteInput): Promise<Quote> {
  const product = await prisma.product.findFirst({
    where: { id: input.productId, tenantId: input.tenantId, status: "ACTIVE" },
  });
  if (!product) throw new QuoteError("Produto não encontrado ou indisponível.");
  if (input.quantity < product.minCommercialQuantity) {
    throw new QuoteError(`Quantidade mínima de compra: ${product.minCommercialQuantity} ${product.unit}.`);
  }

  return prisma.quote.create({
    data: {
      tenantId: input.tenantId,
      customerCompanyId: input.customerCompanyId,
      createdByUserId: input.userId,
      message: input.message || null,
      status: "REQUESTED",
      items: {
        create: {
          productId: input.productId,
          quantity: input.quantity,
          requestedPrice: input.requestedPrice ?? null,
        },
      },
    },
  });
}

export interface ProposeQuoteInput {
  tenantId: string;
  quoteId: string;
  proposedUnitPrice: number;
  responseMessage?: string;
  respondedById: string;
}

/** Same floor rule as pricing exceptions and offers: a proposal can never
 * land below the product's configured minPrice. Unlike the pricing
 * exception flow, there is no override here — if the team truly needs to
 * go lower, they change the product's minPrice first (with its own
 * audited exception flow), then propose. */
export async function proposeQuote(input: ProposeQuoteInput): Promise<Quote> {
  const quote = await prisma.quote.findFirst({
    where: { id: input.quoteId, tenantId: input.tenantId },
    include: { items: { include: { product: { include: { pricing: true } } } } },
  });
  if (!quote) throw new QuoteError("Cotação não encontrada.");
  if (quote.status !== "REQUESTED") throw new QuoteError("Apenas cotações solicitadas podem receber uma proposta.");

  const item = quote.items[0];
  if (!item) throw new QuoteError("Cotação sem item.");

  const minPrice = item.product.pricing?.minPrice != null ? Number(item.product.pricing.minPrice) : null;
  if (isBelowFloor(input.proposedUnitPrice, minPrice)) {
    throw new QuoteError(
      `A proposta (R$ ${input.proposedUnitPrice.toFixed(2)}) fica abaixo do preço mínimo configurado para este produto (R$ ${minPrice?.toFixed(2)}).`,
    );
  }

  await prisma.quoteItem.update({
    where: { id: item.id },
    data: { proposedUnitPrice: input.proposedUnitPrice },
  });

  return prisma.quote.update({
    where: { id: quote.id },
    data: {
      status: "PROPOSED",
      responseMessage: input.responseMessage || null,
      respondedByUserId: input.respondedById,
      respondedAt: new Date(),
    },
  });
}

/** Accepting creates an Order directly (skipping the cart) at the
 * negotiated price, reserving real stock the same way submitOrder does —
 * one atomic transaction, re-validated against current stock since
 * availability may have changed since the proposal was made. */
export async function acceptQuote(tenantId: string, customerCompanyId: string, quoteId: string, userId: string): Promise<Quote> {
  return prisma.$transaction(async (tx) => {
    const quote = await tx.quote.findFirst({
      where: { id: quoteId, tenantId, customerCompanyId },
      include: { items: { include: { product: { include: { inventory: true, pricing: true } } } } },
    });
    if (!quote) throw new QuoteError("Cotação não encontrada.");
    if (quote.status !== "PROPOSED") throw new QuoteError("Apenas cotações com proposta podem ser aceitas.");

    const item = quote.items[0];
    if (!item || item.proposedUnitPrice === null) throw new QuoteError("Cotação sem proposta de preço.");

    const snapshot: InventorySnapshot = item.product.inventory ?? EMPTY_SNAPSHOT;
    if (item.quantity > snapshot.quantityAvailableToSell) {
      throw new QuoteError(
        `Apenas ${snapshot.quantityAvailableToSell} ${item.product.unit} de "${item.product.name}" disponíveis agora.`,
      );
    }

    let after: InventorySnapshot;
    try {
      after = applyMovementToSnapshot(snapshot, "RESERVA", item.quantity);
    } catch (error) {
      if (error instanceof InventoryError) throw new QuoteError(error.message);
      throw error;
    }

    await tx.inventory.upsert({
      where: { productId: item.productId },
      create: { productId: item.productId, ...after },
      update: after,
    });

    const order = await tx.order.create({
      data: {
        tenantId,
        customerCompanyId,
        status: "SUBMITTED",
        submittedAt: new Date(),
        createdByUserId: userId,
        items: {
          create: {
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.proposedUnitPrice,
            listPriceUnitPrice: item.product.pricing ? item.product.pricing.listPrice : item.proposedUnitPrice,
            discountSource: "QUOTE",
          },
        },
      },
    });

    await tx.inventoryMovement.create({
      data: {
        productId: item.productId,
        type: "RESERVA",
        quantity: item.quantity,
        reason: `Reserva para pedido ${order.id} (cotação ${quote.id} aceita)`,
        resultingQuantityOnHand: after.quantityOnHand,
        performedById: userId,
      },
    });

    return tx.quote.update({
      where: { id: quote.id },
      data: { status: "ACCEPTED", decidedAt: new Date(), resultingOrderId: order.id },
    });
  });
}

export async function rejectQuote(tenantId: string, customerCompanyId: string, quoteId: string): Promise<Quote> {
  const quote = await prisma.quote.findFirst({ where: { id: quoteId, tenantId, customerCompanyId } });
  if (!quote) throw new QuoteError("Cotação não encontrada.");
  if (quote.status !== "PROPOSED") throw new QuoteError("Apenas cotações com proposta podem ser rejeitadas.");
  return prisma.quote.update({ where: { id: quote.id }, data: { status: "REJECTED", decidedAt: new Date() } });
}

export async function cancelQuote(tenantId: string, customerCompanyId: string, quoteId: string): Promise<Quote> {
  const quote = await prisma.quote.findFirst({ where: { id: quoteId, tenantId, customerCompanyId } });
  if (!quote) throw new QuoteError("Cotação não encontrada.");
  if (quote.status !== "REQUESTED") throw new QuoteError("Apenas cotações ainda sem proposta podem ser canceladas.");
  return prisma.quote.update({ where: { id: quote.id }, data: { status: "CANCELLED", decidedAt: new Date() } });
}
