---
doc_version: 1
last_updated: 2026-08-25
governed_by: [RULE-06, RULE-07, RULE-08, RULE-11, RULE-15]
---

# Metrics

Appended by `orchestrator` at `/ship`. One row per transition, never edited in place — a corrected
row is a new row with a note, because the history of how a ticket moved is the evidence for whether
the loop works.

**One writer: `/ship`.** Not one lane, one command — see *The one surface that still collides* in
`.ai/standards/session-model.md`. A ticket's transitions are recorded when it ships rather than when
it moves, which is what keeps two branches from appending to the same lines.

## Row schema

`| ts | ticket | from | to | agent | rework_count | tokens | wall_clock_s | notes |`

| ts | ticket | from | to | agent | rework_count | tokens | wall_clock_s | notes |
|----|--------|------|----|-------|--------------|--------|--------------|-------|

## Targets

These are the numbers the model is judged by, and one of them is a revert condition.

| Metric | Target | Read from |
|---|---|---|
| Amendment rate | 60% or above; **below 40% over ten consecutive tickets reverts ADR-001** | `resulted_in_amendment: true` in `consulted` blocks |
| Rework cycles per ticket | 1 or fewer | `rework_count` at DONE |
| Escalations | any is worth reading; a second on the same invariant is a modelling problem | rows whose `to` is `ESCALATED` |
| Chat budget pressure | a pair that repeatedly reaches 6 is negotiating, not clarifying | `chat_budget` in `ticket.yaml` |

## Escalations

One row per escalation, kept separately because they halt rather than queue.

| ts | ticket | invariant or check | decided by | outcome |
|----|--------|--------------------|------------|---------|

Empty because no ticket has run.
