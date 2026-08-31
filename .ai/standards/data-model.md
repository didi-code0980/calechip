---
doc_version: 2
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

### `holiday`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, pk | |
| `date` | date, not null | |
| `name` | text, not null | |
| `created_at` | timestamptz, not null | |

Maintained by admins, including the swap and compensatory days the government announces each year
(brief §7.5). Whether this calendar is per-team or national, and whether the kind of day is recorded,
are both in `OPEN QUESTIONS`.

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
| `holiday` | `team` | — | See `OPEN QUESTIONS`. |

**There is no cascade anywhere in this model, and that is a decision rather than an omission.** A
cascade nobody chose is one the database performs silently, and the invariant it breaks is discovered
by its absence.

## Where invariants are held

Under ADR-005 there is no server, so application code is in the same position as a UI affordance: the
same write is reachable by any token holder. Every structural invariant is therefore held by the
database.

| Invariant | Held by |
|---|---|
| INV-01 — no overlapping entries for one member | An exclusion constraint over `member_id`, the date range, and `portion`, so that `am` and `pm` on one day do not collide while `full` collides with both. **This is the one a read-then-write check cannot hold**: two tabs, two devices or a retry defeat it, and only the database sees both writes. |
| INV-02 — an edit revokes approval | A trigger on update, firing when `start_date`, `end_date`, `type`, `portion` or `tentative` change, and **not** when only `note` changes. |
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

TODO(project): where the seed lives, and the rule that tests share it. A test fixture that exists only
in one test file drifts from the seed and produces failures that reproduce in CI and not locally.
`.ai/standards/testing-standards.md` carries the matching marker for the shared fixture module; fill
both together or they will name different things.

## OPEN QUESTIONS

Per the *no invention* rule in `CLAUDE.md`. Each of these needs a name or a decision that could not be
taken from the glossary, the invariants or the brief. **None is blocking a design that does not touch
it**, and each says what it does block.

1. **Is the holiday calendar per team, or national?** Vietnamese public holidays are national, and so
   are the announced swap days — which argues for one calendar with no `team_id`. But the brief makes
   an admin maintain it, and P2 wants several teams in one workspace, where "who owns the calendar"
   stops being obvious. *Blocks:* the first story touching holidays, and the `holiday` foreign key.

2. **Is the kind of holiday recorded, and what are the values called?** The brief distinguishes the
   fixed annual calendar from compensatory and swap days announced each year. Whether that difference
   is a column or only a display detail was not decided, and the value names would be invented.
   *Blocks:* nothing yet; the calendar works without it.

3. **The generated range column for INV-01.** A PostgreSQL exclusion constraint needs a range to
   operate on, so `start_date` and `end_date` need a generated `daterange` beside them. The column's
   name is a choice nobody has made. *Blocks:* the migration that creates INV-01's constraint.

4. **How a `member` row comes into existence.** Its primary key is `auth.users(id)`, so the row cannot
   precede the auth user. That makes "invite a member" a Supabase Auth invitation, and leaves open
   whether the `member` row is created by a trigger on `auth.users`, on first sign-in, or by an admin
   completing a profile afterwards. *Blocks:* the first story touching team management.

5. **Does `updated_at` distinguish an edit by the owner from an edit by an admin?** An admin may edit
   another member's entry and v1 has no change feed, so `approved_by` is the only trace of anything.
   An `updated_by` column would be the cheapest way to close known weakness 3 without waiting for the
   P1 feed. *Blocks:* nothing; it is a decision about how much trace v1 keeps.
