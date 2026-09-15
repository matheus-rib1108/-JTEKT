import { test, expect } from "@playwright/test";
import { prisma, cleanupE2ECompanies } from "./support/db";
import { makeCompanyFixture } from "./support/fixtures";
import { login, logout, SEED_ADMIN, SEED_COMERCIAL } from "./support/auth";

/**
 * End-to-end regression for the full commercial lifecycle: public
 * registration -> two-person admin approval -> client browses catalog and
 * checks out -> admin confirms -> logistics picks/packs/ships/delivers ->
 * client sees the delivered status. Verifies real inventory side effects
 * (reservation on submit, release + stock decrease on shipment), not just
 * on-screen text, the same way the Fase 9 `markShipped` bug was originally
 * caught by hand.
 *
 * This spec genuinely ships an order — quantityOnHand for PRODUCT_SKU drops
 * by ORDER_QUANTITY every real run, same as a real sale would. That's
 * intentional (the whole point is exercising the real stock movement), but
 * it means repeated runs against a long-lived database do consume real
 * stock; a CI setup running this suite regularly should reseed between
 * runs rather than share one ever-depleting database.
 */
const PRODUCT_SKU = "RLM-6205-2RS";
const ORDER_QUANTITY = 50; // == minCommercialQuantity for this product

test.describe("Fluxo comercial completo", () => {
  test.afterAll(async () => {
    await cleanupE2ECompanies();
    await prisma.$disconnect();
  });

  test("cadastro -> aprovação em duas etapas -> pedido -> entrega", async ({ page }) => {
    const fixture = makeCompanyFixture("Comercial");

    const before = await prisma.inventory.findFirstOrThrow({ where: { product: { sku: PRODUCT_SKU } } });

    // 1. Public self-service registration creates a PENDING_VALIDATION company.
    await page.goto("/register");
    await page.fill("#companyLegalName", fixture.legalName);
    await page.fill("#cnpj", fixture.cnpj);
    await page.fill("#adminName", fixture.adminName);
    await page.fill("#adminEmail", fixture.adminEmail);
    await page.fill("#password", fixture.password);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/portal", { timeout: 10_000 });
    await logout(page);

    // 2. First admin reviews; a *different* admin approves (§12/§26).
    await login(page, SEED_ADMIN.email, SEED_ADMIN.password);
    await page.goto("/admin/clientes");
    const adminRow = page.locator("tr", { hasText: fixture.legalName });
    await adminRow.getByRole("button", { name: "Revisar" }).click();
    await expect(adminRow.getByRole("button", { name: "Aprovar (2ª etapa)" })).toBeDisabled();
    await logout(page);

    await login(page, SEED_COMERCIAL.email, SEED_COMERCIAL.password);
    await page.goto("/admin/clientes");
    const approverRow = page.locator("tr", { hasText: fixture.legalName });
    await approverRow.getByRole("button", { name: "Aprovar (2ª etapa)" }).click();
    await expect(approverRow.locator("td").nth(3)).toContainText("Ativa", { ignoreCase: true });
    await logout(page);

    // 3. Client logs in, finds the product, adds it to the cart, checks out.
    await login(page, fixture.adminEmail, fixture.password);
    await page.goto(`/portal/produtos?q=${PRODUCT_SKU}`);
    await page.getByRole("link", { name: new RegExp(PRODUCT_SKU) }).first().click();
    await page.waitForURL(/\/portal\/produtos\/.+/);

    await page.fill("#quantity", String(ORDER_QUANTITY));
    await page.getByRole("button", { name: "Adicionar ao carrinho" }).click();
    await expect(page.getByText("Adicionado ao carrinho.")).toBeVisible();

    await page.goto("/portal/carrinho");
    await page.getByRole("button", { name: "Finalizar pedido" }).click();
    await page.waitForURL("**/portal/pedidos", { timeout: 10_000 });
    await logout(page);

    // Submitting reserves stock immediately.
    const afterSubmit = await prisma.inventory.findFirstOrThrow({ where: { product: { sku: PRODUCT_SKU } } });
    expect(afterSubmit.quantityReserved).toBe(before.quantityReserved + ORDER_QUANTITY);
    expect(afterSubmit.quantityOnHand).toBe(before.quantityOnHand);

    // 4. Admin confirms the order, then logistics runs it through to delivery.
    // Unfiltered list on purpose: confirming moves the order's status away
    // from SUBMITTED, so a page filtered to that status would correctly
    // drop the row the moment the confirm succeeds.
    await login(page, SEED_ADMIN.email, SEED_ADMIN.password);
    await page.goto("/admin/pedidos");
    const orderRow = page.locator("tr", { hasText: fixture.legalName });
    await orderRow.getByRole("button", { name: "Confirmar" }).click();
    await expect(orderRow.locator("td").nth(5)).toContainText("Confirmado", { ignoreCase: true });

    await page.goto("/admin/logistica");
    const pickingRow = page.locator("tr", { hasText: fixture.legalName });
    await pickingRow.getByRole("button", { name: "Iniciar separação" }).click();

    const shipmentRow = page.locator("tr", { hasText: fixture.legalName });
    await shipmentRow.getByRole("button", { name: "Marcar embalado" }).click();
    await shipmentRow.getByRole("button", { name: "Despachar" }).click();
    await shipmentRow.getByRole("button", { name: "Confirmar despacho" }).click();
    await expect(shipmentRow).toContainText("Despachado", { ignoreCase: true });

    // Shipping must both release the reservation and record the real
    // departure (Fase 9 fix) — reserved back to baseline, on-hand reduced.
    const afterShip = await prisma.inventory.findFirstOrThrow({ where: { product: { sku: PRODUCT_SKU } } });
    expect(afterShip.quantityReserved).toBe(before.quantityReserved);
    expect(afterShip.quantityOnHand).toBe(before.quantityOnHand - ORDER_QUANTITY);

    await shipmentRow.getByRole("button", { name: "Marcar entregue" }).click();
    await expect(page.getByText("Nenhuma separação em andamento")).toBeVisible();
    await logout(page);

    // 5. Client sees the order as delivered in "Meus pedidos".
    await login(page, fixture.adminEmail, fixture.password);
    await page.goto("/portal/pedidos");
    await expect(page.getByText("Entregue", { exact: false })).toBeVisible();
    await logout(page);
  });
});
