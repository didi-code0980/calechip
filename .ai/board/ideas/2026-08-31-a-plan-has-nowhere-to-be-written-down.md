---
stage: IDEA
agent: product
produced_at: 2026-08-31
inputs_read:
  - product_brief.md
  - .ai/00-charter.md
  - .ai/registry/invariants.md
  - .ai/registry/features.md
  - .ai/standards/data-model.md
  - .ai/01-operating-model.md
consulted: []
gate: PASS
blocking_reason: ""
next_state: TRIAGE
---

# A plan has nowhere to be written down where the team can see it

## Problem

A person who knows they will be away — a trip booked four months out, a Friday working from home, an
afternoon at the clinic — has no place to put that fact where their team can find it. It goes into a
chat thread that scrolls away, into their own head, or into an HR request submitted so late that
nothing about the team's work can be rearranged around it.

The brief writes this as requirement 7.2 (*"tạo và sửa đăng ký"*), which is already a solution. The
problem underneath it is narrower and worth stating on its own: **there is no durable, shared,
editable record of an intention to be absent.** Durable matters because chat is not; shared matters
because a private note coordinates nothing; and editable matters most of all, because a plan that
cannot be changed is a plan nobody will enter four months early.

## Who has it

- **Every member**, several times a year — each trip, each recurring work-from-home day, each
  half-day appointment — and again every time one of those changes.
- **The same member, editing**, which is the case the current arrangement handles worst: a chat
  message announcing leave cannot be corrected, only contradicted further down the thread.

## Evidence

- The brief's problem section: personal travel is booked three to six months ahead while the team
  finds out at the last minute. The gap is not knowledge, it is that there is nowhere to put it.
- **Four invariants describe an entity that does not exist yet** — INV-01 (no overlap for one
  member), INV-02 (an edit revokes approval), INV-06 (one portion per entry), INV-07 (one member, one
  team). The domain model was written; the surface that produces the data was not.
- `.ai/standards/data-model.md` already fixes the entry's shape, including `portion` as a single
  enum and the trigger that implements INV-02. It is a schema waiting for a way to fill it.
- The brief's own success measure — more than 80% of members having entered at least one entry within
  two to four weeks — is a measure of exactly this and nothing else.

## Impact if ignored

Every other part of the product has no data. The calendar renders an empty grid, the overload warning
has nothing to count, and approval has nothing to approve.

And the specific consequence the brief names continues: somebody books a flight, tells nobody in a
place that persists, and the conversation happens the week before — *"em đặt vé rồi anh ơi"* — when
the only remaining options are bad for someone.

## Constraints already known

- **INV-01** — two entries of the same member may not cover the same portion of the same date.
  `.ai/standards/data-model.md` holds this with a database exclusion constraint, and records why a
  check in application code cannot: two tabs, two devices, or a retry.
- **INV-02** — an approved entry whose dates, type, portion or tentative flag change returns to
  pending; editing only the note does not.
- **INV-06** — an entry carries exactly one portion for its whole range. **A five-day `pm` entry is
  five afternoons, not a half-day at one end.** The realistic shape of a trip — leaving Wednesday
  afternoon, back Monday morning — is therefore up to three entries, and that cost was accepted
  deliberately. Anything that tries to express it as one entry is a schema migration and an ADR, not
  a story.
- **INV-05** — a tentative entry counts toward the absence count exactly as a settled one does. The
  tentative flag is a visual and social affordance, never an exemption.
- **`.ai/00-charter.md` Roles** — a member creates, edits and deletes their **own** entries; an admin
  may do the same to anyone's, which the charter amended on 2026-08-31 and whose cost is recorded as
  a known weakness in `.ai/standards/rbac-and-security.md`: until the change feed exists, an admin's
  edit is indistinguishable from the member's own.
- **A contiguous range declared in one action is one entry, not one per day.** The brief states this;
  `.ai/registry/invariants.md` records it as **considered and rejected as an invariant** and says it
  belongs in a story as an acceptance criterion. It is a constraint on this idea, from the registry,
  and it is not an invariant — a distinction worth carrying forward so nobody re-derives it.
- The brief's target of under fifteen seconds to record a range is a goal, not a criterion, and this
  idea does not turn it into one.

## Out of scope

- **Recurring declarations** — *"every Friday I work from home"*, set once for a quarter. P1 in the
  brief, and it changes what an entry is, so it does not get smuggled in here.
- **The approval workflow.** A separate idea. This one produces entries; it does not judge them.
- **The overload warning shown while choosing dates.** A separate idea, and the one that gives this
  one its point.
- **The change feed** of who registered or cancelled what. P1.
- **Leave quota, balances, or any HR consequence.** Charter refusals 1 and 2.
- **Group or joint declarations.** Charter refusal 4 — everyone registers independently.

## Open questions

1. **May a member create or edit an entry for a date in the past?** Nothing in the brief or the
   registry says. Forbidding it protects the historical record; allowing it lets somebody record the
   day they were actually out. Both are defensible and the answer changes the interface.
2. **What happens when an approved entry is deleted rather than edited?** INV-02 covers the edit
   path. Deletion removes the record entirely, and v1 has no notification channel, so an admin who
   approved something has no way to learn it is gone.
3. **May an admin create an entry on behalf of another member?** Recorded in
   `.ai/standards/rbac-and-security.md` as **denied by default rather than by decision** — nobody has
   ruled on it, and the default was chosen because a wrong denial is cheaper than a wrong permission.
4. **Is the note free text with no length limit, and is it visible to the whole team?** The brief says
   free and optional; it does not say who reads it, and the charter's transparency principle implies
   everyone, which is worth confirming before somebody writes a medical reason into it.
