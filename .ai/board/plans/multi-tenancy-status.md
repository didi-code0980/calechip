---
doc_version: 1
last_updated: 2026-10-12
governed_by: [RULE-01, RULE-03]
---

# Multi-tenancy — MIR status index

**This file is the only place MIR status is updated.** A ticket's `ticket.yaml` carries the loop's
`state`; the plan status of a MIR item is the `Status` cell below and nowhere else.

Sources: [calechip-multi-tenancy-plan.md](calechip-multi-tenancy-plan.md) and
[multi-tenancy-audit-2026-10-12.md](../audits/multi-tenancy-audit-2026-10-12.md). Each item's detail,
with its audit `file:line` references, is in `.ai/board/tickets/MIR-nn/ticket.yaml` § `mir_detail`.
Predicted feature impact is in [feature-change-log.md](feature-change-log.md).

## The MIR family

One ID per plan item, MIR-01 onward, numbered in plan order, phase by phase.

- **An ID is permanent once assigned.** It appears in migration and test filenames, so it is never
  renumbered and never reused.
- **A cancelled item keeps its ID**, with status `WONTDO`.
- **The number does NOT imply execution order.** `Blocked by` is the only ordering.
- **New items are appended** with the next free number, never inserted.

**Filenames embed the ID the way the feature groups already do:**

| Kind | Existing example | MIR form |
|---|---|---|
| Migration | `supabase/migrations/20260922150000_cal11_cross_team_reads.sql` | `supabase/migrations/<YYYYMMDDHHMMSS>_mir07_<slug>.sql` |
| End-to-end spec | `tests/e2e/cal-12-team-picker.spec.ts` | `tests/e2e/mir-07-<slug>.spec.ts` |
| Unit test | `tests/cross-team-reads.test.ts` — no ID | named by topic, no ID |

The CI check `.github/scripts/check-mir-tracking.mjs` keys on `_mir[0-9]+_` and `mir-[0-9]+-` in a
changed path.

## Status values

`—` not started · `IN_PROGRESS` · `DONE` · `WONTDO`. Everything starts at `—`.

**`Verified` is required for every phase 0 and phase 3 item before it may be marked `DONE`.** It
states how the item was proven and against what — the real database, which environment, which test
or recorded check. **A passing mock test is not verification**: the audit found every current test
runs against a mock that is looser than SQL (audit §8). Until MIR-05 is `DONE` there are no SQL
tests, so a phase 0 verification is a manual check against the real database, recorded in the pull
request (plan:81).

## Index

| ID | Phase | Item | Status | Blocked by | Affects | Verified |
|---|---|---|---|---|---|---|
| MIR-01 | 0 | Rotate the service role and anon keys | — | — | none | required — not yet |
| MIR-02 | 0 | Member role, status and team writable only through bounded paths | — | — | TEA-10 CHANGED; TEA-04 CHANGED; TEA-09 CHANGED; TEA-11 CHANGED | required — not yet |
| MIR-03 | 0 | Bound `set_member_role`; gate promotion to admin; log role changes | — | — | TEA-08 SUPERSEDED; TEA-04 CHANGED; TEA-12 CHANGED | required — not yet |
| MIR-04 | 0 | Scope the member directory to the caller's teams; audit the invitee check | — | — | EVT-01 CHANGED | required — not yet |
| MIR-05 | 1 | Stand up pgTAP, locally and in CI | — | MIR-01, MIR-02, MIR-03, MIR-04 | none | not required |
| MIR-06 | 1 | Write the SQL isolation suite | — | MIR-01, MIR-02, MIR-03, MIR-04 | none | not required |
| MIR-07 | 1 | Align the mock with SQL; add a permission parity test | — | MIR-01, MIR-02, MIR-03, MIR-04 | none | not required |
| MIR-08 | 2 | Retire or regenerate `db.sql` | — | MIR-01, MIR-02, MIR-03, MIR-04 | none | not required |
| MIR-09 | 2 | Clean up known schema inconsistencies | — | MIR-01, MIR-02, MIR-03, MIR-04 | ADM-01 CHANGED; TEA-02 SUPERSEDED | not required |
| MIR-10 | 3 | Schema design for org and membership (approve before migrating) | — | MIR-01, MIR-02, MIR-03, MIR-04, MIR-05, MIR-06, MIR-07, MIR-08, MIR-09 | none | required — not yet |
| MIR-11 | 3 | Composite foreign keys as the isolation layer | — | MIR-01, MIR-02, MIR-03, MIR-04, MIR-05, MIR-06, MIR-07, MIR-08, MIR-09, MIR-10 | none | required — not yet |
| MIR-12 | 3 | Add and backfill `org_id`; backfill `membership` | — | MIR-01, MIR-02, MIR-03, MIR-04, MIR-05, MIR-06, MIR-07, MIR-08, MIR-09, MIR-10 | TEA-01 CHANGED; TEA-09 CHANGED; TEA-11 CHANGED; CAL-01 CHANGED; CAL-08 CHANGED; CAL-13 CHANGED; ADM-02 CHANGED; ADM-03 CHANGED; ADM-07 CHANGED; ADM-08 CHANGED; EVT-01 CHANGED; EVT-02 CHANGED; EVT-04 CHANGED; EVT-07 CHANGED | required — not yet |
| MIR-13 | 3 | Rewrite the policy layer against `membership` and `org_id` | — | MIR-01, MIR-02, MIR-03, MIR-04, MIR-05, MIR-06, MIR-07, MIR-08, MIR-09, MIR-10, MIR-12 | CAL-11 SUPERSEDED; TEA-11 SUPERSEDED; CAL-12 CHANGED; TEA-03 CHANGED; TEA-09 CHANGED; CAL-04 CHANGED; CAL-05 CHANGED; CAL-10 CHANGED; CAL-07 CHANGED; CAL-13 CHANGED; ADM-01 CHANGED; ADM-08 CHANGED; EVT-01 CHANGED | required — not yet |
| MIR-14 | 3 | Approval logic for multi-team members | — | MIR-01, MIR-02, MIR-03, MIR-04, MIR-05, MIR-06, MIR-07, MIR-08, MIR-09, MIR-10 | ADM-04 CHANGED; ADM-05 CHANGED; ADM-06 CHANGED; ADM-08 CHANGED; TEA-12 SUPERSEDED | required — not yet |
| MIR-15 | 3 | Org public special cases | — | MIR-01, MIR-02, MIR-03, MIR-04, MIR-05, MIR-06, MIR-07, MIR-08, MIR-09, MIR-10, MIR-18 | EVT-01 SUPERSEDED; EVT-02 CHANGED; EVT-04 CHANGED; ADM-03 SUPERSEDED | required — not yet |
| MIR-16 | 4 | Role split in the database | — | MIR-01, MIR-02, MIR-03, MIR-04, MIR-10, MIR-11, MIR-12, MIR-13, MIR-14, MIR-15, MIR-18, MIR-21 | TEA-12 SUPERSEDED; TEA-09 CHANGED; ADM-07 SUPERSEDED; TEA-04 CHANGED; TEA-08 CHANGED; ADM-03 CHANGED; ADM-05 CHANGED; EVT-01 CHANGED; EVT-02 CHANGED; EVT-06 CHANGED | not required |
| MIR-17 | 4 | Role split in the client | — | MIR-01, MIR-02, MIR-03, MIR-04, MIR-10, MIR-11, MIR-12, MIR-13, MIR-14, MIR-15, MIR-18, MIR-21 | UIE-09 CHANGED; TEA-06 CHANGED; TEA-11 CHANGED; TEA-09 CHANGED; ADM-01 CHANGED; ADM-03 CHANGED; ADM-04 CHANGED; ADM-07 CHANGED; CAL-03 CHANGED; CAL-12 CHANGED; EVT-01 CHANGED | not required |
| MIR-18 | 3 | System admin panel | — | MIR-01, MIR-02, MIR-03, MIR-04, MIR-05, MIR-06, MIR-07, MIR-08, MIR-09, MIR-10, MIR-12 | none | required — not yet |
| MIR-19 | 5 | Org-scoped routing | — | MIR-01, MIR-02, MIR-03, MIR-04, MIR-10, MIR-11, MIR-12, MIR-13, MIR-14, MIR-15, MIR-18, MIR-21 | UIE-02 CHANGED; UIE-09 CHANGED; CAL-04 CHANGED; CAL-05 CHANGED; CAL-10 CHANGED; CAL-12 CHANGED; TEA-05 CHANGED; EVT-05 CHANGED; EVT-06 CHANGED | not required |
| MIR-20 | 6 | Impersonation and audit log | — | MIR-01, MIR-02, MIR-03, MIR-04, MIR-10, MIR-11, MIR-12, MIR-13, MIR-14, MIR-15, MIR-18, MIR-21, MIR-16, MIR-17 | none | not required |
| MIR-21 | 3 | Drop `member.team_id` after every reader moves | — | MIR-01, MIR-02, MIR-03, MIR-04, MIR-05, MIR-06, MIR-07, MIR-08, MIR-09, MIR-10, MIR-12, MIR-13 | none | required — not yet |
| MIR-22 | 1 | A pgTAP test proves the database refuses a second membership on a personal team, whatever path attempts it | — | MIR-01, MIR-02, MIR-03, MIR-04, MIR-05, MIR-25 | none | not required |
| MIR-23 | 1 | A pgTAP test proves a solo user reads nothing outside their own personal team | — | MIR-01, MIR-02, MIR-03, MIR-04, MIR-05, MIR-13, MIR-25, MIR-26, MIR-28 | none | not required |
| MIR-24 | 1 | A pgTAP test proves the forced config of a personal team cannot be overridden through any path, including a security definer function | — | MIR-01, MIR-02, MIR-03, MIR-04, MIR-05, MIR-27 | none | not required |
| MIR-25 | 3 | `team.is_personal` exists, and the database holds a personal team to exactly one membership | — | MIR-01, MIR-02, MIR-03, MIR-04, MIR-05, MIR-06, MIR-07, MIR-08, MIR-09, MIR-10, MIR-12 | TEA-11 CHANGED | required — not yet |
| MIR-26 | 3 | A signup without an invitation creates a member in Org public, a personal team and one membership, in a single transaction | — | MIR-01, MIR-02, MIR-03, MIR-04, MIR-05, MIR-06, MIR-07, MIR-08, MIR-09, MIR-10, MIR-12, MIR-25, MIR-27, MIR-31 | TEA-01 CHANGED; TEA-02 SUPERSEDED; TEA-05 CHANGED; TEA-09 CHANGED | required — not yet |
| MIR-27 | 3 | A personal team's config is forced by the database — approval off, overload suppressed, notes self-only, roster hidden — and a solo user cannot create an event that invites others | — | MIR-01, MIR-02, MIR-03, MIR-04, MIR-05, MIR-06, MIR-07, MIR-08, MIR-09, MIR-10, MIR-12, MIR-25 | ADM-01 CHANGED; ADM-04 CHANGED; ADM-05 CHANGED; ADM-08 CHANGED; CAL-04 CHANGED; CAL-05 CHANGED; CAL-07 CHANGED; UIE-10 CHANGED; EVT-01 CHANGED; EVT-02 CHANGED | required — not yet |
| MIR-28 | 3 | A personal team is absent from the Org public team listing, and its owner from every member directory | — | MIR-01, MIR-02, MIR-03, MIR-04, MIR-05, MIR-06, MIR-07, MIR-08, MIR-09, MIR-10, MIR-12, MIR-15, MIR-25 | TEA-03 CHANGED; TEA-11 CHANGED; EVT-01 CHANGED | required — not yet |
| MIR-29 | 3 | One function moves a member and every dependent row to another org in a single transaction, in dependency order — Assumption: org-transfer model (a), not confirmed | — | MIR-01, MIR-02, MIR-03, MIR-04, MIR-05, MIR-06, MIR-07, MIR-08, MIR-09, MIR-10, MIR-11, MIR-12, MIR-25 | TEA-09 CHANGED; TEA-11 CHANGED | required — not yet |
| MIR-30 | 3 | `is_personal` is cleared when the owner creates or joins a real team inside Org public | — | MIR-01, MIR-02, MIR-03, MIR-04, MIR-05, MIR-06, MIR-07, MIR-08, MIR-09, MIR-10, MIR-12, MIR-25, MIR-27, MIR-28 | TEA-11 CHANGED | required — not yet |
| MIR-31 | 3 | Open signup is bounded — rate limiting, email verification, and a policy for inactive solo accounts | — | MIR-01, MIR-02, MIR-03, MIR-04, MIR-05, MIR-06, MIR-07, MIR-08, MIR-09, MIR-10 | TEA-01 CHANGED | required — not yet |
| MIR-32 | 4 | No code path assumes a team has a manager | — | MIR-01, MIR-02, MIR-03, MIR-04, MIR-10, MIR-11, MIR-12, MIR-13, MIR-14, MIR-15, MIR-18, MIR-21, MIR-16, MIR-17, MIR-25 | none | not required |
| MIR-33 | 5 | The personal space has a route of its own — alternatives proposed, not decided | — | MIR-01, MIR-02, MIR-03, MIR-04, MIR-10, MIR-11, MIR-12, MIR-13, MIR-14, MIR-15, MIR-18, MIR-21, MIR-19, MIR-25 | TEA-05 CHANGED; UIE-02 CHANGED; CAL-04 CHANGED; CAL-05 CHANGED; CAL-10 CHANGED | not required |
| MIR-34 | 5 | A personal space shows a reduced interface — no roster, no approval UI, no overload warning, one-person week, month and year views | — | MIR-01, MIR-02, MIR-03, MIR-04, MIR-10, MIR-11, MIR-12, MIR-13, MIR-14, MIR-15, MIR-18, MIR-21, MIR-16, MIR-17, MIR-27, MIR-28, MIR-33 | UIE-02 CHANGED; UIE-10 CHANGED; ADM-04 CHANGED; CAL-04 CHANGED; CAL-05 CHANGED; CAL-06 CHANGED; CAL-07 CHANGED; CAL-10 CHANGED | not required |

## How `Blocked by` was derived

Only from the plan's own dependency statements:

- **Phase 0 blocks everything** (plan:65), so MIR-01…MIR-04 block every later item.
- **Phase 1 blocks Phase 3 onward** (plan:105); **Phase 2 blocks Phase 3** (plan:140); **Phase 3
  depends on Phases 0, 1, 2** (plan:163).
- **Within Phase 3, P3-1 is "approve before any migration"** (plan:167), so every other phase 3 item
  waits for MIR-10.
- **Phase 4 depends on Phase 3** (plan:226).
- **Phase 5 "can run in parallel with Phase 4"** (plan:263). It is given Phase 4's predecessors.
  This is the one derived row; the plan states no dependency for Phase 5 directly.
- **Phase 6 depends on Phases 3 and 4** (plan:291).

**Decided by the operator on 2026-10-12**, on questions the plan left open:

- **MIR-06 does not wait for MIR-05** ("Không cần pgTAP").
- **MIR-12 → MIR-13 → MIR-21.** The plan's P3-3 drops `member.team_id` only after every reader moves
  to `membership` (MIR-13's work), while MIR-13 reads the rows MIR-12 backfills. The drop step was
  split out as MIR-21, appended with the next free number; the operator delegated the order.
- **The system panel comes forward.** MIR-18 (plan P4-3) moves to phase 3, after MIR-10 and MIR-12, and
  MIR-15 waits for it, because MIR-15 builds team transfer in the panel (plan:211, plan:317). Phase 4
  items wait for MIR-18 as part of Phase 3.
- **The sign-up queue is decided by `org_admin`** (MIR-16).

Not encoded: **MIR-02**'s pgTAP test depends on MIR-05; until then a manual check stands in (plan:81).

## Not numbered

The plan's *Deferred — decide later* table (plan:309-317) holds decisions, not work items: licence
expiry, over-cap after downgrade, member counting, per-team entry approval (rejected for now), and the
org-to-org transfer UI (whose Phase 3 need is MIR-15, built in MIR-18). A deferred decision that becomes work is
appended with the next free number.

## Solo-user items — MIR-22…MIR-34, appended 2026-10-20

From the plan's *Solo users* section (`calechip-multi-tenancy-plan.md:329-441`, items S-1…S-13), in
that order, numbered from the next free ID. Rows stay in ID order; the Phase column carries the phase.

**`Blocked by` for these rows follows the rules above, plus these item-to-item edges:**

- **Phase 1 tests are blocked by the Phase 3 items they test** — MIR-22 by MIR-25, MIR-23 by MIR-13,
  MIR-25, MIR-26 and MIR-28, MIR-24 by MIR-27 — as well as by MIR-05. They cannot run before the
  schema they assert exists. Phase does not imply order; `Blocked by` does.
- **MIR-25 (`is_personal`) blocks every other solo item.** It waits for MIR-10 and MIR-12, because it
  is a column on `team` constrained against `membership`.
- **MIR-26 (signup) waits for MIR-27 and MIR-31.** The team is born with its forced config, and open
  signup does not ship before its abuse controls (operator, 2026-10-20).
- **MIR-29 (user-level org transfer) waits for MIR-11**, whose composite keys fix the order rows move in.
- **MIR-32 (Phase 4)** takes Phase 4's predecessors plus MIR-16 and MIR-17, the code it verifies.
- **MIR-33 and MIR-34 (Phase 5)** take Phase 5's predecessors (MIR-19's row) plus the items they build
  on; MIR-34 also waits for MIR-16, MIR-17 (operator, 2026-10-20) and MIR-33.

**Decided by the operator on 2026-10-20:** an uninvited signup skips the admission queue (MIR-26,
`requires_adr: true` against ADR-033); the abuse surface is Phase 3 (MIR-31); the reduced interface is
Phase 5 (MIR-34); how a solo user is invited to an event is left open (plan Q1).

**MIR-29 rests on an unapproved assumption** — *Assumption: org-transfer model (a), not confirmed*
(plan:362-372). If model (b) is chosen, MIR-29 becomes `WONTDO` and its replacement is appended.

**Open questions** Q1–Q7 are in the plan (`calechip-multi-tenancy-plan.md:421-431`). Each ticket that
waits on one names it in `mir_detail`.

