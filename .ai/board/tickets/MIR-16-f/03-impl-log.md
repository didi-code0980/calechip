---
ticket: MIR-16-f
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-08T01:28:26Z
inputs_read:
  - .ai/board/tickets/MIR-16-f/01-plan.md
  - .ai/board/tickets/MIR-16-f/ticket.yaml
  - .ai/registry/decisions/ADR-086-set-member-role-writes-the-team-role-and-the-manager-value-is-removed-by-a-column-retype.md
  - .ai/board/tickets/MIR-16-g/ticket.yaml
  - .ai/board/tickets/MIR-17/ticket.yaml
  - .ai/templates/impl-log.md
  - .ai/standards/testing-standards.md
  - supabase/migrations/20261107235000_mir16e_rename_admin_to_org_admin.sql
  - supabase/migrations/20261108090000_mir16c_manager_read_from_membership.sql
  - supabase/migrations/20261020150000_mir03_bounded_role_changes.sql
  - supabase/migrations/20261103210000_mir14_multi_team_decisions.sql
  - supabase/tests/_isolation.psql
  - supabase/tests/070-definer-callers.test.sql
  - supabase/tests/230-writers-write-membership.test.sql
  - supabase/tests/250-membership-self-lock.test.sql
  - supabase/tests/300-org-admin-rename.test.sql
  - supabase/tests/040-member-self-writes.test.sql
  - supabase/tests/140-org-stamping-and-membership-mirror.test.sql
  - supabase/tests/170-multi-team-decisions.test.sql
  - src/lib/data/supabase.ts
  - tests/org-admin-role-mapping.test.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261108150000_mir16f_set_member_role_writes_team_role.sql` | created | re-creates `set_member_role` so it writes `membership.team_role` and its own `member_role_change` audit row, and no longer writes `member.role` | §4.1 |
| `supabase/tests/320-set-member-role-team-role.test.sql` | created | pgTAP for AC-1 to AC-7 against the re-created function, plus the extra fixture (Una on Team U, a pending entry for `member_t2`) the design specified | §4.2 |
| `supabase/tests/070-definer-callers.test.sql` | modified | the AC-13 control at :134-135 now reads `member_roster_team_role`, since `set_member_role` no longer writes `member.role` | §4.3 |
| `supabase/tests/230-writers-write-membership.test.sql` | modified | the AC-5 assertion at :314-315 now asserts the returned `member.role` stays `member` after a promotion to manager | §4.3 |
| `src/lib/data/supabase.ts` | modified | `setRankThroughRpc`'s success return now overrides `role` with the requested rank, since the computed field over the returned row may read the statement's starting snapshot (ADR-086 decision 3) | §4.4 |
| `tests/org-admin-role-mapping.test.ts` | modified | added the AC-8 case asserting `setRankThroughRpc`'s body contains the override | §4.5 |

No other file was touched. `.ai/registry/decisions/ADR-086-...md`, `.ai/board/tickets/MIR-16-g/ticket.yaml` and `.ai/board/tickets/MIR-17/ticket.yaml` are in `allowed_paths` but were already written and committed by `tech-lead-design` at `/plan`; nothing in plan section 4 asked this stage to change them further, and `git status` showed them clean before this stage started, so they are listed here only for completeness and carry no diff from this stage.

## Contract items

| § 1 item | Implemented at | Notes |
|----------|----------------|-------|
| §4.1 migration | `supabase/migrations/20261108150000_mir16f_set_member_role_writes_team_role.sql` | Copied verbatim from the design's SQL block; same signature, `create or replace`, grants kept (ADR-024) |
| §4.2 pgTAP | `supabase/tests/320-set-member-role-team-role.test.sql` | `plan(23)`; AC-1 to AC-7 against the database, run on `tests.seed()` plus the two-part extra fixture (Una on Team U; one pending entry for `member_t2`) |
| §4.3 changed pgTAP (070) | `supabase/tests/070-definer-callers.test.sql:134-135` | Control now reads `member_roster_team_role`; `plan(73)` unchanged |
| §4.3 changed pgTAP (230) | `supabase/tests/230-writers-write-membership.test.sql:314-315` | AC-5 now asserts `member.role` stays `member`; `plan(84)` unchanged |
| §4.4 member seam | `src/lib/data/supabase.ts` `setRankThroughRpc` | Success return is `{ ...toMember(data), role }` |
| §4.5 vitest | `tests/org-admin-role-mapping.test.ts` | New `describe` block, one `it` for AC-8 |

AC-8 is observed against the member seam's source (01-plan.md § 2), which is what the new vitest case does; it is not exercised in pgTAP.

## Deviations from the design

`none`. The migration body, the two changed pgTAP assertions, and the seam change were implemented
exactly as the design's SQL and TypeScript fragments specify. The new pgTAP file's extra fixture (a
new fixture id function, Una's insert, the pending entry) was not given literal SQL by the design —
only the shape in prose (§4.2) — so the specific uuid prefix and the exact assertions are this
stage's own construction from that prose, following the id-helper convention already used by
`250-membership-self-lock.test.sql` (`tests.m21c`) and `170-multi-team-decisions.test.sql`
(`tests.m14`). No field name, permission or invariant was invented; every value asserted comes from
`01-plan.md` §2's acceptance criteria text.

## Invariants

| ID | Still holds because |
|----|---------------------|
| (none — `invariants_touched: []`) | `set_member_role` still writes only `membership.team_role` and `updated_at`, as before. INV-04's windows (`membership.joined_at`, `left_at`) are untouched by this migration; the new pgTAP file's AC-4 and AC-5 assertions confirm no membership row changes on a no-op or a refusal. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 52 files, 1040 tests, all pass (includes the new AC-8 case) |
| `node scripts/check-allowed-paths.mjs` | 0 | 6 changed files, all within `allowed_paths` |
| `node scripts/check-carry.mjs MIR-16-f` | 0 | 6 uncommitted paths, all carried from `allowed_paths` |
| `git diff --name-only` subset of `allowed_paths` | yes | confirmed by the two checks above |
| `pnpm exec supabase db reset --local` then `pnpm exec supabase test db --local supabase/tests` | — | local-only pgTAP run against the real migrations (not one of the four mandatory commands, run anyway since a local project was available — see Open questions). The new file `320-set-member-role-team-role.test.sql` passes 23/23. `070-definer-callers.test.sql` and `230-writers-write-membership.test.sql` pass in full after this ticket's edits. |

## Testability contract

Not applicable. ADR-022 retired the QA stage and plan section 8/testability contract with it; this
ticket's `01-plan.md` carries no plan section 6 selector list (it is a schema-only change with no
screen, per §2b).

## Open questions

- **`TODO(verify)` from 01-plan.md §2, resolved.** Against the local project, `member_roster_team_role`
  on the row `set_member_role` returns DOES see the `team_role` the same call just wrote (the AC-1
  and AC-3 pgTAP assertions, which call `set_member_role` and then separately read
  `member_roster_team_role` in the next statement, both pass; and the function is `stable`, scoped to
  one statement's snapshot, so the *same* statement's own write is visible to it). This does not
  change §4.4: the seam still overrides `role` with the requested rank rather than relying on this,
  because the computed field is read by a *different* statement — the `.select(...)` that follows the
  `.rpc(...)` call — and ADR-086's own reasoning is about a later statement's snapshot, not this one.
- **Pre-existing failure found, unrelated to this ticket, outside `allowed_paths`.** Running the full
  local pgTAP suite (`supabase/tests/`, all files, not just the ones this ticket may touch) surfaces
  one unrelated failure: `170-multi-team-decisions.test.sql` AC-20, "admin_u does not select E" — the
  row is selected (count 1) where the test expects 0. That file does not call `set_member_role` or
  `promote_member_to_admin` anywhere, and nothing this ticket's migration touches
  (`may_decide_entry`, `is_admin`, `shares_active_team`, any `entry_select_*` policy) was changed by
  it. `git stash` to re-run the suite without this ticket's diff was denied in this sandbox, so this
  is a static conclusion (every object this ticket's migration creates or replaces is grep-confirmed
  absent from `170-...test.sql` and from `may_decide_entry`, `is_admin` and `shares_active_team`),
  not an empirical before/after — it is a gap in the `is_admin`/`shares_active_team` reasoning
  `may_decide_entry` uses, predating this ticket (MIR-14). Not fixed here: `170-...test.sql` is not in
  `allowed_paths`, and nothing in `01-plan.md` §4 names it.
