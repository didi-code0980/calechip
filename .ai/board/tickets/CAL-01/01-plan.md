---
ticket: CAL-01
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-01T08:16:29+00:00
inputs_read:
  - .ai/board/tickets/CAL-01/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/00-charter.md
  - .ai/registry/decisions/ADR-011-inv-01-exclusion-constraint.md
  - .ai/registry/decisions/ADR-016-entry-status-guard-is-a-trigger.md
  - .ai/registry/decisions/ADR-021-the-qa-waiver-is-reverted.md
  - .ai/standards/architecture.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/data-model.md
  - .ai/standards/coding-standards.md
  - .ai/standards/testing-standards.md
  - .ai/standards/ui-design-system.md
  - .ai/standards/git-conventions.md
  - .ai/board/ideas/2026-08-31-a-plan-has-nowhere-to-be-written-down.md
  - supabase/migrations/20260831150024_tea01_membership.sql
  - supabase/migrations/20260901093000_tea03_member_select_team.sql
  - supabase/migrations/20260901120000_tea04_member_writes.sql
  - supabase/seed.sql
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/App.tsx
  - src/routes/MemberList.tsx
  - scripts/check-allowed-paths.mjs
consulted: []
chat_before_verdict: none
gate: BLOCKED
blocking_reason: >-
  One acceptance criterion cannot be written without a human decision, and it is the
  `TODO(project):` marker `.ai/registry/features.md` already carries on the CAL-01 row:
  **may a member create an entry for a date in the past?** Nothing in the brief, the charter or
  the registry settles it; the charter's *at any time* governs when the action may be taken, not
  which dates it may target. `features.md` § Columns defines a `Notes` marker as *known-incomplete
  and needs a human decision before it can reach READY*, and both `CLAUDE.md` and the operator's
  own standing instructions in `.ai/steward/context.md` carve acceptance criteria out of the
  decide-and-report autonomy grant — *never invent a feature ID, an invariant, or an acceptance
  criterion*. It is recorded as **AC-17 (placeholder)** in section 2 and under *Open questions*,
  with both branches costed and a recommendation. Everything else in this plan is complete: a
  one-word answer turns AC-17 into a criterion, the placeholder row in section 8 into a selector,
  and this gate into PASS with nothing else changed.
next_state: READY      # the transition this plan proposes; not taken while `gate` is BLOCKED
---

# CAL-01 — Create an entry for themselves, over a range of dates

## 1. Problem and scope

### The feature row, transcribed

`CAL-01` from `.ai/registry/features.md`, without paraphrase:

> | CAL-01 | Create an entry for themselves, over a range of dates | CAL | PLANNED | INV-01, INV-06,
> INV-07 | From 2026-08-31-a-plan-has-nowhere-to-be-written-down.md. The ticket that creates `entry`,
> its three enums, the two generated range columns `date_range` and `portion_slots`, INV-01's
> exclusion constraint with the `btree_gist` extension, INV-03's check and INV-02's trigger — all
> specified in data-model.md at doc_version 3. `schema_delta` links **ADR-005 and ADR-011**: ADR-005
> is what puts these in the database rather than in application code, and ADR-011 decides what the
> constraint operates on. INV-03's check ships with the table although rejection itself is a separate
> idea, which is why INV-03 is not listed at left. A contiguous range declared in one action is one
> entry, not one per day — invariants.md records that as considered and rejected as an invariant and
> says it belongs in a story. Self-only: an admin may not create on another member's behalf, denied by
> default, rbac-and-security.md known weakness 6. The note is readable by the whole team, which
> follows mechanically from `Read any entry in the team` being a row-level select policy under
> ADR-005. TODO(project): whether a member may create or edit an entry for a date in the past is
> undecided — nothing in the brief, the charter or the registry says, both answers are defensible,
> and it changes the interface. One acceptance criterion once answered. |

**One correction to that row, recorded and not acted on.** The create-on-behalf denial is known
weakness **7** in `.ai/standards/rbac-and-security.md`, not 6; weakness 6 is the `WITH CHECK`
limitation, which this ticket also meets (§3, §6). `features.md` is registry and human-only under
RULE-01, so the row stands as written and this plan cites the weakness by its content.

### What the member gains

**Today the product holds no plan and can hold none.** Four invariants describe `entry` and the
table does not exist: TEA-01 through TEA-04 built the roster, the allow-list and the admin write
path, and `public.entry` has never been created. A person who knows in August that they are away in
December has, inside this product, nowhere to put that fact — the same absence the idea file states
as *there is no durable, shared, editable record of an intention to be absent*.

This ticket gives **every member** — admins included, since an admin is a member who can also decide
— one action: declare that they will be on leave or working from home, over one date or a run of
consecutive dates, in one entry, and see it afterwards. It is the first ticket that writes a row the
rest of the product reads: until it lands, the calendar renders an empty grid, the overload warning
has nothing to count, and the approval worklist has nothing to approve.

It is also the ticket that **creates the enforcement surface for four of the seven invariants**, and
that is the larger half of the work. INV-01's exclusion constraint, INV-03's check, INV-02's trigger
and INV-06's column shape all ship here, on a table nobody has written to yet — so every one of them
is a claim until the permission-model test executes it against a real PostgreSQL.

### Out of scope

Non-empty, and each line names where the work goes instead.

- **Editing or deleting an entry.** CAL-02 (own) and CAL-03 (an admin's, on another member's). This
  ticket ships **no `update` and no `delete` policy and no `update` or `delete` grant** on
  `public.entry`, so both verbs are denied to everybody by the absence of a policy. INV-02's trigger
  ships anyway, per the feature row and ADR-016 — it is unreachable from the wire until CAL-02 grants
  `update`, and shipping it here is what keeps `public.entry_enforce_decision()` a single function.
- **Any calendar grid or view** — month, week or year. CAL-04, CAL-05, CAL-06. The triage verdict
  names this as the largest omission in the idea's own *Out of scope*, on the reasoning that a
  create-only ticket is otherwise entitled to build a grid to have something to drag-select on. It is
  not. **Drag-select (brief 7.2) is CAL-04's**, and it hands a date range to the form this ticket
  builds; the date-picker path therefore has to work standalone.
- **The overload warning while choosing dates.** CAL-07, which consumes CAL-04's absence-count
  function. This ticket computes **no count**, displays no count, and reads neither
  `team.overload_threshold` nor the member roster. The triage verdict makes this the test for whether
  CAL-01 has taken on another idea's work: *the one thing that would engage INV-04 is an acceptance
  criterion displaying a count in the creation form.* There is none.
- **The approval workflow, and setting `status` at all.** ADM-04, ADM-05. This feature never writes
  `status`, `rejection_reason`, `approved_by` or `approved_at`, and §6 makes that a **privilege**
  rather than a convention.
- **Recurring declarations** (*every Friday I work from home*). Brief P1; it changes what an entry is.
- **Any notification, email or reminder** on creation. v1 has no channel and must not grow one here.
- **A soft delete, a trash, or an undo for entries.** Nothing requires one; `entry` carries no
  soft-delete column and `member.removed_at` has no analogue here.
- **A length limit on the note.** That is a check constraint and a schema decision nobody has taken.
- **Group or joint declarations.** Charter refusal 4.
- **Fixing the end-to-end suite's unpinned seam.** `BUG-001`, which ADR-021 §Consequences puts ahead
  of this ticket. Named here because §7 lists an end-to-end spec that inherits the defect.

`size_estimate` is read from this section: **M**. One migration creating a table with three enums,
two generated columns, three constraints, a function and a trigger; two new seam functions with two
implementations each; one new screen and its route; and the acceptance suite. The invariant surface
is what makes it M rather than S — six of the seventeen criteria below are refusals held in the
database, and each needs a token and a real PostgreSQL to be observed.

## 2. Acceptance criteria

Written before the source tree was read, per the template's ordering note. Where reading the code
later changed one, the Changelog says so.

**AC-1 — a contiguous range declared in one action is one entry**
- Given a signed-in member with a `member` row on a team
- When they submit the form with `start_date` 2026-12-21 and `end_date` 2026-12-25, type `pto`,
  portion `full`
- Then exactly **one** entry exists for that member covering those dates — not five — and it is
  shown as a single row in their own list

**AC-2 — a single day is the same action**
- Given the same member
- When they submit with `end_date` equal to `start_date`
- Then one entry is created whose range is that one day

**AC-3 — one portion applies to every date in the range (INV-06)**
- Given the same member
- When they submit 2026-12-21 to 2026-12-25 with portion `pm`
- Then one entry is created carrying portion `pm`, and it means five consecutive afternoons — the
  interface offers no way to give one date in the range a different portion from another

**AC-4 — working from home is recordable and is not leave**
- Given the same member
- When they submit with type `wfh`
- Then the entry is created carrying type `wfh`, and it is displayed as distinct from a `pto` entry
  in their own list

**AC-5 — an entry can be declared tentative at creation (INV-05)**
- Given the same member
- When they submit with the tentative control set
- Then the entry is created with `tentative` true, and the list marks it as tentative
- And the flag is independent of approval status: the entry is still `pending`, and nothing about
  being tentative excludes it from anything

**AC-6 — the note is optional, free text, and the form says who reads it**
- Given the same member on the form
- Then a standing sentence beside the note field states that everyone on the team can read it,
  visible before anything is typed
- When they submit with the note empty
- Then the entry is created with no note
- When they submit with a note
- Then the entry is created carrying it verbatim

**AC-7 — an entry belongs to the member who created it, and the form cannot say otherwise (INV-07)**
- Given a signed-in member
- Then the form offers no control that names a member
- When the entry is created
- Then its `member_id` is that member's own id, supplied by the datastore and not by the request

**AC-8 — an entry is created pending, and the form cannot decide it**
- Given a signed-in member
- Then the form offers no control for approval status, rejection reason or approver
- When the entry is created
- Then its status is `pending`, `rejection_reason`, `approved_by` and `approved_at` are all null
- And a request that names any of those four columns at creation is **refused**, whichever role
  issues it

**AC-9 — an overlapping entry is refused, and the refusal is a sentence (INV-01)**
- Given a member who already has a `full` entry covering 2026-12-21 to 2026-12-25
- When they submit a second `full` entry covering 2026-12-23 to 2026-12-27
- Then no second entry is created
- And the screen shows a sentence saying they already have an entry covering part of that range and
  what to do about it — **never** a raw SQLSTATE, a `23P01`, or a database message

**AC-10 — a morning and an afternoon on the same date do not conflict (INV-01)**
- Given a member with an `am` entry on 2026-12-21
- When they submit a `pm` entry on 2026-12-21
- Then both entries exist

**AC-11 — a full day conflicts with a half day (INV-01)**
- Given a member with a `full` entry on 2026-12-21
- When they submit an `am` entry on 2026-12-21
- Then no second entry is created and AC-9's sentence is shown
- And the reverse order — an `am` entry first, then a `full` entry — is refused the same way

**AC-12 — an end date before the start date is refused with a message about dates**
- Given a signed-in member
- When they submit `start_date` 2026-12-25 and `end_date` 2026-12-21
- Then no entry is created
- And the screen shows a sentence about the dates being the wrong way round — not a range-bounds
  message from the datastore

**AC-13 — nobody creates an entry for another member, and admin is not an exception**
- Given a signed-in **admin**
- When a request is issued that would create an entry whose `member_id` is another member's
- Then it is refused
- And the same request issued by a member-role account is refused identically

**AC-14 — the whole team reads the entry, and nobody outside it does (INV-07)**
- Given a member on team A who has created an entry
- When another member of team A reads entries
- Then that entry is returned to them, note included
- When a member of a different team reads entries
- Then it is not returned to them
- When an unauthenticated caller reads entries
- Then nothing is returned

**AC-15 — a signed-in account with no member row cannot create, and is told why**
- Given a signed-in auth user who was never allow-listed, so no `member` row exists for them
- When they open the screen
- Then they see a sentence saying the account is not on a team yet, and no form
- And a request issued anyway creates nothing

**AC-16 — the member sees their own entries, and a short answer is never presented as a complete one**
- Given a member with entries
- When the screen loads
- Then their own entries are listed, and only theirs
- Given a member with no entries
- Then an empty state is shown rather than an empty table
- When the read comes back at its own row limit, so it may have been truncated
- Then the screen shows an unavailable state and **not** a short list presented as complete

**AC-17 — PLACEHOLDER. Whether a date in the past may be chosen.**
- **Not written.** This is the `TODO(project):` on the CAL-01 row of `.ai/registry/features.md`, and
  it is one human decision. See *Open questions* below for both branches, what each costs, and the
  recommendation. It is the gate's `blocking_reason`.

### Invariants touched

`[INV-01, INV-02, INV-03, INV-06, INV-07]`, written back to `ticket.yaml`. The feature row lists
three; this plan lists five and the two additions are argued rather than assumed.

| ID | How this change could affect it | Held by |
|---|---|---|
| **INV-01** | Directly, and this is the ticket that creates the mechanism. Every insert is a chance to put two entries of one member over the same portion of the same date. | `entry_no_overlapping_portion`, an `EXCLUDE USING gist (member_id WITH =, date_range WITH &&, portion_slots WITH &&)` with `btree_gist` — ADR-011, §6. **A UI affordance is explicitly not sufficient** and none is offered as one. |
| **INV-02** | Indirectly and by construction. The feature row and ADR-016 both put `public.entry_enforce_decision()` in this ticket's migration, in its INV-02-only form, so this ticket decides whether the invariant *can* hold when CAL-02 grants `update`. | The `before update` trigger `entry_enforce_decision`, §6. Unreachable from the wire in this ticket, because no `update` grant and no update policy exist. |
| **INV-03** | Indirectly. The check ships with the table although rejection is ADM-05's, per the feature row — so the biconditional's exact form is settled here, and an entry created with a `rejection_reason` and a `pending` status must be impossible from the first row. | `entry_rejection_reason_matches_status`, a check constraint in both directions, §6. |
| **INV-06** | Directly. `portion` is one column on the entry, so a per-day portion is unrepresentable — and AC-3 is the criterion that observes it. | Column shape: one not-null enum. §6. |
| **INV-07** | Directly, twice. `entry.member_id` is not-null against `member(id)`, and the select policy is the only thing deciding whose entries a caller sees. | Not-null foreign key with `on delete restrict`; `member_id` defaulted to `auth.uid()` and **withheld from the insert grant**; `entry_select_team` scoped through `public.member_team_id`. §3, §6. |

**INV-04 is not engaged, and this is stated rather than left blank.** Creating an entry changes what
the absence count for those dates will read, and INV-04 is about the **uniqueness of the definition**
— this ticket contains no definition of it. Nothing here counts, displays a count, reads
`team.overload_threshold`, or reads the roster. The triage verdict names the exact thing that would
engage it, and §1 *Out of scope* refuses it.

**INV-05 is not engaged either.** `tentative` is a column this feature writes (AC-5) and nothing here
counts, so there is no calculation that could treat a tentative entry differently from a settled one.
It becomes engaged at CAL-04 and is sharpest at CAL-07.

### Open questions

**1. May a member create an entry for a date in the past? — BLOCKING. This is AC-17.**

Nothing settles it. The charter's *"Create, edit and delete their own entries, at any time"* governs
when the action may be taken, not which dates it may target; the brief is silent; the registry is
silent. It is **not ADR-shaped** — neither answer touches the schema (`start_date` is a plain `date`
either way), the seam contract, the policies or any dependency — which is why it is one acceptance
criterion and a `TODO(project):` rather than a decision record.

| Answer | What it costs | What changes here |
|---|---|---|
| **Allow** | The historical record can be edited after the fact. Nothing in the product reads `start_date` as a claim about the past, so nothing is misled today; CAL-05's *who approved* and ADM-04's past-dated-pending marker are the first readers that would care. | AC-17 states that a past date is accepted, and the date inputs carry no `min`. **No code beyond one criterion and one test.** |
| **Refuse** | The *"I was actually out"* case becomes unrecordable, and the brief's own success measure counts entries. It also needs a mechanism decision this plan would then owe: a `CHECK` cannot reference `now()` (it is not immutable), so the refusal is a **trigger** clause or an affordance only — and an affordance only is not a control under ADR-005. | AC-17 states the refusal; §6 gains a clause on a `before insert` trigger that does not otherwise exist, which is a second trigger on `entry` and inherits ADR-016's alphabetical-ordering trap; §4 gains a `FailureCode`. |

**Recommendation, for a one-word answer: allow.** It is `product`'s recommendation in the idea file,
it is the cheaper answer by a wide margin, and the asymmetry runs the right way — allowing and later
refusing is a trigger clause added, while refusing and later allowing leaves entries that could not
be recorded when they happened. The refusing branch is also the one that would need a new `before
insert` trigger on a table ADR-016 has already made single-trigger-sensitive.

**2. Is the note's team-wide visibility what the operator intends? — not blocking, already answered
by mechanical consequence.** *Read any entry in the team* is ✅ for a member, and under ADR-005 that
is a **row-level** select policy with no column-level variant, so the note is readable by the whole
team whether or not anybody intended it. AC-6 turns that into a criterion — the field says so at the
point of typing — rather than leaving somebody to discover it after writing a medical reason into it.
Narrowing it later is a schema change (a second table, or a column-privilege split), not a policy
tweak.

**3. A rejected entry still occupies its portion, and this ticket must live with it — not blocking
here, and with the operator.** ADR-011 §Consequences records that INV-01 has no status carve-out, so
a member whose entry was rejected cannot create a replacement on the same dates: the second insert is
refused by the exclusion constraint. Making the constraint partial edits
`.ai/registry/invariants.md`, which is human-only under RULE-01, and the question is already with the
operator. **It does not block this plan** because AC-9 is what ADR-011 asks for in the interim — *the
interface must at minimum explain the refusal rather than surfacing the SQLSTATE* — and AC-9 is
written to be true under either answer. It is recorded here because the refusal sentence AC-9
specifies will, in that case, be shown to somebody trying to correct a rejection, and whoever writes
that sentence should know it.

**4. `BUG-001` is owed ahead of this ticket — not blocking the plan, blocking its QA gate.** ADR-021
§Consequences puts the end-to-end seam-pinning fix ahead of CAL-01, and `.ai/board/tickets/BUG-001`
is `BACKLOG`. Until it lands, `tests/e2e/cal-01-create-entry.spec.ts` (§7) inherits the defect: the
suite pins no datastore and resolves to whatever `.env` the machine carries. This plan does not fix
it and must not — it is another ticket's scope.

## 3. Permission model

Against the permission table in `.ai/standards/rbac-and-security.md`. Both directions; the denials
are the half the permission-model test exists for.

| Action | `member` | `admin` | Where the check runs |
|---|---|---|---|
| Create an entry for themselves | ✅ | ✅ | `entry_insert_own` `with check (member_id = (select auth.uid()))`, **plus** `member_id` defaulted to `auth.uid()` and withheld from the insert column grant |
| Create an entry on behalf of another member | ❌ | ❌ | The **insert column grant**. `member_id` is not granted, so a request naming it is refused with `42501 permission denied for column member_id` before any policy is evaluated |
| Set `status`, `rejection_reason`, `approved_by` or `approved_at` at creation | ❌ | ❌ | The same grant. None of the four is granted for `insert` |
| Write `id`, `created_at`, `updated_at`, `date_range` or `portion_slots` | ❌ | ❌ | Not granted; the last two are `generated always … stored` and are unwritable by anybody |
| Read any entry in the team | ✅ | ✅ | `entry_select_team` |
| Read an entry belonging to another team | ❌ | ❌ | The same policy — `public.member_team_id((select auth.uid()))` |
| Read, create, update or delete anything on `entry` unauthenticated | ❌ | ❌ | `revoke all on public.entry from anon`, and every policy is `to authenticated` |
| Edit or delete an entry | ❌ | ❌ | **Denied to both roles by this ticket.** No `update`/`delete` policy and no `update`/`delete` grant. CAL-02 and CAL-03 add them |

**Every check above is in the database, and every one that is not is named as an affordance.** Under
ADR-005 the browser holds the user's own token and reaches PostgREST directly, so a rule written in
`src/routes/` or in `src/lib/data/` can be skipped by issuing the same request from anywhere else.

The interface has exactly **three** affordances, and each carries a comment saying so:

1. **The form draws no member selector**, which is what makes AC-13 look impossible rather than
   merely refused. It is not the control — the grant is.
2. **The form draws no status, reason or approver control** (AC-8). Again not the control — the grant
   is.
3. **The not-on-a-team state** (AC-15). A caller with no `member` row is shown a sentence instead of
   a form. The control is the not-null foreign key plus `entry_insert_own`: with no `member` row,
   `auth.uid()` names no `member(id)` and the insert is refused by the foreign key.

**One consequence a reviewer should meet rather than discover.** `member_id` carries
`default auth.uid()` **and** is withheld from the grant **and** is re-tested by the policy's
`with check`. That is three locks on one column and it is deliberate, following the shape TEA-04
used on `member.team_id`: the grant is what refuses, the default is what makes the correct value the
only value that can arrive, and the `with check` is redundant today and becomes the live control the
moment any later ticket grants `member_id`. `.ai/standards/rbac-and-security.md` known weakness 6
says a column grant *works exactly where the answer is "nobody"* — and here the answer **is** nobody:
create-on-behalf is ❌ for both roles.

## 4. Contract

### 4.1 Domain types — `src/lib/domain/types.ts`

Three enums, one interface and one constant are added. **No existing type changes**, and `FailureCode`
gains two members — a widened union, which no existing caller must follow.

```ts
/** `entry.type`. A WFH member IS working — the glossary calls this the domain's costliest confusion. */
export type EntryType = "pto" | "wfh";

/** `entry.portion`. One per entry, applying to every date in its range (INV-06). */
export type EntryPortion = "full" | "am" | "pm";

/** `entry.status`. Set by an admin at ADM-05; never by this feature. */
export type EntryStatus = "pending" | "approved" | "rejected";

/**
 * A row of `public.entry`, in application casing.
 *
 * `date_range` and `portion_slots` are DELIBERATELY ABSENT. They are `generated always … stored`,
 * are never written, and PostgreSQL canonicalises a stored discrete range to `[)` — so a one-day
 * entry reads back as `['2026-01-01','2026-01-02')` and its upper bound is the day AFTER it ends
 * (ADR-011 section 1). Not selecting them is what stops a reader above the seam treating that
 * bound as the last day of the entry. `startDate` and `endDate` are the inclusive pair, and they
 * are the only date fields that cross the seam.
 */
export interface Entry {
  id: string;
  memberId: string;
  type: EntryType;
  portion: EntryPortion;
  startDate: string;        // YYYY-MM-DD, inclusive
  endDate: string;          // YYYY-MM-DD, inclusive; equal to startDate for one day
  tentative: boolean;
  status: EntryStatus;
  rejectionReason: string | null;
  note: string | null;
  approvedBy: string | null;
  approvedAt: string | null; // ISO 8601
  createdAt: string;         // ISO 8601
  updatedAt: string;         // ISO 8601
}

/**
 * AC-16. The explicit row limit `listOwnEntries` asks for, and the count at which it refuses to
 * answer. The same shape and the same reason as ROSTER_LIMIT: PostgREST caps rows SERVER-side, a
 * capped read returns a short list with no error, and a short list of your own entries reads as
 * "you have not declared that yet" — which is the answer that makes somebody declare it twice and
 * meet INV-01's refusal instead.
 *
 * It lives here and not in src/lib/data/index.ts because both implementations need it at RUNTIME,
 * and index.ts imports both — the cycle ROSTER_LIMIT already documents.
 *
 * TODO(verify): Supabase's default `max-rows`. This assertion only fires if this number sits BELOW
 * that cap. The same unknown is carried by CAL-04, CAL-07, ADM-02 and ADM-04 in features.md; no
 * project is provisioned and Supabase is on the past-reliable-recall list in tech-stack.md. If the
 * real cap is lower, the fix is this one number.
 */
export const ENTRY_LIMIT = 500;
```

`FailureCode` gains exactly two members, and each exists because a specific database refusal must
reach the member as a sentence rather than as a SQLSTATE:

```ts
  // CAL-01, 01-plan.md section 4.1.
  | "overlapping_entry"   // AC-9, AC-11: 23P01 from entry_no_overlapping_portion (INV-01)
  | "invalid_date_range"  // AC-12: end_date before start_date
```

**No third code.** Every other refusal reachable from this interface is the policy, the grant or the
foreign key saying no, and all three are one sentence to the member — `not_permitted`, which exists.

### 4.2 The seam — two functions added

Added to `DataSeam` in `src/lib/data/index.ts` and to both implementations with the same name and
arity. **No existing signature changes**, so no existing caller changes; that is §7's sizing test.

```ts
/**
 * CAL-01, 01-plan.md section 4.2. The input to `createEntry`.
 *
 * There is NO `memberId`. `entry.member_id` carries `default auth.uid()` and is withheld from the
 * insert grant (section 6), so there is no value a caller could pass that would land in the row —
 * the same reasoning that kept `teamId` off `addAllowedEmail`, and AC-7 and AC-13 are what it buys.
 *
 * There is NO `status`, `rejectionReason`, `approvedBy` or `approvedAt`. This feature never writes
 * them and the grant refuses them (AC-8).
 *
 * `endDate` is INCLUSIVE and equals `startDate` for a single day (AC-2), matching data-model.md.
 * The `'[]'` constructor in the generated column is what makes that true in the datastore, and
 * nothing above the seam ever builds a range literal.
 */
export interface CreateEntryInput {
  type: EntryType;
  portion: EntryPortion;
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD, inclusive
  tentative: boolean;
  note: string | null; // null, never "" — an empty note is the absence of one (AC-6)
}
```

```ts
/**
 * CAL-01 AC-1 through AC-15. Creates ONE entry for the caller, over a range of dates.
 *
 * ONE entry for a contiguous range, never one per day (AC-1). invariants.md records the per-day
 * split as considered and rejected as an invariant and says it belongs in a story; this is it.
 *
 * Returns the created row. The `.select()` in the real implementation is not a convenience: it is
 * how `id`, `status`, `createdAt` and the datastore-supplied `memberId` reach the caller at all,
 * since none of the four is in the request.
 *
 * The three expected failures, each mapped from a datastore refusal to a sentence:
 *   - 23P01 from `entry_no_overlapping_portion` -> `overlapping_entry` (AC-9, AC-11). ADR-011
 *     requires this mapping by name: a raw SQLSTATE at the moment somebody is correcting something
 *     is the failure that ADR recorded and did not fix.
 *   - 23514 from `entry_end_date_not_before_start` -> `invalid_date_range` (AC-12).
 *   - 42501 or 23503 -> `not_permitted` (AC-13, AC-15).
 * Anything else is `unknown`. A transport failure THROWS, because it is not a refusal.
 */
createEntry(input: CreateEntryInput): Promise<Result<Entry>>;

/**
 * CAL-01 AC-1, AC-3, AC-4, AC-5, AC-16. The caller's OWN entries, newest start date first, then
 * `id` ascending so both implementations agree on row order.
 *
 * TAKES NO PARAMETER, and the reason is the opposite of `listMembers`'s. There the policy scoped
 * the rows and a parameter would have implied you could ask for another team's. Here the policy
 * does NOT scope to self — `entry_select_team` returns the whole team's entries by design, because
 * that is the product's central mechanism — so the self filter is this function's own, stated in
 * its name. The team-wide read is CAL-04, CAL-05 and CAL-06's and is deliberately not built here.
 *
 * THROWS on a transport failure and on a possibly-truncated answer (AC-16). There is no
 * caller-visible failure shape, so a `Result` would have nothing to carry; returning `[]` for a
 * broken connection would report "you have declared nothing" for what is a network fault, and
 * returning a short list for a capped read is the exact failure AC-16 exists to prevent.
 */
listOwnEntries(): Promise<Entry[]>;
```

The `entry` row as PostgREST returns it, and the columns the real implementation selects — snake_case
straight off §6, and `date_range`/`portion_slots` are **not** among them:

```ts
const ENTRY_COLUMNS =
  "id, member_id, type, portion, start_date, end_date, tentative, status, " +
  "rejection_reason, note, approved_by, approved_at, created_at, updated_at";
```

### 4.3 The screen — `src/routes/Entries.tsx`, new, at `/entries`

`src/App.tsx` gains one `<Route path="/entries" element={<Entries />} />`. Reachable by address only,
for the same reason `/allow-list` and `/members` are: there is no navigation yet to add an item to.
The first ticket that adds a menu inherits the real version of that.

Four phases, following `MemberList.tsx`:

```ts
type View =
  | { phase: "loading" }
  | { phase: "not-on-a-team" }                        // AC-15
  | { phase: "unavailable" }                          // AC-16, the truncated or failed read
  | { phase: "ready"; me: Member; entries: Entry[] };
```

Form state, and the one thing that is not a control:

```ts
const [type, setType] = useState<EntryType>("pto");
const [portion, setPortion] = useState<EntryPortion>("full");
const [startDate, setStartDate] = useState("");
const [endDate, setEndDate] = useState("");
const [tentative, setTentative] = useState(false);
const [note, setNote] = useState("");
const [busy, setBusy] = useState(false);
const [error, setError] = useState<Failure | null>(null);
```

- **Setting `startDate` sets `endDate` to the same value when `endDate` is empty or earlier.** An
  affordance for AC-2 and AC-12, not a control — AC-12's control is the check constraint, and the
  form still submits whatever the member finally types.
- **`note.trim() === "" ? null : note`** on submit. AC-6: an empty note is the absence of one.
- On success, `setError(null)` and reload the list, so AC-1 is observable as one new row.
- On a returned `Failure`, render its `message` in `entry-form-error` with `role="alert"`. The
  sentence is already in the conversation language; the screen never composes one from a code.
- A **throw** is caught and rendered as the same generic sentence, because a transport error is not
  a refusal.

The three sentences the datastore refusals become, in the conversation language:

| `FailureCode` | Sentence |
|---|---|
| `overlapping_entry` | *Bạn đã có đăng ký trùng buổi trong khoảng ngày này. Hãy sửa đăng ký cũ hoặc chọn ngày khác.* |
| `invalid_date_range` | *Ngày kết thúc không được trước ngày bắt đầu.* |
| `not_permitted` | *Không tạo được đăng ký cho tài khoản này.* |

And the standing note-visibility sentence (AC-6), rendered beside the field and not on submit:

> *Cả nhóm đọc được ghi chú này.*

## 5. Seam impact

**Two functions added, none changed.** `createEntry(input)` and `listOwnEntries()` appear in
`src/lib/data/index.ts` on `DataSeam`, and in `src/lib/data/supabase.ts` and `src/lib/data/mock.ts`
with the same name and arity, so `tests/seam-parity.test.ts` passes **unedited** — which is why that
file is deliberately absent from §7.

`ready`, `signUp`, `getOwnMember`, `getCurrentMember`, `listAllowedEmails`, `addAllowedEmail`,
`removeAllowedEmail`, `listMembers`, `removeMember` and `promoteMember` are untouched.

**Parity is necessary and not sufficient, and this ticket has a specific place where it is not.** The
mock must reproduce the **constraint**, not the screen: an insert that overlaps an existing entry of
the same member on an intersecting portion must return `overlapping_entry` from the mock too, with
`full` conflicting with `am` and `am` not conflicting with `pm`. A mock that accepted every insert
would make every component test pass against a missing exclusion constraint — the one failure a mock
seam can cause and not catch, and the same reasoning `mock.ts` already records for the admission
trigger. The slot arithmetic in the mock is `full → [0,2)`, `am → [0,1)`, `pm → [1,2)` and half-open
intersection, matching ADR-011 §3 exactly.

**Nothing in this ticket goes near INV-04's counting function.** `absenceCountsFor` is CAL-04's, it is
pure, it takes rows, and it must live in a shared module inside `src/lib/data/` imported by both
implementations. This ticket adds no arithmetic to either implementation that a later one would have
to keep in step.

## 6. Schema delta

**NOT `none`** — ADR-014, no carve-out. One new migration,
`supabase/migrations/<timestamp>_cal01_entry.sql`, linked to **ADR-005** (why the enforcement is in
the database at all) and **ADR-011** (what INV-01's constraint operates on), both already approved and
both already named in `ticket.yaml`. It also implements **ADR-016**'s instruction that this ticket
create `public.entry_enforce_decision()` in its INV-02-only form.

**Applying it is human — RULE-09. No agent runs `supabase db push`.**

It alters no existing table, drops nothing, and touches none of the four existing migrations.

```sql
-- The gist operator class for `uuid` equality — ADR-011 section 4. Without it the EXCLUDE fails at
-- migration time with "data type uuid has no default operator class for access method gist".
--
-- TODO(verify): the schema this lands in, and whether it must be on the search_path in force when
-- the constraint below is created. An operator class CANNOT be schema-qualified inside an EXCLUDE
-- clause, so if Supabase's convention puts it in `extensions` the constraint will not resolve
-- without that schema on the path — ADR-011 section 4 carries this marker and says to read
-- Supabase's own extension documentation rather than write the line from memory. No project is
-- provisioned. TEA-01 used `with schema extensions` for citext and then qualified the TYPE, which
-- is not available here.
create extension if not exists btree_gist with schema extensions;

create type public.entry_type    as enum ('pto', 'wfh');
create type public.entry_portion as enum ('full', 'am', 'pm');
create type public.entry_status  as enum ('pending', 'approved', 'rejected');

create table public.entry (
  id               uuid primary key default gen_random_uuid(),

  -- INV-07, and AC-7 and AC-13 together. `default auth.uid()` is what makes the correct value the
  -- only value that can arrive; the insert grant below is what REFUSES any other. `on delete
  -- restrict` because a member is soft-deleted and never removed — data-model.md, and if this ever
  -- fires it is protecting INV-07 and the refusal is correct.
  member_id        uuid not null references public.member (id) on delete restrict default auth.uid(),

  type             public.entry_type    not null,

  -- INV-06. ONE portion, for the whole range. A five-day `pm` entry is five afternoons, and a
  -- per-day portion is unrepresentable because there is nowhere to put one.
  portion          public.entry_portion not null default 'full',

  start_date       date not null,
  end_date         date not null,   -- INCLUSIVE. Equal to start_date for a single day.

  -- INV-05. Displayed to everyone and counted in every calculation; it differs visually only, and
  -- it is INDEPENDENT of `status` — the glossary keeps them apart deliberately.
  tentative        boolean not null default false,

  status           public.entry_status not null default 'pending',
  rejection_reason text,
  note             text,
  approved_by      uuid references public.member (id) on delete restrict,
  approved_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- ADR-011 section 1, verbatim. The '[]' constructor is REQUIRED by the inclusive end_date:
  -- daterange(start_date, end_date) defaults to '[)' and would silently drop the last day of every
  -- entry. PostgreSQL canonicalises a stored discrete range to '[)', so a one-day entry reads back
  -- as ['2026-01-01','2026-01-02') — which is why section 4.1 keeps this column off `Entry`.
  date_range       daterange generated always as (daterange(start_date, end_date, '[]')) stored,

  -- ADR-011 section 3. Slot 0 is the morning, slot 1 the afternoon. This is what lets the
  -- constraint INTERSECT portions instead of comparing them for equality — `portion WITH =` is the
  -- shape that passes every happy-path test and lets a `full` and an `am` entry coexist on one day.
  portion_slots    int4range generated always as (
                     case portion
                       when 'full' then int4range(0, 2)
                       when 'am'   then int4range(0, 1)
                       when 'pm'   then int4range(1, 2)
                     end
                   ) stored,

  -- AC-12. ADR-011 section Consequences records that NOTHING required this and that it belongs to
  -- whoever designs CAL-01. Without it an inverted pair fails INSIDE the generated column with
  -- "range lower bound must be less than or equal to range upper bound" — a database message about
  -- ranges in place of a message about dates.
  constraint entry_end_date_not_before_start check (end_date >= start_date),

  -- INV-03, in BOTH directions, as data-model.md specifies and ADR-016 section 3 quotes. It ships
  -- with the table although rejection is ADM-05's, per the feature row. AC-8 is what observes it
  -- from this ticket: a `pending` entry carrying a reason is unrepresentable.
  constraint entry_rejection_reason_matches_status check (
    (status = 'rejected'::public.entry_status)
    = (rejection_reason is not null and btrim(rejection_reason) <> '')
  )
);

-- INV-01. ADR-011 section 3, verbatim. Two rows conflict when all three hold: same member,
-- intersecting dates, intersecting slots. full vs am -> [0,2) && [0,1) -> refused. am vs pm ->
-- [0,1) && [1,2) -> allowed. This is the one invariant a read-then-write check cannot hold: two
-- tabs, two devices or a retry, and only the database sees both writes.
--
-- Separate from the CREATE TABLE so that a search_path adjustment, should the TODO(verify) above
-- require one, has somewhere to go without rewriting the table.
alter table public.entry
  add constraint entry_no_overlapping_portion
  exclude using gist (
    member_id     with =,
    date_range    with &&,
    portion_slots with &&
  );

alter table public.entry enable row level security;

-- Explicit, not inherited. TEA-01's `revoke all on public.team, public.member, public.allowed_email
-- from anon, authenticated` names three tables because `entry` did not exist — ADR-016 records this
-- as the third time the trap has been found (ADM-01 on `team`, ADM-02 on `holiday`). Supabase's
-- default privileges on a new table in `public` are permissive, and relying on them would leave the
-- policy as the only thing between `anon` and a write.
revoke all on public.entry from anon, authenticated;

grant select on public.entry to authenticated;

-- AC-7, AC-8 and AC-13, and they are held HERE rather than by a predicate.
--
-- SIX columns, and every omission is a decision:
--   * `member_id`  — nobody may choose whose entry this is. `Create an entry on behalf of another
--                    member` is ❌ for BOTH roles, so the privilege is simply withheld and the
--                    column default supplies the only value that can be correct. This is the shape
--                    rbac-and-security.md known weakness 6 records as working on `team` and NOT on
--                    `entry` — it works exactly where the answer is "nobody", and here it is.
--   * `status`, `rejection_reason`, `approved_by`, `approved_at` — this feature never writes them.
--                    ADR-016's guard is a BEFORE UPDATE trigger and does not run on INSERT AT ALL,
--                    so on the create path the grant is the ONLY thing between a member and
--                    `{"status":"approved"}`. A `with check` listing four columns would work and
--                    can be forgotten one column at a time; a grant cannot.
--   * `id`, `created_at`, `updated_at` — datastore-supplied provenance.
--   * `date_range`, `portion_slots` — generated always, unwritable by anybody.
--
-- A statement naming any withheld column is refused with `42501 permission denied for column …`
-- BEFORE any policy is evaluated.
grant insert (type, portion, start_date, end_date, tentative, note) on public.entry to authenticated;

-- No `grant update` and no `grant delete`, and no update or delete POLICY. Both verbs are therefore
-- denied to everybody, admins included, until CAL-02 and CAL-03. ADR-016 records the column list
-- those tickets need and that it must exclude `member_id`, or an admin's edit reassigns an entry to
-- another member and breaks INV-07.

-- AC-7, AC-13. Redundant while `member_id` is ungranted, and kept as the second lock: if a later
-- ticket ever grants that column, this policy already refuses an entry created for somebody else.
-- The same shape TEA-04 used for `member_update_admin`'s `with check`.
--
-- `to authenticated`, never `to public`: a policy written `to public` re-opens the table to the
-- anon key, which ships in the browser bundle by design.
create policy entry_insert_own on public.entry
  for insert to authenticated
  with check (member_id = (select auth.uid()));

-- AC-14. `Read any entry in the team` is ✅ for both roles — reading is the mechanism the product
-- runs on, not a permission left open (charter, Roles).
--
-- INV-07 lives in this one predicate. It reads `public.member` DIRECTLY rather than through a
-- helper, and that is deliberate in both directions:
--   * `public.member_team_id(uuid)` CANNOT be used on the entry's owner: it filters
--     `removed_at is null`, so a removed member's entries would return a null team, `null = x` is
--     never true, and every entry they ever created would vanish from the team's view. ADR-013 and
--     the INV-04 note require the opposite — their entries stay and stay visible.
--   * A direct read of `public.member` runs as the INVOKER, so `member_select_team` applies. That
--     policy returns the caller's team INCLUDING removed members (TEA-03 has no `removed_at`
--     condition, deliberately), which is exactly the set needed. It fails CLOSED if that policy is
--     ever narrowed, and the explicit `team_id =` below holds the line if it is ever widened.
create policy entry_select_team on public.entry
  for select to authenticated
  using (
    exists (
      select 1
      from public.member m
      where m.id = entry.member_id
        and m.team_id = public.member_team_id((select auth.uid()))
    )
  );

-- INV-02, in the CAL-01 form ADR-016 prescribes. The function name and the trigger name are fixed
-- by ADR-016 section 1 and are real under RULE-04.
--
-- ADM-05 REPLACES this function with `create or replace function` and adds ADR-016 clauses (a) and
-- (b) ABOVE the block below. It must NOT add a second BEFORE UPDATE trigger to `entry`: PostgreSQL
-- fires same-event triggers alphabetically by name, and the single-function property is the only
-- thing keeping clause order explicit rather than a matter of spelling.
--
-- `security invoker`, following ADR-016: the function needs no privilege of its own.
--
-- UNREACHABLE FROM THE WIRE IN THIS TICKET. No update grant and no update policy exist, so nothing
-- a token holder can send reaches it. It ships here because the feature row and ADR-016 both put it
-- here, and because CAL-02 must not be the ticket that decides whether INV-02 can hold.
create function public.entry_enforce_decision() returns trigger
  language plpgsql security invoker set search_path = '' as $$
begin
  -- Provenance for `updated_at`, which is withheld from every grant so this is its only writer.
  -- It lives INSIDE this function rather than in a second BEFORE UPDATE trigger, for the ordering
  -- reason above. ADM-05's `create or replace` must keep this line.
  new.updated_at := now();

  -- INV-02, and ADR-016 section 3's rejected-entry case with it. `old.status <> 'pending'` covers
  -- `rejected` as well as `approved`: ADR-011 established that a rejected entry still occupies its
  -- portion under INV-01, so editing it is the member's ONLY route and is the likely path rather
  -- than an edge case. Clearing `rejection_reason` is forced, not chosen — INV-03's check is a
  -- biconditional, and any transition off `rejected` that left the column set is refused with a
  -- raw 23514.
  --
  -- ACTOR-BLIND, on purpose: an admin's edit under CAL-03 revokes approval exactly as the owner's
  -- does. INV-02 carries no actor qualifier, and an actor-conditional reset takes the not-admin
  -- branch silently when auth.uid() is null.
  --
  -- A note-only edit does NOT fire it. `note` is absent from the list below, which is INV-02's one
  -- exclusion and the reason it is an exclusion: revoking an approval over a typo teaches people to
  -- stop annotating.
  if (new.start_date is distinct from old.start_date
   or new.end_date   is distinct from old.end_date
   or new.type       is distinct from old.type
   or new.portion    is distinct from old.portion
   or new.tentative  is distinct from old.tentative)
     and old.status <> 'pending'::public.entry_status then
    new.status           := 'pending'::public.entry_status;
    new.approved_by      := null;
    new.approved_at      := null;
    new.rejection_reason := null;
  end if;

  return new;
end;
$$;

create trigger entry_enforce_decision
  before update on public.entry
  for each row execute function public.entry_enforce_decision();
```

### 6.1 The seed gains entries, and one row TEA-04 found missing

`supabase/seed.sql` gains, with every literal also appearing in `src/lib/fixtures.ts`:

1. **`FIXTURE_MEMBER`'s auth user and `member` row.** TEA-04's `03-impl-log.md` §*Open questions*
   found that `55555555-…` exists in `fixtures.ts` and **not** in the seed, and named the
   consequence: *"whoever writes `tests/permission-model.test.ts` will hit this before they write a
   line."* This is that ticket. AC-13's member-role half and AC-14 both need an active member-role
   account on `FIXTURE_TEAM` to hold a token as, and there is none. **In scope because this ticket's
   own criteria are unobservable without it**, and the fix is exactly the one TEA-04 specified: one
   auth user and one member row matching the literal already in `fixtures.ts`.
2. **`FIXTURE_ENTRY_FULL`** — a `full` `pto` entry belonging to `FIXTURE_MEMBER` over a fixed range.
   AC-9 and AC-11 need an existing entry to collide with, and creating it as a side effect of an
   earlier test is the shape TEA-01's seed already refused for the allow-list pair.
3. **`FIXTURE_ENTRY_AM`** — an `am` entry belonging to `FIXTURE_MEMBER` on a date the `full` entry
   does not cover. AC-10 submits its `pm` counterpart against it.
4. **`FIXTURE_ENTRY_OTHER_TEAM`** — an entry belonging to `FIXTURE_OTHER_TEAM_MEMBER`. **AC-14's
   denial is unobservable without it**: a one-team entry set passes whether the team scope is in
   `entry_select_team`'s predicate or absent from it — the same argument ADR-018 made for
   `member_select_team`, and the same reason `FIXTURE_OTHER_TEAM_MEMBER` exists at all.

Insert order is forced by the foreign keys, none of which cascade: `team` → `auth.users` → `member`
→ `entry`. Every `auth.users` insert sets `confirmation_token`, `recovery_token`,
`email_change_token_new` and `email_change` to `''` — MD-014, as every seeded account already does.

**Seeded entry rows name `member_id` explicitly.** The `default auth.uid()` is not used and cannot
be: a seed runs with no authenticated user, and `auth.uid()` is null there.

## 7. allowed_paths

Written back into `ticket.yaml`. Eleven globs, eleven files.

```yaml
allowed_paths:
  - "supabase/migrations/*.sql"
  - "supabase/seed.sql"
  - "src/lib/domain/types.ts"
  - "src/lib/data/index.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "src/lib/fixtures.ts"
  - "src/routes/Entries.tsx"
  - "src/App.tsx"
  - "tests/permission-model.test.ts"
  - "tests/e2e/cal-01-create-entry.spec.ts"
```

**No inline comments on the items.** `readYamlList` in `scripts/check-allowed-paths.mjs` and in
`.claude/hooks/guard-allowed-paths.mjs` strips only a leading and a trailing quote, so a trailing
`# …` is swallowed into the pattern and the glob then matches nothing.

`supabase/migrations/*.sql` is **one new file**; the glob is only because `supabase migration new`
generates the timestamp. The four existing migrations are not to be edited.

`.ai/board/tickets/CAL-01/**` needs no entry — `check-allowed-paths.mjs` exempts the active ticket's
own directory.

**Deliberately absent:**

- `tests/seam-parity.test.ts` — it must pass **unedited** with two seam functions added. Editing it
  would be the ticket quietly weakening the one test that makes the seam swap safe.
- `tests/e2e/smoke.spec.ts` and `tests/e2e/tea-01-signup.spec.ts` — this ticket changes no shipped
  behaviour they assert. `src/App.tsx` gains a route and its `*` fallback is untouched.
- `eslint.config.js`, `package.json` — no dependency is added (check R9), and the RULE-02 lint rule
  already covers `src/routes/Entries.tsx` through its `files: ["src/**"]` scope.
- `.ai/standards/**` and `.ai/registry/**` — human-only, RULE-01. §9 records two findings against
  them rather than writing them.

### `size` = M, and it agrees with `size_estimate`

**Eleven files is `M` (up to 12)**, and `size_estimate` in §1 is also `M`. **They agree; ADR-012 is
not engaged**, and this line is here because the operating model asks for it either way.

It is one file from the `L` boundary, and that is worth a sentence rather than a shrug: the ticket is
at the top of its band and the thing that would push it over is a second screen. §1 *Out of scope*
refuses every candidate — the grid, the warning, the approval surface — so the count is a real
ceiling and not an accident.

**The `XL` row was checked and is not engaged**, which needs saying because this ticket *does* ship a
migration and *does* touch the shared type module. The operating model's own clarifying paragraph is
the test: *"XL is for changes that break the seam's existing contract … The test is whether existing
callers must change, not whether the seam was touched at all."* Here no existing seam signature
changes, no existing type changes shape, `FailureCode` is a widened union, and the migration alters
no existing table. The precedent is TEA-02, TEA-03 and TEA-04 — all three shipped migrations, all
three were sized `M`, and all three were additive in exactly this sense.

## 8. Testability contract

`data-testid`, named once in `.ai/standards/testing-standards.md`. RULE-05 makes this table the only
channel through which these controls reach QA: a control missing here does not exist, and check R7
verifies the reverse — every selector below exists in the markup.

| selector | Element | Used by |
|---|---|---|
| `entry-form` | The `<form>` wrapping the creation controls | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6 |
| `entry-form-type` | The type control — `pto` / `wfh` | AC-4 |
| `entry-form-portion` | The portion control — `full` / `am` / `pm` | AC-3, AC-10, AC-11 |
| `entry-form-start-date` | The start date input | AC-1, AC-2, AC-12 |
| `entry-form-end-date` | The end date input, inclusive | AC-1, AC-2, AC-12 |
| `entry-form-tentative` | The tentative control | AC-5 |
| `entry-form-note` | The note field | AC-6 |
| `entry-form-note-visibility` | The standing sentence that the whole team reads the note, rendered beside the field and before anything is typed | AC-6 |
| `entry-form-submit` | The submit control | AC-1 … AC-13 |
| `entry-form-error` | The refusal sentence, `role="alert"` | AC-9, AC-11, AC-12, AC-13 |
| `entry-form-not-on-a-team` | The sentence shown instead of the form when the caller has no `member` row | AC-15 |
| `entry-list` | The list of the caller's own entries | AC-1, AC-16 |
| `entry-list-row` | One entry. AC-1 counts these | AC-1, AC-2, AC-10 |
| `entry-list-row-dates` | The inclusive date span on a row | AC-1, AC-2, AC-3 |
| `entry-list-row-type` | The type on a row, `pto` distinguished from `wfh` | AC-4 |
| `entry-list-row-portion` | The portion on a row | AC-3, AC-10, AC-11 |
| `entry-list-row-status` | The approval status on a row | AC-5, AC-8 |
| `entry-list-row-tentative` | The tentative marker on a row, present only when tentative | AC-5 |
| `entry-list-row-note` | The note on a row, present only when there is one | AC-6 |
| `entry-list-empty` | The empty state, shown instead of an empty table | AC-16 |
| `entry-list-unavailable` | The unavailable state, shown for a failed **or possibly truncated** read | AC-16 |
| — | **PLACEHOLDER for AC-17.** If the answer to *Open questions* item 1 is *refuse*, the refusal needs a selector on `entry-form-error` and nothing new; if it is *allow*, this row is deleted. Either way no new selector is expected — recorded so the placeholder does not read as an omission | AC-17 |

**Six criteria have no selector, and that is correct rather than a gap.** AC-7, AC-8's refusal half,
AC-13, AC-14 and AC-15's request half are properties of the grant and the policies. Per
`.ai/standards/testing-standards.md` and ADR-016 they are asserted in
`tests/permission-model.test.ts` **against a real PostgreSQL with a token per role**, not through the
seam — the seam is where the affordance lives and not where the control is. The sharpest of them is a
denial: *a member POSTs `{"member_id": "<somebody else>"}`, or `{"status": "approved"}`, and is
refused.* A permission test asserting only the allow cases passes when the grant is deleted.

## 9. Rejected alternatives

**1. Refuse `status` at creation with an RLS `with check (status = 'pending' and approved_by is null
and approved_at is null and rejection_reason is null)` instead of withholding the columns from the
insert grant.**

Genuinely plausible, and it is the shape most of this repository already reaches for. Unlike the
update case, a `with check` **can** express it here: an INSERT has no OLD row, so there is nothing
the policy cannot see, and `.ai/standards/rbac-and-security.md` known weakness 6 does not apply.

Rejected on three counts, in increasing order of weight. It states four column names in a predicate
that has to be kept in step with the table as columns are added — and the failure mode of forgetting
one is silent. It refuses **after** the policy is evaluated rather than before, so the error is a
policy violation rather than `42501 permission denied for column status`, and the second names the
column. And decisively: **the same predicate has to carry `member_id` too**, at which point the
policy is doing the work of a grant with none of a grant's property that you cannot partially
forget it. The grant refuses five columns by not mentioning them; a `with check` refuses five
columns by mentioning all five correctly. `entry_insert_own`'s `with check` is kept anyway, on
`member_id` only, as the second lock for the day some ticket grants that column.

**2. Build the team-wide read here — `listEntriesInRange(range)` — instead of `listOwnEntries()`.**

Plausible because AC-14 is about the team reading the entry, and because a range-shaped read is what
every calendar view will want. Rejected because **CAL-04 owns that read and its shape is already
constrained before it is designed**: the feature row requires `date_range=ov.` on the generated
column, an assertion of completeness or explicit paging against PostgREST's server-side cap, and a
return type that CAL-07's warn-once-versus-warn-per-day choice is settled by. Building it here would
fix those choices in a ticket that has no view to exercise them, and CAL-04 would inherit an API it
did not design or quietly replace one that already had callers. AC-14 does not need it: the team-read
policy is what this ticket ships, and a policy is observed with a second token in
`tests/permission-model.test.ts`, which is where a permission belongs.

**3. Hold INV-01 with a read-then-write overlap check in the seam, and use the constraint only as a
backstop.**

Attractive because it produces a better message with no SQLSTATE mapping, and because the form could
warn before submitting. Rejected because it is the specific failure `.ai/registry/invariants.md`
names under INV-01 — *"two tabs, two devices, or a retry"* — and because ADR-011 already refused it
on the ground that it reverses ADR-005. It survives here as an **affordance only**, and even that is
not built: the form does not pre-check, because a pre-check that is right 99% of the time trains
everybody to read its silence as permission.

## Changelog

- `2026-09-01T08:16:29+00:00` — sections 1 through 9 written. Sections 1 and 2 were written from
  `features.md`, `invariants.md`, the charter, the glossary and the idea file before the source tree
  was read, per the template's ordering note.
- `2026-09-01T08:16:29+00:00` — section 2 `Invariants touched` **widened from the feature row's
  three to five**, adding INV-02 and INV-03. Raised and amended by `tech-lead-design`, on reading
  ADR-016 and `data-model.md`: the feature row's own Notes say this ticket ships INV-03's check and
  INV-02's trigger, so both are plausibly affected by construction, and `invariants.md` warns that
  concluding an invariant is not engaged because the safest behaviour was chosen is circular. Not a
  registry edit — `invariants_touched` is a `ticket.yaml` field.
- `2026-09-01T08:16:29+00:00` — section 2 gained **AC-16**, which sections 1 and 2 did not originally
  carry. Raised and amended by `tech-lead-design` after reading `listMembers` in
  `src/lib/data/supabase.ts` and `ROSTER_LIMIT` in `src/lib/domain/types.ts`: without a read, **AC-1
  is unobservable** — *one entry and not five* cannot be seen if nothing lists entries — and without
  the completeness assertion the read has the silent failure mode ADM-04's Notes describe, pointing
  at *you have declared nothing*. Recorded here rather than absorbed, because an AC added at design
  time to fit what is easy to build is exactly the failure the SPEC/DESIGN split used to prevent, and
  this is now the only place that shows it.
- `2026-09-01T08:16:29+00:00` — `gate: BLOCKED` on **AC-17** only. Every other section is complete.
