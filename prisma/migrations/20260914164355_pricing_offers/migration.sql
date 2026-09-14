-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED');

-- CreateTable
CREATE TABLE "product_pricing" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "listPrice" DECIMAL(12,2) NOT NULL,
    "minPrice" DECIMAL(12,2),
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_tiers" (
    "id" TEXT NOT NULL,
    "productPricingId" TEXT NOT NULL,
    "minQuantity" INTEGER NOT NULL,
    "discountPercent" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "internalReason" TEXT,
    "discountPercent" DECIMAL(5,2) NOT NULL,
    "targetReduceQuantity" INTEGER NOT NULL,
    "initialQuantityOnHand" INTEGER NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'DRAFT',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_pricing_productId_key" ON "product_pricing"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "price_tiers_productPricingId_minQuantity_key" ON "price_tiers"("productPricingId", "minQuantity");

-- CreateIndex
CREATE INDEX "offers_tenantId_status_idx" ON "offers"("tenantId", "status");

-- CreateIndex
CREATE INDEX "offers_productId_status_idx" ON "offers"("productId", "status");

-- AddForeignKey
ALTER TABLE "product_pricing" ADD CONSTRAINT "product_pricing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_tiers" ADD CONSTRAINT "price_tiers_productPricingId_fkey" FOREIGN KEY ("productPricingId") REFERENCES "product_pricing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
