---
stage: IDEA
agent: product
produced_at: 2026-08-31
inputs_read:
  - product_brief.md
  - .ai/00-charter.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/features.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/data-model.md
consulted: []
gate: PASS
blocking_reason: ""
next_state: TRIAGE
---

# Nothing distinguishes a plan somebody typed from one the lead has actually accepted

## Problem

Every declaration on the board looks equally solid. A colleague reading the calendar cannot tell the
difference between a date somebody entered five minutes ago and one the lead has seen, weighed
against everything else that week, and accepted. So the reader plans around all of it, or around none
of it, and both are wrong.

From the other side: **an admin has no way to say "yes, this one is settled"** and no worklist of
what is waiting for them. Nothing accumulates, nothing is visibly outstanding, and the review happens
— if it happens — by scrolling the calendar looking for things that look new.

And when the answer is no, there is no way for the refusal to carry the one thing that makes it
actionable: the reason.

The brief writes this as requirement 7.4 with a gold star. The problem underneath is **the absence of
a confidence signal**: the board carries intentions of wildly different firmness and renders them
identically.

## Who has it

- **An admin**, whenever entries arrive — bursty, concentrated before holiday clusters, and today
  entirely invisible to them until they go looking.
- **Every member reading the calendar**, each time they plan around somebody else's absence. This is
  the larger group and the one the brief cares about: the star exists so others can *"yên tâm né"*.
- **The member who was refused**, once per refusal, needing to know why so they can propose something
  else.

## Evidence

- Brief section 6 states the meaning explicitly — the star is the signal *"cái này chắc chắn rồi"* —
  and gives it a second purpose: a light incentive to declare early.
- **INV-02 and INV-03 exist today with no surface.** INV-02 says an approved entry returns to pending
  when its substance changes, and `.ai/standards/data-model.md` already specifies the trigger that
  enforces it. INV-03 says a rejected entry always carries a non-empty reason. Both were written for a
  feature that does not exist.
- The charter's Roles table was **amended on 2026-08-31** to settle four admin powers, two of which
  are inside this idea: an admin may approve their own entry, and an admin may edit or delete any
  member's entry.
- `.ai/standards/data-model.md` records `approved_by` and `approved_at` as **the only audit trail v1
  has** — a decision made because an admin can change another member's entry with no other trace.
- The brief's own late success measure is the share of tentative entries that later become approved,
  which only means something if approval exists.

## Impact if ignored

The board's central social mechanism does not work. Tentative entries were invented so people dare to
declare four months out; the approval star is the other half of that bargain — the thing that
eventually converts a maybe into something the team can rely on. Without it, everything on the
calendar stays a maybe forever, and a calendar of maybes is planned around by nobody.

Concretely: a lead who wants to intervene on a crowded day has no lever except a chat message, which
is the arrangement the product was built to replace.

## Constraints already known

- **INV-02** — an approved entry whose dates, type, portion or tentative flag change returns to
  pending; editing only the note does not. So the star is not permanent, and this idea must not build
  an interface that assumes it is.
- **INV-03** — a rejected entry always carries a non-empty rejection reason. This is a hard
  constraint on any bulk-rejection interface, which is the interesting collision inside 7.4.
- **INV-05** — tentative and approval are two independent axes. An admin may approve an entry that is
  still tagged tentative, and doing so does not clear the tag.
- **`.ai/00-charter.md`** — an admin may approve their own entry (operator decision, 2026-08-31).
  Recorded there and in `.ai/standards/rbac-and-security.md` with the consequence stated: the star on
  an admin's own entry means "an admin said so", where that admin is themselves.
- **Charter refusal 2** — an approval here is a team-coordination signal, **not an employment
  decision** and not a substitute for the HR request. Whatever this becomes must not read like an
  HR approval, because people will treat it as one if it looks like one.
- **`.ai/standards/rbac-and-security.md`** — fifteen actions, both directions, with the denials
  written down. The permission model is settled; this idea consumes it rather than deciding it.

## Out of scope

- **Telling the member anything.** v1 has no notification channel. Reminders and chat integration are
  P1, and this idea must not quietly acquire an email sender.
- **The change feed** of who registered, edited or cancelled what. P1, and the thing that would fix
  the admin-edit blind spot — it is named here as a known gap, not built here.
- **Any HR consequence**, quota deduction, or forwarding to an official leave request. Charter
  refusals 1 and 2.
- **Escalation, delegation or multi-step approval.** Two roles only, per the charter.
- **Blocking a save because a day is crowded.** Charter refusal 6, and a different idea entirely.

## Open questions

1. **How does a rejection reason reach the person it is about?** INV-03 guarantees it exists on the
   record. With no notification channel in v1, the member only sees it if they come back and look —
   which makes the reason satisfied as data and useless as communication. This is the sharpest
   question in this idea.
2. ~~**How does bulk rejection satisfy INV-03?**~~ **Answered by the operator, 2026-08-31: one
   reason is typed for the batch and written onto every entry in it.** INV-03 is satisfied per
   entry — each rejected record still carries its own non-empty reason — and bulk rejection stays
   faster than rejecting one at a time, which is the only thing that makes it worth building. An
   admin may then edit an individual reason afterwards. What remains open is whether the per-entry
   edit is in v1 or later.
3. **Does a work-from-home entry need approval at all?** WFH reduces office presence without reducing
   capacity, which the glossary treats as the load-bearing distinction between the two types. Sending
   both down the same approval path may be right, but it has not been decided.
4. **Can an approval be withdrawn by an admin without editing the entry?** INV-02 covers approval
   lost through an edit. Deliberate un-approval is not mentioned anywhere.
5. **Is there any state between pending and a decision for an entry whose date has already passed?**
   Nothing says what happens to a pending entry nobody ever looked at, and those will accumulate.
