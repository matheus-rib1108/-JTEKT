import { defineConfig, configDefaults } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./src/test/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    // e2e/ is a separate Playwright suite (see playwright.config.ts) —
    // real browser tests against a live server, not vitest specs.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
});
