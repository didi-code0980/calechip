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
| 2026-08-31T09:23:25Z | TEA-01 | BACKLOG | SPEC | ba | 0 | — | — | Second revision. The first (09:05:34Z) was routed back by the DESIGN gate; this one carved out the sign-in half, moved AC-6 to it and added AC-13. Not rework (RULE-08). |
| 2026-08-31T09:23:25Z | TEA-01 | SPEC | READY | orchestrator | 0 | — | — | Full DoR, six of six. `size_estimate` M. |
| 2026-08-31T09:34:46Z | TEA-01 | READY | DESIGN | tech-lead-design | 0 | — | — | `size` M against estimate M, twelve files. First design pass (of 09:34:46Z scope) had verdict L and routed back to SPEC; amended twice, 15:24:54Z and 15:35:07Z. |
| 2026-08-31T15:45:55Z | TEA-01 | DESIGN | IN_PROGRESS | developer | 0 | — | — | Ten files. One QA failure routed here at 15:18:06Z and was fixed; per RULE-08 it is the only one that could have incremented, and the routing table put it on `tech-lead-design` instead. |
| 2026-08-31T15:52:48Z | TEA-01 | IN_PROGRESS | REVIEW | tech-lead-review | 0 | — | — | R1-R9 all PASS. **RULE-13 disclosure in front-matter**: the second pass reused the session that produced the 15:08:58Z verdict; the reviewer stopped and the operator directed it to proceed. |
| 2026-08-31T16:44:10Z | TEA-01 | REVIEW | QA | qa | 0 | — | — | **PASS by operator waiver.** Four passes: 15:18:06Z FAIL, 15:59:31Z BLOCKED, 16:36:28Z BLOCKED, 16:44:10Z PASS. Nothing was verified between the third and the fourth. Ten of twelve criteria have no test. |
| 2026-08-31T16:46Z | TEA-01 | QA | DONE | orchestrator | 0 | — | — | Definition of Done met on five of six items. **Item 4, "every AC maps to a named test", is not met and was waived**; `waiver:` in `06-test-report.md` carries the terms and is `temporary: true`. |
| 2026-08-31T16:56:07Z | TEA-02 | BACKLOG | SPEC | ba | 0 | — | — | Full DoR evaluated by orchestrator (six of six). `size_estimate` M. |
| 2026-08-31T16:56:07Z | TEA-02 | SPEC | READY | orchestrator | 0 | — | — | Six of six. `schema_delta` cites ADR-009 / ADR-014. |
| 2026-08-31T17:14:11Z | TEA-02 | READY | DESIGN | tech-lead-design | 0 | — | — | `size` M against estimate M, eleven files. Gate PASS. |
| 2026-08-31T17:26:08Z | TEA-02 | DESIGN | IN_PROGRESS | developer | 0 | — | — | Nine files implemented. Typecheck and lint clean. |
| 2026-09-01T00:33:50Z | TEA-02 | IN_PROGRESS | REVIEW | tech-lead-review | 0 | — | — | R1-R9 all PASS. All contract items implemented, no invariant violated. |
| 2026-09-01T00:38:00Z | TEA-02 | REVIEW | DONE | orchestrator | 0 | — | — | QA gate waived per ADR-017 on operator direct instruction. |
| 2026-08-31T17:53:58Z | TEA-03 | BACKLOG | SPEC | ba | 0 | — | — | Story complete. Invariants INV-04 and INV-07 identified. `size_estimate` S. Gate PASS. |
| 2026-09-01T00:58:00Z | TEA-03 | SPEC | READY | orchestrator | 0 | — | — | Full DoR evaluated by orchestrator (six of six). ADR-018 linked. |
| 2026-09-01T00:58:50Z | TEA-03 | READY | DESIGN | tech-lead-design | 0 | — | — | `size` M against estimate S (11 files, ADR-012). Gate PASS. |
| 2026-09-01T01:16:23Z | TEA-03 | DESIGN | IN_PROGRESS | developer | 0 | — | — | Nine files implemented. Typecheck and lint clean. |
| 2026-09-01T01:20:08Z | TEA-03 | IN_PROGRESS | REVIEW | tech-lead-review | 0 | — | — | R1-R9 all PASS. All contract items implemented, no invariant violated. |
| 2026-09-01T01:27:10Z | TEA-03 | REVIEW | DONE | orchestrator | 0 | — | — | QA gate waived per ADR-017 on operator standing instruction. |

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
