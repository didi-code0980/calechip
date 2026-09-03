import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

// BUG-001 — written from 01-plan.md sections 1, 2 and 8 only (RULE-05). Every locator below is a
// `data-testid` named in section 8's table; no class, DOM path or selector outside that table is
// addressed.
//
// This file runs in the project that carries the acceptance tests (the one that depends on
// seam-guard, per AC-5), so by the time any test below executes, the guard has already read the
// served page at the suite's own base URL and confirmed it reports `mock`. That ordering is exactly
// what makes AC-4 and AC-6 — the guard *refusing* a run — impossible to exercise as a `test()` in
// this file: a scenario where the guard fails is, by construction, a scenario where this project's
// own tests never start. Those two criteria are instead proven at two other levels:
//   - the *mechanism* AC-4's failure message depends on (a non-mock build genuinely reports its own
//     seam by name) is proven below, against a second, independently-built server;
//   - the *mechanism* AC-6 depends on (an already-running server is reused rather than rebuilt, so
//     an unpinned one stays unpinned) is proven in tests/playwright-config.test.ts against the
//     shipped config's own `reuseExistingServer` value;
//   - the full scenario — an unpinned server already on the suite's base URL, and the guard
//     actually refusing the run because of it — was additionally exercised once, by hand, during
//     this QA pass, and that observation is recorded in 06-test-report.md rather than faked here.
//
// AC-7's Supabase half and AC-10 both need a build that resolves to Supabase. Section 8 gives the
// recipe without a credential: `VITE_SUPABASE_URL` is tested for presence, never validity, so
// `https://example.invalid` is sufficient and reaches nothing. `beforeAll` below builds one such
// server, on its own port, and every test that needs it points the shared `page` fixture at that
// port instead of the suite's own base URL — nothing here touches the suite's own webServer or its
// pin.

let altOutDir: string;
let altPreview: ChildProcess | undefined;
let altBaseUrl: string;

async function waitForServer(url: string, timeoutMs: number, child: ChildProcess): Promise<void> {
  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  let exited: { code: number | null; signal: NodeJS.Signals | null } | undefined;
  child.once("exit", (code, signal) => {
    exited = { code, signal };
  });

  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    if (exited) {
      throw new Error(
        `preview server for ${url} exited before it came up (code=${String(exited.code)} ` +
          `signal=${String(exited.signal)}): ${stderr}`,
      );
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`server at ${url} did not become ready in time: ${String(lastError)}\n${stderr}`);
}

// `shell: true` (needed so "pnpm" resolves the same way on every platform, per the project's
// working agreements) makes the returned ChildProcess a shell wrapping the real preview process,
// so a plain `.kill()` on it does not reach that real process — it is left running, holding its
// port, after the test that started it ends. Spawning detached and killing the whole process
// group is what actually stops it.
function killPreviewServer(child: ChildProcess | undefined): void {
  if (!child?.pid) return;
  if (process.platform === "win32") {
    child.kill();
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

test.describe("BUG-001 — the pinned suite and the page it drives", () => {
  // Playwright inspects this callback's first parameter for fixture names, so it must be an
  // object-destructuring pattern even when no fixture is needed.
  // eslint-disable-next-line no-empty-pattern
  test.beforeAll(async ({}, testInfo) => {
    testInfo.setTimeout(120_000);

    altOutDir = mkdtempSync(join(tmpdir(), "bug-001-alt-build-"));

    // A build that resolves to Supabase: VITE_SUPABASE_URL present (dummy, per §8), VITE_DATA_SEAM
    // deliberately absent — this is AC-10's "ordinary production build with VITE_SUPABASE_URL set
    // and VITE_DATA_SEAM unset". Built to its own outDir, well outside the suite's own `dist/`, so
    // it cannot touch the page the suite's own pinned server serves.
    const buildEnv = { ...process.env };
    delete buildEnv.VITE_DATA_SEAM;
    buildEnv.VITE_SUPABASE_URL = "https://example.invalid";
    execFileSync("pnpm", ["exec", "vite", "build", "--outDir", altOutDir], {
      env: buildEnv,
      stdio: "pipe",
      shell: true,
    });

    // `fullyParallel: true` (the suite's own config, read via the sanctioned import in
    // tests/playwright-config.test.ts) means this `beforeAll` can run in more than one worker at
    // once, so the port is worker-scoped rather than fixed — a fixed port here reproduces exactly
    // the cross-worker collision this ticket is otherwise not about.
    const altPort = 4174 + testInfo.workerIndex;
    altBaseUrl = `http://localhost:${altPort}`;
    altPreview = spawn(
      "pnpm",
      ["exec", "vite", "preview", "--outDir", altOutDir, "--port", String(altPort), "--strictPort"],
      { stdio: "pipe", shell: true, detached: process.platform !== "win32" },
    );
    await waitForServer(altBaseUrl, 30_000, altPreview);
  });

  test.afterAll(() => {
    killPreviewServer(altPreview);
    if (altOutDir) rmSync(altOutDir, { recursive: true, force: true });
  });

  test("AC-1: the served page names the seam it resolved, which is what the report's guard depends on", async ({
    page,
  }) => {
    await page.goto("/");
    const seam = await page.getByTestId("app-root").getAttribute("data-seam");
    expect(seam, "app-root carries no data-seam — the run's report has nothing to name").toBeTruthy();
  });

  test("AC-2: the served page reports the mock seam regardless of what a machine's environment claims", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("app-root")).toHaveAttribute("data-seam", "mock");
  });

  test("AC-3: an unconfigured machine reaches the identical mock result", async ({ page }) => {
    // The pin itself is proven unconditional on the process environment in
    // tests/playwright-config.test.ts's AC-3 case. What's left to check here is the runtime
    // consequence — the served page — which is the same observation as AC-2's, because "identical
    // result" is exactly the claim being made.
    await page.goto("/");
    await expect(page.getByTestId("app-root")).toHaveAttribute("data-seam", "mock");
  });

  test("AC-4: a build resolved to a seam other than mock names that seam, which is what the guard's failure message depends on", async ({
    page,
  }) => {
    await page.goto(altBaseUrl);
    await expect(page.getByTestId("app-root")).toHaveAttribute("data-seam", "supabase");
  });

  test("AC-7: a build that resolves to the in-memory seam reports mock and shows the banner", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("app-root")).toHaveAttribute("data-seam", "mock");
    const banner = page.getByTestId("seam-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute("data-seam", "mock");
  });

  test("AC-7: a build that resolves to Supabase reports supabase and the mock banner is absent", async ({
    page,
  }) => {
    await page.goto(altBaseUrl);
    await expect(page.getByTestId("app-root")).toHaveAttribute("data-seam", "supabase");
    await expect(page.getByTestId("seam-banner")).toHaveCount(0);
  });

  test("AC-10: an ordinary production build resolves to Supabase and the mock banner is not rendered", async ({
    page,
  }) => {
    await page.goto(altBaseUrl);
    await expect(page.getByTestId("app-root")).toHaveAttribute("data-seam", "supabase");
    await expect(page.getByTestId("seam-banner")).toHaveCount(0);
  });
});
