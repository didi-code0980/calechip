---
ticket: MIR-08
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-23T03:18:50Z
inputs_read:
  - .ai/board/tickets/MIR-08/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/decisions/ADR-025-db-sql-is-generated-and-never-a-second-source.md
  - .ai/registry/decisions/ADR-026-db-sql-carries-the-target-schema.md
  - .ai/registry/decisions/ADR-064-a-person-cannot-change-their-own-role-status-or-team.md
  - .ai/registry/decisions/ADR-065-role-changes-are-own-team-promotion-is-its-own-action-and-every-change-is-recorded.md
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/board/plans/multi-tenancy-status.md
  - .ai/board/audits/multi-tenancy-audit-2026-10-12.md
  - .ai/board/model-debt.md
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
  - scripts/db-test.mjs
  - .github/workflows/verify.yml
  - supabase/db.sql
  - supabase/migrations/
consulted: []
chat_before_verdict: none
gate: BLOCKED
blocking_reason: >-
  Both outcomes plan item P2-1 allows supersede ADR-026, which is ACCEPTED by the operator.
  ADR-026 decision 1 says supabase/db.sql carries the hand-transcribed target schema; "replace it
  with the generated dump" reverses decision 1, and "delete it" retires the ADR outright. An agent
  may not write an ADR that supersedes an accepted decision (ADR-008), so the operator owes two
  things: (1) the choice — A, retire db.sql and name supabase/migrations/ as the only schema source
  (recommended: it is the remedy both ADR-025 and ADR-026 name in their own revert condition 2,
  and that condition has fired — audit A:307-337, MD-033); or B, replace db.sql with a
  `supabase db dump --local` of the stack MIR-05 already builds, plus a CI job that regenerates it
  and fails on a diff; and (2) the superseding ADR recording that choice, ACCEPTED by the operator.
  Once both exist, re-run /plan MIR-08 in the Tech Lead session: it writes allowed_paths from the
  chosen option's list in section 7 and passes.
next_state: PLAN
---

# MIR-08 — plan

## 1. Problem and scope

**Feature, transcribed from `.ai/registry/features.md`:**

| ID | Feature | Group | Status |
|---|---|---|---|
| MIR-08 | `supabase/db.sql` is regenerated from the applied migrations or retired, and CI fails on drift | MIR | PLANNED |

Source plan item P2-1 (`.ai/board/plans/calechip-multi-tenancy-plan.md:142-145`): generate the real
schema from the applied migrations; replace `supabase/db.sql` with the generated dump, or delete it
and document migrations as the only source; if kept, add a CI check that regenerates it and fails on
drift.

**Who gains what.** Whoever designs against the schema — a human, or a Tech Lead agent at PLAN for
any phase 3 MIR ticket — gets one schema answer they can trust. Today `supabase/db.sql:1` calls
itself "the whole schema" and the audit (A:307-337) found it wrong in twelve places, including
`is_admin` and `member_team_id` bodies that predate `status = 'approved'`. Phase 3 rewrites every
policy (`multi-tenancy-plan.md:140`), so a stale reference here is the most likely way a policy gets
designed against a predicate that no longer runs.

**Out of scope.**
- The four P2-2 clean-ups (`issue.sql` transaction wrapping, `allowed_email` references, the
  `member.team_id` index, the `overload_threshold` check) — MIR-09.
- Any change to a migration, a table, a policy, a function or a grant. `db.sql` is not a migration
  (ADR-026 decision 6); nothing here changes what the database is.
- `.ai/standards/data-model.md` § Migrations and the `A6` row of `.ai/standards/rbac-and-security.md`
  — standards plane, human-only (RULE-01). Owed by the superseding ADR's *Changed by* table.
- `.ai/board/model-debt.md` MD-033 — closed by whoever records the outcome, not by this ticket.
- Dumping the hosted project — refused by ADR-024 §3 and ADR-025's fourth option; any generation is
  against the local stack only (`scripts/db-test.mjs` `REFUSED_FLAGS`).

**`size_estimate`: S** (option A; M under option B — see section 7).

## 2. Acceptance criteria

The operator's choice decides which set applies. Both are written out so the decision can be made
against what each one ships. **AC-0 applies to both.**

**AC-0**
- Given the repository after this ticket
- When a reader searches every non-board, non-registry file for the string `db.sql`
- Then no file asserts a fact about `public.team` policies by citing `db.sql` (today:
  `src/lib/data/supabase.ts:2304`, `src/routes/MonthView.tsx:293`, both citing "db.sql 9.1", which
  the audit, discrepancy 8, found stale since cal04 and adm01)

### Option A — retire

**AC-A1**
- Given `main` after this ticket merges
- When the tree is listed
- Then `supabase/db.sql` does not exist, and `supabase/migrations/` is unchanged byte-for-byte

**AC-A2**
- Given a fresh local stack
- When `pnpm db:test` runs
- Then it passes exactly as before, proving nothing depended on `db.sql` to build the schema

### Option B — regenerate

**AC-B1**
- Given a clean checkout and Docker available
- When `pnpm db:schema` runs
- Then the local stack is reset from every migration and `supabase/db.sql` is overwritten with the
  dump, preceded by a fixed header stating it is generated, never edited, and that
  `supabase/migrations/` is the source

**AC-B2**
- Given a checkout whose `supabase/db.sql` matches a regeneration
- When `pnpm db:schema --check` runs
- Then it exits 0 and writes nothing

**AC-B3 (refusal)**
- Given a pull request that adds a migration without regenerating `supabase/db.sql`, or edits
  `supabase/db.sql` by hand
- When CI's `database` job runs
- Then the job fails, and its log names `supabase/db.sql` and prints the diff

**AC-B4 (refusal)**
- Given any of `--linked`, `--db-url`, `--project-ref` on the command line
- When `pnpm db:schema` runs
- Then it exits 2 before spawning anything, as `db:test` does

**AC-B5**
- Given the regenerated file
- When it is compared against the audit's twelve discrepancies (A:307-337)
- Then none of the twelve remains — including the `auth.users` sync triggers (discrepancy 6), which
  live outside `public` and so must be in the dumped schema set

**Invariants touched:** `[]`. No row, policy, function or grant changes under either option; the
file being retired or regenerated is documentation of the schema, not the schema.

**Open questions.**
1. **A or B** — blocking; the operator's, because either supersedes ADR-026. See `blocking_reason`.
2. Under B only: which schemas the dump covers. `public` alone misses the `auth.users` triggers
   (AC-B5); `public` plus `auth` dumps Supabase-owned objects that change with the CLI version and
   would produce drift nobody caused. `TODO(verify)` against the CLI's own `db dump --help` —
   the Supabase CLI is on the *past reliable recall* list, and the help could not be read in this
   session (the command needed approval and this session has no approval surface).

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

(There is no layout: this ticket has no user interface.)

## 3. Permission model

No role gains or loses any capability; no RLS policy, grant or definer function is touched. The
only actor is the CI runner and a developer's machine, both against the **local** stack only —
the refusal of `--linked`, `--db-url` and `--project-ref` (AC-B4, mirroring `scripts/db-test.mjs`)
is the boundary that keeps the hosted project's credentials out (ADR-024 §3). Applying anything to
the hosted project stays human (RULE-09); neither option applies anything.

## 4. Contract

**Option A:** none. No entry point is added; one file is deleted and two comments are reworded.

**Option B** (provisional; field and flag names fixed here so the Developer does not invent them):

```js
// scripts/build-db-sql.mjs
export const REFUSED_FLAGS = ["--linked", "--db-url", "--project-ref"];
export const OUTPUT_PATH = "supabase/db.sql";
export const HEADER = "-- GENERATED by `pnpm db:schema` from supabase/migrations/. Never edit by hand.\n"
  + "-- supabase/migrations/ is the only source of the schema. CI fails on any difference.\n";
/** @returns {string|null} the first refused flag in argv, or null */
export function refusedFlag(argv) {}
/** @returns {{ name: string, args: string[] }[]} pure; the CLI invocations, in order */
export function steps(outFile) {}           // start, `db reset --local`, `db dump --local … -f <outFile>`
/** @returns {0|1|2} 0 written or unchanged, 1 drift under --check, 2 refused flag or CLI failure */
export function main(argv) {}
```

```json
// package.json "scripts"
"db:schema": "node scripts/build-db-sql.mjs"
```

```yaml
# .github/workflows/verify.yml, job `database`, after `pnpm db:test`
- name: db.sql matches the migrations
  run: pnpm db:schema --check
```

The exact `db dump` flags are `TODO(verify)` — open question 2.

## 5. Seam impact

None. `src/lib/data/` changes in comments only (AC-0); no function, name or arity changes.

## 6. Schema delta

`none`. Neither option creates, alters or drops a database object; ADR-026 decision 6 already holds
that `db.sql` is not a migration. `requires_adr: true` is for a different reason — the superseding
ADR on ADR-026 — and is not a schema ADR.

## 7. allowed_paths

**Written back as `[]`.** With the option undecided, enumerating either list would grant write scope
for a decision nobody has made. The two lists below are what a re-run writes, verbatim.

Option A — 3 paths, `size: S`:

```yaml
allowed_paths:
  - "supabase/db.sql"
  - "src/lib/data/supabase.ts"
  - "src/routes/MonthView.tsx"
```

Option B — 8 paths, `size: M`:

```yaml
allowed_paths:
  - "supabase/db.sql"
  - "scripts/build-db-sql.mjs"
  - "scripts/tests/build-db-sql.test.mjs"
  - "package.json"
  - ".github/workflows/verify.yml"
  - ".ai/templates/plan.md"          # every migration-bearing ticket lists supabase/db.sql
  - "src/lib/data/supabase.ts"
  - "src/routes/MonthView.tsx"
```

`size` is written as `S`, against the recommended option; it becomes `M` if the operator picks B.
`size_estimate` and `size` agree under A and disagree under B, because B adds a generator, its test,
a CI step and a template obligation that A does not need.

`glossary_owed` is `[]`; no glossary row is written.

## 8. Rejected alternatives

- **Hand-correct `db.sql` for the twelve discrepancies and keep ADR-026 as it is.** The cheapest
  edit and inside the current decision, which is why it is the obvious one. Rejected: it is exactly
  what ADR-026's own *Consequences* says cannot hold — group 1 "can drift out of step with the
  migrations and nothing will say so" — and it already did, twelve times (MD-033). It also fails the
  feature row as written, which requires the file to be regenerated or retired, and CI to catch drift.
- **Option B with a concatenation generator** (ADR-025's `build-db-sql.mjs`: migrations in filename
  order, untransformed). Needs no Docker and no CLI flags. Rejected: concatenation reproduces history,
  not the resulting schema — `is_admin` would appear in both its TEA-01 and its `member_approval`
  body, which is discrepancy 10 restated rather than fixed.
- **Under A, add a `check-docs.mjs` check that fails if `supabase/db.sql` reappears.** Considered,
  not planned: the feature row asks for a drift check only if the file is kept. If the operator wants
  the guard, it is one path and stays `S`.

## Changelog

- `2026-10-23T03:18:50Z` — plan written, `gate: BLOCKED` on the A/B choice and the superseding ADR
  for ADR-026. Raised by `tech-lead-design`.
