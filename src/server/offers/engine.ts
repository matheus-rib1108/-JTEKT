import "server-only";
import { prisma } from "@/server/db/client";
import { computeOfferPrice, computeOfferProgress, isBelowFloor } from "@/lib/pricing";
import type { Offer } from "@prisma/client";

export class OfferError extends Error {}

export interface CreateOfferInput {
  tenantId: string;
  productId: string;
  discountPercent: number;
  targetReduceQuantity: number;
  internalReason?: string;
  createdById: string;
}

/** Creating an offer can never push the effective price below the
 * product's configured floor — unlike the pricing exception flow, there is
 * no override here: an offer is a marketing tool built on top of an
 * already-approved price, not a way to bypass the floor (docs/
 * ARCHITECTURE.md §9/§10). */
export async function createOffer(input: CreateOfferInput): Promise<Offer> {
  const product = await prisma.product.findFirst({
    where: { id: input.productId, tenantId: input.tenantId },
    include: { pricing: true, inventory: true },
  });
  if (!product) throw new OfferError("Produto não encontrado.");
  if (!product.pricing) throw new OfferError("Configure o preço de lista do produto antes de criar uma oferta.");

  const listPrice = Number(product.pricing.listPrice);
  const minPrice = product.pricing.minPrice === null ? null : Number(product.pricing.minPrice);
  const offerPrice = computeOfferPrice(listPrice, input.discountPercent);

  if (isBelowFloor(offerPrice, minPrice)) {
    throw new OfferError(
      `Esse desconto resultaria em R$ ${offerPrice.toFixed(2)}, abaixo do preço mínimo configurado (R$ ${minPrice?.toFixed(2)}). Reduza o desconto.`,
    );
  }

  const existingOngoing = await prisma.offer.findFirst({
    where: { productId: input.productId, status: { in: ["DRAFT", "ACTIVE", "PAUSED"] } },
  });
  if (existingOngoing) {
    throw new OfferError("Já existe uma oferta em andamento (rascunho, ativa ou pausada) para este produto.");
  }

  return prisma.offer.create({
    data: {
      tenantId: input.tenantId,
      productId: input.productId,
      discountPercent: input.discountPercent,
      targetReduceQuantity: input.targetReduceQuantity,
      internalReason: input.internalReason || null,
      initialQuantityOnHand: product.inventory?.quantityOnHand ?? 0,
      createdById: input.createdById,
      status: "DRAFT",
    },
  });
}

async function findOfferOrThrow(tenantId: string, offerId: string) {
  const offer = await prisma.offer.findFirst({
    where: { id: offerId, tenantId },
    include: { product: { include: { pricing: true } } },
  });
  if (!offer) throw new OfferError("Oferta não encontrada.");
  return offer;
}

/** Activation re-validates the floor: the product's price/minPrice may
 * have changed since the offer was drafted, and an offer must never go
 * live below the current floor just because it was valid when created. */
export async function activateOffer(tenantId: string, offerId: string, approvedById: string): Promise<Offer> {
  const offer = await findOfferOrThrow(tenantId, offerId);
  if (offer.status !== "DRAFT" && offer.status !== "PAUSED") {
    throw new OfferError("Apenas ofertas em rascunho ou pausadas podem ser ativadas.");
  }

  const pricing = offer.product.pricing;
  if (!pricing) throw new OfferError("O produto não tem mais um preço de lista configurado.");
  const listPrice = Number(pricing.listPrice);
  const minPrice = pricing.minPrice === null ? null : Number(pricing.minPrice);
  const offerPrice = computeOfferPrice(listPrice, Number(offer.discountPercent));
  if (isBelowFloor(offerPrice, minPrice)) {
    throw new OfferError(
      `O preço mínimo do produto mudou desde a criação da oferta; o desconto atual resultaria em R$ ${offerPrice.toFixed(2)}, abaixo do mínimo (R$ ${minPrice?.toFixed(2)}). Encerre esta oferta e crie uma nova.`,
    );
  }

  return prisma.offer.update({
    where: { id: offer.id },
    data: {
      status: "ACTIVE",
      startedAt: offer.startedAt ?? new Date(),
      approvedById,
      approvedAt: new Date(),
    },
  });
}

export async function pauseOffer(tenantId: string, offerId: string): Promise<Offer> {
  const offer = await findOfferOrThrow(tenantId, offerId);
  if (offer.status !== "ACTIVE") throw new OfferError("Apenas ofertas ativas podem ser pausadas.");
  return prisma.offer.update({ where: { id: offer.id }, data: { status: "PAUSED" } });
}

export async function endOffer(tenantId: string, offerId: string): Promise<Offer> {
  const offer = await findOfferOrThrow(tenantId, offerId);
  if (offer.status === "ENDED") throw new OfferError("Esta oferta já foi encerrada.");
  return prisma.offer.update({ where: { id: offer.id }, data: { status: "ENDED", endedAt: new Date() } });
}

export interface OfferWithProgress<T extends Offer = Offer> {
  offer: T;
  currentQuantityOnHand: number;
  reducedQuantity: number;
  progressPercent: number;
}

/** Progress is computed from the product's live Inventory snapshot, never
 * estimated from elapsed time or from the discount itself (§4/§19: "não
 * inventar dados"). Generic over `T` so callers that fetched offers with
 * extra `include`d relations (e.g. `product`) get them back on `offer`
 * instead of the bare `Offer` type. */
export async function attachProgress<T extends Offer>(offers: T[]): Promise<OfferWithProgress<T>[]> {
  const productIds = offers.map((o) => o.productId);
  const inventories = await prisma.inventory.findMany({
    where: { productId: { in: productIds } },
    select: { productId: true, quantityOnHand: true },
  });
  const byProduct = new Map(inventories.map((i) => [i.productId, i.quantityOnHand]));

  return offers.map((offer) => {
    const currentQuantityOnHand = byProduct.get(offer.productId) ?? 0;
    const { reducedQuantity, progressPercent } = computeOfferProgress({
      initialQuantityOnHand: offer.initialQuantityOnHand,
      currentQuantityOnHand,
      targetReduceQuantity: offer.targetReduceQuantity,
    });
    return { offer, currentQuantityOnHand, reducedQuantity, progressPercent };
  });
}
