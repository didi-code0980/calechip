---
doc_version: 3
last_updated: 2026-09-20
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
gate: PASS                 # PASS | FAIL | BLOCKED
blocking_reason: ""
next_state: DONE           # DONE on PASS | REWORK on a routed FAIL | ESCALATED on R7
verdict: PASS              # must equal `gate`. A disagreement voids the artifact
failed_checks: []          # e.g. [R1, R5]. Empty on PASS
invariant_violation: false # true only when R7 fails. RULE-07: escalates, never REWORK
route_to: none             # none | developer | tech-lead-design | human
increments_rework: false   # RULE-08: true only for a Developer-caused failure
---
```

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS / FAIL | `file:line` |
| R2 | typecheck exit 0 | PASS / FAIL | command output |
| R3 | lint exit 0 | PASS / FAIL | command output |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS / FAIL | `file:line` |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS / FAIL | `file:line` |
| R6 | Permission gating matches plan section 3 | PASS / FAIL | `file:line` |
| R7 | No invariant violated (RULE-07) | PASS / FAIL | `file:line` |
| R8 | No dependency added without an ADR | PASS / FAIL | `file:line` |

## R5 detail

One row per contract item from plan section 4, with where it is implemented. A summary sentence is
not this section.

| Contract item | Implemented at | Matches signature |
|---|---|---|

## R7 detail

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

**R7 does not route to REWORK.** Per RULE-07 it escalates to a human on first occurrence. If R7
fails, set `gate: FAIL`, `verdict: FAIL`, `invariant_violation: true`, `route_to: human`,
`increments_rework: false`, `next_state: ESCALATED`, and state the invariant ID in
`blocking_reason`.

## Verdict

`PASS` and the ticket advances to DONE, or `FAIL` with the routing above, or `BLOCKED` with a
reason.

There is no "pass with comments". A comment worth making is either a finding or is not part of this
gate.

## The routing front-matter is what the loop reads

`gate` and the checklist are for a person. **`invariant_violation` and `route_to` are what
`/advance` and `scripts/run-loop.mjs` route on**, and they never key on a check number — ADR-036.

Fill all five, every time, including on a PASS. Their correct combinations are exactly these:

| Outcome | `verdict` | `invariant_violation` | `route_to` | `increments_rework` | `next_state` |
|---|---|---|---|---|---|
| All eight pass | `PASS` | `false` | `none` | `false` | `DONE` |
| R1, R2, R3, R4, R8, or an implementable R5 | `FAIL` | `false` | `developer` | `true` | `REWORK` |
| R5 impossible as specified, or R6 | `FAIL` | `false` | `tech-lead-design` | `false` | `REWORK` |
| **R7 — any invariant violated** | `FAIL` | `true` | `human` | `false` | `ESCALATED` |
| Cannot review at all | `BLOCKED` | `false` | `human` | `false` | `ESCALATED` |

**Why a boolean and not the number.** The number drifted. From ADR-022 until ADR-036 this template
said R7 in its checklist and R8 in the section below it, and `.ai/registry/rules.md` mapped RULE-07
to R8 — so a reviewer who followed the heading wrote an invariant violation under a number the
routing table sends to `developer` with the rework counter incrementing. With a person reading the
verdict that was cosmetic. Unattended it is RULE-07 failing silently, which is the one failure the
rule exists to make impossible.
