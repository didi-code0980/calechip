---
ticket: MIR-16
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-07T08:38:00Z
inputs_read: [ .ai/board/tickets/MIR-16/01-plan.md, .ai/board/tickets/MIR-16/03-impl-log.md, .ai/board/tickets/MIR-16/ticket.yaml ]
consulted: []
chat_before_verdict: none
gate: FAIL
blocking_reason: "R5. (1) Impossible as specified: dropping issue_report_select_admin (migration :34) breaks supabase/tests/060-removed-and-pending.test.sql:72-74, which asserts admin_t still reads rows from public.issue_report. 01-plan.md § 4.3 does not list 060 and § 7 keeps it out of allowed_paths, so the Developer cannot fix it (RULE-03). (2) Developer-caused: 270-issue-reports-system-scope.test.sql:129-133 expects list_issue_reports() to return exactly R-D, R-P, but tests.seed() inserts a third report (_isolation.psql:158-159) with created_at default now() (20260926100000_solo_issue_report.sql:56), which sorts first. Routed to tech-lead-design under ADR-067 (see Delegated decisions); finding 2 rides along to the next /implement."
next_state: REWORK
verdict: FAIL
failed_checks: [R5]
invariant_violation: false
route_to: tech-lead-design
increments_rework: false
---

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed and uncommitted paths within `allowed_paths` | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: PASS` (16 changed files; the non-exempt ones match `ticket.yaml:16-28`). `node scripts/check-carry.mjs MIR-16` → `0 uncommitted path(s)`, `PASS — nothing stray` |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` (`tsc --noEmit`) exit 0, no output |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm lint` (`eslint .`) exit 0, no output, covering `src/lib/data/system.ts`, `src/system/main.tsx` and `tests/e2e/mir-16-issue-reports.spec.ts` |
| R4 | Nothing outside the data-access seam reaches the datastore | PASS | `src/system/main.tsx:734`, `:745` and `:763` call only `systemSeam.*`. The Supabase client is used only in `src/lib/data/system.ts:410`, `:425` and `:435`. `eslint.config.js:20`, `:64-71` enforces the rule on `src/lib/data`, and lint passes |
| R5 | Every § 4 contract item implemented | **FAIL** | `supabase/tests/060-removed-and-pending.test.sql:72-74` against migration `:34`. `supabase/tests/270-issue-reports-system-scope.test.sql:129-133` against `supabase/tests/_isolation.psql:158-159`. See Findings |
| R6 | Permission gating matches § 3 | PASS | Both RPCs refuse unless `is_system_admin()` is true: migration `:70-72` and `:88-90`. `is_system_admin()` requires the row and `aal2`: `20261104150000_mir18_system_admin.sql:52-53`. The image read is gated by `is_system_admin()` at migration `:44-46`, and the three member-era policies are dropped at `:34-36`. The `anon` revokes are at `:103` and `:105`. The panel's mock gate is at `src/lib/data/system.ts:875` and `:884` |
| R7 | No invariant violated | PASS | `ticket.yaml:15` `invariants_touched: []`, and there are no IDs to reason through. The migration `:28-108` touches only `issue_report` policies, one storage policy and two new functions. No table, column or constraint changes |
| R8 | No dependency added without an ADR | PASS | `package.json` is not in `git diff --name-only origin/main...HEAD`. The new `date-fns` import (`src/system/main.tsx:10`) is an existing dependency (`package.json:27`) |

Also run: `pnpm test` exited 0 (51 files, 1027 tests). `pnpm db:test` and Playwright were not run here, and the impl log did not run them either (`03-impl-log.md:92-93`). The two R5 defects are the kind those runs would have caught.

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 drop the three policies | `supabase/migrations/20261107210000_mir16_issue_reports_system_scope.sql:34-36` | yes |
| § 4.1 `issue_image_select_system` | migration `:43-46` | yes |
| § 4.1 `list_issue_reports()`: definer, `search_path=''`, 42501 guard, left join on member, join on org, order, limit 500 | migration `:54-82` | yes |
| § 4.1 `set_issue_report_status(uuid, issue_status)`: guard, update, P0002 | migration `:84-96` | yes |
| § 4.1 grants | migration `:103-106` | yes |
| § 4.2 pgTAP 270: fixture, AC-1 to AC-6, policy census, `plan(31)` | `supabase/tests/270-issue-reports-system-scope.test.sql:22`, `:53-76`, `:87-250` (31 assertions counted) | **no**. AC-4 at `:129-133` asserts exactly two rows, but the seed's own report (`_isolation.psql:158-159`) is a third and the newest. The assertion fails |
| § 4.3 160 changes | `supabase/tests/160-read-path-org-bound.test.sql:242-243`, `:249-253` | yes |
| § 4.3 010 definer census | `supabase/tests/010-catalogue.test.sql:72-74` | yes. 010 names none of the three dropped policies, so it needs no policy-census edit |
| § 4.3 the rest of the suite stays green | not achievable: `supabase/tests/060-removed-and-pending.test.sql:72-74` asserts `isnt_empty` on `public.issue_report` for `admin_t`. § 4.3 does not list it | **no**. Impossible within `allowed_paths` |
| § 4.4 `SystemSeam` gains three methods | `src/lib/data/system.ts:60`, `:62`, `:65` | yes |
| § 4.4 types and messages | `src/lib/data/system.ts:167`, `:181`, `:186`, `:190` | yes |
| § 4.4 Supabase implementation, limit refusal, literals | `src/lib/data/system.ts:408-442` (`:415` limit, `:435` `"issue-report"`, `60 * 60`) | yes |
| § 4.4 mock store, `mockMaySeeOrgs` gate, `issue_not_found`, null URLs, `__setMockIssueReports` | `src/lib/data/system.ts:704-727`, `:874-893` | yes |
| § 4.5 `IssueReports` after *National holidays* | `src/system/main.tsx:722`, `:974-976` | yes |
| § 4.5 test ids and copy | `src/system/main.tsx:651-708`, `:777-817`. *Removed member* is at `:664` | yes |
| § 4.6 e2e, one test per AC-7 to AC-11 | `tests/e2e/mir-16-issue-reports.spec.ts:134`, `:170`, `:178`, `:196`, `:212` | yes. The seeding deviation (`page.evaluate` instead of an init script) is recorded at `03-impl-log.md:62-73` and goes through the one hook the contract names |

## R7 detail

| Invariant | Held by | Citation |
|---|---|---|
| *(none: `invariants_touched: []`)* | n/a | `.ai/board/tickets/MIR-16/ticket.yaml:15`; `01-plan.md:149-150` |

## Findings

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|
| 1 | R5 (impossible as specified) | The migration drops `issue_report_select_admin` (`20261107210000_mir16_issue_reports_system_scope.sql:34`). `supabase/tests/060-removed-and-pending.test.sql:72-74` is an AC-13 control that asserts `admin_t` reads rows from `public.issue_report`. After this migration that assertion fails. `01-plan.md` § 4.3 lists the changed pgTAP files (160, 010, and 150 as unchanged) but misses 060, and § 7 leaves 060 out of `allowed_paths`. The Developer may not edit it (RULE-03). The plan must add `060-removed-and-pending.test.sql` to § 4.3 and § 7, with the intended change: `issue_report` comes out of the `admin_t` control array at `:74`, which may change `plan(n)`. | `tech-lead-design` | No |
| 2 | R5 (implementable) | `supabase/tests/270-issue-reports-system-scope.test.sql:129-133` uses `results_eq` to expect exactly `(R-D), (R-P)` from `list_issue_reports()`. `tests.seed()` (`:23`) already inserts a report by `member_t` (`_isolation.psql:158-159`) with `created_at` defaulting to `now()` (`20260926100000_solo_issue_report.sql:56`). That is later than both fixture timestamps (`270:71-72`), so the function returns three rows and the seed row comes first. The assertion fails under `pnpm db:test`. Fix it in the test: restrict to the two fixture ids, or count the seed row, while keeping the newest-first proof. | `developer`, on the pass after re-plan | Yes on its own. Not charged here: see Delegated decisions |

## Verdict

`FAIL` on R5, routed to `tech-lead-design`.

## Delegated decisions

- **Only one `route_to` is possible, but the two R5 findings route to different owners.** Recommended answer, taken under ADR-067: route to `tech-lead-design` with `increments_rework: false`. Finding 1 has to be fixed upstream before any Developer pass can make the pgTAP suite green: 060 must enter `allowed_paths`. Finding 2 is cheap, and the Developer fixes it in the same `/implement` pass that follows the re-plan. Charging the Developer for a cycle that RULE-08 says it did not cause would be wrong. Waiving the increment for finding 2 is the cost of not running a second cycle, and it is recorded here so a later reviewer can see it.
