---
ticket: BUG-001
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-02T15:13:57+00:00
inputs_read:
  - .ai/board/tickets/BUG-001/ticket.yaml
  - .ai/board/tickets/BUG-001/01-plan.md
  - .ai/board/tickets/BUG-001/03-impl-log.md
  - .ai/templates/review-report.md
  - .ai/01-operating-model.md
  - .ai/registry/rules.md
  - .ai/registry/invariants.md
  - .ai/registry/features.md
  - .ai/standards/testing-standards.md
  - .ai/standards/architecture.md
  - .ai/standards/coding-standards.md
  - .ai/standards/git-conventions.md
  - scripts/check-allowed-paths.mjs
  - .claude/hooks/guard-allowed-paths.mjs
  - eslint.config.js
  - package.json
  - .github/workflows/verify.yml
  - playwright.config.ts
  - src/App.tsx
  - src/lib/data/index.ts
  - src/routes/SignUp.tsx
  - tests/e2e/seam.setup.ts
  - tests/e2e/tea-01-signup.spec.ts
  - tests/e2e/smoke.spec.ts
  - git diff origin/main...HEAD
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: QA
---

# BUG-001 — review report

Diff under review: `origin/main...HEAD` on `claude/bug-001-i4gtee`, three commits (`7bb419f`
PLAN, `ce3669c` IN_PROGRESS, `91a6d71` state). Working tree clean — `git status --porcelain`
empty, so the committed diff **is** the working-tree state.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | **PASS** | 7 changed files; 4 code files match `ticket.yaml:59-64`, 3 are the ticket folder exempted at `scripts/check-allowed-paths.mjs:120`. Detail below |
| R2 | typecheck exit 0 | **PASS** | `pnpm exec tsc --noEmit` (`.ai/standards/testing-standards.md:16`) re-run by this reviewer — exit 0, no output |
| R3 | lint exit 0 | **PASS** | `pnpm exec eslint .` (`.ai/standards/testing-standards.md:17`) re-run by this reviewer — exit 0, no output |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | **PASS** | `src/App.tsx:7` imports `seamName` from `./lib/data` (the seam, `.ai/standards/architecture.md:17`); `tests/e2e/seam.setup.ts:1` imports only `@playwright/test`; `playwright.config.ts:48` sets an env var. `git diff origin/main...HEAD -- src/lib/` is empty |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | **PASS** | Per-item table below; `playwright.config.ts:22-33,48`, `src/App.tsx:15`, `tests/e2e/seam.setup.ts:1-16`, `tests/e2e/tea-01-signup.spec.ts:14-22` |
| R6 | Permission gating matches plan section 3 | **PASS** | `01-plan.md:237` claims no permission row is touched; `git diff origin/main...HEAD -- src/routes/ supabase/` is empty and `src/App.tsx:32-48` adds no route. The §3 denial verified by execution — below |
| R7 | Every test selector in plan section 8 exists in the markup | **PASS** | `app-root` `src/App.tsx:15`; `seam-banner` `src/App.tsx:23-24`; `signup-form` `src/routes/SignUp.tsx:79` |
| R8 | No invariant violated — reason through each ID in `invariants_touched` (RULE-07) | **PASS** | `ticket.yaml:23` `invariants_touched: []`; the emptiness re-derived per ID below against `.ai/registry/invariants.md:33-39` |
| R9 | No dependency added without an ADR | **PASS** | `package.json` absent from `git diff origin/main...HEAD --name-only`; `pnpm-lock.yaml` likewise. The one new import, `tests/e2e/seam.setup.ts:1`, resolves to `@playwright/test` already declared at `package.json:30` |

## R1 detail — performed by hand, because no automation fires on this branch

`ticket.yaml:41-44` and `01-plan.md:218-221` both warn that R1 has no mechanism here. Confirmed
rather than accepted: `scripts/check-allowed-paths.mjs:85-86` exits 0 on any branch not starting
`feat/`, and `.claude/hooks/guard-allowed-paths.mjs:11-13` documents the same gate. Run on this
branch, the script printed `allowed-paths: branch "claude/bug-001-i4gtee" is not feat/*, nothing
to check` and exited 0. The branch is not even the `bugfix/BUG_TEA-01_01` of `ticket.yaml:10` —
this session was assigned `claude/bug-001-i4gtee`, so **three** names are in play and none of them
is enforced. The subset check below is therefore mine, file by file.

`git diff origin/main...HEAD --name-only`, all seven:

| Changed file | Verdict | Against |
|---|---|---|
| `.ai/board/tickets/BUG-001/01-plan.md` | allowed | ticket folder, exempt — `scripts/check-allowed-paths.mjs:120` returns false for anything under `.ai/board/tickets/<ID>/`, and `.ai/01-operating-model.md:115-117` calls the ticket folder the one place writable with `allowed_paths` empty |
| `.ai/board/tickets/BUG-001/03-impl-log.md` | allowed | same |
| `.ai/board/tickets/BUG-001/ticket.yaml` | allowed | same |
| `playwright.config.ts` | allowed | `ticket.yaml:59` |
| `src/App.tsx` | allowed | `ticket.yaml:60` |
| `tests/e2e/seam.setup.ts` | allowed | `ticket.yaml:61` |
| `tests/e2e/tea-01-signup.spec.ts` | allowed | `ticket.yaml:62` |

No file outside the list. The two globs at `ticket.yaml:63-64` — `tests/e2e/bug-001-seam-pin.spec.ts`
and `tests/playwright-config.test.ts` — are correctly **absent**: `01-plan.md:443-444` assigns both
to QA, and a Developer that had written them would have taken QA's work.

The four files `01-plan.md:446-451` names as deliberately absent are all unchanged and all absent
from the diff: `.github/workflows/verify.yml` (this is AC-9's second clause, read from the diff),
`src/lib/data/index.ts` (AC-10's second clause), `tests/seam-parity.test.ts`, `tests/e2e/smoke.spec.ts`.

**The licence on `tests/e2e/tea-01-signup.spec.ts` was comment-only** (`01-plan.md:442`) and was
kept. Every line in that file's hunk begins `//`: removed `:15-18`, added `:15-22`, and
`tests/e2e/tea-01-signup.spec.ts:24` (`const SIGNUP = "/signup";`) is the first non-comment line
and is unchanged. No assertion, locator, title or address moved (AC-8's precondition).

## R2 and R3 — re-run, not taken from the log

`03-impl-log.md:60-64` asserts four exit codes. Three were re-executed in this session rather than
read:

| Command | Named at | Exit observed here |
|---|---|---|
| `pnpm exec tsc --noEmit` | `.ai/standards/testing-standards.md:16` | 0 |
| `pnpm exec eslint .` | `.ai/standards/testing-standards.md:17` | 0 |
| `pnpm exec vitest run` | `.ai/standards/testing-standards.md:18` | 0 — 1 file, 2 tests |
| `node scripts/check-docs.mjs` | `.ai/standards/testing-standards.md:20` | 0 — 1 pre-existing D8 advisory on `ADR-008`, unrelated to this diff |

`pnpm exec eslint .` passing is also R4's mechanism: `eslint.config.js:31-50` scopes
`no-restricted-imports` on `@supabase/*` to `src/**` outside `src/lib/data/`.

### The end-to-end suite — what I ran, and the one thing I could not

The container's Chromium is build 1194 and `@playwright/test` 1.62.1 wants 1234; downloads are
blocked. As `03-impl-log.md:66-70` says, the shipped command cannot launch a browser here. I did
not take the log's word for the outcome: I ran the suite three times through a throwaway config
**outside the repository** that imported `playwright.config.ts` and overrode only
`launchOptions.executablePath` (and `webServer.cwd`, since the config sat elsewhere). It has been
deleted; `grep -rn executablePath` over the tree returns nothing outside `node_modules`, and
`git status --porcelain` is empty.

| What | Result observed by this reviewer |
|---|---|
| No `VITE_SUPABASE_URL`, no `.env` present (AC-3) | **11 passed** — `[seam-guard]` 1, `[chromium]` 10 |
| `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` exported (AC-2) | **11 passed** — the pin at `playwright.config.ts:48` beat the exported environment |
| A Supabase-resolved `vite build` served on `:4173` before invoking, so `reuseExistingServer` reuses it (AC-4, AC-6) | **1 failed … 10 did not run**, with `Expected: "mock" / Received: "supabase"` and `locator resolved to <main data-seam="supabase" data-testid="app-root">` |

**What I could not verify:** that the documented command `pnpm exec playwright test` exits 0
*unmodified* on a machine with a matching browser. The override is a launch path only — it changes
no project, no `testMatch`, no `dependencies` and not `webServer.env` — but it is a modification,
and CI (`.github/workflows/verify.yml:47-51`) installs the matching browser and runs the command
plain. That run belongs to QA and to the pull request, and R2/R3 are the only two exit codes this
gate owns.

## R5 detail

One row per contract item in `01-plan.md` §4.

| Contract item | Implemented at | Matches signature |
|---|---|---|
| §4.1 the pin — `env: { VITE_DATA_SEAM: "mock" }` on `webServer` (`01-plan.md:294-307`) | `playwright.config.ts:48` | Yes, character-identical to the plan's block, comment included |
| §4.1 the guard project — `name: "seam-guard"` with its own `testMatch` (`01-plan.md:282-286`) | `playwright.config.ts:23-27` | Yes. Confirmed by execution that `chromium` does not also collect it: the run reported 11 tests, 1 in `[seam-guard]` and 10 in `[chromium]` |
| §4.1 the dependency — `dependencies: ["seam-guard"]` on `chromium` (`01-plan.md:288-291`) | `playwright.config.ts:31` | Yes. Confirmed by execution: on guard failure the report read `1 failed … 10 did not run` |
| §4.1 `reuseExistingServer` kept (`01-plan.md:310-316`) | `playwright.config.ts:39` | Yes — unchanged from `main`, which is what the plan specifies, not a departure |
| §4.2 `data-seam={seamName}` on `app-root` (`01-plan.md:324`) | `src/App.tsx:15` | Yes. No new import — `seamName` already at `src/App.tsx:7`. The banner at `src/App.tsx:21-30` keeps its `data-testid`, its `data-seam="mock"` and its conditional, as `01-plan.md:335-337` requires |
| §4.3 the guard file, whole (`01-plan.md:346-361`) | `tests/e2e/seam.setup.ts:1-16` | Yes, character-identical. Reads the served page only — `page.goto` at `:12`, `getByTestId` at `:13`; no `process.env`, no config object, no `import.meta.env` anywhere in the file |
| §4.4 comment correction, no assertion (`01-plan.md:371-380`) | `tests/e2e/tea-01-signup.spec.ts:14-22` | Yes; comment-only, verified line by line under R1 |
| §4.5 names fixed under RULE-04 (`01-plan.md:387-393`) | `seam-guard` `playwright.config.ts:24`; `tests/e2e/seam.setup.ts` exists; `data-seam` `src/App.tsx:15`; `VITE_DATA_SEAM` `playwright.config.ts:48` and `src/lib/data/index.ts:164` | Yes. Nothing invented — no identifier in the diff is absent from §4.5 |

The two names at `01-plan.md:390-391` (`tests/e2e/bug-001-seam-pin.spec.ts`,
`tests/playwright-config.test.ts`) are QA's per `01-plan.md:443-444` and are correctly not here.

**Plan §5 (seam impact: none) and §6 (schema delta: none) hold on the diff**: `src/lib/data/`,
`supabase/` and `tests/seam-parity.test.ts` are all absent from `git diff --name-only`, and
`tests/seam-parity.test.ts` passes unedited inside the vitest run above.

## R6 detail

`01-plan.md:237-238` states that no row in `.ai/standards/rbac-and-security.md` is touched and no
role gains or loses anything. Verified on the diff, not on the claim:

- `git diff origin/main...HEAD -- src/routes/ src/lib/ supabase/ .ai/standards/` is **empty** — no
  new control, no new write path, no policy.
- The only markup change is one attribute at `src/App.tsx:15`. The route table at
  `src/App.tsx:32-48` is byte-identical to `main`.

`01-plan.md:245` states the section's real content as a security property rather than a role gate —
*"an acceptance run must be structurally incapable of reaching a real datastore"* — and
`01-plan.md:254-257` states it as a denial across AC-2, AC-4 and AC-6. I executed all three
(table under R3) and the denial holds in each: the pin beats an exported environment, and a stale
unpinned server produces a refusal that names the seam it got, with the ten dependent tests not run.
The named escape hatch `--no-deps` (`01-plan.md:259-261`) is disclosed in the plan and is unchanged
by the diff.

**The disclosure claim at `01-plan.md:263-267` holds at the type level**: `seamName` is declared
`"mock" | "supabase"` at `src/lib/data/index.ts:171`, so `src/App.tsx:15` can render no URL and no
key.

## R7 detail

Every selector in `01-plan.md` §8 (`:473-475`), against the markup:

| Selector | Exists at | Notes |
|---|---|---|
| `app-root` | `src/App.tsx:15` | Carries `data-seam={seamName}`. **Present in both configurations** — I observed `data-seam="mock"` in the pinned run and `<main data-seam="supabase" data-testid="app-root">` in the unpinned one, which is exactly what §8 promises QA and what AC-4's message depends on |
| `seam-banner` | `src/App.tsx:23` | With `data-seam="mock"` at `:24`, rendered only when `seamName === "mock"` (`src/App.tsx:21`). Unchanged by this diff |
| `signup-form` | `src/routes/SignUp.tsx:79` | Unchanged; file absent from the diff |

No selector in §8 is missing from the markup. R7 is the direction `.ai/standards/testing-standards.md:62`
specifies, and it passes.

## R8 detail

`ticket.yaml:23` declares `invariants_touched: []`. The template's table takes one row per listed ID
and the list is empty, so the emptiness itself is what must be reasoned — and
`.ai/registry/invariants.md:62-65` warns that concluding no invariant is engaged *because the safe
behaviour was chosen* is circular. I did not accept `01-plan.md:190-203`'s argument; I re-derived it
per ID against the diff.

**The structural fact the per-ID reasoning rests on:** every one of INV-01 to INV-07 constrains rows
in `entry`, `member` or `team`. The diff touches four files, and none of them can reach a row. The
seam is the only door (`.ai/standards/architecture.md:17`) and `git diff origin/main...HEAD -- src/lib/ supabase/`
is empty, so no write path, no read path, no constraint, no trigger and no computation changed.

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 — no two entries of one member cover the same portion of a date | Untouched. Overlap is a constraint on `entry` rows; nothing in this diff creates, edits or queries an entry. The whole of the application change is one HTML attribute | `.ai/registry/invariants.md:33`; `src/App.tsx:15` is the only `src/` line changed; `git diff -- src/lib/` empty |
| INV-02 — an edited approved entry returns to `pending` | Untouched. A status transition living below the seam; no seam function added, removed or changed, and `tests/seam-parity.test.ts` passes unedited | `.ai/registry/invariants.md:34`; `01-plan.md:397`; vitest run above, 2/2 |
| INV-03 — a rejected entry carries a non-empty reason | Untouched. A column-level constraint on `entry`; no schema delta, no migration, no policy — `supabase/` absent from the diff | `.ai/registry/invariants.md:35`; `ticket.yaml:65` `schema_delta: none`; `01-plan.md:407-409` |
| INV-04 — one definition of the absence count | Untouched, and this is the one worth stating rather than listing: the invariant is the **uniqueness** of the computation, so it is violated by *adding* a second computation of the number. The diff adds no computation of anything — `src/App.tsx:15` renders a string the seam already exports at `src/lib/data/index.ts:171`, and `tests/e2e/seam.setup.ts:15` compares that string to a literal. Neither counts absences | `.ai/registry/invariants.md:36,110-114`; `src/App.tsx:15`; `tests/e2e/seam.setup.ts:9,15` |
| INV-05 — a tentative entry counts as a non-tentative one | Untouched. A property of the same single computation as INV-04, which does not exist in any file this diff touches | `.ai/registry/invariants.md:37`; `git diff -- src/lib/` empty |
| INV-06 — one portion per entry, applying to every date in its range | Untouched. A schema shape; `ticket.yaml:65` is `schema_delta: none` and `01-plan.md:407-409` argues it is a genuinely-`none` case — no migration, policy, trigger, constraint, grant, column or enum, and I confirm `supabase/` and `src/lib/domain/` are absent from `git diff --name-only` | `.ai/registry/invariants.md:38`; `01-plan.md:407-409` |
| INV-07 — every entry belongs to exactly one member, counted against that member's team | Untouched, **and this is the chain that had to be followed rather than dismissed.** An acceptance run against the live project does write rows — auth users, and `member` rows through TEA-01's trigger. So the indirect chain is real and `.ai/registry/invariants.md:64-65` requires following it. It terminates outside the invariant in both directions: (a) INV-07 constrains an `entry`'s ownership, and a spurious `member` row with no entries violates no clause of it; (b) the writes are what this diff **stops**, verified by execution — a run whose page reported `supabase` produced `1 failed … 10 did not run`, so the ten specs that would issue sign-up requests never started | `.ai/registry/invariants.md:39`; `playwright.config.ts:31`; `tests/e2e/seam.setup.ts:15`; observed report `1 failed … 10 did not run` |

**No invariant here is held by a UI affordance.** `src/App.tsx:15` is an affordance and it holds
nothing — it is a *disclosure* the guard reads, and the thing that actually refuses is
`dependencies: ["seam-guard"]` at `playwright.config.ts:31`, in the runner, outside the browser.
Nothing was moved onto the UI to make a check pass.

R8 does not fail. No escalation under RULE-07.

## Findings

None. No check failed, so there is no routing row and `rework_count` stays `0` (`ticket.yaml:67`).

Two facts are recorded here because they are true and load-bearing, and neither is a finding
against this diff. Stating them is not a softened verdict: neither is an R1-R9 item, and neither
routes anywhere from this gate.

1. **`ticket.yaml:75` still reads `plan: { passed: false, at: null }`, and `ticket.yaml:8` went
   `BACKLOG` to `REVIEW` without passing through `READY` or `IN_PROGRESS`.** `01-plan.md:33` says
   `next_state: READY` and the field was never advanced; `03-impl-log.md` *Open questions* item 2
   discloses this rather than smoothing it, which is why I can cite it. The consequence is
   concrete: the Definition of Ready gate at `.ai/01-operating-model.md:56-57` was never evaluated for
   this ticket, and `ticket.yaml:78-79` says `/ship` requires `passed: true` on all three gates
   under ADR-021. **This is upstream of IN_PROGRESS and outside R1-R9** — the REVIEW gate is
   defined as R1-R9 and nothing else (`.ai/01-operating-model.md:84`) — and it is not the
   Developer's to fix. It is the `orchestrator`'s at the READY row, and it must be settled before
   `/ship`, not before QA. I have not touched `ticket.yaml`.
2. **The `TODO(verify)` at `01-plan.md:493-496` is still open and it is QA's**: whether
   `playwright.config.ts` imports cleanly inside vitest, which AC-5's `tests/playwright-config.test.ts`
   needs. Nothing in this diff settles it and nothing in this diff was required to. Named here so
   QA does not meet it as a surprise; the plan already names the fallback.

## Verdict

**PASS.** All nine checks pass with citations. The ticket advances to QA.

The three claims worth having verified rather than read were verified: the pin beats a configured
machine (AC-2), a stale unpinned server is refused before any dependent test runs (AC-4, AC-6), and
the diff is a strict subset of `allowed_paths` on a branch where nothing would have caught it if it
were not (R1).

`chat_before_verdict: none` is truthful. This session read files and the diff, ran commands, and
exchanged no message with the Developer or with QA.
