---
doc_version: 2
last_updated: 2026-09-03
governed_by: [RULE-01, RULE-09]
---

# ADR-023 — The admin write path on `team`, and the read that stays CAL-04's

## Status

`ACCEPTED by tech-lead-design` — 2026-09-03.

Accepted by an agent under [ADR-008](ADR-008-agents-may-accept-adrs.md), and the test that ADR states
is met: this decides a question nothing has decided, inside the envelope
[ADR-005](ADR-005-authorization-in-rls.md) and [ADR-020](ADR-020-the-admin-write-path-on-member.md)
already set. It supersedes and reverses nothing. Decision point 3 below is the one place it could
have — and it declines to, deliberately, which is the opposite move.

Reviewed at merge under CODEOWNERS, like any other registry change.

## Context

ADM-01 fails Definition of Ready item 4. Its `schema_delta` is not `none` —
[ADR-014](ADR-014-policy-migrations-are-not-schema-delta-none.md), no carve-out for a migration that
only creates a policy and a grant — and no ADR exists to link. This is that ADR, and it is the same
position TEA-04 was in before ADR-020.

**The permissions are settled and none of them move.** `.ai/standards/rbac-and-security.md` carries
*Set the overload threshold* ❌ for member and ✅ for admin, and *Read the overload threshold* ✅ for
both. Both rows were decided by the operator on 2026-08-31. Nothing here invents, widens or narrows a
permission; what is undecided is the **mechanism** on `public.team`, and the table currently has none
of any kind.

**Three file facts, because the decision turns on them rather than on preference:**

1. `supabase/migrations/20260831150024_tea01_membership.sql:145` does
   `revoke all on public.team, public.member, public.allowed_email from anon, authenticated`, and
   grants `select` back on `member` and `allowed_email` only. `authenticated` holds **no privilege of
   any kind** on `public.team`, so a policy alone would grant nothing and a grant alone would be
   filtered by RLS to nothing. Both statements are required, together, or the path does not exist.
2. `public.is_admin(uuid)` and `public.member_team_id(uuid)` exist from that same migration, are
   `security definer`, and are already granted to `authenticated` at its line 71. A policy on `team`
   may therefore consult `member` without recursing, and a second grant here would be a statement
   that reads as a control and is not one.
3. **An RLS `UPDATE` policy is row-level.** It admits every column of any row it admits, including
   `team.name` — and there is no permission row anywhere for renaming the team. This is the finding
   the ADM-01 feature row calls the one that makes the ticket bigger than it looks, and it is why the
   decision below is about a privilege and not only about a policy.

## Decision

### 1. The write is a column-level grant plus a policy, and the grant is the control

```sql
grant update (overload_threshold) on public.team to authenticated;

create policy team_update_admin on public.team
  for update to authenticated
  using      (id = public.member_team_id(auth.uid()) and public.is_admin(auth.uid()))
  with check (id = public.member_team_id(auth.uid()) and public.is_admin(auth.uid()));
```

The grant is what withholds `name` from everybody; the policy is what withholds the row from a member
and from another team. Neither does the other's job, and describing the policy alone as "the
permission" is the specific mistake this point exists to prevent.

The grant is **uniform across roles** — it names `authenticated`, not an admin — and that is correct
here for the reason it could not work on `entry.status`: nobody may rename the team, so there is no
role for whom the withheld column should be writable. This is the same shape as ADR-020's
`grant update (role, removed_at) on public.member`.

`to authenticated`, never `to public`. A policy written `to public` re-opens the table to `anon`.

### 2. No trigger, and this is the difference from ADR-020

ADR-020's path on `member` requires `member_enforce_role_and_removal()` because a `WITH CHECK` sees
the new row with no old row and so cannot express *this column did not change*. Nothing on this table
needs that sentence: after point 1 there is exactly **one** writable column, so "which columns
changed" is answered by the privilege rather than by a comparison.

The permitted **range** of the value is deliberately not enforced in the datastore either. It is a
product decision that the invariant register explicitly declined to constrain — `invariants.md`
records *"The threshold is 50%"* under *Considered and rejected as an invariant* — and a `check`
constraint would be a schema change to a table TEA-01 owns, refusing with a raw `23514` that the seam
would then have to translate into a sentence. The bound belongs at the screen that speaks percent.

### 3. No `select` policy and no `select` grant on `public.team` are added by ADM-01

They remain CAL-04's, unmoved. `.ai/registry/features.md` says so on both rows — *"CAL-04 owns the
matching **select** policy and grant"* on ADM-01, and *"This row owns the `team` select policy and the
grant it needs … ADM-01 owns the matching **update** privilege on that table and nothing else"* on
CAL-04 — and ADR-014's *Correction* of 2026-08-31 exists specifically because an earlier line got this
ownership wrong.

**This is the point that could have been decided the other way, and the case against doing so is
precedent rather than deference.** TEA-05 reached this exact fork and took the narrow side: the
landing screen shows no team name, and `src/routes/Home.tsx` carries the reason in its opening comment, in the shipped
source. The TEA-05 feature row states the general instruction — *narrow the screen rather than taking
CAL-04's policy early*, and a design that takes it is ADR-010's revert condition firing rather than a
scope adjustment. Moving the ownership is also a `features.md` edit, which is RULE-01 human-only; an
agent that took the policy here would be executing that edit in SQL while leaving the registry saying
the opposite.

**The cost is named rather than absorbed: ADM-01 now depends on CAL-04.** An admin who cannot read
`overload_threshold` cannot be shown the value they are changing, and — because PostgreSQL requires
`SELECT` on any column named in `RETURNING` — the write cannot come back as a row either, which is
what a refusal is detected by under RLS. ADM-01's `depends_on` gains CAL-04 for this reason and for no
other.

### 4. No `insert` and no `delete` policy on `public.team` in v1

Same shape as ADR-018 Decision point 3 on `member`, and for a narrower reason: v1 has one team, it
arrives in the seed, and `rbac-and-security.md` carries no permission row for creating or destroying
one. Multiple teams are deferred rather than refused (`glossary.md`, *Team*), so the ticket that
introduces them revisits this point rather than working around it.

## Rationale

**Rejected: a blanket `grant update on public.team to authenticated`, with the policy as the only
control.** It is one statement instead of two and it is what an RLS-first reading suggests. Rejected
on context fact 3: the policy admits the whole row, so any admin could rewrite `team.name`, which no
permission row allows. The subtlety is not a cost to route around — it is the finding, and point 1 is
it written down.

**Rejected: a `security definer` function, `public.set_overload_threshold(numeric)`, carrying the role
test in its own body and needing only `grant execute`.** Genuinely plausible: it sidesteps the column
grant and point 3's dependency in one move, because a definer function reads the row under its owner's
privileges. Rejected on two counts. It moves authorization out of the place ADR-005 puts it, and that
ADR's whole content is that the policy is the control with nothing behind it. And it would establish a
**second** pattern for admin writes on the first row of the ADM group, one ticket after ADR-020
established the first — so the next admin row would choose between two patterns with the reason for
neither recorded.

**Rejected: ADM-01 takes the `select` policy and a human amends the CAL-04 row afterwards.** This is
what an earlier PLAN run of ADM-01 stopped on, as `gate: BLOCKED`, and it is a reasonable thing to
have asked. It is rejected here rather than re-asked because the premise it rested on is not in the
repository: `.ai/board/backlog.md` still orders CAL-04 at row 4 and ADM-01 at row 7, so the registry's
stated reason for the assignment — the owner should be the first consumer — still points at CAL-04.
The operator can reverse this in one sentence, and if they do, the amendment is theirs under RULE-01
and this ADR is superseded rather than reinterpreted.

## Consequences

- **ADM-01 has an ADR to link and satisfies Definition of Ready item 4.**
- **The ADM group inherits one admin-write pattern**, matching `member`: column grant, team-scoped
  admin policy, trigger only where `WITH CHECK` structurally cannot reach. ADM-03 and ADM-05 arrive
  at a decided shape instead of a fork.
- **ADM-01 cannot be built before CAL-04.** Definition of Ready item 1 is unaffected; item 3 fails
  until CAL-04 is `DONE`. This is an ordering fact rather than a defect, and it is visible on the
  board rather than discovered at implementation.

**What becomes weaker:**

- **The change has no audit trail.** `team` carries no `updated_by` and no `updated_at`, so v1 records
  neither who moved the threshold nor when — while moving it silently reclassifies every date in the
  product, past and future, because an overloaded day is a comparison performed on read and not a
  stored flag. This is known weakness 3 in `rbac-and-security.md` and this ADR does not close it.
- **The range is enforced in one place only, and it is the removable one.** Point 2 puts the bound at
  the screen. A caller with an admin token and a client of their own may write `-3` or `47`, and
  nothing refuses it. That is a wrong number rather than a violated invariant, and it was weighed
  against a `check` constraint on a shipped table.

## Revert condition

**A second column of `public.team` becoming writable.** The uniform, role-blind column grant in point
1 holds only while `overload_threshold` is the one writable column and nobody may write `name`. The
day a second column is granted to a different set of people, the privilege stops being the control and
point 1 must be re-decided rather than extended.

A second signal, for point 2: **the first value written outside `[0, 1]` by any path**. One occurrence
means the screen was the wrong place for the bound and the constraint is worth its migration.

## Affected documents

| File | Change |
|---|---|
| `.ai/board/tickets/ADM-01/ticket.yaml` | `schema_delta` not `none`, `requires_adr: true`, this ADR linked; `depends_on` gains CAL-04 per Decision point 3 |
| `.ai/board/tickets/ADM-01/01-plan.md` | Sections 3, 4, 5 and 6 are written against this decision |
