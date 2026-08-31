---
doc_version: 1
last_updated: 2026-08-31
governed_by: [RULE-01, RULE-07, RULE-09]
---

# Domain invariants

These are the statements about the domain that must hold in every state the system can reach. They
are not requirements, not acceptance criteria, and not preferences. A requirement can be renegotiated
with a stakeholder; an invariant that stops holding means the data is wrong.

**This file is seeded once, at the start of a project, and is human-only from that moment.** RULE-01
applies to it and to everything else under `.ai/registry/**`. An agent that believes an invariant is
wrong, incomplete, or in conflict with a story stops with `gate: BLOCKED` and names the invariant in
`blocking_reason`. It does not edit this file, it does not author the ADR itself, and it does not
work around the invariant.

An invariant violation is not a bug to be reworked. Per RULE-07 it escalates to a human on first
occurrence and never enters REWORK, because the code being wrong and the model being wrong need
different people to decide what happens next.

## Status of this ledger — read before using it

**Seeded from `product_brief.md` (Draft v1) on 2026-08-31, and not yet confirmed by the operator.**

Every row below is something the brief states in words. Nothing here was inferred, generalised, or
filled in to reach a target count — the candidates that *would* have required inference are listed
further down without IDs, because issuing an ID to a guess is the one thing this file must never do.

Five rows is below the five-to-fifteen this file recommends. That is the honest yield of a draft
brief, not a shortfall to be padded. The ledger grows when the operator answers the open questions
below, and it grows one confirmed sentence at a time.

## Ledger

| ID | Invariant |
|----|-----------|
| INV-01 | No two entries belonging to the same member may overlap in time. |
| INV-02 | An approved entry whose dates, type, portion or tentative flag change returns to `pending`. |
| INV-03 | A rejected entry always carries a non-empty rejection reason. |
| INV-04 | The absence count for a date is the sum over that date's entries of 1 per `full` portion and 0.5 per `am` or `pm` portion, with PTO and WFH counted alike. No second definition of this number exists anywhere in the system. |
| INV-05 | A tentative entry counts toward the absence count exactly as a non-tentative one does. |

## Unissued IDs

An ID listed here was considered and deliberately never issued. It is valid to **cite** — a document
explaining why a number is missing has to be able to name it — and never valid to **use**: it must
not appear in a ledger row, a design, or `invariants_touched`.

| ID | Status |
|----|--------|

IDs are stable references cited from `02-design.md`, `04-review.md`, and `ticket.yaml`. They are
never renumbered and never reused.

This section exists so a later reader does not conclude a row went missing. Check D2 in
`scripts/check-docs.mjs` reads this section as its source of legitimately-unissued IDs, so prose
explaining the gap does not fail the audit.

## How to use this file

**In a story.** The BA populates `invariants_touched` in `ticket.yaml` with the IDs a change could
plausibly affect. Empty is a legitimate answer and must be written as `[]`; absent is not.

The list records what the change **could** affect, not what survives the mitigation. Choosing the
safest behaviour and then concluding no invariant is engaged is circular reasoning: the fact that the
behaviour had to be chosen is the evidence that the invariant was in play. Follow indirect chains —
an invariant reached through a cascade is still reached.

**In a design.** The Tech Lead states, per listed ID, which mechanism holds it: a database
constraint, a check inside the data seam, or a UI affordance that makes the violating action
unreachable. A UI affordance alone is never sufficient for an invariant.

**In a review.** Check R8 requires the reviewer to reason through each ID in `invariants_touched`
individually and cite where it is held. "No invariants affected" without that reasoning is a failed
check, not a pass.

## Notes on individual invariants

### INV-01 — overlap

Source: brief 7.2, *"Không tạo được đăng ký chồng lấn với đăng ký khác của cùng người."*

**Overlap is not yet fully defined, and the gap is in the half-day case.** Two entries on the same
date where one is `am` and the other is `pm` do not overlap in any meaningful sense, and the brief
does not say so. Until that is settled, an implementation that compares date ranges alone will refuse
a legitimate pair, and one that ignores portion will accept a genuine double-booking.

**A UI affordance is not sufficient here.** This one wants a constraint that holds against concurrent
writes: two tabs, two devices, or a retry. A check that reads then writes without a guard is the
classic way this invariant is claimed and not held.

### INV-02 — approval does not survive an edit

Source: brief 7.2, *"Đăng ký đã duyệt mà bị sửa → tự động quay về trạng thái chờ duyệt."*

The reason this is an invariant rather than a workflow preference: an entry displaying ⭐ approved for
content that no admin ever saw is a **false record**, and the whole team reads that star as "this one
is certain". The data is wrong, not merely stale.

The brief does not say whether editing the free-text note alone re-triggers this. Listed as an open
question below; until answered, treat the note as **not** part of the trigger, because reverting an
approval over a typo trains people to stop annotating.

### INV-04 — one definition of the absence count

Source: brief section 6, *"tổng số người `PTO + WFH` vượt 50% quân số team. Nửa ngày tính 0.5."*

The invariant is the **uniqueness** of the definition, not the formula. The number appears in at
least four places — the live warning while choosing dates, the day cell in the month view, the year
grid, and any future notification — and the failure mode is that one of them is computed slightly
differently and quietly disagrees with the others. Where the number is computed is an architecture
decision; that there is exactly one computation of it is a domain one.

The threshold itself is **not** part of this invariant. It is configurable, and a configurable value
cannot be an invariant.

### INV-05 — tentative still counts

Source: brief section 6, *"Vẫn hiển thị đầy đủ cho cả team, vẫn tính vào cảnh báo."*

This is load-bearing for the product's central mechanism. Tentative exists so people dare to declare
four months ahead; if a tentative entry stopped counting, early declarations would be invisible to
the warning that early declaration was invented to feed, and the feature would defeat itself.

## Candidates not issued, pending the operator's word

**These are deliberately unnumbered.** Each is invariant-shaped and each requires a decision the
brief does not contain. Answering one is what turns it into a row; guessing would put a fabricated
constraint in front of every future agent as though it were established.

1. **Does an entry belong to exactly one member and exactly one team?** Structurally near-certain,
   but never stated. It matters now rather than later because the brief defers multi-team to P2 while
   asking the data model to leave room for it.

2. **Are rejected entries excluded from the absence count?** The brief is silent. Pending and
   approved entries clearly count; if rejected ones also counted, a day could read as overloaded
   because of plans that were refused.

3. **Which team size does the threshold use?** *"50% quân số team"* — the size at the moment of
   calculation, or at the date being calculated? They differ the first time someone joins or leaves,
   and the difference silently rewrites the past.

4. **May a multi-day entry carry a half-day portion?** The brief allows both a run of consecutive
   days and a half-day portion, and never says whether they combine. The prototype in `_figma/` only
   ever puts a portion on a single-day entry. This changes the schema, so it cannot be deferred past
   design.

5. **Does editing only the free-text note revoke an approval?** See the INV-02 note.

## Considered and rejected as an invariant

**"A contiguous range declared in one action is one entry, not one per day."** Brief 7.2 states it,
and it did not earn a row. Five records describing a five-day absence still describe reality
correctly — the data is not wrong, the user is inconvenienced, and editing the plan costs five
operations instead of one. That is an acceptance criterion for the entry-creation feature, and it
belongs in a story rather than here. Recorded so nobody re-derives it and reaches the other answer.
