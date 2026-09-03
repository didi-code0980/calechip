---
ticket: BUG-001
stage: QA
agent: qa
produced_at: 2026-09-03T01:15:23+0000
inputs_read: [ .ai/board/tickets/BUG-001/01-plan.md ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: QA
---

## Coverage map

| AC | Test name | Level | Selectors used |
|---|---|---|---|
| AC-1 | `AC-1: the seam-guard project is distinctly named and the reporter surfaces it in the run's own output` | unit | none (config shape) |
| AC-1 | `AC-1: the served page names the seam it resolved, which is what the report's guard depends on` | e2e | `app-root` |
| AC-2 | `AC-2: the pin holds even when the process environment carries VITE_SUPABASE_URL` | unit | none (config shape) |
| AC-2 | `AC-2: the served page reports the mock seam regardless of what a machine's environment claims` | e2e | `app-root` |
| AC-3 | `AC-3: an unconfigured machine reaches the identical pinned result` | unit | none (config shape) |
| AC-3 | `AC-3: an unconfigured machine reaches the identical mock result` | e2e | `app-root` |
| AC-4 | `AC-4: a build resolved to a seam other than mock names that seam, which is what the guard's failure message depends on` | e2e | `app-root` |
| AC-5 | `AC-5: the webServer the suite starts pins the seam to the in-memory value` | unit | none (config shape) |
| AC-5 | `AC-5: a project named seam-guard is declared` | unit | none (config shape) |
| AC-5 | `AC-5: every project other than seam-guard depends on it` | unit | none (config shape) |
| AC-6 | `AC-6: a server already running at the base URL is reused rather than rebuilt` | unit | none (config shape) |
| AC-7 | `AC-7: a build that resolves to the in-memory seam reports mock and shows the banner` | e2e | `app-root`, `seam-banner` |
| AC-7 | `AC-7: a build that resolves to Supabase reports supabase and the mock banner is absent` | e2e | `app-root`, `seam-banner` |
| AC-8 | `AC-8: tests/e2e/tea-01-signup.spec.ts carries none of its assertions skipped, and the guard is still a live assertion` | unit | none (file-text structural check) |
| AC-9 | `AC-9: .github/workflows/verify.yml is not part of this ticket's diff` | unit | none (git-diff fact) |
| AC-10 | `AC-10: src/lib/data/index.ts is not part of this ticket's diff` | unit | none (git-diff fact) |
| AC-10 | `AC-10: an ordinary production build resolves to Supabase and the mock banner is not rendered` | e2e | `app-root`, `seam-banner` |

An AC with no row is a gate failure. Every one of AC-1 through AC-10 has at least one row above.

**On AC-4 and AC-6, read together with the note in `tests/e2e/bug-001-seam-pin.spec.ts`.** The file
that carries the acceptance tests (`chromium`, dependent on `seam-guard`) only ever runs *after* the
guard has already confirmed the served page reports `mock` — so a scenario where the guard refuses
is, by construction, a scenario where that project's own tests never start. Neither AC is therefore
provable as a `test()` inside that project without contradicting its own precondition. Each is instead
proven at the level that is actually reachable:

- **AC-6**'s mechanism — that an already-running server is reused rather than rebuilt, so an unpinned
  one stays unpinned — is a static fact of the shipped config (`webServer.reuseExistingServer`), and is
  asserted directly against the imported `playwright.config.ts` default export, the one sanctioned
  RULE-05 exception this ticket carries (01-plan.md §8).
- **AC-4**'s mechanism — that a non-mock build genuinely reports its own seam by name, which is the
  affirmative signal §8 says the guard's message depends on — is proven at the e2e level, against a
  second, independently-built server on its own port, using only the `app-root`/`data-seam` selector
  named in §8.
- The **full scenario** named by both criteria — an unpinned server already at the suite's own base
  URL, and the shipped guard actually refusing the run because of it — was additionally exercised once
  by hand during this QA pass, exactly via the recipe in §8 ("How to reach the failing states, without
  a credential"), and the observed result is recorded in `06-test-report.md`. It is not re-derived from
  a `test()` because no `test()` in the normal project graph can observe it without already having
  contradicted it.

## Refusal cases

- `AC-4: ...` is the refusal shape for this ticket's own scope: it exists to establish that a wrongly
  resolved build cannot pass unnoticed — the served page must genuinely, nameably disagree with the
  pin. It is not phrased as "the run fails" (untestable inside the passing project, per above) but as
  "the disagreement is observable", which is the fact the guard's refusal is built from.
- The AC-8 unit test is a refusal case in file-structure terms: it asserts the *absence* of `.skip`,
  `.only` and `.fixme` on `tests/e2e/tea-01-signup.spec.ts`, and the *presence* of the guard assertion
  string — i.e., that the cheapest way out named in 01-plan.md's Out-of-scope section ("Deleting or
  skipping the guard") was not taken.
- The AC-9 and AC-10 unit tests are refusals against silent scope creep: each asserts a named file is
  **not** in this ticket's diff, i.e., that the fix did not reach into `.github/workflows/verify.yml`
  or `src/lib/data/index.ts` to get a passing result.

This ticket carries no domain-write refusal case (create/reject/second-write) because it touches no
domain entity — see Invariant probes below.

## Invariant probes

`invariants_touched: []`, transcribed unedited from 01-plan.md §2. The plan's own argument — no
domain data is written or read by anything this ticket changes — was not independently re-derived here
(QA does not read `src/**`), but nothing in sections 1, 2 or 8 gives QA a probe to write against
`entry`, `member` or `team`, and no test above touches any of the three. There is no invariant probe in
this plan for that reason, stated rather than left as an absent row.

## Fixtures

None used. `.ai/standards/testing-standards.md`'s shared fixture module is for domain entities
(`entry`, `member`, `team`); this ticket's criteria are about the test harness's own configuration and
the page's `data-seam` attribute, neither of which the fixture module models. `AC-2`/`AC-3`'s "machine
with/without `VITE_SUPABASE_URL`" duality is constructed directly with `vi.resetModules()` and a
process-environment override in `tests/playwright-config.test.ts`, not with a fixture.

## Out of scope for this plan

- **A real Supabase-backed run.** Explicitly out of scope for the ticket itself (01-plan.md §1); no
  test here reaches a live project, and every Supabase-resolved build is built with a dummy,
  non-resolving `VITE_SUPABASE_URL`, per §8's recipe.
- **TEA-01's own acceptance assertions.** AC-8 asserts they are *unedited* and *unskipped*; it does not
  re-test what they test.
- **CI's own execution of `.github/workflows/verify.yml`.** No PR exists yet for this branch (ticket
  work is not committed by QA — RULE-09/"Agents commit at `/ship` only"), so AC-9's first clause ("a
  runner with no `.env` and ... a machine with one" produce the same result) is checked with two local
  runs differing only in whether `VITE_SUPABASE_URL` is set in the invoking shell, not with an actual
  GitHub Actions run. Recorded as a limitation in `06-test-report.md`, not silently assumed equivalent.
- **Performance and accessibility.** Untouched by this ticket; not applicable to any AC here.

## Selector gaps

None. Every selector used above (`app-root`, `seam-banner`) is named in section 8's table, together
with its exact contract (`data-seam` attribute on `app-root`; presence/absence of `seam-banner`). No
test in either file addresses a class, DOM path or attribute outside that table.
