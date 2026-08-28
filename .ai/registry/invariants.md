---
doc_version: 1
last_updated: 2026-08-25
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

## TODO(project): this file ships with no rows

An invariant is not a feature and not an acceptance criterion. The test is whether a violation means
**the data is wrong**, rather than that a user is inconvenienced. Write between five and fifteen; a
ledger of forty is a requirements document wearing the wrong name.

Seed them before the first `/spec`. `invariants_touched` on a ticket may legitimately be `[]`, but
only after somebody has a ledger to check it against.

## Ledger

| ID | Invariant |
|----|-----------|

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

TODO(project): one subsection per invariant that needs more than its one-line ledger row — typically
the ones held by a mechanism that is not obvious from the wording, the ones that reach other
invariants through a cascade the text does not mention, and the ones whose enforcement is weaker than
the sentence implies. An invariant whose enforcement has quietly lapsed is worse than one that was
never claimed, so record the weakness here rather than in a ticket.
