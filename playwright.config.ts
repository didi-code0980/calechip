import { defineConfig, devices } from "@playwright/test";

// End-to-end lives beside the unit tests but is separated by suffix, so one runner never picks up
// the other's files: vitest owns `tests/**/*.test.ts`, playwright owns `tests/e2e/**/*.spec.ts`.
// Both stay under `tests/`, which is one of the SCAFFOLD_ROOTS check-docs.mjs knows about.
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // `vite preview` binds to localhost only — a `127.0.0.1` URL times out waiting for a server that
  // is running. Verified by attempt rather than assumed.
  webServer: {
    command: "pnpm exec vite build && pnpm exec vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});
