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
| 2026-09-01T03:40:34Z | TEA-04 | BACKLOG | PLAN | tech-lead-design | 0 | — | — | First ticket planned under ADR-019, which merged SPEC and DESIGN into one PLAN stage. `size_estimate` M and `size` M agree; ADR-012 not engaged. Nine `allowed_paths`. Gate PASS. |
| 2026-09-01T04:30:00Z | TEA-04 | PLAN | READY | orchestrator | 0 | — | — | Full DoR, six of six. Item 4 failed on a missing ADR until ADR-020 was accepted by the operator; `schema_delta` re-read at this transition per ADR-020 §Affected documents, because it had been written against ADR-018 point 3 as it read before the amendment. |
| 2026-09-01T04:38:11Z | TEA-04 | READY | IN_PROGRESS | developer | 0 | — | — | Seven files. The migration is the feature under ADR-005; everything above it is an affordance. |
| 2026-09-01T04:46:50Z | TEA-04 | IN_PROGRESS | REVIEW | tech-lead-review | 0 | — | — | R1-R9 all PASS, every item citing file:line. |
| 2026-09-01T04:48:46Z | TEA-04 | REVIEW | DONE | orchestrator | 0 | — | — | **QA gate WAIVED per ADR-017 — the third, which fires revert condition 2.** TEA-02, TEA-03 and TEA-04 are the three rows that condition counts. Reverting is registry work under RULE-01 and was not done here. |
| 2026-09-03T01:20:02Z | BUG-001 | BACKLOG | PLAN | tech-lead-design | 0 | — | — | First ticket planned under ADR-022, which removed the QA stage. `size_estimate` S and `size` S agree; ADR-012 not engaged. Two `allowed_paths`, one file new. Gate PASS. One `consulted` entry with `resulted_in_amendment: true` — the operator superseded the branch name to `feat/BUG-001`, which turns the RULE-03 path guard back on. |
| 2026-09-03T01:34:00Z | BUG-001 | PLAN | READY | orchestrator | 0 | — | — | Full DoR, six of six, graded at `/next-ticket`. **Not written to `ticket.yaml` at the time** — `/next-ticket` is report-only and writes no file, so the ticket still read `state: BACKLOG` on disk when the next stage arrived. This row and the `gates:` comment in `ticket.yaml` are that grade's only record. |
| 2026-09-03T01:43:20Z | BUG-001 | READY | REVIEW | developer | 0 | — | — | `/implement` wrote `state: REVIEW` directly. **IN_PROGRESS was never on disk** and no row claims it was; the developer recorded the skip in `ticket.yaml` and in `03-impl-log.md` *Open questions* item 2, and declined to forge `gates.plan.passed` rather than tidying it. Two files: the `webServer` seam pin and a setup-project guard that asserts the served page. |
| 2026-09-03T02:04:23Z | BUG-001 | REVIEW | DONE | orchestrator | 0 | — | — | R1–R8 all PASS, each citing `file:line`; there is no R9 (`.claude/commands/review.md:42`). `gates.plan` and `gates.review` were written here from each artifact's `produced_at`, repairing the bookkeeping the two stages deliberately left. **No `qa` gate and none owed** — ADR-022, and this ticket was planned after 2026-09-01. **Definition of Done item 3 was NOT run at `/ship`**: the operator instructed step 1 to be skipped. What stands in for it is evidence in `04-review.md` rather than a `/ship` run — typecheck exit 0, lint exit 0, and `pnpm exec playwright test` 11 passed on a machine carrying a real `.env`; `pnpm exec vitest run` was run by nobody at this ticket. |
| 2026-09-01T07:26:13Z | TEA-05 | BACKLOG | PLAN | tech-lead-design | 0 | — | — | `size_estimate` M and `size` M agree; ADR-012 not engaged. Twelve `allowed_paths`. Gate PASS. The shell predated ADR-019 and carried `spec`/`design` gates; migrated to one `plan` gate at this stage. |
| 2026-09-01T07:26:13Z | TEA-05 | PLAN | READY | orchestrator | 0 | — | — | Full DoR, six of six — the first ticket to reach this gate with no ADR owed. Item 4 had to be earned: the shell made `schema_delta: none` CONDITIONAL and `01-plan.md` section 6 discharges the condition. |
| 2026-09-01T08:14:14Z | TEA-05 | READY | IN_PROGRESS | developer | 0 | — | — | Cycle 1. Eighteen files across the seam, the session hook, three routes and the fixtures. |
| 2026-09-01T08:18:50Z | TEA-05 | IN_PROGRESS | REVIEW | tech-lead-review | 0 | — | — | Cycle 1, nine-item checklist. |
| 2026-09-01T08:33:00Z | TEA-05 | REVIEW | REWORK | qa | 0 | — | — | **`06-test-report.md` gate FAIL** — `pnpm exec playwright test` exit 1, 13 failures. Cause named in `blocking_reason` and it is not this ticket: the end-to-end suite was unpinned and drove the live Supabase project, which is BUG-001. The QA stage was removed by ADR-022 two days later; this is the last row any `qa` agent writes. |
| 2026-09-03T02:39:34Z | TEA-05 | REWORK | IN_PROGRESS | developer | 1 | — | — | Cycle 2, the AC-7 fix. BUG-001 had shipped, so the suite could state which seam it drove. Roughly eighty lines inserted above the TEA-05 block in `mock.ts`, which is why cycle 1's citations in both artifacts no longer resolve — recorded in `04-review.md` rather than repaired, per the additive rule. |
| 2026-09-03T02:47:46Z | TEA-05 | IN_PROGRESS | REVIEW | tech-lead-review | 1 | — | — | Cycle 2, fresh session under RULE-13, renumbered to the post-ADR-022 eight-item checklist. R1–R8 all PASS, no findings. All four commands re-run at exit 0, including `playwright test` 21 tests. |
| 2026-09-03T02:57:02Z | TEA-05 | REVIEW | DONE | orchestrator | 1 | — | — | `review` gate written from `04-review.md` cycle 2 `produced_at`. **`qa` left `false` and not waived** — no stage produces it since ADR-022, and its 2026-09-01 FAIL is superseded by its cause shipping. `rework_count` corrected 0 -> 1; nothing had incremented it. **TEA-05 and TEA-01 both go to `DONE` in `features.md`** — `/ship` step 3 read as plural, per this ticket's two `feature_ids`. **Definition of Done item 3 was NOT run at `/ship`**: the operator instructed step 1 to be skipped; the exit-0 evidence is cycle 2's, from 2026-09-03. |

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
