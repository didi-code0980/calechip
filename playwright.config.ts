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
  // BUG-001. The guard runs first and `chromium` declares it as a dependency, so a run that would
  // drive anything but the in-memory seam ABORTS rather than reports. `fullyParallel: true` is why
  // this cannot be an ordinary test: the sign-up specs would otherwise reach the datastore
  // concurrently with the guard failing, and by the time the report is read the writes have
  // happened. Its own `testMatch` overrides the top-level one so `chromium` does not also pick it up.
  projects: [
    {
      name: "seam-guard",
      testMatch: /seam\.setup\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["seam-guard"],
    },
  ],
  // `vite preview` binds to localhost only — a `127.0.0.1` URL times out waiting for a server that
  // is running. Verified by attempt rather than assumed.
  webServer: {
    command: "pnpm exec vite build && pnpm exec vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    // BUG-001. The suite STATES which implementation it is a test of instead of inheriting it.
    // `webServer.env` reaches the build, and Vite's `loadEnv` applies `process.env` AFTER the parsed
    // `.env` file and overwrites it — so this beats a developer's `.env` rather than losing to it
    // (measured during triage, ticket.yaml section 5).
    //
    // It is HERE and not in .github/workflows/verify.yml and not in a package.json script, because
    // the local `/qa` run and CI invoke the same binary with the same config — so one line fixes the
    // structural disagreement between them, and neither can be fixed without the other. section 9.
    env: { VITE_DATA_SEAM: "mock" },
  },
});
