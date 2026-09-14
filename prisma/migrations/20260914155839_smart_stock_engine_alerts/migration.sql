-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('BELOW_REORDER_POINT', 'ABOVE_MAX_STOCK', 'IDLE_STOCK', 'MANY_POSITIONS_OCCUPIED', 'NON_STANDARD_POSITION');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'RESOLVED');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "unitCost" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "stock_classifications" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "abcClass" TEXT,
    "xyzClass" TEXT,
    "priorityScore" INTEGER,
    "factors" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_classifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'WARNING',
    "targetKey" TEXT NOT NULL,
    "productId" TEXT,
    "storageLocationId" TEXT,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_classifications_productId_key" ON "stock_classifications"("productId");

-- CreateIndex
CREATE INDEX "alerts_tenantId_status_idx" ON "alerts"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "alerts_tenantId_type_targetKey_key" ON "alerts"("tenantId", "type", "targetKey");

-- AddForeignKey
ALTER TABLE "stock_classifications" ADD CONSTRAINT "stock_classifications_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "storage_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
