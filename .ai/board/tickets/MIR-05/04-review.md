---
ticket: MIR-05
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-21T21:45:38+07:00
inputs_read:
  - .ai/board/tickets/MIR-05/01-plan.md
  - .ai/board/tickets/MIR-05/03-impl-log.md
  - .ai/board/tickets/MIR-05/99-questions.md
  - .ai/board/tickets/MIR-05/ticket.yaml
  - .ai/templates/review-report.md
  - .ai/01-operating-model.md
  - git diff origin/main...HEAD
  - supabase/migrations/20260905120100_adm02_holiday_seed.sql
consulted: []
chat_before_verdict: none
gate: BLOCKED
blocking_reason: "The precondition recorded in 99-questions.md (option A: MIR-05 stays BLOCKED until 20260905120100_adm02_holiday_seed.sql parses) is not met. At HEAD the file is still the ADM-02 original (lines 30-33: `values` followed only by comments, then `on conflict`), the operator's edit that 03-impl-log.md's passing run rested on exists in no commit, stash or working tree, so `pnpm db:test` cannot pass at HEAD and the new `database` job would make `verify` fail on every run after merge. R1-R8 all pass; a human must commit the holiday rows (or choose option B/C) before this ships."
next_state: ESCALATED
verdict: BLOCKED
failed_checks: []
invariant_violation: false
route_to: human
increments_rework: false
---

# MIR-05 — review

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed subset of `allowed_paths`; nothing uncommitted stray | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: PASS` (13 changed files, all in `ticket.yaml:16-25` or exempt: `.ai/board/backlog.md`, ticket folder). `node scripts/check-carry.mjs MIR-05` → `0 uncommitted path(s)`, `PASS — nothing stray` |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` exit 0 |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm exec eslint scripts/db-test.mjs scripts/tests/db-test.test.mjs` exit 0; repo-wide `eslint .` exit 0 |
| R4 | No datastore access outside the seam | PASS | `src/` untouched by the diff; `scripts/db-test.mjs:45-48` only spawns the Supabase CLI, imports nothing from `@supabase/*` (`scripts/db-test.mjs:9-11`) |
| R5 | Every plan § 4 contract item implemented | PASS | see R5 detail |
| R6 | Permission gating matches plan § 3 | PASS | hosted-target refusal `scripts/db-test.mjs:13,16-23,39-42`; `--local` on reset/test `scripts/db-test.mjs:32-33`; no `environment:` on `database` `.github/workflows/verify.yml:83-99` (siblings carry it at :33, :64, :104); seed disabled `supabase/config.toml:66-70`, `supabase/seed.sql` not in diff |
| R7 | No invariant violated | PASS | `ticket.yaml:15` `invariants_touched: []`; diff touches no file under `supabase/migrations/` or `src/` |
| R8 | No dependency added without an ADR | PASS | `package.json:14` adds a script only; `supabase` CLI `^2.116.0` already on `origin/main` (`git show origin/main:package.json` line 45) |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| 4.1 `db:test` script | `package.json:14` | yes |
| 4.2 `REFUSED_FLAGS` | `scripts/db-test.mjs:13` | yes |
| 4.2 `refusedFlag(argv)` | `scripts/db-test.mjs:16-23` | yes — exact or `<flag>=` |
| 4.2 `steps()` | `scripts/db-test.mjs:26-35` | yes — array identical to plan |
| 4.2 `main` refusal, exit 2, nothing spawned | `scripts/db-test.mjs:38-42` | yes — message verbatim |
| 4.2 `main` stop at first failing step | `scripts/db-test.mjs:44-53` | yes |
| 4.2 `spawnSync` with `stdio: inherit`, `shell: win32` | `scripts/db-test.mjs:45-48` | yes |
| 4.3 harness test | `supabase/tests/000-harness.test.sql:2-15` | yes — verbatim plus header comment |
| 4.4 `config.toml`, seed disabled with AC-6 comment | `supabase/config.toml:5,66-70` | yes |
| 4.4 `supabase/.gitignore` as generated | `supabase/.gitignore:1-8` | yes |
| 4.5 `database` job | `.github/workflows/verify.yml:81-99` | yes |
| 4.5 `verify` needs/env/check | `.github/workflows/verify.yml:117,128,131-132` | yes |
| 4.5 header job list | `.github/workflows/verify.yml:5` | yes |
| 4.6 script tests | `scripts/tests/db-test.test.mjs:10-45` | yes — `node --test` 6/6 pass |
| 4.7 branch-protection doc | `docs/ops/branch-protection.md:27,35` | yes |

## R7 detail

| Invariant | Held by | Citation |
|---|---|---|
| (none — `invariants_touched: []`) | No table, policy, trigger, constraint or seam function changes; diff is outside `supabase/migrations/` and `src/` | `ticket.yaml:15`; `git diff --stat origin/main...HEAD` |

## Findings

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|
| 1 | — (precondition, not an R-check) | `supabase/migrations/20260905120100_adm02_holiday_seed.sql:30-33` at HEAD is still unparseable. `03-impl-log.md`'s passing third run depended on an operator edit that is absent from every commit (`git log --all` shows only `6003584`), every stash and the working tree. The operator's decision in `99-questions.md` makes MIR-05 BLOCKED until that file parses. Merged as is, `verify.yml:97-99` fails at `start`, and `verify.yml:132` turns the required check red on every run. | human | false |

## Verdict

`BLOCKED`. The implementation passes R1–R8 as built. It cannot advance to DONE until a human
commits the holiday rows (ADM-02 Open question 1) or chooses option B or C in `99-questions.md`.
After that, re-run `pnpm db:test` and `/review MIR-05` in a fresh session.
