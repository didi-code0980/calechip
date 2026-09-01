---
doc_version: 5
last_updated: 2026-08-31
governed_by: [RULE-01, RULE-04, RULE-09]
---

# Data model

This is where field names become real, which makes it the document RULE-04 depends on: the Developer
may not invent a field name, so every name has to exist here or in design section 1 first.

**Every name below is either in `.ai/registry/glossary.md` or was decided by the operator on
2026-08-31.** Names that would have required inventing are in `OPEN QUESTIONS` at the end rather than
in a table, because a plausible column name in this file is indistinguishable from a decided one.

## Entities

### `team`

One row in v1. The table exists anyway because INV-07 counts entries against a team, and the brief's
P2 list asks the model to leave room for more.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, pk | |
| `name` | text, not null | |
| `overload_threshold` | numeric, not null, default `0.5` | The *Threshold* in the glossary. A share, not a count. Configurable by an admin; not an invariant, precisely because it is configurable. |
| `created_at` | timestamptz, not null | |

### `member`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, pk, references `auth.users(id)` | **The member's id is the Supabase Auth user id.** Every policy is then `... = auth.uid()` with no lookup, which matters more than it looks: under ADR-005 a policy written loosely fails open, and the shortest correct policy is the one hardest to write wrongly. |
| `team_id` | uuid, not null, references `team(id)` | INV-07. |
| `display_name` | text, not null | |
| `avatar` | text, not null | The mascot or avatar at the head of each row (brief §8). The prototype stores an emoji. |
| `role` | `member_role`, not null, default `member` | Enum: `member`, `admin`. Rank order and the full permission table are in [rbac-and-security.md](rbac-and-security.md). |
| `removed_at` | timestamptz, null | Soft delete. Null means active. |
| `created_at` | timestamptz, not null | |

**A member cannot exist before their auth user does**, because the primary key *is* that user's id.
So "invite a member" is a Supabase Auth invitation, not a row this application inserts on its own —
see `OPEN QUESTIONS`.

**`removed_at` is what "current member count" means.** INV-04's denominator is the members of a team
with `removed_at is null`. Their entries stay, which is the operator's decision of 2026-08-31, and
the consequence is already recorded in the INV-04 note: removing somebody changes the absence count
for past dates.

### `entry`

The unit everything else counts, approves and displays.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, pk | |
| `member_id` | uuid, not null, references `member(id)` | INV-07. Exactly one member. |
| `type` | `entry_type`, not null | Enum: `pto`, `wfh`. A WFH member is working — the glossary calls this the most costly confusion in the domain. |
| `portion` | `entry_portion`, not null, default `full` | Enum: `full`, `am`, `pm`. **One portion for the whole range** (INV-06): a five-day `pm` entry is five afternoons. |
| `start_date` | date, not null | |
| `end_date` | date, not null | Equal to `start_date` for a single day. |
| `tentative` | boolean, not null, default `false` | Displayed to everyone, counted in every calculation (INV-05); it differs visually only. Independent of `status` — the glossary keeps them apart deliberately. |
| `status` | `entry_status`, not null, default `pending` | Enum: `pending`, `approved`, `rejected`. |
| `rejection_reason` | text, null | INV-03: not null and non-empty exactly when `status = 'rejected'`. |
| `note` | text, null | Free text, optional (brief §6). **Editing it alone does not revoke an approval** — INV-02. |
| `approved_by` | uuid, null, references `member(id)` | Operator decision, 2026-08-31. The only audit trail v1 has, and it matters more than usual because an admin may edit another member's entry with no other trace — known weakness 3 in [rbac-and-security.md](rbac-and-security.md). |
| `approved_at` | timestamptz, null | |
| `created_at` | timestamptz, not null | |
| `updated_at` | timestamptz, not null | |
| `date_range` | `daterange`, generated always … stored | [ADR-011](../registry/decisions/ADR-011-inv-01-exclusion-constraint.md). `daterange(start_date, end_date, '[]')` — the `'[]'` is required because `end_date` is inclusive. **Never written**, so the seam's insert and update types must exclude it. Stored canonicalised to `[)`. |
| `portion_slots` | `int4range`, generated always … stored | [ADR-011](../registry/decisions/ADR-011-inv-01-exclusion-constraint.md). The half-day slot range: `full` → `[0,2)`, `am` → `[0,1)`, `pm` → `[1,2)`. Exists so INV-01's constraint can intersect portions rather than compare them for equality. Never written. |

### `allowed_email`

The gate on membership, from [ADR-009](../registry/decisions/ADR-009-how-a-person-becomes-a-member.md).
An admin adds an address; the person signs themselves up; a trigger on `auth.users` creates the
`member` row only if the address is here, and marks the entry consumed.

| Field | Type | Notes |
|---|---|---|
| `email` | citext, pk | The address the person will sign up with. Case-insensitive, because an address that differs only in case is the same person and a case-sensitive gate silently refuses them. |
| `team_id` | uuid, not null, references `team(id)` | Which team they join. |
| `added_by` | uuid, not null, references `member(id)` | An admin. The only provenance for who let somebody in. |
| `added_at` | timestamptz, not null | |
| `consumed_at` | timestamptz, null | Set by the trigger when the `member` row is created. Null means the invitation is still open. |

**The table name is the one invented name in this file**, and it is the Tech Lead's to confirm at
PLAN — RULE-04 allows a name to exist here *or* in plan section 4. Everything else above comes
from ADR-009 or from the entities it joins.

**No elevated credential exists anywhere in this flow.** `inviteUserByEmail` was rejected precisely
because it lives on Supabase's admin surface and needs the service-role key, which under ADR-005 has
no server to live in. See ADR-009 for the verification.

### `holiday`

**System-wide, not per team**, and a row records the working status it forces on its date —
[ADR-015](../registry/decisions/ADR-015-the-holiday-calendar-is-national-and-carries-a-kind.md).

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, pk | |
| `date` | date, not null, **unique** | One row per date. This makes *the status of date D* a function rather than a query, which the bridge-day derivation depends on. **Cost:** a date carrying two observances gets one row and one `name`. |
| `name` | text, not null | The human label — *"Nghỉ bù 30/4"*, *"Làm bù 2/9"*. The label, not the effect; `kind` carries the effect. |
| `kind` | `holiday_kind`, not null, default `non_working` | Enum: `non_working`, `working`. **The values name the effect on the working calendar, not the Vietnamese label**, because three labels (`nghỉ lễ`, `nghỉ bù`, `làm bù`) collapse to two effects. A `làm bù` mandated Saturday is `working` — a weekend day that counts as a working day, the exact inverse of a holiday. |
| `created_at` | timestamptz, not null | |

**There is no `team_id`.** Vietnamese public holidays and the announced swap days are national;
`.ai/registry/glossary.md` says *"Holidays belong to the calendar, not to any member"*, and INV-07
constrains entries and the members they belong to rather than a row that has neither. The select
policy is therefore `using (true)` to `authenticated` — correct here and a leak anywhere else in this
model, because a holiday row carries no member, no team and no personal data. Writes are
`public.is_admin((select auth.uid()))`, per the *Add, edit or delete a holiday or swap day* row in
[rbac-and-security.md](rbac-and-security.md).

Maintained by admins, including the swap and compensatory days the government announces each year
(brief §7.5). **A row with `kind = 'working'` is a holiday that is not a holiday** — the naming is a
known smell, recorded in ADR-015; `calendar_day` was available and lost because `holiday` is the
glossary's word and the permission table's word.

**Bridge-day detection is therefore a three-input computation** — non-working overrides, working
overrides, and the weekend rule. Thursday a holiday, Friday working, Saturday a mandated `làm bù`
working day: Friday is **not** a bridge day, and a two-input computation reports one.

## What is deliberately not stored

Two of the most-used numbers in the product are computed on read and have no column.

- **The absence count** (INV-04). Derived from the day's `pending` and `approved` entries — 1 per
  `full`, 0.5 per `am` or `pm`, PTO and WFH alike, rejected excluded. It is a decimal, and there is
  exactly one implementation of it, inside the seam.
- **Bridge days.** Computed from the holiday calendar and the weekend. A bridge day is an ordinary
  working day; storing it would create a second thing to keep true.

An overloaded day is likewise a comparison performed on read, not a flag.

## Relationships

| From | To | Cardinality | On delete |
|---|---|---|---|
| `member` | `team` | many-to-one | **Refuse.** No delete path exists for a team in v1. |
| `entry` | `member` | many-to-one | **Refuse.** A member is soft-deleted, never removed, so this constraint should never fire — and if it ever does, it is protecting INV-07 and the refusal is the correct outcome. |
| `entry.approved_by` | `member` | many-to-one, nullable | **Refuse**, for the same reason. Nulling it would erase who approved. |
| `holiday` | `team` | **none** | No foreign key. The calendar is system-wide — [ADR-015](../registry/decisions/ADR-015-the-holiday-calendar-is-national-and-carries-a-kind.md). |

**There is no cascade anywhere in this model, and that is a decision rather than an omission.** A
cascade nobody chose is one the database performs silently, and the invariant it breaks is discovered
by its absence.

## Where invariants are held

Under ADR-005 there is no server, so application code is in the same position as a UI affordance: the
same write is reachable by any token holder. Every structural invariant is therefore held by the
database.

| Invariant | Held by |
|---|---|
| INV-01 — no overlapping entries for one member | An exclusion constraint over `member_id`, `date_range` and `portion_slots`, so that `am` and `pm` on one day do not collide while `full` collides with both — [ADR-011](../registry/decisions/ADR-011-inv-01-exclusion-constraint.md), which also records that a rejected entry still occupies its portion and that nothing yet requires `end_date >= start_date`. **This is the one a read-then-write check cannot hold**: two tabs, two devices or a retry defeat it, and only the database sees both writes. |
| INV-02 — an edit revokes approval | `public.entry_enforce_decision()`, a `before update` trigger firing when `start_date`, `end_date`, `type`, `portion` or `tentative` change, and **not** when only `note` changes. **It clears `approved_by` and `approved_at` as well as resetting `status`** — a `pending` entry still naming its approver is the false record INV-02 exists to prevent ([ADR-011](../registry/decisions/ADR-011-inv-01-exclusion-constraint.md), consequences). It is **actor-blind**: an admin's edit under CAL-03 revokes approval exactly as the owner's does. **A substantive edit to a `rejected` entry also returns it to `pending` and clears `rejection_reason`** — INV-02 is silent on that case, and ADR-011 makes it the likely one, since a rejected entry still occupies its portion so editing it is the member's only route ([ADR-016](../registry/decisions/ADR-016-entry-status-guard-is-a-trigger.md) §3). |
| Only an admin may decide an entry | **The same function**, and not a policy — [ADR-016](../registry/decisions/ADR-016-entry-status-guard-is-a-trigger.md). An RLS `with check` sees the NEW row and has no OLD, so *"`status` did not change"* is not expressible, and a member PATCHing `{"status":"approved"}` against their own row satisfies CAL-02's own-entry policy. A column `grant` cannot help either: `member` and `admin` are the same PostgreSQL role, `authenticated`. The guard runs **first**, on the values the client sent, before the INV-02 reset above touches them. **`approved_by` and `approved_at` are written by the database from `auth.uid()` and `now()` and are never trusted from the wire** — the only audit trail v1 has was otherwise forgeable by any admin. |
| INV-03 — a rejection carries a reason | A check constraint tying `rejection_reason` to `status = 'rejected'`, in both directions. |
| INV-04 — one definition of the absence count | A single function inside the seam. Application-level by nature: it is a computation rather than a state constraint, and nothing can store a wrong value because nothing stores it at all. |
| INV-05 — tentative counts | Follows from INV-04 having one implementation; `tentative` is not consulted by it. |
| INV-06 — one portion per entry | Column shape: a single not-null enum, so a per-day portion is unrepresentable. |
| INV-07 — one member, one team | Not-null foreign keys, and the refusals above. |

TODO(project): cite the migration file and the constraint name for each row once migrations exist. A
row here naming a mechanism that has not been written is a claim, and `.ai/registry/invariants.md`
warns specifically that an invariant claimed and not held is worse than one never claimed.

## Migrations

Applying a migration is human (RULE-09). Drafting one is design work; running one is not. A ticket
whose `schema_delta` is anything but `none` needs an approved ADR linked before it can pass Definition
of Ready.

Supabase CLI migrations, per [tech-stack.md](tech-stack.md).

TODO(verify): where migrations live and the one command that applies them. The Supabase CLI is on the
*past reliable recall* list in `tech-stack.md`, so read its own documentation rather than writing the
path and the command from memory.

TODO(project): add the migrations directory to `.github/CODEOWNERS` once it exists. That file's own
`TODO(project)` already says so, and under ADR-005 the migrations are the security surface.

## Seed data

**Two different things, and conflating them is how a correction gets reverted.**

- **Production data** — the several years of national holidays the operator decided are seeded up
  front — ships as a **data migration**, `insert ... on conflict (date) do nothing`. Not
  `supabase/seed.sql`, which runs under `supabase db reset` and never reaches the hosted project.
  `do nothing` rather than `do update` is the load-bearing part: it lets an admin's correction of a
  government announcement survive re-application, where `do update` would silently overwrite the one
  piece of knowledge in that table no seed could have supplied.
  [ADR-015](../registry/decisions/ADR-015-the-holiday-calendar-is-national-and-carries-a-kind.md).

- **The test-and-development seed** is `supabase/seed.sql`, and `src/lib/fixtures.ts` is the shared
  fixture module holding the same literals so the two cannot drift — established in
  `.ai/board/tickets/TEA-01/02-design.md`. A test fixture that exists only in one test file drifts
  from the seed and produces failures that reproduce in CI and not locally.
  `.ai/standards/testing-standards.md` carries the matching marker for the shared fixture module.

  **It holds a small synthetic set, never the real calendar**: one `non_working` holiday, one
  compensatory day off, one `working` Saturday, one day that is a bridge day under them, and one year
  with no rows. A test asserting *"30/4/2026 is a bridge day"* asserts a fact about the world that an
  admin may correctly change.

## OPEN QUESTIONS

Per the *no invention* rule in `CLAUDE.md`. Each of these needs a name or a decision that could not be
taken from the glossary, the invariants or the brief. **None is blocking a design that does not touch
it**, and each says what it does block.

1. ~~**Is the holiday calendar per team, or national?**~~ **Answered 2026-08-31 by
   [ADR-015](../registry/decisions/ADR-015-the-holiday-calendar-is-national-and-carries-a-kind.md):**
   national. **No `team_id` and no foreign key.** The file's own framing above was right — the
   holidays and the announced swap days are national — and `.ai/registry/glossary.md` says
   *"Holidays belong to the calendar, not to any member"*. INV-07 does **not** force a column: it
   constrains entries and the members they belong to, and a holiday is neither.

   A not-null `team_id` was recommended and rejected, on the argument that without one the write
   policy narrows to `is_admin(auth.uid())` and at P2 any admin of any team rewrites everybody's Tết.
   That cost is real and accepted. It lost on the seed — a national set with `team_id not null` must
   either hard-code the v1 team's uuid or fan out over `select id from team`, and a set that must be
   re-inserted whenever a team is created is a mechanism nobody has designed — and on the migration
   asymmetry, which runs the opposite way from the assumption that *"the cheap answer now is the
   expensive migration later"*: **absent → nullable overlay is purely additive**, while **not-null →
   shared needs a fan-out or a dedup across N teams**. The nullable option was refused separately
   because `unique (team_id, date)` does not compare NULLs equal, so two national rows for one date
   would be permitted unless `nulls not distinct` — PostgreSQL 15+, and the major behind the hosted
   project is still unverified.

2. ~~**Is the kind of holiday recorded, and what are the values called?**~~ **Answered 2026-08-31 by
   [ADR-015](../registry/decisions/ADR-015-the-holiday-calendar-is-national-and-carries-a-kind.md):**
   yes, as a column. `kind holiday_kind not null default 'non_working'`, an enum of exactly two
   values — **`non_working` and `working`**. Under RULE-04 those names are now real. They name the
   effect on the working calendar rather than the Vietnamese label, because `name` already carries
   the label and three labels collapse to two effects; a three-value enum would invite a third code
   path that can never differ from one of the other two. Item 2 said *"Blocks: nothing yet"* — that
   stopped being true with the first story touching bridge days, because a `làm bù` working Saturday
   is unrepresentable without it and its absence makes the derivation report bridge days that do not
   exist.

3. ~~**The generated range column for INV-01.**~~ **Answered 2026-08-31 by
   [ADR-011](../registry/decisions/ADR-011-inv-01-exclusion-constraint.md):** two stored generated
   columns, `date_range` (`daterange`, built with the `'[]'` constructor because `end_date` is
   inclusive) and `portion_slots` (`int4range`, `full` → `[0,2)`, `am` → `[0,1)`, `pm` → `[1,2)`),
   with `EXCLUDE USING gist (member_id WITH =, date_range WITH &&, portion_slots WITH &&)` and the
   `btree_gist` extension. The question as written above overstated the need — an exclusion
   constraint would accept a bare expression; what requires named columns is PostgREST, which filters
   on columns and not expressions (ADR-005). Note that PostgreSQL canonicalises a stored discrete
   range to `[)`, so a one-day entry reads back as `['2026-01-01','2026-01-02')`.

4. ~~**How a `member` row comes into existence.**~~ **Answered 2026-08-31 by
   [ADR-009](../registry/decisions/ADR-009-how-a-person-becomes-a-member.md):** an admin adds the
   address to `allowed_email`, the person signs themselves up on the ordinary client, and a trigger on
   `auth.users` creates the `member` row only if the address is allow-listed. There is no invitation
   email — the admin tells the person by whatever channel the team already uses, and a story must say
   so rather than implying one arrives.

5. **Does `updated_at` distinguish an edit by the owner from an edit by an admin?** An admin may edit
   another member's entry and v1 has no change feed, so `approved_by` is the only trace of anything.
   An `updated_by` column would be the cheapest way to close known weakness 3 without waiting for the
   P1 feed. *Blocks:* nothing; it is a decision about how much trace v1 keeps.
