---
ticket: MIR-08
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-23T07:15:50Z
inputs_read: [ .ai/board/tickets/MIR-08/01-plan.md, .ai/board/tickets/MIR-08/03-impl-log.md, .ai/board/tickets/MIR-08/ticket.yaml, .ai/board/tickets/MIR-08/99-questions.md, .ai/templates/review-report.md ]
consulted: []
chat_before_verdict: none
gate: BLOCKED
blocking_reason: "R1, R2 and R3 could not be run. This review session's permission layer denied every non-git subprocess (`node scripts/check-allowed-paths.mjs`, `node scripts/check-carry.mjs MIR-08`, `pnpm typecheck`) with no approval surface, and lint was not attempted for the same reason. The reviewer must run R2 and R3 itself and may not take 03-impl-log.md's exit codes on trust; 03-impl-log.md:66 records that the Developer could not run check-allowed-paths.mjs either, so no stage has run R1's script. A person must grant this review session `node scripts/*.mjs` and `pnpm typecheck` / `pnpm lint` (or run them and commit the output), then re-run /review MIR-08 in a fresh session. R4–R8 were checked and show no defect; this is not a verdict on the code."
next_state: ESCALATED
verdict: BLOCKED
failed_checks: []
invariant_violation: false
route_to: human
increments_rework: false
---

# MIR-08 — review

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; carry has no stray path | **NOT RUN** | `node scripts/check-allowed-paths.mjs` and `node scripts/check-carry.mjs MIR-08` denied by the session's permission layer — no output to quote. By-hand reading only, not a substitute: `git diff --name-only origin/main...HEAD` lists the ticket folder, `.ai/board/backlog.md` (ship-owned), and five paths all present in `.ai/board/tickets/MIR-08/ticket.yaml:17-21`. `git status --porcelain` was empty. The Developer also did not run the script (`03-impl-log.md:66`). |
| R2 | typecheck exit 0 | **NOT RUN** | `pnpm typecheck` denied by the session's permission layer. The impl log's exit 0 (`03-impl-log.md:63`) is not accepted in its place. |
| R3 | lint exit 0 on changed lintable files | **NOT RUN** | Not runnable for the same reason. Relevant context: the earlier lint blocker was in `scripts/run-loop.mjs:46`, outside the diff (`99-questions.md`), and would be an ADR-041 chore, not a gate failure. |
| R4 | Nothing bypasses the data-access seam | PASS (provisional) | The only `src/` changes are comment lines: `src/lib/data/supabase.ts:2304-2305`, `src/routes/MonthView.tsx:293-294`. No import, call or identifier changes. |
| R5 | Plan §4 contract implemented | PASS (provisional) | See R5 detail |
| R6 | Permission gating matches plan §3 | PASS (provisional) | Plan §3 changes no capability. `git diff --name-only origin/main...HEAD` touches no path under `supabase/migrations/`, `supabase/tests/`, `supabase/seed.sql` or `supabase/config.toml` (AC-2). The only database-adjacent change is deleting `supabase/db.sql`, which no code or CI references: `git grep -n "db\.sql" -- src scripts .github package.json` returns nothing. |
| R7 | No invariant violated | PASS (provisional) | See R7 detail |
| R8 | No dependency added without an ADR | PASS (provisional) | `package.json` and `pnpm-lock.yaml` are absent from `git diff --name-only origin/main...HEAD`. |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| Delete `supabase/db.sql` | `supabase/db.sql` deleted in the branch diff (1091 lines removed); absent from the tree | n/a — deletion |
| Replace `(db.sql 9.1)` with ``(`supabase/migrations/20260904100000_cal04_team_select.sql`)`` in `supabase.ts` | `src/lib/data/supabase.ts:2304-2305` | Yes. The sentence is unchanged. The cited file exists, and `supabase/migrations/20260904100000_cal04_team_select.sql:34` (grant) and `:36` (`create policy team_select_own`) bear out the claim. |
| The same replacement in `MonthView.tsx` | `src/routes/MonthView.tsx:293-294` | Yes; the sentence is otherwise unchanged |
| AC-6: ADR status lines (written at PLAN, not by the Developer) | `.ai/registry/decisions/ADR-026-db-sql-carries-the-target-schema.md:11` (`SUPERSEDED by ADR-068`, original kept at :13); `.ai/registry/decisions/ADR-068-…md:11` (`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`) | Yes |

## R7 detail

`invariants_touched: []` (`.ai/board/tickets/MIR-08/ticket.yaml:15`). No ID to reason through. I checked independently that the empty list is correct: the diff changes no row, policy, function, grant or migration (R6 citation). The only `src/` deltas are comments (`src/lib/data/supabase.ts:2304-2305`, `src/routes/MonthView.tsx:293-294`). The deleted `supabase/db.sql` was not executed by any build, test or CI step (empty `git grep` across `src scripts .github package.json`).

| Invariant | Held by | Citation |
|---|---|---|
| — (none touched) | n/a | `.ai/board/tickets/MIR-08/ticket.yaml:15` |

## Findings

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|
| 1 | R1, R2, R3 | The review could not run its own verification commands. The session denies `node` and `pnpm` subprocesses, and nobody can approve them. No code defect was found. | human (cannot review at all → ESCALATED) | false |
| 2 | R1 (note) | No stage has ever run `check-allowed-paths.mjs` for MIR-08. `03-impl-log.md:66` records the same denial at IMPLEMENT. The sandbox permission gap therefore affects both stages, not just this one. | human — permissions in `.claude/settings*.json` / `.claude/PERMISSIONS.md` (steward) | false |

## Delegated decisions

None taken. ADR-067 lets the reviewer pick an answer it can recommend, but no recommendable answer exists here. The alternative to running R2/R3 is accepting the impl log's exit codes, which the reviewer role forbids. This needs a permission grant, and only a person can give one.

## Verdict

`BLOCKED`. Re-run `/review MIR-08` in a fresh session once `node scripts/check-allowed-paths.mjs`, `node scripts/check-carry.mjs` and `pnpm typecheck` / `pnpm lint` can run in the review session.
