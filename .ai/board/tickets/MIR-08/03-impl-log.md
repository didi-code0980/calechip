---
ticket: MIR-08
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-23T04:19:40Z
inputs_read:
  - .ai/board/tickets/MIR-08/01-plan.md
  - .ai/board/tickets/MIR-08/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/templates/impl-log.md
  - .ai/registry/decisions/ADR-068-db-sql-is-retired-and-the-migrations-are-the-only-schema-source.md
  - .ai/registry/decisions/ADR-026-db-sql-carries-the-target-schema.md
  - src/lib/data/supabase.ts
  - src/routes/MonthView.tsx
  - supabase/migrations/
consulted: []
chat_before_verdict: none
gate: BLOCKED
blocking_reason: "pnpm exec eslint . (the lint command named in testing-standards.md, and part of
  this stage's literal gate) exits 1 on scripts/run-loop.mjs:46:7, 'PROTECTED_BRANCHES' is assigned
  a value but never used. That file is not in allowed_paths and not named in plan §4; git diff
  --name-only confirms it carries no edit from this ticket, and git log -1 -- scripts/run-loop.mjs
  resolves to a73808d, committed before this ticket's branch existed. I cannot fix it without
  violating RULE-03, and widening allowed_paths is tech-lead-design's call on plan §7, not mine to
  make by reading AC-4's wording my own way. Asked in 99-questions.md; no live tech-lead-design
  session exists in this run to answer it (.ai/templates/questions.md:9: 'there is no live message
  API'), so the question stands unanswered rather than self-resolved. Implementation itself
  (deleting supabase/db.sql, both comment edits) is complete, typechecks clean, and all 987 unit
  tests pass; only this one unrelated command is red."
next_state: IN_PROGRESS
---

# MIR-08 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/db.sql` | deleted | Retire the file per ADR-068/option A — it is a second, drifted source of the schema; `supabase/migrations/` remains the only source. | §4 item 1 |
| `src/lib/data/supabase.ts` | modified | Replaced the stale `(db.sql 9.1)` citation at line ~2304 with the migration file that actually grants/policies `public.team`, so the comment's claim stays checkable after `db.sql` is gone. | §4 item 2 |
| `src/routes/MonthView.tsx` | modified | Same replacement, at line ~293, in the comment explaining the `unavailable` phase before that migration is applied. | §4 item 2 |
| `.ai/board/tickets/MIR-08/99-questions.md` | created | Raised the lint-gate blocker (below) to `tech-lead-design`, unanswered — recorded under RULE-12/RULE-15 provenance, not a contract item. | n/a — process record, not a contract item |

No other file was touched. `.ai/registry/decisions/ADR-068-...md` and `ADR-026-...md` are in
`allowed_paths` but were already complete at PLAN (01-plan.md §7: "the Developer does not touch
them") — confirmed unchanged by reading both before starting and not editing either.

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 1. delete `supabase/db.sql` | file removed from the tree (`git status --porcelain` shows `D supabase/db.sql`) | No replacement artifact added — no generator, no dump, no new check-docs.mjs guard (explicitly out of scope, §1). |
| 2. replace `(db.sql 9.1)` with the migration path in both comments | `src/lib/data/supabase.ts:2303-2304`, `src/routes/MonthView.tsx:292-294` | Both now cite `` `supabase/migrations/20260904100000_cal04_team_select.sql` `` and the sentence each comment makes ("before that migration is applied, `public.team` has no grant and no policy") is otherwise unchanged, per AC-3's wording. |

## Deviations from the design

`none`.

## Invariants

`invariants_touched: []` in `ticket.yaml`. No row, policy, function or grant was created, altered or
dropped — the only change to the database-adjacent surface is deleting a documentation file that was
never a migration (ADR-026 decision 6) and was not read by any code or CI step. Confirmed by: the
`database` CI job builds the schema from `supabase/migrations/` only (it never referenced
`db.sql`), and `git grep`-equivalent search found no reference to `db.sql` anywhere under `src/`
except the two comments edited here.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| typecheck (`pnpm exec tsc --noEmit`) | 0 | clean |
| lint (`pnpm exec eslint .`) | 1 | **Blocking.** `scripts/run-loop.mjs:46:7 'PROTECTED_BRANCHES' is assigned a value but never used`. `git diff --name-only` confirms `scripts/run-loop.mjs` is not part of this ticket's diff; `git log -1 -- scripts/run-loop.mjs` resolves to `a73808d` ("chore: ADR-067 — the runner pushes, merges..."), committed before MIR-08's branch existed. The file is not in `allowed_paths` (RULE-03) and is not named in plan §4, so I cannot fix it myself. Raised to `tech-lead-design` in `99-questions.md`, unanswered (see `blocking_reason`). Both files this ticket touched (`src/lib/data/supabase.ts`, `src/routes/MonthView.tsx`) lint clean on their own; `supabase/db.sql` was deleted, not linted. |
| unit tests (`pnpm exec vitest run`) | 0 | 49 files, 987 tests, all pass |
| `git diff --name-only` subset of `allowed_paths` | yes | Diff is exactly `src/lib/data/supabase.ts`, `src/routes/MonthView.tsx`, `supabase/db.sql` (deleted) — all three are in `allowed_paths` (01-plan.md §7 / `ticket.yaml`). `node scripts/check-allowed-paths.mjs` itself could not be run in this sandboxed session (tool denied the subprocess); verified manually against the `allowed_paths` list instead. |

AC-5 (the CI `database` job / `pnpm db:test`) is a CI-only check per the AC's own text ("Given CI on
the pull request") and was not run locally; nothing in this change touches `supabase/migrations/`,
so there is nothing new for it to exercise. AC-6 (ADR status lines) was verified by reading both
ADR files, not by editing them — both already read as the AC requires.

## Testability contract

Not applicable — this ticket has no user interface and plan §2b records no layout. No selector is
added, renamed or removed.

## Open questions

One, open: `99-questions.md` asks `tech-lead-design` whether this ticket's gate may pass with
`pnpm exec eslint .` red on a pre-existing, unrelated, out-of-allowed_paths failure
(`scripts/run-loop.mjs:46`), or whether `allowed_paths` should be widened for a one-line fix. I
recommend option A (report, do not widen) but have not taken it — `allowed_paths` is plan §7's,
not mine to reinterpret by reading AC-4 my own way, and no live `tech-lead-design` session exists
in this run to answer it. See `blocking_reason` above.

## Delegated decisions

None. The lint-gate question above was raised but not self-resolved — it is recorded as a blocker,
not a delegated decision, because it reaches into `allowed_paths` (plan §7), which is
`tech-lead-design`'s to amend, not the Developer's.
