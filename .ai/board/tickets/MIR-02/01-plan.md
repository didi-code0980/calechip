---
ticket: MIR-02
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-20T03:27:22+0000
inputs_read:
  - .ai/board/tickets/MIR-02/ticket.yaml
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/board/plans/multi-tenancy-status.md
  - .ai/board/audits/multi-tenancy-audit-2026-10-12.md
  - .ai/board/audits/multi-tenancy-audit-2026-10-12-repro.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/standards/rbac-and-security.md
  - .ai/templates/plan.md
  - supabase/migrations/20260901120000_tea04_member_writes.sql
  - supabase/migrations/20260910093000_solo_profile_self_update.sql
  - supabase/migrations/20260910100000_solo_member_approval.sql
  - supabase/migrations/20260911180000_solo_many_teams.sql
  - supabase/migrations/20260912100000_solo_manager_role.sql
  - supabase/migrations/20260924100000_solo_cross_team_role.sql
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/routes/MemberList.tsx
  - tests/cross-team-role.test.ts
  - tests/e2e/solo-member-admin.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-02 — A member's own role, status and team can be changed only through bounded, definer-checked paths

## 1. Problem and scope

**Feature IDs implemented:** none. MIR-02 is plan item P0-2 of
`.ai/board/plans/calechip-multi-tenancy-plan.md:76-81` and implements no `features.md` row
(`ticket.yaml` `feature_ids: []`). The rows it changes, transcribed from `features.md`:

- **TEA-04** — *Remove a member, and promote a member to admin*
- **TEA-09** — *A person signs up, waits, and an admin admits them onto a team or rejects them*
- **TEA-10** — *A member edits their own display name, avatar and password from a profile screen*
- **TEA-11** — *An admin creates, renames and deletes an empty team, admits a sign-up onto any team, and moves a member between teams*

**No role gains a capability. Every role loses one nobody granted.** Today any approved member can
make themselves admin of every team, or move themselves to another team, with one PATCH against
their own `member` row (audit:11-36; rbac-and-security.md known weakness A2). After this ticket the
datastore refuses that write at two independent layers — the column privilege and the trigger — and
every legitimate write of `role`, `status` or `team_id` runs through a `security definer` function
that checks its caller. The admin screens keep exactly the behaviour they have.

**Out of scope:**

- Bounding `set_member_role` to the caller's team, gating promotion to admin, logging role
  changes — **MIR-03**.
- Moving `removed_at` behind a function. It keeps its grant; self-removal is already refused by the
  trigger. MIR-03 / MIR-16.
- The pgTAP test (plan:81). Depends on **MIR-05**; until then a manual check is recorded in the PR.
- `supabase/db.sql` drift — **MIR-08**.
- Editing `.ai/standards/rbac-and-security.md` to close A2 — human-owned standard; the reply that
  ships this names the edit.
- Rotating keys (**MIR-01**), the member directory (**MIR-04**).
- Running the reproduction or applying the migration against a real project — human (RULE-09).

`size_estimate: M`

## 2. Acceptance criteria

The subject of every criterion is the datastore as reached by a signed-in caller's own token through
PostgREST. "Refused" means an error response and no column of the row changed.

**AC-1** — self-promotion refused
- Given an approved, not-removed caller whose `role` is `member`
- When they PATCH their own `member` row with `{"role":"admin"}` (or `"manager"`)
- Then the request is refused and their `role` is unchanged

**AC-2** — self-move refused
- Given an approved, not-removed caller of any role
- When they PATCH their own `member` row with a different `team_id`
- Then the request is refused and their `team_id` is unchanged

**AC-3** — self-status refused
- Given a caller whose `status` is `pending`, or `approved`
- When they PATCH their own `member` row with any other `status`
- Then the request is refused and their `status` is unchanged

**AC-4** — no plain-table path to the three columns, for anybody
- Given a caller who is an admin
- When they PATCH any `member` row naming `role`, `status` or `team_id`
- Then the request is refused before any row is matched

**AC-5** — profile edit unchanged (TEA-10)
- Given an approved, not-removed caller
- When they save a new display name and avatar from the profile screen
- Then both are saved, exactly as before this ticket

**AC-6** — rejecting a sign-up still works (TEA-09)
- Given an admin and a sign-up with no team and `status = 'pending'`
- When the admin rejects it
- Then its `status` is `rejected` and its `team_id` stays empty

**AC-7** — rejecting refuses what the old policy refused
- Given a caller who is not an admin, or a target that is not a pending, teamless sign-up
- When the caller rejects it
- Then the request is refused and the row is unchanged

**AC-8** — the edit panel's team save still works (TEA-04 screen, `setMemberTeam`)
- Given an admin and an approved member of the admin's own team
- When the admin saves that member's team as the admin's own team
- Then it succeeds and the returned member is the saved row

**AC-9** — the edit panel's team save refuses what the old policy refused
- Given a non-admin caller, or a target on another team, or a destination that is not the caller's own team
- When the caller saves
- Then the request is refused and the row is unchanged

**AC-10** — admin functions unchanged (TEA-04, TEA-09, TEA-11)
- Given an admin
- When they promote a member, set a rank, admit a sign-up onto any team, move a member (themselves
  included) between teams, or remove a member of their own team
- Then each succeeds or is refused exactly as before this ticket

**AC-11** — the anonymous key gains nothing
- Given the anon key and no session
- When it calls either new function
- Then it is refused

**Invariants touched:** `[INV-07]` — `team_id` is which team a member's entries count against; this
ticket removes the self-service path that could change it and leaves the admin paths' answer
unchanged. INV-04 reads `removed_at`, which this ticket does not touch.

**Open questions:** none. Every permission keeps its existing answer; ADR-063 records the mechanism.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

(There is no layout: this ticket changes no screen.)

## 3. Permission model

Every check lives in the datastore. Screens are unchanged and remain affordances only (ADR-005).

| Action | member | manager | admin | Where |
|---|---|---|---|---|
| Write own `role` / `status` | ❌ | ❌ | ❌ | no column grant; trigger clause (new) |
| Write own `team_id` by plain update | ❌ | ❌ | ❌ | no column grant |
| Write own `team_id` through `move_member` | ❌ | ❌ | ✅ unchanged | function body `is_admin`; trigger exempts admins |
| Write anybody's `role` / `status` / `team_id` by plain update | ❌ | ❌ | ❌ | no column grant |
| Reject a pending sign-up | ❌ | ❌ | ✅ | `reject_member` body |
| Save a member's team as own team | ❌ | ❌ | ✅ own team | `set_member_team` body |
| Edit own name / avatar | ✅ | ✅ | ✅ | unchanged |
| Remove a member | ❌ | ❌ | ✅ own team | unchanged |
| Execute either new function as `anon` | ❌ | — | — | `revoke all … from public` |

## 4. Contract

**SQL — new migration `supabase/migrations/20261020120000_mir02_member_bounded_writes.sql`,
one transaction, idempotent (ADR-024):**

```sql
-- 1. decision 1
revoke update (role, status, team_id) on public.member from authenticated;

-- 2. decision 2
create or replace function public.reject_member(p_member_id uuid) returns void
  language plpgsql security definer set search_path = '' as $$ … $$;
--   raise 42501 'only an admin can decide a sign-up'            when not is_admin(auth.uid())
--   update public.member set status = 'rejected'
--     where id = p_member_id and team_id is null and status = 'pending'
--   raise 42501 'that sign-up is not waiting for a decision'   when not found

create or replace function public.set_member_team(p_member_id uuid, p_team_id uuid)
  returns public.member
  language plpgsql volatile security definer set search_path = '' as $$ … $$;
--   raise 42501 'only an admin can move a member'               when not is_admin(auth.uid())
--   update public.member m set team_id = p_team_id
--     where m.id = p_member_id
--       and m.team_id  = public.member_team_id(auth.uid())
--       and p_team_id  = public.member_team_id(auth.uid())
--     returning m.* into v_row
--   raise 42501 'that member could not be moved'                when not found

revoke all on function public.reject_member(uuid) from public;
revoke all on function public.set_member_team(uuid, uuid) from public;
grant execute on function public.reject_member(uuid) to authenticated;
grant execute on function public.set_member_team(uuid, uuid) to authenticated;

-- 3. decision 3
drop policy if exists member_decide_admin on public.member;

-- 4. decision 4 — create or replace public.member_enforce_role_and_removal(),
--    every existing clause copied character for character, plus, FIRST in the body:
--    if v_uid is not null and old.id = v_uid then
--      if new.role   is distinct from old.role   then raise 42501 'you may not change your own role';
--      if new.status is distinct from old.status then raise 42501 'you may not change your own status';
--      if new.team_id is distinct from old.team_id and not public.is_admin(v_uid)
--                                                 then raise 42501 'you may not change your own team';
--    end if;
```

**TypeScript — `src/lib/data/supabase.ts`. Signatures unchanged; only bodies change:**

```ts
// decideMember(memberId: string, decision: MemberDecision): Promise<Result<void>>
//   approve branch: unchanged (rpc "admit_member")
//   reject branch:  client().rpc("reject_member", { p_member_id: memberId })
//                   error → { ok: false, error: toTeamFailure(error,
//                     "That sign-up could not be decided. It may already have been.") }
//                   else  → { ok: true, value: undefined }

// setMemberTeam(memberId: string, teamId: string): Promise<Result<Member>>
//   client().rpc("set_member_team", { p_member_id: memberId, p_team_id: teamId })
//   error            → { ok: false, error: toTeamFailure(error, "That member could not be moved.") }
//   !isMemberRow(data) → { ok: false, error: { code: "unknown", message: "That member could not be moved." } }
//   else             → { ok: true, value: toMember(data) }
```

No new field name, no new `FailureCode`, no new seam function.

## 5. Seam impact

Two bodies in `src/lib/data/supabase.ts` change (`decideMember` reject branch, `setMemberTeam`).
No function added or removed, so `tests/seam-parity.test.ts` is unaffected. `src/lib/data/mock.ts`
already reproduces both predicates (`decideMember`, `setMemberTeam`) and needs no change. The
contract comment on `setMemberTeam` in `src/lib/data/index.ts` names `member_update_admin` as the
control; it is updated to name `set_member_team`.

## 6. Schema delta

One migration touching a grant, a policy, a trigger function and two new functions — not `none`
(ADR-014). Recorded by
[ADR-063](../../../registry/decisions/ADR-063-a-members-role-status-and-team-are-written-only-through-definer-functions.md),
`ACCEPTED by tech-lead-design` under ADR-008. Applying it is human (RULE-09).

**Verification owed in the PR, by a human against a provisioned project** (`verification_required:
true`): before applying, the reproduction in `multi-tenancy-audit-2026-10-12-repro.md` § MIR-02 and
its result; after applying, the same PATCH refused (AC-1), plus AC-6 and AC-8 from the screens.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/board/tickets/MIR-02/**"
  - "supabase/migrations/20261020120000_mir02_member_bounded_writes.sql"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/index.ts"
  - "tests/mir02-member-bounded-writes.test.ts"
```

`glossary_owed` is empty; no glossary row is written. The test file asserts the migration text
(the revoke, the dropped policy, both functions' `revoke … from public`, the trigger's new clauses and
that every TEA-04 / profile clause survives the replace) — the pattern `tests/cross-team-role.test.ts`
uses — and the mock's `decideMember` / `setMemberTeam` refusals for AC-7 and AC-9.

`size: M` — five paths, two of them one-file code changes. Agrees with `size_estimate`.

## 8. Rejected alternatives

- **Trigger clause only, grants left as they are.** One function body closes AC-1..3, but leaves
  three writable columns behind a single `if` that a later `create or replace` can drop without the
  diff showing it — the risk `profile_self_update.sql` copied four clauses verbatim to avoid. AC-4
  would not hold.
- **Route `setMemberTeam` through the existing `move_member`.** One function fewer, but it widens
  the edit panel to any team, returns no row, and a read-back of a member moved off the caller's
  team is filtered by `member_select_team`, so a successful move would report as a refusal.
- **Remove `setMemberTeam` from the seam.** Its only save today writes the team the member is
  already on. Removing it changes a shipped screen (`MemberList.tsx:264`) and its e2e test — scope
  growth this ticket does not need.

## Changelog

- 2026-10-20T03:27:22+0000 — created. `ticket.yaml`'s predicted TEA-04 impact ("role and removal
  writes move behind definer RPCs") is narrower in fact: role writes already moved under ADR-044, and
  removal does not move here (§ 1 Out of scope). The `supabase.ts` line numbers in `mir_detail` are
  stale; the writers are now at `decideMember` and `setMemberTeam`. Raised and amended by
  tech-lead-design.
