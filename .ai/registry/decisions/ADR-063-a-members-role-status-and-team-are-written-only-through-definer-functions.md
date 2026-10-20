---
doc_version: 2
last_updated: 2026-10-20
governed_by: [RULE-01, RULE-09]
---

# ADR-063 — A member's `role`, `status` and `team_id` are written only through definer functions, and nobody changes their own

## Status

`ACCEPTED by tech-lead-design` — 2026-10-20, at `/plan MIR-02`.

**Why an agent may sign this (ADR-008).** It reverses no accepted decision. Every permission it
touches keeps the answer it already had in `.ai/standards/rbac-and-security.md`: an admin still
rejects a sign-up, still moves a member, still sets a rank; a member still edits their own name and
avatar. What changes is the *mechanism* each of those runs through, and one refusal that was always
intended and never enforced — a person changing their own `role`, `status` or `team_id`. No ADR, no
permission row and no operator answer ever granted that. If the operator disagrees at merge, the
revert condition below applies.

## Context

`.ai/board/audits/multi-tenancy-audit-2026-10-12.md:11-36`, the audit's most severe finding, and
`.ai/standards/rbac-and-security.md` § Known weaknesses A2.

Three column grants to the whole `authenticated` role — `update (role, removed_at)`
(`20260901120000_tea04_member_writes.sql:29`), `update (display_name, avatar)`
(`20260910093000_solo_profile_self_update.sql:39`), `update (status, team_id)`
(`20260910100000_solo_member_approval.sql:173`) — combine with policy `member_update_own`
(`profile_self_update.sql:61-64`), which admits the caller's own row, and with a trigger
(`member_enforce_role_and_removal`, final at `profile_self_update.sql:117-204`) that does not refuse a
person changing their own `role`, `status` or `team_id`. So `PATCH /rest/v1/member?id=eq.<self>`
with `{"role":"admin"}` from an ordinary member is admitted by every layer, and `is_admin` is global.

A column grant cannot say *who* is writing — `member`, `manager` and `admin` are one PostgreSQL role
(known weakness 6). The grant on these three columns exists only to serve admin writes, and since
ADR-039 and ADR-044 most of those already run through `security definer` functions that bypass the
grant anyway: `set_member_role`, `admit_member`, `move_member`. Two plain-table writers remain:

- rejecting a sign-up — `decideMember` with `approve: false`, a PATCH of `status` and `team_id`
  under policy `member_decide_admin`;
- `setMemberTeam` — the Members screen's edit panel, a PATCH of `team_id` under
  `member_update_admin`, whose `with check` pins the destination to the caller's own team.

## Decision

1. **Revoke `update (role, status, team_id)` on `public.member` from `authenticated`.** After this
   the only columns a plain table write may name are `display_name`, `avatar` and `removed_at`, each
   already fenced by the trigger. Every write of the three revoked columns is a `security definer`
   function that tests the caller in its own body.
2. **Two new definer functions replace the two remaining table writers, each reproducing the policy
   it replaces exactly — no wider, no narrower:**
   - `reject_member(p_member_id uuid) returns void` — caller `is_admin`; the row has `team_id is
     null` and `status = 'pending'`; sets `status = 'rejected'`. The predicate is
     `member_decide_admin`'s `using` plus the rejection half of its `with check`.
   - `set_member_team(p_member_id uuid, p_team_id uuid) returns public.member` — caller `is_admin`;
     the row's `team_id` and `p_team_id` both equal `member_team_id(auth.uid())`. The predicate is
     `member_update_admin`'s `using` and `with check`. It is **not** `move_member` and must not
     become it: that function is cross-team by ADR-039 and returns nothing, and this one is
     own-team and returns the row the screen re-renders.
3. **Drop policy `member_decide_admin`.** Nothing calls it after decision 2, and it is not
   team-scoped: with `removed_at` still granted, it would let any admin write a removal onto any
   pending sign-up. A policy nothing uses grants something to whoever finds it.
4. **The trigger refuses a person changing their own `role` or `status`, always, and their own
   `team_id` unless they are an admin.** Defence behind decision 1: a definer function runs the
   trigger with `auth.uid()` still the real caller, so this holds for any future function that
   forgets to check. The admin exception on `team_id` is `move_member`'s documented behaviour —
   *"Moving an admin — the caller included — is allowed"* (`20260911180000_solo_many_teams.sql`) —
   and is kept rather than decided again here. `v_uid is not null`, so a migration, the SQL editor
   and a service-role call are not blocked — the carve-out every other clause makes.
5. **The stale comment at `profile_self_update.sql:13-17` is reconciled by a dated note in the new
   migration**, not by editing an applied migration. That file says `team_id` is "still ungranted to
   everybody"; it was false from `member_approval.sql` until this migration, and true again after.

`removed_at` keeps its grant. Removal is admin-only through `member_update_admin`, own-team, and the
trigger already refuses self-removal; moving it is MIR-03 or MIR-16's decision, not this one's.

## Rejected alternatives

- **Trigger clause only, grants left in place.** Closes the hole with one function body, but leaves
  three writable columns guarded by a single `if` that a later `create or replace` can drop silently
  — `profile_self_update.sql` had to copy four clauses "character for character" for exactly that
  reason. Two independent locks cost one revoke.
- **Route `setMemberTeam` through `move_member`.** Fewer functions, but it widens the edit panel to
  any team and the read-back of a row moved off the caller's team is filtered by
  `member_select_team`, so a successful move would report as a refusal.

## Consequences

- A member who PATCHes `role`, `status` or `team_id` receives `42501 permission denied for column`
  before any policy runs. That is the reproduction in
  `.ai/board/audits/multi-tenancy-audit-2026-10-12-repro.md` § MIR-02, turned into a refusal.
- `supabase/db.sql` disagrees with the migrations one item more; MIR-08 owns that file.
- No SQL test proves it until MIR-05 stands up pgTAP. Until then the proof is a manual check against
  a provisioned project, recorded in the pull request (`calechip-multi-tenancy-plan.md` P0-2).

## Revert condition

Any legitimate screen action that writes `role`, `status` or `team_id` and is refused after this
migration is applied. The fix is a definer function for that action, not the grant back.
