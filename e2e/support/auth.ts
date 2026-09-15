import type { Page } from "@playwright/test";

export const SEED_ADMIN = { email: "admin@jtekt.demo", password: "TrocarSenha#2026" };
export const SEED_COMERCIAL = { email: "comercial@jtekt.demo", password: "TrocarSenha#2026b" };

/** Logs in through the real login form and waits for the post-login
 * redirect, exactly like a user would — no cookie shortcuts, since the
 * point of an E2E spec is to exercise the real request path. */
export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 10_000 });
}

export async function logout(page: Page): Promise<void> {
  await page.evaluate(() => fetch("/api/auth/logout", { method: "POST" }));
}
