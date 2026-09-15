import { test, expect } from "@playwright/test";
import { prisma, cleanupE2ECompanies } from "./support/db";
import { makeCompanyFixture } from "./support/fixtures";
import { login, logout, SEED_ADMIN } from "./support/auth";

/**
 * End-to-end regression for the quote (cotação) flow: client requests a
 * special price -> admin proposes a price above the configured floor ->
 * client accepts, which creates a real Order (reserving stock) straight
 * from the quote, bypassing the cart. The order is cancelled at the end so
 * the reservation is released through the real cancelOrder action before
 * the test company is deleted — never by deleting rows directly (see
 * docs/ROADMAP.md's "Débitos técnicos conhecidos" on why a raw delete can
 * orphan a reservation).
 */
const PRODUCT_SKU = "ROL-ESF-6006";
const QUOTE_QUANTITY = 100; // == minCommercialQuantity for this product
const PROPOSED_PRICE = "20.00"; // above this product's R$18 floor

test.describe("Fluxo de cotação", () => {
  test.afterAll(async () => {
    await cleanupE2ECompanies();
    await prisma.$disconnect();
  });

  test("solicitar -> propor acima do piso -> aceitar -> cancelar", async ({ page }) => {
    const fixture = makeCompanyFixture("Cotacao");

    // Register + approve (single admin review+approve is enough here; the
    // two-person enforcement itself is covered by commercial-flow.spec.ts).
    await page.goto("/register");
    await page.fill("#companyLegalName", fixture.legalName);
    await page.fill("#cnpj", fixture.cnpj);
    await page.fill("#adminName", fixture.adminName);
    await page.fill("#adminEmail", fixture.adminEmail);
    await page.fill("#password", fixture.password);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/portal", { timeout: 10_000 });
    await logout(page);

    // Approving the company itself isn't this spec's concern (the two-person
    // rule is covered by commercial-flow.spec.ts) — set it ACTIVE directly
    // so the test can get straight to the quote flow.
    const company = await prisma.customerCompany.findFirstOrThrow({ where: { legalName: fixture.legalName } });
    const seedAdmin = await prisma.user.findFirstOrThrow({ where: { email: SEED_ADMIN.email } });
    await prisma.customerCompany.update({
      where: { id: company.id },
      data: { status: "ACTIVE", approvedAt: new Date(), approvedById: seedAdmin.id },
    });

    // 1. Client requests a quote from the product detail page.
    await login(page, fixture.adminEmail, fixture.password);
    await page.goto(`/portal/produtos?q=${PRODUCT_SKU}`);
    await page.getByRole("link", { name: new RegExp(PRODUCT_SKU) }).first().click();
    await page.waitForURL(/\/portal\/produtos\/.+/);

    await page.getByRole("button", { name: "Solicitar cotação" }).click();
    await page.fill("#quoteQuantity", String(QUOTE_QUANTITY));
    await page.getByRole("button", { name: "Enviar solicitação" }).click();
    await expect(page.getByText("Cotação solicitada")).toBeVisible();
    await logout(page);

    // 2. Admin proposes a price above the floor.
    await login(page, SEED_ADMIN.email, SEED_ADMIN.password);
    await page.goto("/admin/cotacoes?status=REQUESTED");
    const quoteRow = page.locator("tr", { hasText: fixture.legalName });
    await quoteRow.getByRole("link", { name: "Ver" }).click();
    await page.waitForURL(/\/admin\/cotacoes\/.+/);
    await page.fill("#proposedUnitPrice", PROPOSED_PRICE);
    await page.getByRole("button", { name: "Enviar proposta" }).click();
    await expect(page.getByText("Proposta enviada")).toBeVisible();
    await logout(page);

    const before = await prisma.inventory.findFirstOrThrow({ where: { product: { sku: PRODUCT_SKU } } });

    // 3. Client accepts -> a real Order is created and stock is reserved.
    await login(page, fixture.adminEmail, fixture.password);
    await page.goto("/portal/cotacoes");
    await expect(page.getByText(`${PROPOSED_PRICE.replace(".", ",")}`).first()).toBeVisible();
    await page.getByRole("button", { name: "Aceitar" }).click();
    // Exact match matters here: the "Aceitar" button's own label contains
    // "Aceita" as a substring, so a loose text match would resolve before
    // the transition even completes (a false pass, not a real wait).
    await expect(page.getByText("Aceita", { exact: true })).toBeVisible();
    await logout(page);

    const afterAccept = await prisma.inventory.findFirstOrThrow({ where: { product: { sku: PRODUCT_SKU } } });
    expect(afterAccept.quantityReserved).toBe(before.quantityReserved + QUOTE_QUANTITY);

    // 4. Clean up through the real cancel action so the reservation releases.
    // Unfiltered list on purpose — see the same note in commercial-flow.spec.ts.
    await login(page, SEED_ADMIN.email, SEED_ADMIN.password);
    await page.goto("/admin/pedidos");
    const orderRow = page.locator("tr", { hasText: fixture.legalName });
    await orderRow.getByRole("button", { name: "Cancelar" }).click();
    await orderRow.getByRole("button", { name: "Confirmar cancelamento" }).click();
    await expect(orderRow.locator("td").nth(5)).toContainText("Cancelado", { ignoreCase: true });
    await logout(page);

    const afterCancel = await prisma.inventory.findFirstOrThrow({ where: { product: { sku: PRODUCT_SKU } } });
    expect(afterCancel.quantityReserved).toBe(before.quantityReserved);
  });
});
