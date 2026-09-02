---
ticket: BUG-001
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-02T12:56:02+00:00
inputs_read:
  - .ai/board/tickets/BUG-001/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/rules.md
  - .ai/registry/decisions/ADR-021-the-qa-waiver-is-reverted.md
  - .ai/standards/architecture.md
  - .ai/standards/testing-standards.md
  - .ai/standards/git-conventions.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/coding-standards.md
  - .ai/board/ideas/2026-09-01-the-end-to-end-suite-does-not-pin-which-seam-it-drives.md
  - .ai/board/model-debt.md
  - .ai/01-operating-model.md
  - playwright.config.ts
  - vite.config.ts
  - .github/workflows/verify.yml
  - .gitignore
  - src/App.tsx
  - src/lib/data/index.ts
  - tests/e2e/tea-01-signup.spec.ts
  - tests/e2e/smoke.spec.ts
  - tests/seam-parity.test.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# BUG-001 — The end-to-end suite does not pin which seam it drives

## 1. Problem and scope

### The registry row, transcribed

**There is no `BUG-001` row in `.ai/registry/features.md`, and that is deliberate.** This ticket
carries `feature_ids: [TEA-01]`; Definition of Ready item 1 constrains `feature_ids` and not the
ticket `id`. The provenance was written into the existing `TEA-01` row's `Notes` instead, and that
sentence is what section 1 transcribes, without paraphrase:

> **A defect against this feature's test harness is ticketed as `BUG-001`, from
> 2026-09-01-the-end-to-end-suite-does-not-pin-which-seam-it-drives.md, triaged PROMOTE on 2026-09-01
> and owed ahead of CAL-01 by ADR-021.** The end-to-end suite pins no datastore: it inherits whatever
> `.env` the machine has, so its verdict is not reproducible and on a configured machine it drives the
> live Supabase project with a developer's credentials — six of this feature's own acceptance tests
> fail on `main` because of it. **No new feature row was written for it, deliberately**, and this
> sentence is that decision's provenance: this column records what the product contains, and a test
> harness that cannot state which datastore it drove is not a capability. The ticket carries
> `id: BUG-001` with `feature_ids: [TEA-01]` — Definition of Ready item 1 constrains `feature_ids` and
> not the ticket `id`, and `git-conventions.md` requires a bug to carry its parent feature so that its
> priority can be decided. Nothing regressed in the shipped behaviour; the tests are right and the
> harness cannot tell them what they are testing.

### What the loop gains

**Today no ticket can pass the QA gate, on any machine that can run the application.** ADR-021
restored Definition of Done item 3 on 2026-09-01, which requires all four commands to exit 0.
`playwright.config.ts:20-24` declares `webServer.command` with **no `env` block**, so the build
inherits the machine's `.env`; `src/lib/data/index.ts:164` resolves the seam from
`VITE_DATA_SEAM === "mock" || !VITE_SUPABASE_URL`; and `.env` is untracked and gitignored. The one
input that decides the answer is the one input no reviewer can read.

Two consequences, and the second is the larger:

1. **The verdict is not reproducible.** Six of ten end-to-end tests fail on `main` on a configured
   machine and pass on an unconfigured one. `.github/workflows/verify.yml:50-51` runs the same command
   with no `env:` block on a runner that has no `.env`, so **CI and the QA gate disagree structurally
   about the same commit and neither says why.** Green CI on a commit whose acceptance suite is broken
   is not a neutral absence of information.
2. **An acceptance run writes to the live Supabase project with a developer's own credentials.** A
   sign-up suite creates auth users; `playwright.config.ts:9` sets `fullyParallel: true`, so several at
   once. Nobody has to make a mistake — running the documented command is enough.

**What this ticket gives the loop is a suite that states what it drives and refuses to run against
anything else.** After it, `pnpm exec playwright test` means the same thing on every machine, its
report names the seam it drove, and a run that would have reached a real datastore stops before the
first dependent test issues a request.

**This ticket changes no shipped application behaviour.** It adds one presentational attribute
(§4.2) and touches nothing else in `src/`.

### Out of scope

Non-empty. The first six are carried from the ticket shell §10 and the idea's own *Out of scope*,
because that is where they were decided; the last two are added here.

- **A second end-to-end suite against a real, dedicated test database.** Its own decision, with a
  project to provision, a lifecycle, credentials in CI and seed data. MD-021's fix shape says the
  same: *"a second suite against a real database is a separate decision and needs its own project,
  never the developer's."*
- **Retiring the untested surface of TEA-02, TEA-03 and TEA-04.** That is the *other* ticket ADR-021
  owes (§What is owed, item 2) — row-level policy work under ADR-005. It is downstream of this one and
  is not discharged by it.
- **Fixing, rotating or inspecting anything in `.env`, or auditing what earlier acceptance runs wrote
  to the live project.** Both are real and both have a human on the end of them.
- **Changing how `src/lib/data/index.ts` resolves the seam for the application.** The fallback at
  `:164` is deliberate and `:166-171` records why. That file is **not** in `allowed_paths`.
- **Rewriting TEA-01's acceptance criteria or its six failing assertions.** They are correct, and
  AC-8 below asserts they pass unedited.
- **Deleting or skipping the guard at `tests/e2e/tea-01-signup.spec.ts:52`.** The idea names this as
  the cheapest way out and the destructive one; §9 keeps it as a rejected alternative rather than
  leaving it unnamed, because it is what somebody under gate pressure will actually reach for.
- **Fixing the two `feat/`-hard-coded path-guard resolvers.** `git-conventions.md:44-49` says the
  cheapest moment is before any `bugfix/` branch exists and this ticket spends that moment. It is
  steward work on an `ops/` branch — see *Open questions* item 1.
- **The permission-model test against a real PostgreSQL.** Adjacent, frequently confused with this,
  and the opposite problem: that test is *supposed* to reach a real database. It is owed by CAL-01.

`size_estimate` is read from this section: **S.** One config change, one attribute, one setup file,
one comment correction, and the acceptance suite. No schema, no policy, no seam function, no screen.

## 2. Acceptance criteria

Written before the source tree was re-read for sections 3 to 9, per the template's ordering note.

**The whole criterion set is observable without a live Supabase project, and that is a property of
the design rather than a convenience.** `src/lib/data/index.ts:164` resolves on the **presence** of
`VITE_SUPABASE_URL`, never on its validity, so a dummy value produces a genuinely
Supabase-resolved build. §8 carries the recipe. No criterion below requires a credential.

**AC-1 — the run states which seam it drove**
- Given the end-to-end command named in `.ai/standards/testing-standards.md`
- When it runs, on any machine, passing or failing
- Then the report names a project that asserted the seam **the served page reported**, so the run's
  own output answers *"what did this test?"* without anybody inspecting the environment

**AC-2 — the suite drives the in-memory seam even when the machine says otherwise**
- Given a machine whose environment sets `VITE_SUPABASE_URL`
- When `pnpm exec playwright test` runs
- Then the served page reports the `mock` seam, and all tests pass

**AC-3 — an unconfigured machine gets the identical result**
- Given a machine with no `.env` and no `VITE_SUPABASE_URL`
- When the same command runs
- Then the served page reports the `mock` seam and the result is identical to AC-2's — same tests,
  same outcome

**AC-4 — a served page reporting any other seam fails the guard, and the failure names what it got**
- Given a server on the suite's base URL whose page reports a seam other than `mock`
- When the suite runs
- Then the guard fails
- And its message names the seam the page actually reported — not merely that something was missing

**AC-5 — the refusal is declared in the runner's configuration, not left to a test to notice**
- Given the shipped runner configuration
- Then it pins the seam for the server it starts, declares the guard as a project, and makes the
  project carrying the acceptance tests **depend** on the guard
- And a change removing any one of those three fails a named test

**AC-6 — a reused server that was not built under the pin is caught**
- Given a preview server already running on the suite's base URL, built without the pin, so that the
  suite reuses it instead of building
- When the suite runs
- Then AC-4's failure fires — the guard reads the page that is being served, not the value the
  configuration intended

**AC-7 — the page states its seam in both configurations**
- Given a build that resolves to the in-memory seam
- Then the application root reports `mock`, and the existing mock banner is visible
- Given a build that resolves to Supabase
- Then the application root reports `supabase`, and the mock banner is **absent** — unchanged from
  what ships today

**AC-8 — TEA-01's suite passes unedited in what it asserts**
- Given `tests/e2e/tea-01-signup.spec.ts` with none of its assertions changed, deleted or skipped
- When the suite runs under this fix
- Then all ten end-to-end tests pass
- And the guard at that file's line 52 passes **as an assertion**, not by having been removed

**AC-9 — continuous integration and the QA gate stop disagreeing**
- Given one commit
- When `pnpm exec playwright test` runs on a runner with no `.env` and on a machine with one
- Then both drive the in-memory seam and both produce the same result
- And `.github/workflows/verify.yml` is **unchanged** — no `env:` block is added to make this true

**AC-10 — the application's own seam resolution is untouched**
- Given an ordinary production build with `VITE_SUPABASE_URL` set and `VITE_DATA_SEAM` unset
- Then the application resolves to Supabase exactly as it does today, and the mock banner is not
  rendered
- And `src/lib/data/index.ts` is not modified by this ticket

### Invariants touched

**`[]`** — written explicitly, and argued rather than left to read as an oversight.

`.ai/registry/invariants.md` warns that concluding no invariant is engaged because the safe behaviour
was chosen is circular reasoning. The test here is different and it holds: **this ticket writes no
domain data and reads none.** It touches the test runner's configuration, one presentational
attribute, and the test tree. No entity is created, no policy is written, no count is computed, and
no column changes. INV-01 through INV-07 all constrain the state of `entry`, `member` and `team`, and
none of those is reachable from anything this ticket edits.

The one indirect chain worth following, because it is the strongest candidate: an acceptance run
against the live project **writes rows** — auth users, and through TEA-01's trigger, `member` rows.
That is precisely the behaviour this ticket **stops**, and it is not an invariant question: INV-07
says an entry belongs to one member, and a spurious member row created by a test run does not violate
it. It is a blast-radius problem, and §3 is where it is held.

### Open questions

**1. `/plan` step 0 names `feat/BUG-001`; the ticket carries an operator-set
`branch: "bugfix/BUG_TEA-01_01"`. They cannot both be followed, and the ticket's is authoritative.**
`.claude/commands/plan.md` step 0 hard-codes `feat/<TICKET-ID>` and is silent on bug tickets;
`.ai/standards/git-conventions.md:36` says `<FEATURE-ID>` is a row in `features.md` and nothing else,
so `feat/BUG-001` is not a legal branch name under the standard. The operator settled it on
2026-09-01, knowing the path guard is inactive on `bugfix/` — recorded in `ticket.yaml` §4. **This is
a defect in `/plan`, not a decision this plan may take:** `.claude/**` is human plane. It does not
block anything here; it is a steward chore, and the fix shape is one sentence in step 0 saying that a
ticket carrying a non-empty `branch` uses that name.

**2. `RULE-03` has no mechanical enforcement on this ticket, and §7 is therefore a promise.** Both
resolvers hard-code `feat/`, so `scripts/check-allowed-paths.mjs` exits 0 on a `bugfix/` branch and
`.claude/hooks/guard-allowed-paths.mjs` does not fire. `ticket.yaml` §4 says this in capitals and
tells the reviewer to check the diff by hand. Repeated here because the plan is what `/review` reads:
**R1 has no automation behind it on this ticket and is the check most likely to be assumed done.**

**3. Whether `.ai/standards/testing-standards.md`'s command table should be corrected once this
lands — not this ticket's, and not blocking.** That table records *"end-to-end | 10 tests in 2 files —
4 pass, 6 fail"* as of 2026-09-01. After this ticket the correct row is 10 tests in 3 files, all
passing, on any machine. The file is human plane under RULE-01 and is not in `allowed_paths`; it is a
steward chore. It matters more than a stale sentence usually would, because that table is what
Definition of Done item 3 is read against.

**4. Nothing here re-measured the four-pass/six-fail split, and no `.env` exists in this working
copy.** `ADR-021` measured it and `ticket.yaml` §5 records that triage did not reproduce it either.
This plan does not report it as newly observed. What triage **did** measure is carried into §4 and
cited as triage's measurement, not as this plan's.

## 3. Permission model

**No permission row in `.ai/standards/rbac-and-security.md` is touched, added or removed, and no role
gains or loses anything.** This ticket ships no user-facing action: there is no new control, no new
route, no new write path, and no read that did not exist.

That is the whole of the role model's answer, and it is not the whole of this section, because this
ticket exists for a security property and check R6 should meet it rather than conclude the section is
empty.

**The property: an acceptance run must be structurally incapable of reaching a real datastore.**

| Where it could be held | Verdict |
|---|---|
| The runner's configuration — `webServer.env` pins the build the suite serves | **Held here.** It is the one place both readers of the command pass through: the local `/qa` run and `.github/workflows/verify.yml:51` invoke the same binary with the same config |
| A guard project the acceptance project depends on, asserting **the served page** | **Held here too**, and this is the half that survives a reused server. Playwright aborts a project whose declared dependency failed — verified during triage on an isolated config, which reported *"1 failed … 1 did not run"* |
| Application code — a check inside `src/lib/data/` or a component | **Refused.** RULE-02: nothing outside the seam may select an implementation, and a test file may not reach past the seam to pick a client. §1 *Out of scope* keeps `src/lib/data/index.ts` out of `allowed_paths` for the same reason |
| A `.env` convention, a README instruction, or a developer habit | **Refused.** The defect being fixed *is* an unwritten convention. A control that depends on every future contributor's environment is the thing that failed |

**The denial that matters, stated as a denial:** after this ticket there must be **no configuration of
a developer's machine** — no `.env`, no exported variable, no already-running server — under which
`pnpm exec playwright test` reaches a real datastore without failing first. AC-2, AC-4 and AC-6 are
that denial in three forms, and AC-6 is the one that would otherwise be missed.

**One thing is deliberately *not* claimed.** `--no-deps` bypasses the guard, and Playwright offers no
way to forbid it. That is an escape hatch a person has to type, which is a different risk from an
environment that decides silently; it is named here rather than left for a reviewer to find.

**On the new attribute and disclosure.** §4.2 makes the application root carry the resolved seam name
in both configurations. It discloses the string `mock` or `supabase` and nothing else — no URL and no
key. The same value is already rendered today on `seam-banner`'s `data-seam` in the mock case, and
`.ai/standards/rbac-and-security.md` §Secrets records that the project URL and anon key ship in the
bundle by design regardless.

## 4. Contract

Three edits, and the file that each belongs to is fixed in §7 with its owning stage.

### 4.1 `playwright.config.ts` — the pin, the guard project, and the dependency

```ts
projects: [
  // BUG-001. The guard runs first and `chromium` declares it as a dependency, so a run that would
  // drive anything but the in-memory seam ABORTS rather than reports. `fullyParallel: true` is why
  // this cannot be an ordinary test: the sign-up specs would otherwise reach the datastore
  // concurrently with the guard failing, and by the time the report is read the writes have
  // happened. Its own `testMatch` overrides the top-level one so `chromium` does not also pick it up.
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
```

**`reuseExistingServer: !process.env.CI` is kept, deliberately.** `ticket.yaml` §7 leaves the choice
open and names the cost of `false`: every local run pays a full build, which is the reason the flag
exists. It is kept because the guard closes the hazard the flag was left open for — a stale unpinned
server now produces a **loud refusal** (AC-6) instead of a silent breach. **The residual, named rather
than left implicit:** a stale server built from an older commit *under the pin* is still reused, and
the guard passes because the seam is right. That is a staleness defect, it exists today, and it is not
this one.

### 4.2 `src/App.tsx` — the page states its seam in both configurations

One attribute on the element that already carries `data-testid="app-root"`. No logic, no new import,
no behaviour change — `seamName` is already imported and already consumed three lines below.

```tsx
<main data-testid="app-root" data-seam={seamName} className="...">
```

**Why the existing banner is not sufficient on its own, and this is the design's one real judgement
call.** `seam-banner` renders **only** in the mock case, so a guard written against it can assert
nothing but *absence*, and absence is indistinguishable from a server that did not start, a route that
404'd, or a JavaScript error. Its message today reads *"no seam-banner: the build did not resolve to
the mock"* — which is a guess about the cause, and the confusion that guess produced is what this
ticket is. An affirmative attribute lets the failure read *expected `mock`, received `supabase`*,
which is AC-4's second clause and the sentence a developer actually needs.

**It changes nothing TEA-01 asserts.** `seam-banner` keeps its `data-testid`, keeps its
`data-seam="mock"`, keeps its conditional rendering, and `tests/e2e/tea-01-signup.spec.ts:52-56`
passes unedited (AC-8).

### 4.3 `tests/e2e/seam.setup.ts` — the guard

The whole file. It asserts the **served page**, never `process.env`, never the config, and never
`import.meta.env` — a guard that reads the value the configuration intended agrees with itself and
proves nothing (`ticket.yaml` §7).

```ts
import { expect, test } from "@playwright/test";

// BUG-001. The seam guard. `chromium` declares this project in `dependencies`, so a failure here
// aborts the acceptance suite instead of merely reporting alongside it.
//
// It reads THE SERVED PAGE and nothing else. `reuseExistingServer` means the page may come from a
// build that never saw `webServer.env`, so a guard reading the environment, the config or
// `import.meta.env` would agree with itself and prove nothing.
const EXPECTED_SEAM = "mock";

test("the served page reports the in-memory seam", async ({ page }) => {
  await page.goto("/");
  const root = page.getByTestId("app-root");
  await expect(root, "the application root did not render: no seam could be read").toBeVisible();
  await expect(root).toHaveAttribute("data-seam", EXPECTED_SEAM);
});
```

**The assertion is the record (AC-1).** Playwright names the project and the test title on every run,
and on failure prints expected against received — so *"what did this test?"* is answered by the run's
own output. **A reporter annotation or a written seam field was considered and refused:** it is a
second mechanism that can silently stop running, and it would record on success what the assertion
already refuses on failure. A record nobody reads unless something is wrong is worth less than the
refusal.

### 4.4 `tests/e2e/tea-01-signup.spec.ts` — one comment, no assertion

Lines 14-18 carry a claim that became false: *"Section 6.2 resolves a build with no
`VITE_SUPABASE_URL` to the mock, which is what the end-to-end command named in
`.ai/standards/testing-standards.md` produces."* That command produces no such thing on a configured
machine — it is the sentence this whole ticket exists because of, and it was true when written.

The correction states what is now true — the command pins the seam in `playwright.config.ts` and the
`seam-guard` project refuses a run that resolved to anything else — and **no assertion, locator,
title or address in the file changes** (AC-8, and §1 *Out of scope*).

### 4.5 Names fixed here, under RULE-04

The Developer may not invent these; they appear in the config, in the tests and in §8.

| Name | What it is |
|---|---|
| `seam-guard` | The Playwright project holding the guard, and the name `chromium` lists in `dependencies` |
| `tests/e2e/seam.setup.ts` | The guard's file |
| `tests/e2e/bug-001-seam-pin.spec.ts` | The acceptance spec, QA's |
| `tests/playwright-config.test.ts` | The vitest test asserting the configuration itself, QA's (AC-5) |
| `data-seam` | The attribute on `app-root`, values `mock` and `supabase` — already the attribute name on `seam-banner` |
| `VITE_DATA_SEAM` | Read at `src/lib/data/index.ts:164`. Not introduced here |

## 5. Seam impact

**None.** No function is added to, removed from or changed in `src/lib/data/`, and
`tests/seam-parity.test.ts` passes **unedited** — which is why it is absent from §7.

`src/lib/data/index.ts` is deliberately not in `allowed_paths`. Its fallback at `:164` and the comment
at `:166-171` are the application's chosen behaviour and are explicitly out of scope: a deployment
that forgets one variable must keep failing loudly rather than accepting sign-ups into memory. This
ticket changes what the **test runner** tells that line, never the line.

## 6. Schema delta

**`none`**, and this is one of the genuinely `none` cases under ADR-014 rather than a claim that
needs checking. There is no migration, no policy, no trigger, no constraint, no grant, no column and
no enum. `requires_adr: false` stands as the shell has it.

## 7. allowed_paths

Written back into `ticket.yaml`. Six globs, six files.

```yaml
allowed_paths:
  - "playwright.config.ts"
  - "src/App.tsx"
  - "tests/e2e/seam.setup.ts"
  - "tests/e2e/tea-01-signup.spec.ts"
  - "tests/e2e/bug-001-seam-pin.spec.ts"
  - "tests/playwright-config.test.ts"
```

**No inline comments on the items** — `readYamlList` strips only a leading and a trailing quote, so a
trailing `# …` is swallowed into the pattern and the glob matches nothing.

**RULE-03 is unenforced on this branch and this list is a promise, not a fence** — *Open questions*
item 2. Treat it as binding anyway, and R1 must be performed by hand.

### Who writes which file — the ownership straddle `ticket.yaml` §9 requires resolving

`.ai/01-operating-model.md:85` gives `qa` **the test tree**, and this fix lives in it and outside it.
Left unresolved, `developer` and `qa` each assume the other has it. The rule applied is: **a file the
command cannot run without is the fix; a file that judges the fix is a test.**

| File | Stage | Why |
|---|---|---|
| `playwright.config.ts` | IN_PROGRESS, `developer` | Not in the test tree |
| `src/App.tsx` | IN_PROGRESS, `developer` | Application source |
| `tests/e2e/seam.setup.ts` | IN_PROGRESS, `developer` | **The exception, and it is argued rather than assumed.** It is under `tests/` only because Playwright requires a project's file inside `testDir`. It is the mechanism of the fix: once the config names it in `dependencies`, `pnpm exec playwright test` cannot run at all without it, so a REVIEW that received the config without it would have nothing to review |
| `tests/e2e/tea-01-signup.spec.ts` | IN_PROGRESS, `developer` | Comment only (§4.4). **The Developer changes no assertion in it**, and R1 should read this row as the licence's whole extent |
| `tests/e2e/bug-001-seam-pin.spec.ts` | QA | The acceptance spec |
| `tests/playwright-config.test.ts` | QA | AC-5's named test |

**Deliberately absent:** `.github/workflows/verify.yml` (AC-9 requires it unchanged — §9 rejected
alternative 1), `src/lib/data/index.ts` and `tests/seam-parity.test.ts` (§5),
`tests/e2e/smoke.spec.ts` (it asserts `app-root` is visible; adding an attribute does not change
that), `.ai/standards/**` and `.ai/registry/**` (human plane, RULE-01 — *Open questions* items 1
and 3), and `scripts/check-allowed-paths.mjs` and `.claude/hooks/guard-allowed-paths.mjs` (§1 *Out of
scope*).

### `size` = S, and it agrees with `size_estimate`

**Six files is `S` (up to 6)**, and §1's estimate is also `S`. **They agree; ADR-012 is not
engaged.** It sits exactly on the S/M boundary, and the file that put it there is
`tests/playwright-config.test.ts` — added while writing §4.1, when AC-5 turned out to need a named
test that the acceptance spec cannot carry (see the Changelog).

**The `XL` row was checked and is not engaged**, which needs saying because `src/App.tsx` is
application source: the operating model's test is *whether existing callers must change*. No schema,
no seam signature, no shared type module — `src/lib/domain/types.ts` is untouched, and an added HTML
attribute has no callers.

## 8. Testability contract

`data-testid`, named once in `.ai/standards/testing-standards.md`. RULE-05 makes this table the only
channel through which these reach QA — and on this ticket that is not a formality, because **the
assertion *is* a selector and an attribute value** (`ticket.yaml` §9).

| selector | Element | Used by |
|---|---|---|
| `app-root` | The application root. **Carries `data-seam`, whose value is the resolved seam name: `mock` or `supabase`.** Present in both configurations — this is the affirmative signal AC-4's message depends on | AC-1, AC-2, AC-3, AC-4, AC-6, AC-7 |
| `seam-banner` | The mock-datastore banner. **Rendered only when the resolved seam is `mock`**, and carries `data-seam="mock"`. Unchanged by this ticket; its absence in the Supabase case is the existing behaviour AC-7 asserts | AC-7, AC-8 |
| `signup-form` | The sign-up form, addressed by TEA-01's suite. Named here only so AC-8's *"all ten tests pass"* is checkable against a table QA can see | AC-8 |

### How to reach the failing states, without a credential

**This is part of the contract, not advice.** AC-4, AC-6 and AC-7's second half all require a build
that resolved to Supabase, and QA may not read the implementation to work out how to make one.

- **`VITE_SUPABASE_URL` is tested for presence, never for validity.** Any non-empty string produces a
  genuinely Supabase-resolved build. `https://example.invalid` is sufficient and reaches nothing.
- **An unpinned build served on the suite's base URL** is produced by building with that variable set
  and starting `vite preview --port 4173 --strictPort` before invoking the suite. Because the shipped
  config reuses an existing server outside CI, the suite then serves that page — which is exactly the
  state AC-6 names.
- **AC-5 is asserted against the configuration itself**, not against a run: that the server the suite
  starts is pinned to the in-memory seam, that a project named `seam-guard` exists, and that the
  project carrying the acceptance tests lists it in `dependencies`. All three are readable from
  `playwright.config.ts`'s default export.

  TODO(verify): that `playwright.config.ts` imports cleanly inside the unit runner — it pulls
  `@playwright/test`, which is a test runner rather than a library, and this was not executed while
  writing this plan. If it does not, the named fallback is to assert against the file's text; prefer
  the import, because a text assertion passes on a commented-out line.

**AC-9 is observed from two runs of one command and no edit**: the CI job's own output on the pull
request, and a local run on a machine carrying `VITE_SUPABASE_URL`. The criterion's second clause —
that `.github/workflows/verify.yml` is unchanged — is read from the diff.

## 9. Rejected alternatives

**1. Put the pin in `.github/workflows/verify.yml`'s `env:` block, or in a `package.json` script.**

Genuinely plausible and the ordinary place for this: CI configuration belongs in the CI file, and a
`"e2e": "VITE_DATA_SEAM=mock playwright test"` script is one line and readable.

Rejected because **it fixes the wrong half.** The QA gate is run locally by `qa` and CI is run by the
runner, and both invoke the same binary with the same config — a workflow `env:` block leaves every
local run unpinned, which is where the live-project writes happen and where the gate is actually
evaluated. The `package.json` variant fails differently and worse: it makes `pnpm run e2e` and
`pnpm exec playwright test` mean different things, while `.ai/standards/testing-standards.md:19` names
the second as *the* end-to-end command and every gate in the model refers to it by role. A pin in the
config is the only version that cannot be bypassed by invoking the documented command.

**2. Assert the pin by reading `process.env.VITE_DATA_SEAM`, or the config object, in a setup step.**

Plausible, simpler, and no browser needed. Rejected because it **agrees with itself and proves
nothing**: `reuseExistingServer` is true outside CI, so the page under test may come from a build that
never saw the variable. The check would pass while the suite drove the live project — the precise
shape of the defect being fixed, reproduced inside its own guard. It is the reason §4.3 reads the
served page and the reason `app-root` gained an attribute in §4.2.

**3. Delete or skip the guard at `tests/e2e/tea-01-signup.spec.ts:52`.**

Recorded because it is the alternative somebody will actually reach for, not a strawman: it is one
line, it makes the suite green in **both** configurations, and it removes six failures and the QA
gate's obstacle in a single edit. The pressure is real — six failing assertions between a ticket and
DONE.

Rejected because it deletes the only thing in the repository that has ever reported which datastore an
acceptance run touched. Its own comment says what is lost: *"the report that cites this suite stops
being true quietly."* The failure it produces today is the harness working correctly — refusing to
claim it proved something it did not prove. **The defect is that there was no way to give it the
answer it was asking for**, and this ticket gives it one instead of removing the question.

## Changelog

- `2026-09-02T12:56:02+00:00` — sections 1 through 9 written. Sections 1 and 2 were written from
  `features.md`, the idea file, `ticket.yaml`, ADR-021 and MD-021 before the source tree was re-read.
- `2026-09-02T12:56:02+00:00` — **AC-5 rewritten, and it is the one amendment worth the record.** As
  first drafted it read *"when the guard fails, no test in the acceptance project runs at all"* — a
  Playwright dependency guarantee. Raised and amended by `tech-lead-design` on reaching §8: that
  property **cannot be asserted from inside a run it aborts**, so as written it was an AC with no
  observable form, which RULE-16 and Definition of Done item 4 both forbid. It was re-aimed at the
  configuration that the guarantee rests on — the pin, the project, and the dependency — which is
  named, fast, and is exactly the assertion that catches the regression this ticket exists to prevent.
  The runner's own abort semantics stay verified where triage verified them (`ticket.yaml` §6, *"1
  failed … 1 did not run"*) and are cited rather than re-claimed. This added
  `tests/playwright-config.test.ts` and moved `size` from five files to six.
- `2026-09-02T12:56:02+00:00` — §4.2 added `data-seam` to `app-root`, widening the ticket into
  `src/App.tsx`. Raised and amended by `tech-lead-design`. `ticket.yaml` §7 requires the guard to
  assert the served page; the only existing signal is an element that renders in one configuration
  only, so the guard could assert nothing but absence and its message would have been the same guess
  that produced this ticket. Recorded rather than absorbed, because widening a harness fix into
  application source is exactly the kind of scope growth *Out of scope* exists to catch — it is one
  attribute, it changes no behaviour, and AC-8 and AC-10 are what hold it to that.
