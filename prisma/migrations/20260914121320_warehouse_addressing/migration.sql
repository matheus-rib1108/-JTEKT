-- CreateEnum
CREATE TYPE "StorageLocationStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'BLOCKED');

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_locations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "area" TEXT,
    "corridor" TEXT NOT NULL,
    "rack" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "StorageLocationStatus" NOT NULL DEFAULT 'AVAILABLE',
    "isNonStandard" BOOLEAN NOT NULL DEFAULT false,
    "nonStandardNote" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_storage_locations" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "storageLocationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_storage_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_tenantId_code_key" ON "warehouses"("tenantId", "code");

-- CreateIndex
CREATE INDEX "storage_locations_tenantId_warehouseId_idx" ON "storage_locations"("tenantId", "warehouseId");

-- CreateIndex
CREATE INDEX "storage_locations_tenantId_isNonStandard_idx" ON "storage_locations"("tenantId", "isNonStandard");

-- CreateIndex
CREATE INDEX "storage_locations_tenantId_status_idx" ON "storage_locations"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "storage_locations_tenantId_code_key" ON "storage_locations"("tenantId", "code");

-- CreateIndex
CREATE INDEX "product_storage_locations_storageLocationId_idx" ON "product_storage_locations"("storageLocationId");

-- CreateIndex
CREATE UNIQUE INDEX "product_storage_locations_productId_storageLocationId_key" ON "product_storage_locations"("productId", "storageLocationId");

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_locations" ADD CONSTRAINT "storage_locations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_locations" ADD CONSTRAINT "storage_locations_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_storage_locations" ADD CONSTRAINT "product_storage_locations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_storage_locations" ADD CONSTRAINT "product_storage_locations_storageLocationId_fkey" FOREIGN KEY ("storageLocationId") REFERENCES "storage_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
