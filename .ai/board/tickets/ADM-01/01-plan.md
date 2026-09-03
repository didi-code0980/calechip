---
ticket: ADM-01
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-03T10:29:17+07:00
inputs_read:
  - .ai/board/tickets/ADM-01/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/rules.md
  - .ai/registry/decisions/ADR-005-authorization-in-rls.md
  - .ai/registry/decisions/ADR-014-policy-migrations-are-not-schema-delta-none.md
  - .ai/registry/decisions/ADR-020-the-admin-write-path-on-member.md
  - .ai/standards/architecture.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/data-model.md
  - .ai/standards/coding-standards.md
  - .ai/standards/ui-design-system.md
  - .ai/board/backlog.md
  - supabase/migrations/20260831150024_tea01_membership.sql
  - supabase/migrations/20260901120000_tea04_member_writes.sql
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/App.tsx
consulted: []
chat_before_verdict: none
gate: BLOCKED
blocking_reason: >-
  ADM-01 cannot read `public.team` and therefore cannot show the admin the value they are
  editing. `supabase/migrations/20260831150024_tea01_membership.sql:145` does
  `revoke all on public.team, public.member, public.allowed_email from anon, authenticated`
  and grants `select` on `member` and `allowed_email` only, so `authenticated` holds no
  privilege on `team` at all and no select policy on it exists. `.ai/registry/features.md`
  assigns that select policy and its grant to CAL-04 — "CAL-04 owns the matching select policy
  and grant" on the ADM-01 row, and "This row owns the `team` select policy and the grant it
  needs … ADM-01 owns the matching update privilege on that table and nothing else" on the
  CAL-04 row. That assignment was written when CAL-04 preceded ADM-01, and its stated reason
  was that the owner should be the first consumer so the policy is exercisable at its own gate.
  The operator reordered the backlog on 2026-09-03 so that ADM-01 is row 1 and CAL-04 is row 7,
  and said another team is building the CAL group. ADM-01 is now the first consumer and the
  registry's own reason points the other way. THE DECISION NEEDED, one sentence from the
  operator: does ADM-01 ship `grant select (…) on public.team to authenticated` and the
  `team_select_own` policy, with the CAL-04 row's Notes amended by a human to say CAL-04
  consumes them rather than creates them? Proceeding on an assumption is not safe here and that
  is why this is BLOCKED rather than shipped with a stated assumption: if the assumption is
  wrong, two teams write two `create policy` statements for the same policy on the same table in
  two migrations, which fails on apply and is exactly the collision the reorder was meant to
  avoid. Everything else in this plan is complete and does not depend on the answer; sections 4,
  6 and 7 mark the read half so it can be struck in one edit if the answer is no.
session_disclosure: >-
  This plan was produced in a session that had already run `/thuki` twice in the same
  conversation, so it is not a fresh `tech-lead-design` session. RULE-13 constrains REVIEW only
  — `.ai/registry/rules.md:43` — and `.ai/standards/session-model.md:19` lists
  `tech-lead-design` as persistent, so no rule is broken. It is disclosed because
  `.claude/commands/thuki.md` says the steward does not do ticket work, and a reader deciding
  how much to trust this artifact should know which session wrote it. The precedent for
  disclosing rather than discarding is TEA-01's review, recorded in `.ai/board/metrics.md`.
next_state: BACKLOG
---

# ADM-01 — Set the overload threshold

## 1. Problem and scope

**Feature ID: ADM-01.** Transcribed from `.ai/registry/features.md` without paraphrase:

> | ADM-01 | Set the overload threshold | ADM | PLANNED | [] |

An admin gains the ability to change the share of the team above which a date is called overloaded.
Today `team.overload_threshold` exists, is `numeric not null default 0.5`, and no human being can
change it — TEA-01 created the column and revoked every privilege on the table, so the default is
the only value the product will ever hold. That matters more than a settings screen usually would,
because the threshold is not a stored fact about any day: an overloaded day is a comparison
performed on read (`.ai/standards/data-model.md`, *What is deliberately not stored*), so changing
this one number silently reclassifies every date in the product, past and future, in both
directions. This ticket is the first row in the ADM group, so it also fixes the shape the approval,
holiday-calendar and remaining admin rows inherit.

**Out of scope.**

- **Any use of the threshold.** Nothing in this ticket compares a count to it, draws an overloaded
  day, or warns anybody. The absence count is CAL-04's single function and the warning is CAL-07;
  building either here would give INV-04 a second arithmetic, which the CAL-04 registry row names
  as the specific failure that would survive the seam-parity test.
- **A general admin settings area.** One screen, at its own address. The ADM-01 registry row leaves
  the choice open as a `TODO(project):` and recommends its own screen so that this row does not have
  to invent an admin area; that recommendation is taken, and Open question 2 records it as an
  assumption that ships rather than a decision made silently.
- **Renaming the team.** `team.name` is not writable by anybody after this ticket, and section 6
  explains that this is the whole reason the grant is column-level.
- **Any audit trail of the change.** `team` carries no `updated_by` and no `updated_at`, so v1
  records neither who moved the threshold nor when. This is known weakness 3 in
  `.ai/standards/rbac-and-security.md` and it is not closed here; adding the columns is a schema
  change nobody has asked for and would need its own row.
- **Reading the threshold anywhere but this screen.** The value is fetched by this screen and by
  nothing else in the product until CAL-04 consumes it.

`size_estimate`: **M**.

## 2. Acceptance criteria

**AC-1 — an admin sees the value before changing it**
- Given a signed-in admin of a team whose `overload_threshold` is `0.5`
- When they open the threshold screen
- Then the screen shows the current threshold as `50%`, and the input is pre-filled with it.

**AC-2 — an admin changes the threshold**
- Given a signed-in admin on the threshold screen showing `50%`
- When they enter `60` and save
- Then the save succeeds, the screen reports success, and re-opening the screen shows `60%`.

**AC-3 — the new value survives a reload**
- Given an admin who has saved a threshold of `60%`
- When the page is reloaded
- Then the screen shows `60%`, read from the datastore and not from anything held in the browser.

**AC-4 — a member cannot reach the control**
- Given a signed-in member whose role is `member`
- When they open the threshold screen by typing its address
- Then no input and no save control is rendered, and the screen says the setting is for admins.

**AC-5 — a member's write is refused by the datastore, not by the screen**
- Given a signed-in member whose role is `member`
- When an update of `overload_threshold` on their team's row is issued directly against the
  datastore with that member's own token, bypassing every interface control
- Then the row is unchanged and the caller is told the write was not permitted.

**AC-6 — a caller with no session is refused**
- Given nobody signed in
- When the threshold screen's address is opened
- Then no threshold value is shown, and nothing reveals whether a team exists or what its threshold
  is.

**AC-7 — the threshold is bounded**
- Given a signed-in admin on the threshold screen
- When they enter a value below `0` or above `100`
- Then the save control refuses the value, the screen says the permitted range is `0%` to `100%`
  inclusive, and no write is issued.

**AC-8 — a non-numeric or empty value is refused**
- Given a signed-in admin on the threshold screen
- When they clear the input or enter text that is not a number
- Then the save control refuses it, the screen says a whole percentage is required, and no write is
  issued.

**AC-9 — the write cannot reach any other column of the team row**
- Given a signed-in admin
- When an update naming `name` on their own team's row is issued directly against the datastore with
  that admin's own token
- Then the write is refused, because no role holds the privilege to write that column.

**AC-10 — the link is shown to an admin and to nobody else**
- Given the landing screen
- When it is rendered for an admin, then for a member, then for somebody with no member row
- Then the link to the threshold screen appears in the first case only.

**AC-11 — nothing is blocked by this setting**
- Given any threshold value, including `0%`
- When any other screen in the product is used
- Then no action anywhere is refused, delayed or warned about because of the threshold. Charter
  refusal 6 governs what the threshold *does*; this row only sets it.

**AC-12 — saving the same value again is not an error**
- Given an admin on the threshold screen showing `60%`
- When they save `60` without changing it
- Then the save succeeds and the value remains `60%`.

**Invariants touched: `[]`.**

Written explicitly rather than left absent, and the reason is recorded rather than left to read as
an oversight. Setting the threshold changes what is *called* overloaded; it touches no entry, writes
no count and reads none. `.ai/registry/invariants.md:178` records **"The threshold is 50%"** under
*Considered and rejected as an invariant* — "configurable by an admin, therefore not an invariant" —
so the field this ticket makes writable is the one the invariant register already declined to
constrain. INV-04 is deliberately absent for the same reason it is absent from CAL-08 and ADM-05: a
row that changes what a comparison yields, while computing no comparison, cannot produce a second
definition of anything.

**Open questions.**

1. **BLOCKING — who ships the `team` select policy and grant.** Stated in full in
   `blocking_reason`. AC-1, AC-2, AC-3 and AC-6 are unbuildable until it is answered, because
   `authenticated` currently holds no privilege on `public.team`. It is the only question here that
   blocks.
2. **Assumption that ships — the surface is its own screen at `/threshold`.** The ADM-01 registry
   row leaves this open and recommends its own screen; the recommendation is taken so this row does
   not have to invent an admin settings area, and ADM-02, ADM-03 and ADM-04 inherit the answer.
   Reversing it later moves one route and one link.
3. **Assumption that ships — the permitted range is `0` to `100` inclusive, in whole percentage
   points.** The registry row records the range and granularity as unstated in the brief, the
   charter and the glossary, and says the input needs bounds. `0` and `1` are both admitted rather
   than excluded, because both are meaningful against the glossary's strictly-greater comparison —
   at `0` any day with one absence is overloaded and an empty day is not, at `100%` no day ever is,
   and neither is a degenerate state the product must refuse. Whole percentage points, because the
   screen speaks in percent and a half-point of a team of six is not a distinction anybody can act
   on. AC-7 and AC-8 are written against this and are the two criteria to revisit if the operator
   answers differently.
4. **Not blocking, and not this ticket's to answer.** The change has no audit trail, per Out of
   scope. Recorded here so that a reader of ADM-05 — which does get `approved_by` and `approved_at`
   — does not conclude that `team` was considered and found not to need them.

## 3. Permission model

Against `.ai/standards/rbac-and-security.md`. Two rows, both already in that table and both
operator-decided; this ticket invents no permission.

| Permission | member | admin | Where it is enforced |
|---|---|---|---|
| `Read the overload threshold` (line 47) | ✅ | ✅ | The `team_select_own` policy and the select grant — **subject to Open question 1** |
| `Set the overload threshold` (line 48) | ❌ | ✅ | The `team_update_admin` policy, plus the column-level update grant |

**The denials, stated as denials.**

- A member may not write `overload_threshold`. Enforced by `team_update_admin`, whose `using` and
  `with check` both require `public.is_admin(auth.uid())`.
- Nobody — member or admin — may write `team.name`, `team.id` or any other column of `team`. There
  is no permission row anywhere for renaming the team, and this is the finding the ADM-01 registry
  row calls the one that makes this ticket bigger than it looks: **an RLS `UPDATE` policy is
  row-level, so it admits every column of any row it admits.** A policy alone would turn *set the
  threshold* into *edit the team row*. The control that actually withholds `name` is the
  column-level grant in section 6, and it is uniform across roles precisely because nobody may
  rename the team. TEA-04's `grant update (role, removed_at) on public.member` is the same shape,
  and `.ai/registry/features.md`'s ADM-05 row contrasts the two: a column grant works here and
  cannot work for `entry.status`, because there `member` and `admin` are the same PostgreSQL role
  and revoking the column would block the admin too.
- Nobody may read another team's row. `team_select_own` is scoped by
  `public.member_team_id(auth.uid())`, which is `security definer` and already granted to
  `authenticated` by TEA-01 at `supabase/migrations/20260831150024_tea01_membership.sql:71`.
- A caller with no session reads nothing and writes nothing. `anon` is granted nothing on `team` by
  TEA-01's revoke and stays that way; every policy below is written `to authenticated`, never
  `to public`, per the note TEA-03's migration carries at
  `supabase/migrations/20260901093000_tea03_member_select_team.sql:27`.

**Where the check runs.** On the server side of the boundary, always. Under ADR-005 the browser
speaks to PostgREST directly, so the policy and the grant *are* the control and there is nothing
behind them. The role test on the screen — AC-4 and AC-10, hiding the input and the link from a
member — is an affordance only, and AC-5 exists precisely to prove that removing the affordance
changes nothing: it issues the write with a member's own token, past every control the interface
holds.

## 4. Contract

Two functions on the seam and one new domain type. Nothing here is invented; every field name comes
from `.ai/standards/data-model.md`'s `team` entity or from an existing seam function's shape.

```ts
// src/lib/domain/types.ts — new.
//
// A row of `public.team`, in application casing. `name` is present because the row has it and a
// screen may want to say which team it is showing; it is READ-ONLY in v1 and section 6's grant is
// what makes that true rather than a convention.
export interface Team {
  id: string;
  name: string;
  /**
   * The share of the team above which a date is overloaded — a SHARE, not a count
   * (glossary, *Threshold*). Stored as `numeric` and carried here as a fraction in [0, 1],
   * so 0.5 means 50%. The screen speaks in whole percent and converts at its own edge; the
   * seam never carries the percent form, because two representations of one number is how
   * a factor of one hundred gets applied twice.
   */
  overloadThreshold: number;
}
```

```ts
// src/lib/data/index.ts — added to `interface DataSeam`.

/**
 * ADM-01 AC-1, AC-3, AC-6. The caller's own team, or null when nobody is signed in and when the
 * caller has no member row. Null is a normal answer and not an error, the same shape
 * `getCurrentMember()` already uses.
 *
 * TAKES NO TEAM PARAMETER. `team_select_own` scopes the row to the caller's own team (INV-07),
 * and a parameter would imply the caller could ask for another team's and be answered — the
 * reasoning that already kept `teamId` off `addAllowedEmail` and `listMembers`.
 *
 * THROWS on a transport failure, and returns null only for the two states above. Returning null
 * for a broken connection would report "you are on no team" for what is a network fault.
 */
getTeam(): Promise<Team | null>;

/**
 * ADM-01 AC-2, AC-5, AC-9, AC-12. Sets the caller's own team's threshold. Admin only; the policy
 * is the control and this function is the affordance.
 *
 * TAKES NO TEAM PARAMETER, for the reason above, and NO OTHER COLUMN: the input carries the one
 * field this ticket may write, so there is no shape in which a caller could send `name` and have
 * it reach the datastore.
 *
 * `overloadThreshold` is a FRACTION in [0, 1], not a percentage. Callers convert at the screen.
 *
 * Returns the updated row. The `.select()` in the real implementation is not a convenience: under
 * row-level security a refused UPDATE is FILTERED, not errored — it matches nothing and PostgREST
 * answers 200 with an empty body, which `removeMember` already documents at
 * `src/lib/data/index.ts`. Zero rows returned is a refusal and maps to `not_permitted`; treating
 * `!error` as success would report a refusal as done. This is the one behaviour in this contract
 * that a developer will get wrong in good faith, and AC-5 is the test that catches it.
 */
setOverloadThreshold(input: SetOverloadThresholdInput): Promise<Result<Team>>;
```

```ts
// src/lib/data/index.ts — new input type, beside the existing SignUpInput / SignInInput.
export interface SetOverloadThresholdInput {
  /** A fraction in [0, 1] inclusive. The screen validates the range (AC-7) before calling. */
  overloadThreshold: number;
}
```

**No new `FailureCode`.** `not_permitted` already exists in `src/lib/domain/types.ts` and carries
AC-5 exactly; `network` and `unknown` carry the rest. Adding a code here would be inventing one for
a failure the union already names.

## 5. Seam impact

Two functions added: `getTeam()` and `setOverloadThreshold(input)`. Both appear in
`src/lib/data/index.ts`, `src/lib/data/supabase.ts` and `src/lib/data/mock.ts` with the same name
and the same arity, or `tests/seam-parity.test.ts` fails. That test is deliberately **not** in
`allowed_paths`: it must pass unedited with the two functions added, which is the property that
makes it worth having.

`getTeam()` is struck from all three implementations if Open question 1 is answered "CAL-04 keeps
the select policy" — and with it AC-1, AC-2's read-back, AC-3 and AC-6. That is the whole of the
answer's blast radius on this section, and it is why the two functions are separate rather than one
read-modify-write call.

**No pure module and no shared arithmetic.** This ticket adds neither. The single absence-count
function that both seam implementations import is CAL-04's, and the ADM-01 row's rule that it must
live in one shared module inside `src/lib/data/` binds that row, not this one. A helper here would
be the first half of the duplicate INV-04 arithmetic the registry warns about.

`mock.ts` holds the team in a module-level mutable record seeded from `FIXTURE_TEAM`, which already
carries `overloadThreshold` at `src/lib/fixtures.ts:12` — so no fixture changes, and
`src/lib/fixtures.ts` is not in `allowed_paths`. The mock's `setOverloadThreshold` must refuse a
non-admin caller in exactly the way the policy does, returning `not_permitted` rather than throwing:
the mock is what the acceptance suite drives (BUG-001 pinned that), so a mock that is permissive
where the policy is not would make AC-5 pass against nothing.

## 6. Schema delta

**NOT `none`** — ADR-014, no carve-out. `ticket.yaml` shipped from the template with
`schema_delta: none` and `requires_adr: false`, and the ADM-01 registry row's closing sentence says
`schema_delta` none because "`team` and `overload_threshold` are created by TEA-01's migration".
That is true of the **column** and does not settle the **privileges**: the same row, earlier,
requires a policy and a column grant, and ADR-014 makes a migration creating a policy not-`none`.
Both fields are corrected in `ticket.yaml` by this plan. This is the same correction TEA-02 made at
its own SPEC, recorded at `.ai/board/tickets/TEA-02/ticket.yaml:28`.

One new migration, `supabase/migrations/<timestamp>_adm01_team_threshold.sql`. It alters no table,
adds no column and drops nothing.

```sql
-- ADM-01. The admin write path on `public.team`, and the read that makes it usable.
--
-- `public.is_admin(uuid)` and `public.member_team_id(uuid)` already exist from
-- 20260831150024_tea01_membership.sql and both are `security definer`, so a policy on `team` may
-- consult `member` without recursing. Both are already granted to `authenticated` at
-- 20260831150024_tea01_membership.sql:71 — a second grant here is the redundant-grant trap: it
-- reads as a control and is not one.

-- THE COLUMN GRANT IS THE CONTROL, not the policy. An RLS UPDATE policy is row-level and admits
-- every column of a row it admits, so `team_update_admin` alone would let any admin rewrite
-- `team.name` — for which no permission row exists anywhere. TEA-01 revoked all on `public.team`
-- from `anon` and `authenticated` at 20260831150024_tea01_membership.sql:145, so nothing here is
-- inherited and both statements below are required. Same shape as TEA-04's
-- `grant update (role, removed_at) on public.member`, and it works here for the reason it cannot
-- work on `entry.status`: nobody may rename the team, so the privilege is uniform across roles.
grant update (overload_threshold) on public.team to authenticated;

-- AC-2, AC-5, AC-9, AC-12. `to authenticated`, never `to public`: a policy written `to public`
-- re-opens the table to the anon role.
create policy team_update_admin on public.team
  for update to authenticated
  using      (id = public.member_team_id(auth.uid()) and public.is_admin(auth.uid()))
  with check (id = public.member_team_id(auth.uid()) and public.is_admin(auth.uid()));

-- ------------------------------------------------------------------------------------------------
-- BLOCKED — the two statements below are the subject of Open question 1 and are written here so the
-- decision can be made against the real thing. If the operator answers that CAL-04 keeps the select
-- policy, delete this block, delete `getTeam()` from section 4, and strike AC-1, AC-3, AC-6 and the
-- read-back half of AC-2. If they answer that ADM-01 takes it, a human amends the CAL-04 row's
-- Notes in features.md so CAL-04 consumes these rather than creating them a second time.
-- ------------------------------------------------------------------------------------------------

-- AC-1, AC-3. `Read the overload threshold` is ✅ / ✅ in rbac-and-security.md:47, so this policy
-- carries no role test — a member may read the threshold and may not set it.
grant select on public.team to authenticated;

create policy team_select_own on public.team
  for select to authenticated
  using (id = public.member_team_id(auth.uid()));
```

**No trigger, and this is the difference from TEA-04.** ADR-020's write path on `member` needed
`member_enforce_role_and_removal()` because a `with check` sees the NEW row with no OLD and so
cannot say "this column did not change". Nothing here needs that sentence: there is exactly one
writable column, its permitted range is enforced at the screen (AC-7), and a value outside `[0, 1]`
is a wrong number rather than a violated invariant — the invariant register declined to constrain
it at all. A `check` constraint on the column would be a schema change to a table TEA-01 owns, and
it would refuse with a raw `23514` that the seam would then have to translate; the range is a
product decision recorded as Open question 3, not a datastore truth.

**Applying the migration is human — RULE-09.**

`requires_adr`: **true**. The ADR is not written by this plan. The precedent is exact: TEA-04's
plan passed its gate with `requires_adr: true` and an ADR that did not yet exist, and DoR item 4
failed at the orchestrator's gate until the operator accepted ADR-020
(`.ai/board/tickets/TEA-04/ticket.yaml:93`). The ADR owed here is the same shape — *the admin write
path on `team`* — and it is owed to the operator rather than written by an agent under ADR-008,
because it would settle Open question 1, which is a `features.md` ownership change and therefore
RULE-01 human-only. Writing it here would be answering the question this plan is blocked on.

## 7. allowed_paths

```yaml
allowed_paths:
  - "supabase/migrations/20260903000000_adm01_team_threshold.sql"
  - "src/lib/domain/types.ts"
  - "src/lib/data/index.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "src/routes/Threshold.tsx"
  - "src/routes/Home.tsx"
  - "src/App.tsx"
  - "tests/e2e/adm-01-threshold.spec.ts"
  - "tests/permission-model.test.ts"
```

Ten globs, ten files, two of them new. `size`: **M**.

**`size_estimate` and `size` agree at M**, so ADR-012 is not engaged and nothing splits. The
estimate in section 1 was written before the file list and the agreement is worth one line rather
than none: both were reached from the same fact, that this ticket is one screen, one migration and
two seam functions, and the thing that could have pushed it to L — an admin settings area — was put
out of scope in section 1 before the count was taken.

**Deliberately absent, each for a reason:**

- `tests/seam-parity.test.ts` — must pass unedited with the two functions added (section 5).
- `src/lib/fixtures.ts` — `FIXTURE_TEAM` already carries `overloadThreshold`
  (`src/lib/fixtures.ts:12`), so there is nothing to add.
- `playwright.config.ts` — the seam is already pinned by BUG-001 and this ticket has no reason to
  touch it.
- `src/routes/AllowList.tsx`, `src/routes/MemberList.tsx`, `src/routes/SignIn.tsx`,
  `src/routes/SignUp.tsx`, `src/routes/NotOnATeam.tsx` — untouched. `Home.tsx` is in the list only
  for AC-10's link, which is the same one-link change TEA-05 made for `/allow-list`.
- `.ai/registry/**` — nothing in this ticket writes the registry. The one amendment this work
  implies, to the CAL-04 row's Notes, is a human's under RULE-01 and is named in `blocking_reason`.

## 8. Rejected alternatives

**Rejected: fold the read into the write, and ship no `getTeam()`.** The screen would render an
empty input, the admin would type a number, and the save would return the updated row — so the
product would never need `select` on `team` and Open question 1 would evaporate, unblocking this
ticket today.

It was genuinely plausible and it is how the ticket could ship this week. It was rejected on three
counts, in increasing order of seriousness. It makes AC-1 unwritable, and an admin who cannot see
the current value has no way to know whether they are changing it or confirming it. It makes AC-3
unwritable, so nothing in the product ever proves the value was stored rather than accepted. And the
third is the one that decided it: PostgREST's `return=representation` needs the `select` privilege
too, so the write would come back empty and `setOverloadThreshold` would have to treat *no rows* as
success — destroying the refusal detection that AC-5 depends on and that `removeMember` already
documents as the trap. The alternative removes the blocker by removing the ticket's only observable
outcome.

**Rejected: a `security definer` function, `public.set_overload_threshold(numeric)`, with no policy
and no grant on the table.** It would carry the role test in its own body, need only
`grant execute`, and sidestep both the column-grant subtlety and the select question in one move.
Rejected because it moves the authorization out of the place ADR-005 puts it — the whole decision of
that ADR is that the policy is the control — and because it would establish, on the first row of the
ADM group, a second pattern for admin writes one ticket after ADR-020 established the first. The
next admin row would have to choose between them, and the reason for the choice would be lost. The
column-grant subtlety is not a cost to be avoided; it is the finding, and it is written down.

**Rejected: store the threshold as whole percent in the datastore.** The screen speaks percent and
the column would then need no conversion. Rejected because `.ai/standards/data-model.md:27` fixes
the column as a share with default `0.5`, changing it is a migration on a shipped table, and
CAL-04's comparison is `count / currentMembers > threshold` — a share on both sides. The conversion
belongs at the one edge that speaks percent, which is the screen.

## Changelog

- `2026-09-03T10:29:17+07:00` — sections 1 through 8 written. Gate BLOCKED on Open question 1.
  Raised by `tech-lead-design`.
- `2026-09-03T10:29:17+07:00` — section 6 corrects `schema_delta` from `none` and `requires_adr`
  from `false` in `ticket.yaml`, per ADR-014. The ADM-01 row in `features.md` says `schema_delta`
  none in its closing sentence; that is true of the column and not of the policy and grant the same
  row requires. Raised by `tech-lead-design`. Not a registry edit — the correction is to
  `ticket.yaml`, and the registry row is left as a human's to amend.
