import { test, expect } from "@playwright/test";
import { prisma, ensureSeedAdminMfaDisabled } from "./support/db";
import { login, logout, SEED_ADMIN } from "./support/auth";
import { currentTotpCode } from "./support/totp";

/**
 * End-to-end regression for TOTP-based MFA: enroll, log out, log back in
 * (must stop at the code step instead of going straight to a session),
 * then disable again so the shared seeded admin account is left exactly
 * as every other spec expects it.
 */
test.describe("Login em duas etapas (MFA)", () => {
  test.afterAll(async () => {
    // Safety net: if an assertion above failed mid-test after MFA was
    // enabled but before the spec disabled it again, later runs logging in
    // as this admin would unexpectedly hit the MFA step.
    await ensureSeedAdminMfaDisabled(SEED_ADMIN.email);
    await prisma.$disconnect();
  });

  test("ativar MFA -> exigir código no login -> desativar", async ({ page }) => {
    await login(page, SEED_ADMIN.email, SEED_ADMIN.password);
    await page.goto("/admin/conta");

    await page.getByRole("button", { name: "Ativar autenticação em duas etapas" }).click();
    const secretBase32 = await page
      .locator('input[name="secretBase32"]')
      .getAttribute("value", { timeout: 10_000 });
    expect(secretBase32).toBeTruthy();

    await page.fill("#mfaCode", currentTotpCode(secretBase32!));
    await page.getByRole("button", { name: "Confirmar e ativar" }).click();
    await expect(page.getByText("Autenticação em duas etapas ativada.")).toBeVisible();

    await logout(page);

    // Password alone must not be enough anymore.
    await page.goto("/login");
    await page.fill("#email", SEED_ADMIN.email);
    await page.fill("#password", SEED_ADMIN.password);
    await page.click('button[type="submit"]');
    await expect(page.locator("#mfaCode")).toBeVisible({ timeout: 10_000 });
    expect(page.url()).toContain("/login");

    await page.fill("#mfaCode", currentTotpCode(secretBase32!));
    await page.click('button[type="submit"]');
    await page.waitForURL("**/admin/dashboard", { timeout: 10_000 });

    // Clean up back to baseline through the real disable flow.
    await page.goto("/admin/conta");
    await page.fill("#disableCode", currentTotpCode(secretBase32!));
    await page.getByRole("button", { name: "Desativar" }).click();
    await expect(page.getByRole("button", { name: "Ativar autenticação em duas etapas" })).toBeVisible();

    await logout(page);
  });
});
