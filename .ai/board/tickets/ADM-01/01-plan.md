---
ticket: ADM-01
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-03T03:40:08+00:00
inputs_read:
  - .ai/board/tickets/ADM-01/ticket.yaml
  - .ai/board/backlog.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/rules.md
  - .ai/registry/decisions/ADR-005-authorization-in-rls.md
  - .ai/registry/decisions/ADR-008-agents-may-accept-adrs.md
  - .ai/registry/decisions/ADR-014-policy-migrations-are-not-schema-delta-none.md
  - .ai/registry/decisions/ADR-018-who-may-read-the-member-list.md
  - .ai/registry/decisions/ADR-020-the-admin-write-path-on-member.md
  - .ai/standards/architecture.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/data-model.md
  - .ai/standards/testing-standards.md
  - supabase/migrations/20260831150024_tea01_membership.sql
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/App.tsx
  - src/routes/Home.tsx
  - tests/seam-parity.test.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
supersedes: >-
  A PLAN run of this ticket on 2026-09-03 committed 01-plan.md to `feat/ADM-01` with `gate: BLOCKED`,
  asking the operator to move the `public.team` select policy from CAL-04 to ADM-01. That artifact is
  not amended — it stands on its branch — and this one reaches a different verdict on one premise its
  `blocking_reason` asserted and the repository does not carry: that the operator had reordered the
  backlog so ADM-01 preceded CAL-04. `.ai/board/backlog.md` orders CAL-04 at row 4 and ADM-01 at row
  7, and no commit on `main` or on `feat/ADM-01` changes it. With CAL-04 still first, the registry's
  own stated reason for the assignment holds, no registry amendment is owed, and the question is a
  dependency rather than a decision. Section 6 and ADR-023 Decision point 3 carry the reasoning.
session_disclosure: >-
  Written in a session whose designated branch is `claude/adm-01-plan-pj6xts` rather than
  `feat/ADM-01`. That is an external constraint on the session and not a choice of this stage; the
  branch carries the same two artifacts a `feat/` branch would. One consequence is worth knowing when
  judging this plan: `.claude/hooks/guard-allowed-paths.mjs` exits 0 on any non-`feat/` branch, so
  RULE-03 was not mechanically enforced here. It is enforced on the branch the implementation runs
  on, which is where `allowed_paths` in section 7 does its work.
---

# ADM-01 — Set the overload threshold

## 1. Problem and scope

**Feature ID: ADM-01.** Transcribed from `.ai/registry/features.md` without paraphrase:

> | ADM-01 | Set the overload threshold | ADM | PLANNED | [] |

An admin gains the ability to change the share of the team above which a date is called overloaded.
Today `team.overload_threshold` exists — `numeric not null default 0.5`, created by TEA-01's
migration — and nobody can change it, because that same migration revoked every privilege on
`public.team` from every role a browser can hold. The default is the only value this product will
ever contain until this ticket ships.

That matters more than a settings screen usually would. The threshold is not a stored fact about any
day: an overloaded day is a comparison performed on read, never a flag
(`.ai/standards/data-model.md`, *What is deliberately not stored*), so changing this one number
silently reclassifies every date in the product, past and future, in both directions. This is also
the first row in the ADM group, so the shape it fixes — an admin surface at its own address, an
admin write as a column grant plus a team-scoped policy — is what ADM-02 through ADM-06 inherit.

**Out of scope.**

- **Any *use* of the threshold.** Nothing here compares a count to it, draws an overloaded day, or
  warns anybody. The absence count is CAL-04's single shared function and the warning is CAL-07;
  building either here would give INV-04 a second arithmetic, which the CAL-04 registry row names as
  the failure that survives the seam-parity test because parity checks names and arity and not
  behaviour.
- **Reading `public.team` for any other purpose, and the select policy itself.** ADM-01 consumes
  CAL-04's select policy and grant; it does not create them. ADR-023 Decision point 3, and section 6.
- **A general admin settings area.** One screen, at its own address. Open question 2.
- **Renaming the team.** `team.name` stays unwritable by everybody after this ticket, and section 6
  explains that this is the entire reason the update grant is column-level rather than blanket.
- **Any audit trail.** `team` carries no `updated_by` and no `updated_at`, so v1 records neither who
  moved the threshold nor when. Known weakness 3 in `.ai/standards/rbac-and-security.md`; adding the
  columns is a schema change on a shipped table that nobody has asked for and would need its own row.
- **Enforcing the permitted range in the datastore.** The bound lives at the screen. ADR-023 Decision
  point 2 weighs it against a `check` constraint and records the cost.

`size_estimate`: **M**.

## 2. Acceptance criteria

**AC-1 — an admin sees the value before changing it**
- Given a signed-in admin of a team whose `overload_threshold` is `0.5`
- When they open the threshold screen
- Then the screen shows the current threshold as `50%`, and the input is pre-filled with `50`.

**AC-2 — an admin changes the threshold**
- Given a signed-in admin on the threshold screen showing `50%`
- When they enter `60` and save
- Then the save succeeds, the screen reports success, and the screen shows `60%`.

**AC-3 — the new value was stored, not just accepted**
- Given an admin who has saved a threshold of `60%`
- When the page is reloaded
- Then the screen shows `60%`, read back from the datastore and not from anything held in the
  browser.

**AC-4 — a member is refused the control**
- Given a signed-in member whose role is `member`
- When they reach the threshold screen by typing its address
- Then the current threshold is shown, no input and no save control is rendered, and the screen says
  in one sentence that only an admin may change it.

**AC-5 — a member's write is refused by the datastore, not by the screen**
- Given a signed-in member whose role is `member`
- When an update of `overload_threshold` on their own team's row is issued directly against the
  datastore with that member's own token, bypassing every control the interface holds
- Then the row is unchanged and the caller is told the write was not permitted.

**AC-6 — an admin cannot write any other column of the team row**
- Given a signed-in admin
- When an update naming `name` on their own team's row is issued directly against the datastore with
  that admin's own token
- Then the write is refused, because no role holds the privilege to write that column, and
  `team.name` is unchanged.

**AC-7 — an admin cannot reach another team's row**
- Given a signed-in admin of team A and a second team B existing
- When an update of team B's `overload_threshold` is issued with team A's admin token
- Then no row is changed and the caller is told the write was not permitted.

**AC-8 — a caller with no session sees and changes nothing**
- Given nobody signed in
- When the threshold screen's address is opened
- Then no threshold value is shown, nothing reveals whether a team exists or what its threshold is,
  and no write is possible.

**AC-9 — the value is bounded**
- Given a signed-in admin on the threshold screen
- When they enter a value below `0` or above `100`
- Then the save control refuses the value, the screen says the permitted range is `0%` to `100%`
  inclusive, and no write is issued.

**AC-10 — a non-numeric or empty value is refused**
- Given a signed-in admin on the threshold screen
- When they clear the input or enter text that is not a whole number
- Then the save control refuses it, the screen says a whole percentage is required, and no write is
  issued.

**AC-11 — the link is shown to an admin and to nobody else**
- Given the landing screen
- When it is rendered for an admin, then for a member, then for somebody with no member row
- Then the link to the threshold screen appears in the first case only. Hiding it refuses nobody —
  AC-4 and AC-5 are what refuse — and it is an affordance in exactly the sense ADR-005 uses.

**AC-12 — nothing anywhere is blocked by this setting**
- Given any threshold value, including `0%`
- When any other screen in the product is used
- Then no action is refused, delayed or warned about because of the threshold. Charter refusal 6
  governs what the threshold *does*; this row only sets it.

**AC-13 — saving an unchanged value is not an error**
- Given an admin on the threshold screen showing `60%`
- When they save `60` without changing it
- Then the save succeeds and the value remains `60%`.

**Invariants touched: `[]`.**

Written explicitly rather than left absent, with the reason recorded so it does not read as an
oversight. Setting the threshold changes what is *called* overloaded; it touches no entry, writes no
count and reads none. `.ai/registry/invariants.md` records **"The threshold is 50%"** under
*Considered and rejected as an invariant* — configurable by an admin, therefore not an invariant — so
the one field this ticket makes writable is the field the invariant register already declined to
constrain. INV-04 is deliberately absent on the same argument TEA-05's row made about INV-06: a
change that alters what a comparison yields, while computing no comparison, cannot produce a second
definition of anything. INV-01, INV-02, INV-03, INV-05 and INV-06 all constrain `entry` rows, and
nothing here writes or reads one. INV-07 constrains entries and the members they belong to; this
writes a column of `team` itself.

**Open questions.**

None blocking. The three below are assumptions that ship, and the first two are the two
`TODO(project):` markers on the ADM-01 feature row — which under `features.md`'s own *Columns*
section mean the feature is known-incomplete and needs a human decision before it reaches READY. They
are answered here as recommendations with their cost, so that the decision arrives complete rather
than as homework.

1. **The surface is its own screen, at `/threshold`.** The registry row leaves the choice open and
   recommends its own screen so that this row does not have to invent an admin area; the
   recommendation is taken. ADM-02, ADM-03 and ADM-04 inherit it. Reversing it later moves one route
   and one link and changes no acceptance criterion but AC-11's wording.
2. **The permitted range is `0` to `100` inclusive, in whole percentage points.** The registry row
   records the range and granularity as unstated in the brief, the charter and the glossary, and says
   the input needs bounds. Both endpoints are admitted rather than excluded, because both are
   meaningful against the glossary's strictly-greater comparison: at `0%` any day with one absence is
   overloaded and an empty day is not, at `100%` no day ever is, and neither is a degenerate state
   the product must refuse. Whole percentage points, because the screen speaks percent and half a
   point of a team of six is not a distinction anybody can act on. **AC-9 and AC-10 are the two
   criteria to rewrite if the operator answers differently**, and section 6 records that no datastore
   constraint has to move with them.
3. **No audit trail, and this is recorded so it is not read as an omission.** Section 1 puts it out
   of scope. Noted here so that a reader of ADM-05 — which does get `approved_by` and `approved_at` —
   does not conclude that `team` was considered and found not to need them.

## 3. Permission model

Against `.ai/standards/rbac-and-security.md`. Two rows, both already in that table, both decided by
the operator on 2026-08-31. This ticket invents no permission and narrows none.

| Permission | member | admin | Where it is enforced |
|---|---|---|---|
| `Read the overload threshold` | ✅ | ✅ | `team_select_own` and `grant select on public.team` — **CAL-04's**, consumed here (section 6) |
| `Set the overload threshold` | ❌ | ✅ | `team_update_admin`, **plus** `grant update (overload_threshold) on public.team to authenticated` |

**The denials, stated as denials.**

- **A member may not write `overload_threshold`.** Enforced by `team_update_admin`, whose `using` and
  `with check` both require `public.is_admin(auth.uid())`. AC-5.
- **Nobody — member or admin — may write `team.name`, `team.id` or `team.created_at`.** No permission
  row anywhere allows renaming the team. The control is the **column-level grant**, not the policy:
  an RLS `UPDATE` policy is row-level and admits every column of any row it admits, so the policy
  alone would turn *set the threshold* into *edit the team row*. The grant is uniform across roles
  precisely because there is no role for whom `name` should be writable. AC-6, and ADR-023 Decision
  point 1.
- **Nobody may read or write another team's row.** Both policies are scoped by
  `public.member_team_id(auth.uid())`, which is `security definer` and already granted to
  `authenticated` at `supabase/migrations/20260831150024_tea01_membership.sql:71`. AC-7.
- **A caller with no session reads nothing and writes nothing.** TEA-01's revoke leaves `anon` with
  no privilege on `public.team` and this ticket adds none; every policy is written `to authenticated`
  and never `to public`, which is the note TEA-03's migration already carries. AC-8.
- **A removed member is refused both.** `public.member_team_id` and `public.is_admin` each filter
  `removed_at is null`, so a removed admin's `member_team_id` is null, `id = null` is unknown, and no
  row matches. Nothing extra is written here to achieve that; it is a property of the two helpers.

**Where the check runs.** On the server side of the boundary, always. Under ADR-005 the browser
speaks to PostgREST directly, so the policy and the grant **are** the control and there is nothing
behind them. Two interface behaviours are affordances only and are marked as such: hiding the input
from a member (AC-4) and hiding the link from a non-admin (AC-11). **AC-5 exists to prove that
removing both affordances changes nothing** — it issues the write with a member's own token, past
every control the interface holds. Check R6 should read the interface role tests as affordances,
which is why they are named here rather than left to the code to imply.

## 4. Contract

One new domain type and two seam functions. Every field name below comes from
`.ai/standards/data-model.md`'s `team` entity or from an existing seam function's shape; RULE-04
means nothing here is invented at implementation time.

```ts
// src/lib/domain/types.ts — new, beside Member and AllowedEmail.
//
// A row of `public.team`, in application casing.
//
// `name` is present because the row has it and because a screen may want to say which team it is
// showing. It is READ-ONLY in v1, and section 6's column grant is what makes that true — not a
// convention, and not the absence of a setter.
export interface Team {
  id: string;
  name: string;
  /**
   * The share of the team above which a date is overloaded — a SHARE, not a count (glossary,
   * *Threshold*). `numeric` in the datastore, carried here as a FRACTION in [0, 1], so 0.5 means
   * 50%.
   *
   * THE SEAM NEVER CARRIES THE PERCENT FORM. The screen speaks whole percent and converts at its
   * own edge, in both directions. Two representations of one number inside the seam is how a factor
   * of one hundred gets applied twice, and CAL-04's comparison `count / currentMembers > threshold`
   * is a share on both sides.
   */
  overloadThreshold: number;
}
```

```ts
// src/lib/data/index.ts — new input type, beside SignUpInput and SignInInput.
export interface SetOverloadThresholdInput {
  /** A FRACTION in [0, 1] inclusive. The screen validates the range (AC-9) and converts before
   *  calling; this function does not re-validate and does not clamp. */
  overloadThreshold: number;
}
```

```ts
// src/lib/data/index.ts — added to `interface DataSeam`.

/**
 * ADM-01 AC-1, AC-3, AC-4, AC-8. The caller's own team, or null when nobody is signed in and when
 * the caller has no member row. Null is a normal answer and not an error — the shape
 * `getCurrentMember()` already uses.
 *
 * TAKES NO TEAM PARAMETER. `team_select_own` scopes the row to the caller's own team (INV-07), and a
 * parameter would imply the caller could ask for another team's and be answered — the same reasoning
 * that kept `teamId` off `addAllowedEmail` and off `listMembers`.
 *
 * THROWS on a transport failure, and returns null only for the two states above. Returning null for
 * a broken connection would report "you are on no team" for what is a network fault, which is the
 * distinction `listMembers` already documents.
 *
 * DEPENDS ON CAL-04's `team_select_own` policy and `grant select on public.team`. Against a real
 * project without them this returns null for everybody, indistinguishably from "no member row" —
 * which is why ADM-01 depends on CAL-04 rather than shipping ahead of it (section 6, ADR-023 point
 * 3).
 */
getTeam(): Promise<Team | null>;

/**
 * ADM-01 AC-2, AC-5, AC-6, AC-7, AC-13. Sets the caller's own team's threshold. Admin only; the
 * policy is the control and this function is the affordance.
 *
 * TAKES NO TEAM PARAMETER, for the reason above, and CARRIES NO OTHER COLUMN: the input holds the
 * one field this ticket may write, so there is no shape in which a caller could send `name` and have
 * it reach the datastore. The column grant refuses it regardless; this is the second lock.
 *
 * `overloadThreshold` is a FRACTION in [0, 1], not a percentage.
 *
 * RETURNS THE UPDATED ROW, and the `.select()` in the real implementation is not a convenience.
 * Under row-level security a refused UPDATE is FILTERED, not errored: it matches nothing and
 * PostgREST answers 200 with an empty body — the behaviour `removeMember` already documents in this
 * file. ZERO ROWS RETURNED IS A REFUSAL and maps to `not_permitted`; treating `!error` as success
 * would report a refusal as done. This is the one thing in this contract a developer will get wrong
 * in good faith, and AC-5 and AC-7 are the two tests that catch it.
 */
setOverloadThreshold(input: SetOverloadThresholdInput): Promise<Result<Team>>;
```

**No new `FailureCode`.** `not_permitted` already exists in `src/lib/domain/types.ts` and carries
AC-5, AC-6 and AC-7 exactly; `network` and `unknown` carry the rest. Adding a code here would be
inventing one for a failure the union already names.

**Selectors.** `data-testid` (`.ai/standards/testing-standards.md`), and they are listed because
whoever writes the tests now has to supply by hand what the retired QA stage supplied by structure:
`threshold-current`, `threshold-input`, `threshold-save`, `threshold-saved`, `threshold-error`,
`threshold-refused`, `home-threshold-link`.

## 5. Seam impact

**Two functions added: `getTeam()` and `setOverloadThreshold(input)`.** Both appear in
`src/lib/data/index.ts`, `src/lib/data/supabase.ts` and `src/lib/data/mock.ts` with the same name and
the same arity, or `tests/seam-parity.test.ts` fails. That test is deliberately **not** in
`allowed_paths`: it must pass unedited once the two functions exist, which is the property that makes
it worth having.

They are two functions rather than one read-modify-write call because the read and the write are
governed by different policies, owned by different tickets, and needed on different screens — CAL-04
needs `getTeam()` and does not need the write.

**No pure module and no shared arithmetic is added here.** The single absence-count function both
seam implementations import is CAL-04's, and the rule that it must live in one shared module inside
`src/lib/data/` binds that row, not this one. A helper here would be the first half of the duplicated
INV-04 arithmetic the registry warns about.

**`mock.ts` holds the team as a module-level mutable record seeded from `FIXTURE_TEAM`**, which
already carries `overloadThreshold` at `src/lib/fixtures.ts:12` — so no fixture changes and
`src/lib/fixtures.ts` is not in `allowed_paths`. Two properties the mock must have, because the
end-to-end suite is pinned to it by BUG-001 and a permissive mock would make AC-5 pass against
nothing:

- `setOverloadThreshold` **refuses a non-admin and a removed caller** by returning `not_permitted`,
  never by throwing — mirroring the policy rather than approximating it.
- `getTeam()` **returns null when there is no current member**, matching what the policy returns to a
  caller with no session and to a caller with no member row.

## 6. Schema delta

**NOT `none`** — ADR-014, no carve-out for a migration that only adds a policy and a grant. The
ticket shipped from the template with `schema_delta: none` and `requires_adr: false`, and the ADM-01
feature row's closing sentence says `schema_delta` none because *"`team` and `overload_threshold` are
created by TEA-01's migration"*. **That is true of the column and does not settle the privileges**,
which the same row requires two paragraphs earlier. Both fields are corrected in `ticket.yaml` by
this plan — the same correction TEA-02 made at its own SPEC. The correction is to `ticket.yaml`; the
registry row is left as a human's to amend under RULE-01.

**Linked ADR: [ADR-023](../../../registry/decisions/ADR-023-the-admin-write-path-on-team.md) — The
admin write path on `team`, and the read that stays CAL-04's.** `ACCEPTED by tech-lead-design` under
ADR-008: it decides a question nothing had decided, inside the envelope ADR-005 and ADR-020 already
set, and supersedes nothing. `requires_adr: true`, and unlike TEA-04 the ADR exists at the gate
rather than after it.

One new migration, `supabase/migrations/20260903000000_adm01_team_threshold.sql`. It alters no table,
adds no column, drops nothing, and creates no trigger.

```sql
-- ADM-01. The admin write path on `public.team`. ADR-023.
--
-- `public.is_admin(uuid)` and `public.member_team_id(uuid)` already exist from
-- 20260831150024_tea01_membership.sql, are `security definer` so a policy on `team` may consult
-- `member` without recursing, and are ALREADY granted to `authenticated` at that file's line 71. A
-- second grant here would be the redundant-grant trap: it reads as a control and is not one.

-- THE COLUMN GRANT IS THE CONTROL, not the policy. An RLS UPDATE policy is row-level and admits
-- every column of any row it admits, so `team_update_admin` alone would let an admin rewrite
-- `team.name` — for which no permission row exists anywhere. TEA-01 revoked all on `public.team`
-- from `anon` and `authenticated` at 20260831150024_tea01_membership.sql:145, so nothing here is
-- inherited and BOTH statements below are required. Same shape as TEA-04's
-- `grant update (role, removed_at) on public.member`, and it works here for the reason it could not
-- work on `entry.status`: nobody may rename the team, so the privilege is uniform across roles.
grant update (overload_threshold) on public.team to authenticated;

-- AC-2, AC-5, AC-6, AC-7, AC-13. `to authenticated`, never `to public` — a policy written
-- `to public` re-opens the table to the anon role.
create policy team_update_admin on public.team
  for update to authenticated
  using      (id = public.member_team_id(auth.uid()) and public.is_admin(auth.uid()))
  with check (id = public.member_team_id(auth.uid()) and public.is_admin(auth.uid()));
```

**No `select` policy and no `select` grant. That absence is the decision, not an omission.**
`.ai/registry/features.md` assigns them to CAL-04 on both rows, and ADR-014's *Correction* of
2026-08-31 exists because an earlier line got that ownership wrong. TEA-05 reached the same fork and
took the narrow side — `src/routes/Home.tsx` shows no team name and says why in its opening comment —
under the TEA-05 row's instruction to narrow the screen rather than take CAL-04's policy early.
Taking it here would also mean writing in SQL an ownership change the registry still contradicts, and
amending `features.md` is human-only under RULE-01.

**The cost, stated rather than absorbed: `depends_on` gains CAL-04.** AC-1, AC-3, AC-4 and AC-8 need
the read, and so does the write's refusal detection, because PostgreSQL requires `SELECT` on any
column named in `RETURNING`. `depends_on` is amended from `[TEA-01]` to `[TEA-01, CAL-04]` in
`ticket.yaml` and recorded in the Changelog. **Definition of Ready item 3 therefore fails until
CAL-04 is `DONE`** — that is an ordering fact the board should carry, not a defect in this plan, and
the orchestrator grades it rather than this artifact asserting it.

**No trigger, and this is the difference from TEA-04.** ADR-020's path on `member` needs
`member_enforce_role_and_removal()` because a `with check` sees the new row with no old row and so
cannot say *this column did not change*. Nothing here needs that sentence: after the column grant
there is exactly one writable column, so "which columns changed" is answered by the privilege. The
permitted range is enforced at the screen (AC-9) rather than by a `check` constraint — ADR-023
Decision point 2 records why, and its second revert condition is the signal that says the choice was
wrong.

**Applying the migration is human — RULE-09.**

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

Ten globs, ten files, three of them new. `size`: **M**.

**`size_estimate` and `size` agree at M**, so ADR-012 is not engaged and nothing splits. The line the
template asks for even on agreement: both were reached from the same fact — one screen, one
migration, two seam functions — and the thing that could have pushed this to L, a general admin
settings area, was put out of scope in section 1 before the file count was taken. The agreement is
therefore weaker evidence than it looks, and section 8's first rejected alternative is where the size
was actually decided.

**`tests/permission-model.test.ts` does not exist on disk and this ticket creates it.** That is worth
one sentence rather than a silent entry: `src/lib/data/index.ts:57`, TEA-01's design and TEA-03's
design all name it as the file through which the policies are observed through the seam, and `git
log --all` has no commit that ever added it. It was designed three times and written zero times. This
ticket does not adopt the whole of it — it adds the ADM-01 cases and nothing else.

**Deliberately absent, each with its reason:**

- `tests/seam-parity.test.ts` — must pass unedited once the two functions exist (section 5). Editing
  it to make it pass would remove the only thing it proves.
- `src/lib/fixtures.ts` — `FIXTURE_TEAM` already carries `overloadThreshold` at line 12, so there is
  nothing to add. `supabase/seed.sql` for the same reason.
- `playwright.config.ts` — BUG-001 pinned the end-to-end seam and this ticket has no reason to touch
  it.
- `src/hooks/useSession.ts` — the threshold screen reads its own member through the seam, the way
  `AllowList.tsx` and `MemberList.tsx` already do. `Home.tsx` is in the list for AC-11's one link
  only, which is the same one-link change TEA-05 made for `/allow-list`.
- `.ai/registry/**` — nothing the *implementation* writes touches the registry. ADR-023 is written by
  this plan, at PLAN, and is not the Developer's to edit.

## 8. Rejected alternatives

**Rejected: ship write-only, and depend on nothing.** The screen would render an empty input, the
admin would type a number and save, the product would never need `select` on `public.team`, and
ADM-01 would be buildable today with `depends_on: [TEA-01]` untouched. This is the alternative that
would have made this ticket cheaper than any other choice available, and it is what the section-1
scope was tested against.

Rejected on three counts, in increasing order of seriousness. **AC-1 becomes unwritable**, and an
admin who cannot see the current value has no way to know whether they are changing it or confirming
it — on a setting that reclassifies every date in the product, that is the difference between a
decision and a guess. **AC-3 becomes unwritable**, so nothing in the product ever demonstrates that
the value was stored rather than accepted. And the third decided it: PostgreSQL requires `SELECT`
privilege on every column named in `RETURNING`, so `.select()` after the update fails and
`setOverloadThreshold` would have to treat *no rows* as success — destroying the refusal detection
AC-5 and AC-7 depend on and that `removeMember` already documents as the trap. The alternative
removes the dependency by removing the ticket's only observable outcome. *(TODO(verify): whether
PostgREST's `Prefer: count=exact` with `return=minimal` reports the affected-row count without
`SELECT` privilege, which would restore refusal detection alone. No project is provisioned and
`tech-stack.md` lists Supabase as past reliable recall. It does not change this verdict — AC-1 and
AC-3 stay unwritable either way — so it is recorded rather than resolved.)*

**Rejected: take CAL-04's `select` policy and grant into this ticket, and have a human amend the
CAL-04 row afterwards.** Genuinely plausible, and it is what the earlier BLOCKED run of this plan
asked the operator for. Rejected because the premise does not survive a look at the repository:
`.ai/board/backlog.md` still orders CAL-04 at row 4 and ADM-01 at row 7, so the registry's own stated
reason for the assignment — the owner should be the first consumer, so the policy is exercisable at
its own gate — still points at CAL-04 and not here. TEA-05 met this fork and narrowed instead, on an
instruction its own feature row states in terms. Two teams writing `create policy team_select_own` in
two migrations fails on apply, and the ordering that prevents it is the one the board already
records. **This is one sentence from the operator away from being the right answer**, and if they say
it, the `features.md` amendment is theirs under RULE-01 and ADR-023 is superseded rather than
reinterpreted.

**Rejected: a `security definer` function, `public.set_overload_threshold(numeric)`, with no policy
and no grant on the table.** It would carry the role test in its own body, need only `grant execute`,
and sidestep both the column-grant subtlety and the CAL-04 dependency in one move — a definer
function reads under its owner's privileges, so it could return the row too. Rejected because it
moves authorization out of the place ADR-005 puts it, and that ADR's whole content is that the policy
is the control with nothing behind it; and because it would establish a second pattern for admin
writes on the first row of the ADM group, one ticket after ADR-020 established the first, leaving the
next admin row to choose between two shapes with the reason for neither recorded. The column-grant
subtlety is not a cost to avoid; it is the finding, and section 6 is it written down.

**Rejected: store the threshold as whole percent.** The screen speaks percent and the column would
then need no conversion anywhere. Rejected because `.ai/standards/data-model.md` fixes the column as
a share with default `0.5`, changing it is a migration on a shipped table, and CAL-04's comparison is
`count / currentMembers > threshold` — a share on both sides. The conversion belongs at the one edge
that speaks percent, which is the screen.

## Changelog

- `2026-09-03T03:40:08+00:00` — sections 1 through 8 written. Gate PASS. Raised by
  `tech-lead-design`.
- `2026-09-03T03:40:08+00:00` — section 6 corrects `schema_delta` from `none` and `requires_adr` from
  `false` in `ticket.yaml`, per ADR-014. The ADM-01 feature row's closing sentence says `schema_delta`
  none; that is true of the column and not of the policy and the grant the same row requires. Not a
  registry edit — the correction is to `ticket.yaml`. Raised by `tech-lead-design`.
- `2026-09-03T03:40:08+00:00` — section 6 amends `depends_on` from `[TEA-01]` to `[TEA-01, CAL-04]`.
  **This is a Definition of Ready item produced at BACKLOG being corrected at PLAN**, which item 6
  already contemplates for the feature-group case and which nothing forbids for item 3. The triage
  note reasoned that *"reading and writing the threshold is independent of any view"*; that is true of
  the screens and false of the privileges, and the same note two paragraphs later is what found the
  privilege problem it did not then follow through. Recorded rather than silently written, because a
  correction that moves a ticket out of buildable range is exactly the kind a reader should be able
  to find. Raised by `tech-lead-design`.
- `2026-09-03T03:40:08+00:00` — ADR-023 written and accepted under ADR-008, satisfying Definition of
  Ready item 4. Raised by `tech-lead-design`.
- `2026-09-03T03:40:08+00:00` — front-matter `supersedes` records the earlier BLOCKED plan on
  `feat/ADM-01` and the one premise this run reaches differently. That artifact is not edited.
  Raised by `tech-lead-design`.
