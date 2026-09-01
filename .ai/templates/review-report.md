---
doc_version: 1
last_updated: 2026-09-01
governed_by: [RULE-02, RULE-03, RULE-04, RULE-07, RULE-08, RULE-12, RULE-13, RULE-16]
---

# Template: review report

Written by `tech-lead-review` as `04-review.md`. Copy everything below the line.

**Isolated dispatch.** RULE-13: fresh context, files only, no message channel. You did not talk to
the Developer and you will not. `chat_before_verdict` must be `none`; if it cannot truthfully be, the
review is void and the stage re-runs in a clean session.

**Every check cites `file:line`. An item with no citation counts as failed.**

---

```yaml
---
ticket: <ID>
stage: REVIEW
agent: tech-lead-review
produced_at: <ISO8601>
inputs_read: [ .ai/board/tickets/<ID>/01-plan.md, .ai/board/tickets/<ID>/03-impl-log.md ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: QA
---
```

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS / FAIL | `file:line` |
| R2 | typecheck exit 0 | PASS / FAIL | command output |
| R3 | lint exit 0 | PASS / FAIL | command output |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS / FAIL | `file:line` |
| R5 | Every contract item in design section 1 is implemented (RULE-04) | PASS / FAIL | `file:line` |
| R6 | Permission gating matches design section 2 | PASS / FAIL | `file:line` |
| R7 | Every selector in design section 6 exists in the markup | PASS / FAIL | `file:line` |
| R8 | No invariant violated (RULE-07) | PASS / FAIL | `file:line` |
| R9 | No dependency added without an ADR | PASS / FAIL | `file:line` |

## R5 detail

One row per contract item from design section 1, with where it is implemented. A summary sentence is
not this section.

| Contract item | Implemented at | Matches signature |
|---|---|---|

## R8 detail

**One row per ID in `invariants_touched`.** Reason through each individually and cite the line that
holds it. "No invariants affected" without per-ID reasoning is a failed check, not a pass.

| Invariant | Held by | Citation |
|---|---|---|

An invariant that is held only by a UI affordance is not held.

## Findings

For each failure: what is wrong, where, and which routing row it falls under.

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|

Routing is from the failure routing table in `.ai/01-operating-model.md`. Per RULE-08 only
Developer-caused failures increment the count; an R7 failure is a design defect and must not be
charged to the Developer.

**R8 does not route to REWORK.** Per RULE-07 it escalates to a human on first occurrence. If R8
fails, set `gate: FAIL`, `next_state: ESCALATED`, and state the invariant ID in `blocking_reason`.

## Verdict

`PASS` and the ticket advances to QA, or `FAIL` with the routing above, or `BLOCKED` with a reason.

There is no "pass with comments". A comment worth making is either a finding or is not part of this
gate.
