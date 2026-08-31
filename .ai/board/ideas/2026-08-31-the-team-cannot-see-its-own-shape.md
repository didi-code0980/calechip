---
stage: IDEA
agent: product
produced_at: 2026-08-31
inputs_read:
  - product_brief.md
  - .ai/00-charter.md
  - .ai/registry/invariants.md
  - .ai/registry/features.md
  - .ai/standards/ui-design-system.md
  - .ai/01-operating-model.md
consulted: []
gate: PASS
blocking_reason: ""
next_state: TRIAGE
---

# The team cannot see its own shape at the time-scale the question is being asked at

## Problem

Three different questions get asked about absence, at three different distances, and none of them can
be answered today without reading a chat history:

- **"Who is out this week, and for how much of each day?"** — asked while handing work over.
- **"What does next month look like?"** — asked before agreeing to a date with anyone.
- **"Where are the clusters this year, and who is away a lot?"** — asked once a quarter, by the
  person planning around them.

They are the same data at three resolutions, and a single view answers at most one of them well. A
week view cannot show a cluster in October. A year grid cannot show that Minh is out only in the
afternoon.

The brief writes this as requirement 7.1, a table of three views. The problem it answers is that
**the information exists in the team but has no shape**, so the question is answered by asking people.

## Who has it

- **The lead**, weekly at minimum and before every commitment involving a date. The brief's own target
  is that they answer *"what does next month look like?"* in under ten seconds; today it is a
  conversation.
- **Every member**, each time they consider a date for themselves — which is the moment when seeing
  the cluster is worth something, because the plan is not yet booked.

## Evidence

- Brief goal 3, stated as a time: under ten seconds for the month-ahead question.
- Brief 7.1 gives three named views with distinct users, which is unusually specific for a draft and
  indicates the three questions were observed rather than imagined.
- Brief 7.1's own acceptance note that the year view must stay smooth at thirty people tells us the
  long-range view is expected to be used, not decorative.
- **The charter makes visibility the mechanism, not a permission**: *"a plan nobody can see
  coordinates nothing"*, and every member reads every other member's entries in full. A product
  built on that principle currently has no surface that delivers it.
- INV-05 exists specifically so that a tentative plan is visible and counted. Without a view, it is
  neither.

## Impact if ignored

Entries get recorded and never read, which is worse than not recording them: the team believes the
information is shared while the coordination still happens in chat. The brief's failure signal —
entry rate falling below 50% after the first month — arrives quickly, because nobody keeps feeding a
board they never look at.

The bridge-day pile-up specifically continues, because it is a *pattern across people* and no single
person's entry reveals it.

## Constraints already known

- **`.ai/00-charter.md`** — everyone sees everyone, in full. There is no per-view privacy setting to
  design and no filtered variant for members.
- **INV-04** — any count of people absent on a date that appears in any view is the one definition,
  including half-days at 0.5 and PTO and WFH counted alike. A view that computes its own number is
  the failure this invariant exists to prevent, and the brief expects the number in at least three
  places.
- **INV-05** — tentative entries appear and count. They are distinguished visually only.
- **`.ai/standards/ui-design-system.md`** and `CLAUDE.md`'s visual direction: the calendar grid is the
  most-used screen and **information density wins there every time**. The pastel treatment, the
  dashed border for tentative, the star for approved, and the Vui/Gọn density toggle are already
  specified there — this idea does not re-decide them.
- **INV-07** — a view is drawn for one team's members. v1 has one team; the query is still scoped.

## Out of scope

- **Read-only calendar subscription (iCal) and export to CSV or Excel.** Both P1, both a different
  problem: taking the data somewhere else rather than seeing it here.
- **The weekly digest posted to Slack, Teams or Zalo.** P1.
- **The overload warning raised while choosing a date.** A separate idea. Marking a day that is
  already overloaded is part of this one; interrupting someone mid-choice is not.
- **Year-end recap.** P2.
- **Any filtering by role, project or constraint.** P2.

## Open questions

1. **Does switching views hold the date the user was looking at?** The brief lists this as an
   acceptance criterion for 7.1. It is recorded here as an open question only because it implies
   shared time-anchor state across three surfaces, which is a design consequence rather than a
   preference — naming it now stops it appearing during DESIGN.
2. **Does a removed member still occupy a row in the year view for the part of the year they were
   present?** Their entries stay (operator decision, 2026-08-31), so the data is there; whether the
   roster shows them is undecided, and the year view is one row per person.
3. **Which view opens by default, and is it the same for both roles?** The brief calls the month view
   the default; it does not say whether a lead opening the product wants the same thing.
4. **How far back and forward can a person navigate?** The product is about the future, but the
   success measures compare quarters, which implies looking backwards.
