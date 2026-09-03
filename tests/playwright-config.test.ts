// BUG-001 — asserting on playwright.config.ts's default export.
//
// This is the one sanctioned exception to RULE-05 on this ticket (01-plan.md §8): importing the
// shipped config and asserting on the exported object is the contract AC-5 names; reading how it
// was written is not, and nothing here does that. Every property accessed below is read off the
// live, imported object — never off the file's text.
//
// AC-2 and AC-3 are proven the same way, one level further: the module is imported twice, once
// with `VITE_SUPABASE_URL` set on the process and once without, using vitest's module registry
// reset so each import re-evaluates the module fresh. A pin that is a static literal — not derived
// from `process.env` at import time — produces the identical `webServer.env` either way, which is
// exactly the property AC-2 and AC-3 both require and exactly what would stop holding if the pin
// were ever made conditional on the machine's own environment.
//
// AC-9's second clause and AC-10's second clause are each a version-control fact — "this file is
// untouched by this ticket" — not a runtime one. Both are read from `git diff` against the
// branch's merge base with `origin/main`, never from the files' own content.
//
// AC-8 is checked structurally against `tests/e2e/tea-01-signup.spec.ts`, which is part of the
// test tree QA may read (RULE-05 restricts implementation source, not the test tree). It asserts
// the absence of `.skip`/`.only`/`.fixme` and the presence of the guard assertion string. The
// full "all ten tests pass" clause needs a real run of the suite and is reported, not re-derived
// from file text, in 06-test-report.md.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { PlaywrightTestConfig } from "@playwright/test";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

async function loadConfig(env: Record<string, string | undefined>): Promise<PlaywrightTestConfig> {
  vi.resetModules();
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(env)) {
    saved[key] = process.env[key];
    const value = env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    const mod = (await import("../playwright.config")) as { default: PlaywrightTestConfig };
    return mod.default;
  } finally {
    for (const key of Object.keys(saved)) {
      const value = saved[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function firstWebServer(config: PlaywrightTestConfig) {
  const ws = config.webServer;
  return Array.isArray(ws) ? ws[0] : ws;
}

function gitDiffTouchesPath(path: string): boolean {
  let base: string;
  try {
    base = execFileSync("git", ["merge-base", "HEAD", "origin/main"], { cwd: REPO_ROOT })
      .toString()
      .trim();
  } catch {
    base = execFileSync("git", ["merge-base", "HEAD", "main"], { cwd: REPO_ROOT })
      .toString()
      .trim();
  }
  const out = execFileSync("git", ["diff", "--name-only", base, "--", path], { cwd: REPO_ROOT })
    .toString()
    .trim();
  return out.length > 0;
}

describe("BUG-001 — playwright.config.ts's default export", () => {
  it("AC-5: the webServer the suite starts pins the seam to the in-memory value", async () => {
    const webServer = firstWebServer(await loadConfig({}));
    expect(webServer, "no webServer declared").toBeTruthy();
    expect(webServer?.env?.VITE_DATA_SEAM).toBe("mock");
  });

  it("AC-5: a project named seam-guard is declared", async () => {
    const config = await loadConfig({});
    const names = (config.projects ?? []).map((p) => p.name);
    expect(names).toContain("seam-guard");
  });

  it("AC-5: every project other than seam-guard depends on it", async () => {
    const config = await loadConfig({});
    const others = (config.projects ?? []).filter((p) => p.name !== "seam-guard");
    expect(others.length, "no project carries the acceptance tests").toBeGreaterThan(0);
    for (const project of others) {
      expect(
        project.dependencies ?? [],
        `project ${String(project.name)} does not depend on seam-guard`,
      ).toContain("seam-guard");
    }
  });

  it("AC-1: the seam-guard project is distinctly named and the reporter surfaces it in the run's own output", async () => {
    const config = await loadConfig({});
    const names = (config.projects ?? []).map((p) => p.name);
    expect(names).toContain("seam-guard");
    // "list" prints every project's own test names as it runs. A reporter that swallows that
    // (e.g. a bare "dot" or "json") would still satisfy the other assertions here, but the run's
    // own output would stop answering "what did this test?" on its own — which is what AC-1 asks.
    expect(config.reporter).toBe("list");
  });

  it("AC-2: the pin holds even when the process environment carries VITE_SUPABASE_URL", async () => {
    const webServer = firstWebServer(await loadConfig({ VITE_SUPABASE_URL: "https://example.invalid" }));
    expect(webServer?.env?.VITE_DATA_SEAM).toBe("mock");
  });

  it("AC-3: an unconfigured machine reaches the identical pinned result", async () => {
    const configured = firstWebServer(
      await loadConfig({ VITE_SUPABASE_URL: "https://example.invalid" }),
    );
    const unconfigured = firstWebServer(await loadConfig({ VITE_SUPABASE_URL: undefined }));
    expect(unconfigured?.env, "the two machines produced different webServer envs").toEqual(
      configured?.env,
    );
    expect(unconfigured?.env?.VITE_DATA_SEAM).toBe("mock");
  });

  it("AC-6: a server already running at the base URL is reused rather than rebuilt", async () => {
    const webServer = firstWebServer(await loadConfig({}));
    expect(
      webServer?.reuseExistingServer,
      "reuseExistingServer must be true for AC-6's reused, unpinned server to be the one the guard actually reads",
    ).toBe(true);
  });

  it("AC-9: .github/workflows/verify.yml is not part of this ticket's diff", () => {
    expect(gitDiffTouchesPath(".github/workflows/verify.yml")).toBe(false);
  });

  it("AC-10: src/lib/data/index.ts is not part of this ticket's diff", () => {
    expect(gitDiffTouchesPath("src/lib/data/index.ts")).toBe(false);
  });

  it("AC-8: tests/e2e/tea-01-signup.spec.ts carries none of its assertions skipped, and the guard is still a live assertion", () => {
    const text = readFileSync(`${REPO_ROOT}tests/e2e/tea-01-signup.spec.ts`, "utf-8");
    expect(text, "a .skip found on TEA-01's suite").not.toMatch(/\.skip\s*\(/);
    expect(text, "a .only found on TEA-01's suite — the rest would not run").not.toMatch(
      /\.only\s*\(/,
    );
    expect(text, "a .fixme found on TEA-01's suite").not.toMatch(/\.fixme\s*\(/);
    expect(
      text,
      "the seam-banner guard assertion is no longer present as a live assertion",
    ).toMatch(/getByTestId\(\s*["']seam-banner["']\s*\)/);
    expect(
      text,
      "the guard no longer asserts data-seam=mock on the banner",
    ).toMatch(/toHaveAttribute\(\s*["']data-seam["']\s*,\s*["']mock["']\s*\)/);
  });
});
