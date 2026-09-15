import { defineConfig, devices } from "@playwright/test";

/**
 * Real integration/E2E suite (Fase 13) — runs against a live Next.js dev
 * server backed by the real Postgres database, not mocks. Each spec is
 * responsible for cleaning up the test data it creates (see
 * e2e/support/cleanup.ts) so repeated runs don't corrupt the seeded demo
 * baseline used for manual walkthroughs.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Some sandboxed dev environments ship a pre-installed Chromium at
        // a fixed path instead of one `playwright install` can manage (no
        // outbound access to download browsers on demand). Point at it via
        // PLAYWRIGHT_CHROMIUM_PATH when set; otherwise fall back to
        // Playwright's normal auto-resolved browser (the expected case in
        // CI, where `playwright install` runs first).
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
          : {},
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
