---
ticket: BUG-001
stage: QA
agent: qa
produced_at: 2026-09-03T01:15:23+0000
inputs_read: [ .ai/board/tickets/BUG-001/01-plan.md, .ai/board/tickets/BUG-001/05-test-plan.md ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

## Results

| Suite | Command | Exit code | Passed | Failed | Skipped |
|---|---|---|---|---|---|
| unit | `pnpm exec vitest run` | 0 | 12 | 0 | 0 |
| e2e | `pnpm exec playwright test` | 0 | 18 | 0 | 0 |

**The e2e command could not be run unmodified in this container.** The preinstalled Chromium is build
1194; the pinned `@playwright/test` (1.62.1) wants 1234, and downloads are blocked by the egress proxy.
Per the QA brief for this run, the suite was executed against a throwaway config generated **outside
the repository** (in the session scratchpad, never committed, deleted immediately after use) that
imported `playwright.config.ts`'s own default export unchanged and added only
`use.launchOptions.executablePath` pointing at the container's pinned Chromium install, plus an
absolute `testDir` (needed only because the override file lives outside the repo) and `webServer.cwd`.
No tracked file carries an `executablePath`, a `-c` flag, or any other reference to the container's
browser path. **This belongs to CI**, whose runner presumably carries a matching browser and needs none
of this. The exit code and counts above are from four consecutive real runs of the actual, tracked
`tests/e2e/**` and `playwright.config.ts` against that throwaway config, all identical (12.0–12.7s,
18/18), with no leftover process after any of them (verified by port and by PID, not just by grep on
the earlier, misleading `"vite preview"` string pattern — the real child listens as `vite.js preview`).

Two runs of `pnpm exec vitest run` (unmodified, no config needed) also confirmed 12/12, 0 failed.

## AC coverage

| AC | Test name | Result |
|---|---|---|
| AC-1 | `AC-1: the seam-guard project is distinctly named and the reporter surfaces it in the run's own output` (unit) | PASS |
| AC-1 | `AC-1: the served page names the seam it resolved, which is what the report's guard depends on` (e2e) | PASS |
| AC-2 | `AC-2: the pin holds even when the process environment carries VITE_SUPABASE_URL` (unit) | PASS |
| AC-2 | `AC-2: the served page reports the mock seam regardless of what a machine's environment claims` (e2e) | PASS |
| AC-3 | `AC-3: an unconfigured machine reaches the identical pinned result` (unit) | PASS |
| AC-3 | `AC-3: an unconfigured machine reaches the identical mock result` (e2e) | PASS |
| AC-4 | `AC-4: a build resolved to a seam other than mock names that seam, which is what the guard's failure message depends on` (e2e) | PASS — mechanism only; full scenario verified manually, see below |
| AC-5 | `AC-5: the webServer the suite starts pins the seam to the in-memory value` (unit) | PASS |
| AC-5 | `AC-5: a project named seam-guard is declared` (unit) | PASS |
| AC-5 | `AC-5: every project other than seam-guard depends on it` (unit) | PASS |
| AC-6 | `AC-6: a server already running at the base URL is reused rather than rebuilt` (unit) | PASS — mechanism only; full scenario verified manually, see below |
| AC-7 | `AC-7: a build that resolves to the in-memory seam reports mock and shows the banner` (e2e) | PASS |
| AC-7 | `AC-7: a build that resolves to Supabase reports supabase and the mock banner is absent` (e2e) | PASS |
| AC-8 | `AC-8: tests/e2e/tea-01-signup.spec.ts carries none of its assertions skipped, and the guard is still a live assertion` (unit) | PASS — "all ten pass" clause confirmed by the real run above (tea-01-signup.spec.ts's 9 tests + smoke.spec.ts's 1, all green) |
| AC-9 | `AC-9: .github/workflows/verify.yml is not part of this ticket's diff` (unit) | PASS — first clause verified manually, see below |
| AC-10 | `AC-10: src/lib/data/index.ts is not part of this ticket's diff` (unit) | PASS |
| AC-10 | `AC-10: an ordinary production build resolves to Supabase and the mock banner is not rendered` (e2e) | PASS |

Every AC in section 2 of the plan (AC-1 through AC-10) appears above with at least one PASS.

### Manual verification — AC-4 and AC-6's full scenario

Reason this could not be a `test()`: explained in `05-test-plan.md`'s coverage-map note. Performed once,
by hand, per 01-plan.md §8's own recipe ("How to reach the failing states, without a credential"):

1. Built the app with `VITE_SUPABASE_URL=https://example.invalid` and `VITE_DATA_SEAM` unset (a
   dummy value — tested for presence only, per §8 — reaching nothing).
2. Started `pnpm exec vite preview --port 4173 --strictPort` by hand — an unpinned server, already
   listening on the suite's own base URL, built without the pin.
3. Ran the real, tracked suite (`pnpm exec playwright test`, via the same throwaway-config technique
   used for every other run in this container) against it, relying on the shipped
   `reuseExistingServer: true` to skip rebuilding.

Observed: `seam-guard` failed — `expect(locator).toHaveAttribute("data-seam", "mock")`, **received
`"supabase"`** — naming the seam it actually got, exactly as AC-4 requires. All 17 dependent tests
(everything in the `chromium` project) reported "did not run". `pnpm exec playwright test`'s own exit
code was `1`. This is AC-6's scenario (a reused, unpinned server) producing AC-4's failure (named,
descriptive), both directly against the shipped, untouched `tests/e2e/seam.setup.ts` — never read, only
run. The rigged server and its build output were torn down immediately after, and a clean pinned run
was re-confirmed (18/18, exit 0) before writing this report.

### Manual verification — AC-9's first clause

No PR exists yet for this branch — QA does not commit (RULE-09 / "Agents commit at `/ship` only") — so
there is no actual GitHub Actions run of `.github/workflows/verify.yml` for this commit to cite. What
was checked instead: two local runs of `pnpm exec playwright test` (via the same throwaway-config
technique), one with `VITE_SUPABASE_URL=https://example.invalid` set in the invoking shell and one
without. Both produced the identical result: 18/18 passed, `seam-guard` first, mock seam throughout.
This is the substance of the clause — the result does not depend on the invoking shell's own
environment — observed locally rather than against CI's own runner. Recorded as a gap, not silently
assumed equivalent: **the literal "a runner with no `.env`" half of AC-9 is CI's own future run, not
something QA reached in this pass.**

## Failures

None.

## Invariant observations

| Invariant | Held | Evidence |
|---|---|---|
| (none — `invariants_touched: []`) | n/a | 01-plan.md §2 argues no invariant is engaged: this ticket writes no domain data and reads none. QA does not read `src/**` and cannot independently re-derive that argument, but nothing in sections 1, 2 or 8 names a probe against `entry`, `member` or `team`, and no test in this pass touches any of the three. No violation was observed, and none was looked for beyond what the plan's own scope makes reachable. |

## Selector gaps encountered

None. `app-root` and `seam-banner`, section 8's table, were sufficient for every test written. No
selector outside that table was needed or used.

## Verdict

**PASS.** All ten acceptance criteria map to at least one named, passing test; the unit command
(`pnpm exec vitest run`) and the end-to-end command (`pnpm exec playwright test`) both exit 0 — the
latter confirmed against the real, tracked suite via a throwaway, untracked, deleted config, because
this container's preinstalled browser does not match the pinned `@playwright/test` version and cannot
be upgraded here; that gap belongs to CI, not to this ticket. No invariant violation was observed. No
selector gap was encountered. `chat_before_verdict: none` is truthful — no message channel to
`developer` or `tech-lead-review` was used or needed.
