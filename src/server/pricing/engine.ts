import "server-only";
import { prisma } from "@/server/db/client";
import { computeOfferPrice, isBelowFloor } from "@/lib/pricing";

export class PricingError extends Error {}

export interface SavePricingInput {
  tenantId: string;
  productId: string;
  listPrice: number;
  minPrice: number | null;
  actorId: string;
  actorHasExceptionPermission: boolean;
  exceptionReason?: string;
}

export interface SavePricingResult {
  before: { listPrice: number | null; minPrice: number | null } | null;
  after: { listPrice: number; minPrice: number | null };
  isException: boolean;
}

/** Saves list/min price for a product. A `listPrice` below the configured
 * `minPrice` is never silently accepted — the caller must hold
 * PRICING_APPROVE_EXCEPTION and provide a reason, both enforced here (not
 * just hidden in the UI), so the write and its audit trail happen in the
 * same place. */
export async function savePricing(input: SavePricingInput): Promise<SavePricingResult> {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: input.productId, tenantId: input.tenantId },
      include: { pricing: true },
    });
    if (!product) throw new PricingError("Produto não encontrado.");

    const isException = isBelowFloor(input.listPrice, input.minPrice);
    if (isException) {
      if (!input.actorHasExceptionPermission) {
        throw new PricingError(
          "Preço de lista abaixo do preço mínimo configurado exige um usuário com permissão de exceção.",
        );
      }
      if (!input.exceptionReason) {
        throw new PricingError("Informe o motivo da exceção para salvar um preço abaixo do mínimo.");
      }
    }

    const before = product.pricing
      ? {
          listPrice: Number(product.pricing.listPrice),
          minPrice: product.pricing.minPrice === null ? null : Number(product.pricing.minPrice),
        }
      : null;

    const pricing = await tx.productPricing.upsert({
      where: { productId: input.productId },
      create: {
        productId: input.productId,
        listPrice: input.listPrice,
        minPrice: input.minPrice,
        updatedById: input.actorId,
      },
      update: {
        listPrice: input.listPrice,
        minPrice: input.minPrice,
        updatedById: input.actorId,
      },
    });

    return {
      before,
      after: { listPrice: Number(pricing.listPrice), minPrice: pricing.minPrice === null ? null : Number(pricing.minPrice) },
      isException,
    };
  });
}

export interface AddPriceTierInput {
  tenantId: string;
  productId: string;
  minQuantity: number;
  discountPercent: number;
}

export interface AddPriceTierResult {
  tierId: string;
  minQuantity: number;
  discountPercent: number;
  resultingUnitPrice: number;
}

/** A quantity tier's resulting unit price is re-validated against the
 * product's current `minPrice` here — not only at some earlier moment the
 * tier was designed — since the floor can be raised after the tier
 * already exists. */
export async function addPriceTier(input: AddPriceTierInput): Promise<AddPriceTierResult> {
  const product = await prisma.product.findFirst({
    where: { id: input.productId, tenantId: input.tenantId },
    include: { pricing: true },
  });
  if (!product) throw new PricingError("Produto não encontrado.");
  if (!product.pricing) throw new PricingError("Configure o preço de lista do produto antes de adicionar faixas de desconto.");

  const listPrice = Number(product.pricing.listPrice);
  const minPrice = product.pricing.minPrice === null ? null : Number(product.pricing.minPrice);
  const resultingUnitPrice = computeOfferPrice(listPrice, input.discountPercent);

  if (isBelowFloor(resultingUnitPrice, minPrice)) {
    throw new PricingError(
      `Esse desconto resultaria em R$ ${resultingUnitPrice.toFixed(2)}, abaixo do preço mínimo configurado (R$ ${minPrice?.toFixed(2)}).`,
    );
  }

  const existing = await prisma.priceTier.findUnique({
    where: { productPricingId_minQuantity: { productPricingId: product.pricing.id, minQuantity: input.minQuantity } },
  });
  if (existing) throw new PricingError("Já existe uma faixa de desconto para essa quantidade mínima.");

  const tier = await prisma.priceTier.create({
    data: {
      productPricingId: product.pricing.id,
      minQuantity: input.minQuantity,
      discountPercent: input.discountPercent,
    },
  });

  return {
    tierId: tier.id,
    minQuantity: tier.minQuantity,
    discountPercent: Number(tier.discountPercent),
    resultingUnitPrice,
  };
}

export async function removePriceTier(tenantId: string, tierId: string): Promise<{ productId: string }> {
  const tier = await prisma.priceTier.findFirst({
    where: { id: tierId, productPricing: { product: { tenantId } } },
    include: { productPricing: true },
  });
  if (!tier) throw new PricingError("Faixa de desconto não encontrada.");

  await prisma.priceTier.delete({ where: { id: tierId } });

  return { productId: tier.productPricing.productId };
}
