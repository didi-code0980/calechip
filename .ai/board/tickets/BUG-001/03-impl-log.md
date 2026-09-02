---
ticket: BUG-001
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-02T13:19:34+00:00
inputs_read:
  - .ai/board/tickets/BUG-001/01-plan.md
  - .ai/board/tickets/BUG-001/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/standards/git-conventions.md
  - .ai/steward/context.md
  - playwright.config.ts
  - src/App.tsx
  - tests/e2e/tea-01-signup.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# BUG-001 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `playwright.config.ts` | modified | The suite could not state which datastore it drove: `webServer` had no `env` block, so the build inherited the machine's `.env`. Adds the pin, the `seam-guard` project, and the `dependencies` edge that makes a wrong run abort instead of report | §4.1 |
| `src/App.tsx` | modified | The only existing seam signal renders in the mock case alone, so a guard built on it could assert nothing but absence — and absence is indistinguishable from a server that never started. One attribute makes the page state its seam affirmatively in both configurations | §4.2 |
| `tests/e2e/seam.setup.ts` | created | The guard itself. It is the mechanism of the fix rather than a test of it: once the config names it in `dependencies`, `pnpm exec playwright test` cannot run at all without it | §4.3 |
| `tests/e2e/tea-01-signup.spec.ts` | modified | Comment only. Lines 14-18 asserted that the documented end-to-end command produces a mock build; that claim was false and is the sentence this ticket exists because of. No assertion, locator, title or address changed | §4.4 |

Two further files in this ticket folder carry PLAN's output rather than code — see *Open questions*
item 1, which is the one thing a reviewer must not discover from the diff alone.

## Contract items

| § 1 item | Implemented at | Notes |
|----------|----------------|-------|
| §4.1 pin | `playwright.config.ts:48` | `env: { VITE_DATA_SEAM: "mock" }` on `webServer`. `reuseExistingServer` kept, per §4.1's explicit decision — the guard converts the stale-server hazard into a loud refusal, verified below |
| §4.1 guard project | `playwright.config.ts:24` | `name: "seam-guard"`, with its own `testMatch` so `chromium` does not also collect it |
| §4.1 dependency | `playwright.config.ts:31` | `dependencies: ["seam-guard"]` on `chromium` |
| §4.2 attribute | `src/App.tsx:15` | `data-seam={seamName}` on the element already carrying `data-testid="app-root"`. No new import — `seamName` was already imported and consumed three lines below |
| §4.3 guard | `tests/e2e/seam.setup.ts:11-16` | Reads the served page only. No `process.env`, no config object, no `import.meta.env` |
| §4.4 comment | `tests/e2e/tea-01-signup.spec.ts:14-22` | Comment lines only; `git diff` on that file contains no non-comment line |

## Deviations from the design

`none`.

`reuseExistingServer: !process.env.CI` is **kept**, which is what §4.1 specifies rather than a
departure from it — the plan left the alternative named and rejected it in the same paragraph.

## Invariants

`invariants_touched` is `[]`, so this table has no rows, and §2 of the plan argues the emptiness
rather than asserting it. The one chain worth restating: an acceptance run against the live project
creates auth users and, through TEA-01's trigger, `member` rows. That is the behaviour this ticket
**stops**, and it is a blast-radius property rather than an invariant — INV-07 says an entry belongs
to one member, and a spurious member row does not violate it. Nothing here writes or reads domain
data.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| typecheck — `pnpm exec tsc --noEmit` | 0 | the command named in `.ai/standards/testing-standards.md` |
| lint — `pnpm exec eslint .` | 0 | same |
| unit — `pnpm exec vitest run` | 0 | same. 1 file, 2 tests. `tests/seam-parity.test.ts` passes unedited (§5) |
| end-to-end — `pnpm exec playwright test` | 0 | 11 passed (the guard plus the existing 10). See the browser note below |
| `git diff --name-only` subset of `allowed_paths` | yes | checked by hand — RULE-03 is not mechanically enforced on this branch |

**The end-to-end runs required a browser override, and it is not in the diff.** This container ships
Chromium build 1194 while `@playwright/test` 1.62.1 wants 1234, and the download is blocked by the
egress proxy. The runs below used a throwaway config that imported the shipped one and overrode
`launchOptions.executablePath` only; it was deleted afterwards and nothing in the repository carries
an `executablePath`. QA re-runs the documented command unmodified.

### What was observed, rather than assumed

Each acceptance criterion this stage can reach was run, because the defect being fixed is precisely a
suite that agreed with itself:

- **AC-2 — the pin beats a configured machine.** With `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY` exported, **11 passed**. This is the six-failure case ADR-021 recorded.
- **AC-3 — an unconfigured machine is identical.** With neither variable set, **11 passed**.
- **AC-4 and AC-6 — a stale unpinned server is caught, loudly.** A Supabase-resolved build was
  served on `:4173` before invoking the suite, so `reuseExistingServer` reused it. The guard failed
  with `locator resolved to <main data-seam="supabase" …> - unexpected value "supabase"` — it names
  what it received, which is AC-4's second clause — and the report read **`1 failed … 10 did not
  run`**. The sign-up specs never issued a request, which is the whole security property and the
  half `fullyParallel: true` would otherwise defeat.
- **AC-7 second half** was observed in that same run: the Supabase build reports
  `data-seam="supabase"` on `app-root` and renders no `seam-banner`.
- **AC-9's second clause** is read from the diff: `.github/workflows/verify.yml` is unchanged.
- **AC-10** likewise: `src/lib/data/index.ts` is unchanged.

AC-1, AC-5 and AC-8 are QA's to assert in `tests/e2e/bug-001-seam-pin.spec.ts` and
`tests/playwright-config.test.ts`, which are QA's files under §7 and are deliberately absent here.

## Testability contract

| selector | Exists at |
|----------|-----------|
| `app-root` | `src/App.tsx:15` — now carries `data-seam`, values `mock` and `supabase` |
| `seam-banner` | `src/App.tsx:23` — unchanged, still `data-seam="mock"`, still conditional |
| `signup-form` | `src/routes/SignUp.tsx:79` — unchanged |

## Open questions

**1. The plan artifact reached this branch by cherry-pick, and a reviewer will otherwise read that as
scope growth.** `/implement` step 0 expects `feat/BUG-001`; the ticket sets
`branch: "bugfix/BUG_TEA-01_01"`; this session was assigned `claude/bug-001-i4gtee`. None of the
three agree, and PLAN's output had been committed to `claude/cal-01-plan-81g2vy` — an unmerged branch
that also carries CAL-01's plan. Commit `1230c7f` was cherry-picked here because it touches BUG-001
files only; merging the branch would have pulled a second ticket into this tree and broken the
one-ticket-in-flight property ADR-006 rests on. So `.ai/board/tickets/BUG-001/01-plan.md` and the
four filled `ticket.yaml` fields in this diff are **PLAN's work, not this stage's** — they are
unmodified from `1230c7f`.

**2. `state:` still reads `BACKLOG` in `ticket.yaml`.** PLAN's front-matter says `next_state: READY`
but the field was never advanced, so the ticket has passed through PLAN and IN_PROGRESS without its
state ever leaving `BACKLOG`. Not corrected here: the field is the orchestrator's, and a developer
advancing it two steps by hand would hide the miss rather than surface it.

**3. RULE-03 has no automation on any of the three candidate branch names**, since both resolvers
hard-code `feat/`. The subset check in the table above was performed by hand, and R1 must be too —
`ticket.yaml` §4 and the plan's *Open questions* item 2 both say so, and it is the check most likely
to be assumed done.

**4. `TODO(verify)` in plan §8 is still open and belongs to QA**: whether `playwright.config.ts`
imports cleanly inside vitest for AC-5's named test. It imports `@playwright/test`, a runner rather
than a library. Nothing in this stage settled it — the throwaway config above imported the shipped
config under the *Playwright* runner, which is not the same question.
