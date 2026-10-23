---
ticket: MIR-09
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-23T08:45:40Z
inputs_read:
  - .ai/board/tickets/MIR-09/01-plan.md
  - .ai/board/tickets/MIR-09/ticket.yaml
  - .ai/registry/decisions/ADR-069-member-team-id-is-indexed-and-the-overload-threshold-is-checked-in-the-database.md
  - .ai/templates/impl-log.md
  - .ai/standards/testing-standards.md
  - supabase/migrations/20260926100000_solo_issue_report.sql
  - supabase/migrations/20260905000000_adm01_team_threshold.sql
  - supabase/migrations/20261020180000_mir04_scoped_member_directory.sql
  - supabase/tests/_isolation.psql
  - supabase/tests/050-cross-team-writes.test.sql
  - supabase/tests/030-member-reads.test.sql
  - supabase/tests/010-catalogue.test.sql
  - supabase/bootstrap.sql
  - src/lib/domain/types.ts
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/lib/data/supabase.ts
  - src/lib/fixtures.ts
  - tests/threshold.test.ts
  - tests/draft-entry.test.ts
  - .ai/00-charter.md
  - .ai/registry/invariants.md
consulted:
  - with: tech-lead-design
    asked: "Implementing 01-plan.md § 4 in full makes pnpm test fail tests/draft-entry.test.ts's
      AC-14 charter-refusal-6 scanner: its regex flags any CHECK mentioning overload_threshold,
      including the new team_overload_threshold_range constraint, which validates the admin's own
      input and does not consult the column to refuse a write to a different table. That file is
      outside allowed_paths so I cannot fix it myself (RULE-03). Asked to either widen
      allowed_paths and narrow the scanner (my proposed narrowing given), or say what to do
      instead."
    answer: "(none yet — question written to 99-questions.md this session; no tech-lead-design
      session has answered as of produced_at above.)"
    resulted_in_amendment: false
chat_before_verdict: none
gate: BLOCKED
blocking_reason: "Every § 4 contract item is implemented and typecheck/lint/the rest of the unit
  suite are green, but pnpm test fails one pre-existing test, tests/draft-entry.test.ts's AC-14
  charter-refusal-6 scanner (lines 280-343), against the new migration's check constraint. Fixing
  the scanner requires editing that file, which is outside allowed_paths (RULE-03). Consulted
  tech-lead-design in .ai/board/tickets/MIR-09/99-questions.md; awaiting an answer before this
  stage can reach PASS."
next_state: IN_PROGRESS
---

# MIR-09 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261023120000_mir09_schema_cleanup.sql` | created | the index and the check constraint, wrapped in one transaction | §4 "Migration" |
| `supabase/migrations/20260926100000_solo_issue_report.sql` | modified | added `begin;`/`commit;` around its existing statements, nothing else changed | §4 "`20260926100000_solo_issue_report.sql`" |
| `supabase/tests/110-schema-cleanup.test.sql` | created | pgTAP coverage for AC-1, AC-2, AC-3 | §4 "`supabase/tests/110-schema-cleanup.test.sql`" |
| `supabase/bootstrap.sql` | modified | reworded the `allowed_email` sentence at :183-185 to past tense | §4 "`supabase/bootstrap.sql:183-185`" |
| `src/lib/domain/types.ts` | modified | removed `already_allow_listed`/`already_consumed` from `FailureCode`, added `invalid_threshold`; reworded a second comment (see Deviations) that also named the retired code literally | §4 "`src/lib/domain/types.ts`" |
| `src/lib/data/index.ts` | modified | added `isValidThreshold`/`INVALID_THRESHOLD_MESSAGE` beside `SetOverloadThresholdInput`; rewrote the stale "NO RANGE CHECK" doc comment on `setOverloadThreshold` | §4 "`src/lib/data/index.ts`" |
| `src/lib/data/mock.ts` | modified | imported the two new names; narrowed `refused()`'s code union; added the pre-send guard as the first statement of `setOverloadThreshold`; rewrote its own stale "NO RANGE CHECK" comment | §4 "`src/lib/data/mock.ts`" |
| `src/lib/data/supabase.ts` | modified | imported the two new names; added the pre-send guard and the `23514` mapping in `setOverloadThreshold`; deleted the `23505` arm of `toPostgrestFailure`; reworded the CAL-01 comment at the old :1334-1338 to say `member`/`team` instead of `allowed_email`; rewrote the stale "NO RANGE CHECK" comment above `setOverloadThreshold` | §4 "`src/lib/data/supabase.ts`" |
| `src/lib/fixtures.ts` | modified | deleted the two orphaned doc comments at the old lines 57 and 59 | §4 "`src/lib/fixtures.ts`" |
| `tests/threshold.test.ts` | modified | added `describe("MIR-09 range")`, AC-4 against the mock as admin and as a member | §4 "`tests/threshold.test.ts`" |
| `.ai/board/tickets/MIR-09/99-questions.md` | created | consulted tech-lead-design about the `tests/draft-entry.test.ts` conflict below | n/a — consultation, not a contract item |

`.ai/board/tickets/MIR-09/ticket.yaml`'s `chat_budget` line changed too, but that edit was made by
`chat-guard.mjs` on the `99-questions.md` write, not by this agent, and `ticket.yaml` is not in
`allowed_paths`.

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| Migration | `supabase/migrations/20261023120000_mir09_schema_cleanup.sql` | exact SQL from §4, wrapped `begin`/`commit` |
| `src/lib/domain/types.ts` | `FailureCode` union | `invalid_threshold` added with the cited comment; the two allow-list codes removed |
| `src/lib/data/mock.ts` | `setOverloadThreshold` | `isValidThreshold` guard is the function's first statement |
| `src/lib/data/index.ts` | beside `SetOverloadThresholdInput` | `isValidThreshold`, `INVALID_THRESHOLD_MESSAGE` |
| `src/lib/data/supabase.ts` | `setOverloadThreshold`, `toPostgrestFailure` | guard first, `23514` mapped before the generic fallback, `23505` arm deleted |
| `src/lib/fixtures.ts` | — | two orphaned comments deleted, `FIXTURE_UNLISTED_EMAIL` and its own comment kept |
| `supabase/bootstrap.sql:183-185` | — | past-tense, no SQL statement changed |
| `supabase/migrations/20260926100000_solo_issue_report.sql` | — | `begin;`/`commit;` only, confirmed by `git diff` showing no other byte changed |
| `supabase/tests/110-schema-cleanup.test.sql` | whole file | AC-1 `has_index`; AC-2 four `throws_ok` cases plus a `results_eq` confirming no write landed; AC-3 three `rows_affected`/`results_eq` pairs (0, 1, 0.5) |
| `tests/threshold.test.ts` | `describe("MIR-09 range")` | AC-4 as admin (four invalid values, one assertion each, plus the stored value unchanged) and as `FIXTURE_MEMBER` (value check precedes permission check) |

AC-5 (a `23514` from the real seam maps to `invalid_threshold`) and AC-6/AC-7/AC-9 that depend on a
provisioned database (`pnpm db:test`) are not executable in this environment — RULE-09 keeps applying
any migration human, and no project is provisioned here. They are implemented per the contract's exact
code (see `src/lib/data/supabase.ts`'s `error.code === "23514"` branch) but not run against Postgres.
`verification_required: false` in `ticket.yaml` for this ticket.

## Deviations from the design

One, beyond the contract's literal text, both forced by AC-8's literal grep (no match for
`already_allow_listed` or `already_consumed` anywhere in `src/`):

- `src/lib/domain/types.ts` carried a SECOND comment (on `holiday_date_taken`, unrelated to the removal
  site itself) that named `already_allow_listed` literally, to contrast the two codes' messages. Left
  alone it would still have matched AC-8's search. Reworded to make the same point without naming the
  retired code. Not consulted — the fix is mechanical (removing a dangling reference to a deleted
  symbol) and has one reasonable shape.

Otherwise none. `src/lib/data/supabase.ts`'s other `allowed_email` mention, in the comment above
`toHolidayFailure` (around the old line 1379, comparing that function's `23505` to a now-removed one),
was left as written: the contract named only the CAL-01 comment at :1334-1338 for rewording, and
`01-plan.md` § 1's "Today these are" list of allow-list references is closed at three items, none of
which is that comment. Flagging it rather than touching it, since touching an unnamed file location
beyond the contract risks the same defect RULE-04 warns against in the other direction.

## Invariants

`invariants_touched: []` in `ticket.yaml`. `01-plan.md` § 2 already argues `[]` for INV-04 and INV-07;
nothing built here reopens either argument — the index changes no read's answer, and the check
constraint narrows which *writes to the threshold itself* succeed, not what any absence count returns
for an unchanged value.

One further invariant-shaped question was found and is the subject of this stage's block: Charter
refusal 6 (not a registry `INV-xx`, per `.ai/registry/invariants.md` lines 198-199) is pinned by
`tests/draft-entry.test.ts`'s AC-14 scanner, which the new migration's check constraint trips as a
false positive — reasoning in `99-questions.md`. I did not treat this as an invariant violation under
RULE-07 (escalate to a human, stop) because refusal 6 is explicitly *not* a registry invariant and my
reading is that the new constraint does not actually breach it; I treated it as a design question
instead, which is the lower-cost path if I am right and the safer one if I am wrong, since no code here
ships until a `tech-lead-design` or human verdict exists.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `node scripts/check-allowed-paths.mjs` | — | not run this pass; `git diff --name-only` below is the same check by hand |
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 1 | 989 passed, 1 failed — `tests/draft-entry.test.ts`'s AC-14 scanner against the new migration, see `blocking_reason` |
| `git diff --name-only` subset of `allowed_paths` | yes | every modified/created file under version control is in `allowed_paths`; `99-questions.md` and this file are the ticket's own artifacts, not source |

## Testability contract

Plan section 2b: no selector, no layout change. `01-plan.md` § 5 names no new seam method and
`tests/seam-parity.test.ts` is unaffected by this work (confirmed green in the `vitest run` above).

## Open questions

See `.ai/board/tickets/MIR-09/99-questions.md`, asked this session and unanswered as of
`produced_at`: whether `tests/draft-entry.test.ts`'s charter-refusal-6 scanner may be narrowed (and
added to `allowed_paths`) to admit a `CHECK` constraint that validates the threshold column's own
value, as this ticket's migration adds, without weakening its coverage of a `using`/`with
check`/trigger clause that reads the column to gate a write elsewhere.
