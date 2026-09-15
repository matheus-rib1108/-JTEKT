-- CreateIndex
CREATE INDEX "login_attempts_ipAddress_createdAt_idx" ON "login_attempts"("ipAddress", "createdAt");

-- CreateIndex
CREATE INDEX "products_tenantId_manufacturer_idx" ON "products"("tenantId", "manufacturer");

-- CreateIndex
CREATE INDEX "products_tenantId_application_idx" ON "products"("tenantId", "application");
