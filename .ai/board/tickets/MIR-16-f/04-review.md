---
ticket: MIR-16-f
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-08T01:32:15Z
inputs_read: [ .ai/board/tickets/MIR-16-f/01-plan.md, .ai/board/tickets/MIR-16-f/03-impl-log.md, .ai/board/tickets/MIR-16-f/ticket.yaml, .ai/registry/invariants.md, .ai/templates/review-report.md ]
consulted: []
chat_before_verdict: none
gate: FAIL
blocking_reason: "R5: plan § 4.2's AC-6 assertion is not implemented as specified. supabase/tests/320-set-member-role-team-role.test.sql:161 only matches a quoted literal after `set role =`, so it cannot see `set role = p_role` — the exact shape of the pre-ticket body (20261107235000_mir16e_rename_admin_to_org_admin.sql:109). The assertion would pass against the function this ticket replaces. § 4.2 requires a regex that admits only org_admin as the assigned value. Implementable; routes to developer."
next_state: REWORK
verdict: FAIL
failed_checks: [R5]
invariant_violation: false
route_to: developer
increments_rework: true
---

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; uncommitted carried | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket MIR-16-f, 13 changed file(s)` … `allowed-paths: PASS` (exit 0). `node scripts/check-carry.mjs MIR-16-f` → `0 uncommitted path(s)` … `PASS — nothing stray` (exit 0). Every non-ticket, non-ship-owned path in `git diff --name-only origin/main...HEAD` is listed at `.ai/board/tickets/MIR-16-f/ticket.yaml:20-28`. |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit`, run by the reviewer: exit 0, no output. |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm exec eslint .`, run by the reviewer: exit 0, no output. The changed lintable files are `src/lib/data/supabase.ts` and `tests/org-admin-role-mapping.test.ts`. Also run: `pnpm exec vitest run` → 52 files and 1040 tests passed. |
| R4 | Data-access seam respected (RULE-02) | PASS | The only TypeScript datastore call changed is inside the seam, at `src/lib/data/supabase.ts:1232-1243`. `tests/org-admin-role-mapping.test.ts:75-83` reads source text and makes no datastore call. |
| R5 | Every § 4 contract item implemented | **FAIL** | § 4.2 AC-6: `supabase/tests/320-set-member-role-team-role.test.sql:161` (details in R5 and Findings below). All other items are implemented; see the R5 detail. |
| R6 | Permission gating matches § 3 | PASS | `supabase/migrations/20261108150000_mir16f_set_member_role_writes_team_role.sql:30-52` carries the org-admin test, the `org_admin` refusal and the five target predicates. They match the pre-ticket body at `20261107235000_mir16e_rename_admin_to_org_admin.sql:98-122` predicate for predicate, with the same 42501 errcodes. `security definer` and `set search_path = ''` are at `:24`. A `create or replace` with the same signature keeps the grants (`:22`). Verified by the reviewer: `pnpm exec supabase test db --local` on 320, 070 and 230 → `Files=3, Tests=180 … Result: PASS`. 320's refusal cases are at `:124-147`. |
| R7 | No invariant violated | PASS | `invariants_touched: []` (`ticket.yaml:18`). Per-ID reasoning is in the R7 detail below. |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main...HEAD -- package.json pnpm-lock.yaml` is empty. No import was added in `src/lib/data/supabase.ts:1240-1243`. |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 migration: `create or replace public.set_member_role(uuid, public.member_role) returns public.member`, plpgsql volatile security definer, `search_path = ''` | `supabase/migrations/20261108150000_mir16f_set_member_role_writes_team_role.sql:22-77`, wrapped in `begin`/`commit` at `:20`, `:79` | Yes. The body matches the plan's SQL line for line. |
| § 4.1 the five predicates as a `select`, with no write to `member` | same file `:41-48` | Yes |
| § 4.1 `v_to` mapping, `v_from` read from the active primary row | `:54-59` | Yes |
| § 4.1 change-only write: membership `team_role` and `updated_at`, plus the audit insert | `:62-73` (`is distinct from` at `:62`) | Yes |
| § 4.1 header comment cites ADR-086 decision 1, says `member.role` is not written, and gives legacy rows to MIR-16-g | `:1-14` | Yes |
| § 4.2 the file uses one `plan(n)`, `tests.seed()`, and the Una fixture on `team_u` | `320-set-member-role-team-role.test.sql:15-30` | Yes |
| § 4.2 one pending entry by `member_t2` (AC-7) | `:32-33` | Yes |
| § 4.2 AC-1 | `:38-51` | Yes |
| § 4.2 AC-2: count by `member_id`, read as owner | `:56-64` | Yes |
| § 4.2 AC-3 (legacy manager Mona) | `:69-89` | Yes |
| § 4.2 AC-4: membership digest and audit count before and after | `:94-114` | Yes. This is a per-row `md5`, not a `string_agg`, over the one row the call could touch. That is equivalent for this assertion. |
| § 4.2 AC-5: four refusals with no audit row and no membership change | `:119-153` | Yes |
| **§ 4.2 AC-6: a regex that admits only `org_admin` as the assigned value** | **`:158-169`** | **No.** `:161` matches only `set role = '<literal>'`. A non-literal assignment such as `set role = p_role` is never captured, so it is never counted. See Finding 1. |
| § 4.2 AC-7: the decider follows the team role | `:174-180` | Yes |
| § 4.3 070 control reads `member_roster_team_role`, `plan(73)` unchanged | `supabase/tests/070-definer-callers.test.sql:134-135` | Yes |
| § 4.3 230 AC-5 asserts the returned `member.role` is `member`, `plan(84)` unchanged | `supabase/tests/230-writers-write-membership.test.sql:314-316` | Yes |
| § 4.4 seam returns `{ ...toMember(data), role }`, with the rpc and `.select` unchanged | `src/lib/data/supabase.ts:1232-1235`, `:1240-1243` | Yes |
| § 4.5 vitest AC-8 case | `tests/org-admin-role-mapping.test.ts:75-83` | Yes |

## R7 detail

| Invariant | Held by | Citation |
|---|---|---|
| *(none listed — `invariants_touched: []`)* | The plan names no invariant (`01-plan.md` § 2 "Invariants touched"). I checked each ledger ID that a rank write could plausibly reach. | `ticket.yaml:18` |
| INV-04 (absence count windows) | The windows are `membership.joined_at` and `left_at`. The new body writes only `team_role` and `updated_at` on the active primary row. No `left_at` or `joined_at` is written, and no row is inserted or closed. | `20261108150000_…sql:63-65` |
| INV-07 (entry counted against every team of its member) | No membership row is added, closed or re-teamed, so the member's set of teams is unchanged. | `20261108150000_…sql:63-65` |
| INV-01, 02, 03, 05, 06 (entry-row rules) | The migration writes no `entry` row and alters no entry policy or trigger. The only objects touched are `membership` and `member_role_change`. | `20261108150000_…sql:63-73` |

There are no UI-only holds: every guard above is inside the `security definer` body.

## Findings

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|
| 1 | R5 | **The AC-6 assertion cannot fail on the regression it guards.** `320-set-member-role-team-role.test.sql:161` extracts `'([a-z_]+)'`, so only quoted literals are counted. The pre-ticket `set_member_role` wrote `set role = p_role` (`20261107235000_mir16e_rename_admin_to_org_admin.sql:109`, and the same shape at `20261107230000_mir16b_is_org_admin.sql:615`). That is a parameter, not a literal, so the assertion would pass against the function this ticket replaces. Plan § 4.2 specifies `prosrc ~* 'set\s+role\s*=\s*(?!''org_admin'')'` "or an equivalent regex that admits only `org_admin` as the assigned value". The implemented regex admits every non-literal value. `03-impl-log.md` § Deviations says `none`, which is also wrong here. **Fix:** use the plan's lookahead form, or anything that counts every `set role =` whose right-hand side is not `'org_admin'`. | developer (row: implementable R5) | true |

**Recorded for a human; not part of this gate (OPS chore, ADR-041 shape):**
`supabase/tests/170-multi-team-decisions.test.sql:215`, test 42, "AC-20: admin_u does not select E", fails locally (`have: 1, want: 0`). I reproduced this with `pnpm exec supabase test db --local supabase/tests/170-multi-team-decisions.test.sql`.

- **Not this ticket's.** The file's only `set_member_role` call is at `:382`, after the failing assertion at `:215`, and this migration replaces no other object.
- **Outside `allowed_paths`**, so no loop role on this ticket can fix it.
- **The impl log is wrong about the file.** `03-impl-log.md` says 170 "does not call `set_member_role` … anywhere". It does, at `:382`. Its tests other than test 42 pass.

## Verdict

`FAIL`: R5, routed to `developer`, `rework_count` +1, `next_state: REWORK`.
