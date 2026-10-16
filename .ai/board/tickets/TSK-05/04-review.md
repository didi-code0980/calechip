---
ticket: TSK-05
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-15T20:30:10+0700
inputs_read:
  - .ai/board/tickets/TSK-05/01-plan.md
  - .ai/board/tickets/TSK-05/03-impl-log.md
  - .ai/board/tickets/TSK-05/ticket.yaml
  - .ai/templates/review-report.md
  - .ai/01-operating-model.md
  - .ai/registry/rules.md
  - src/lib/task-tick.ts
  - src/routes/Tasks.tsx
  - tests/e2e/tsk-01-tasks.spec.ts
  - git diff origin/main...HEAD
consulted: []
chat_before_verdict: none
gate: FAIL
blocking_reason: "R5 — § 4.2 as specified cannot meet AC-3/AC-4: the page applies `saved` to its lists but ignores the `done` that `failed` and `settled` carry, so after a successful write followed by a failed one the row shows a value the server does not hold."
next_state: REWORK
verdict: FAIL
failed_checks: [R5]
invariant_violation: false
route_to: tech-lead-design
increments_rework: false
---

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; uncommitted nothing stray | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: PASS`, exit 0 (10 changed files; code paths are exactly the five in `ticket.yaml` `allowed_paths`). `node scripts/check-carry.mjs TSK-05` → `carried .ai/board/ideas/2026-10-15-ticking-a-task-done-waits-two-round-trips-and-locks-the-box.md <- the idea that promoted it`, `PASS — nothing stray`, exit 0 |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` exit 0 |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm exec eslint src/lib/task-tick.ts src/routes/Tasks.tsx tests/task-tick.test.ts tests/e2e/tsk-05-optimistic-tick.spec.ts tests/e2e/tsk-01-tasks.spec.ts` exit 0; `pnpm exec eslint .` exit 0 |
| R4 | No datastore access outside the seam | PASS | The tick's only write is `seam.setTaskDone` at `src/routes/Tasks.tsx:411`, passed into the module; `src/lib/task-tick.ts:14` imports types only, no seam or client import |
| R5 | Every § 4 contract item implemented | **FAIL** | Items are present (detail below), but § 4.2's `onOutcome` wiring, implemented as specified at `src/routes/Tasks.tsx:413-422`, cannot satisfy AC-3 and AC-4 — Finding 1 |
| R6 | Permission gating matches § 3 | PASS | No gating added or removed; the write stays `seam.setTaskDone(id, done)` at `src/routes/Tasks.tsx:411`, the refusal path rolls back at `src/lib/task-tick.ts:89-91` and is surfaced at `src/routes/Tasks.tsx:420-421` |
| R7 | No invariant violated | PASS | `invariants_touched: []` (`ticket.yaml`); the diff touches no file under `src/lib/domain/` (`git diff --stat origin/main...HEAD`) — see R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main...HEAD -- package.json pnpm-lock.yaml` is empty; new import at `src/routes/Tasks.tsx:22` is an in-repo module |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| 4.1 `TickWrite` | `src/lib/task-tick.ts:17` | yes |
| 4.1 `TICK_FAILED` | `src/lib/task-tick.ts:20` | yes |
| 4.1 `TickOutcome` | `src/lib/task-tick.ts:23-30` | yes |
| 4.1 `TaskTicker` (`tap`, `shown`, `mark`, `reconcile`) | `src/lib/task-tick.ts:32-43`, `:111-135` | yes |
| 4.1 `createTaskTicker(write, onChange, onOutcome)` | `src/lib/task-tick.ts:58-63` | yes |
| 4.1 one run per task; `tap` flips `desired`, bumps `seq`, `onChange` before send | `src/lib/task-tick.ts:112-120` | yes |
| 4.1 one write in flight per task | `src/lib/task-tick.ts:70`, `:120` | yes |
| 4.1 throw/reject → `unknown` + `TICK_FAILED` | `src/lib/task-tick.ts:56`, `:73-81` | yes |
| 4.1 answer: success / superseded failure logged / resend / close with one outcome and `{ done, at: ++counter }` | `src/lib/task-tick.ts:84-108` | yes (impl-log deviation 1, current failure rolls `desired` back first, is the reading AC-3 needs) |
| 4.1 no clock, timer, debounce | `src/lib/task-tick.ts` (none present) | yes |
| 4.2 one ticker via `useRef`, `write = seam.setTaskDone` | `src/routes/Tasks.tsx:408-426` | yes |
| 4.2 `onOutcome`: `saved` swaps both lists and clears error; `failed` sets error; `settled` nothing | `src/routes/Tasks.tsx:413-422` | as specified — **and that specification is the defect**, Finding 1 |
| 4.2 tick errors `Record<string,string>`, cleared before `tap` | `src/routes/Tasks.tsx:404`, `:477-480` | yes |
| 4.2 `load` reads `mark` first, reconciles both lists | `src/routes/Tasks.tsx:430`, `:435-441` | yes |
| 4.2 rows get `shown(task)`, `onTick` with unshown task, `tickError` | `src/routes/Tasks.tsx:551-557`, `:568-575` | yes |
| 4.2 box `onClick={onTick}`, no `disabled` on box; save buttons keep `disabled={busy}` | `src/routes/Tasks.tsx:221`; `:202`, `:296`, `:366` | yes |
| 4.2 `errors.general ?? tickError` in view and move | `src/routes/Tasks.tsx:307` | yes |
| 4.2 row keys drop `done` | `src/routes/Tasks.tsx:483` | yes |
| 4.2 overdue count from shown values; section condition unchanged | `src/routes/Tasks.tsx:544-545`; `:538` | yes |
| 4.2 no `setTaskDone` in `run`; tick never calls `load`/`onChanged` | only call at `src/routes/Tasks.tsx:411` | yes |
| 4.3 selectors unchanged | `src/routes/Tasks.tsx:168`, `:216`, `:543` | yes |

## R7 detail

`invariants_touched: []`, written explicitly at PLAN (`01-plan.md` § 2). No ID to reason through.
The diff does not touch `src/lib/domain/absence.ts`, `busy.ts` or `day-status.ts`, nor any entry
path; the tick writes the same `done` column through the unchanged `seam.setTaskDone`
(`src/routes/Tasks.tsx:411`).

## Findings

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|
| 1 | R5 | **A run that closes `failed` or `settled` after an earlier write in it succeeded leaves the row showing a value the server does not hold.** The module tracks `confirmed` from every successful answer (`src/lib/task-tick.ts:88`) and emits it as `done` on `failed`/`settled` (`:105-106`), then deletes the run (`:102`), so `shown` falls back to the page's list. The page updates its lists only on `saved` (`src/routes/Tasks.tsx:414-418`); on `failed` it sets the error only (`:420-421`) and on `settled` nothing — exactly § 4.2's wiring. The list still holds the value from the last load. Reproduced against the committed module with the page's handling mirrored: task loaded `done:false`; tap, tap; write 1 (`true`) succeeds; write 2 (`false`) fails → outcome `{kind:"failed", done:true}`, and `shown(stateTask).done` is `false` while the server holds `true`. The `settled` variant (tap ×3, write 1 succeeds, write 2 superseded and fails) ends the same way. This breaks AC-3 ("returns to the value before the tap", defined in § 2 as the last successful write) and AC-4 (screen and store agree); the next load corrects it, so the screen silently flips by itself — the exact symptom § 8 alternative 1 was rejected for. The contract is what is wrong: § 4.2 must say that `failed` and `settled` write `done` into both lists for `taskId` (as `saved` does with its task). The module needs no change, and a test of the page-side handling of both outcomes (or of an outcome sequence in `tests/task-tick.test.ts` asserting the `done` carried) should be named. | `tech-lead-design` (R5 impossible as specified) | No |

## Verdict

`FAIL` — R5, routed to `tech-lead-design` per the failure routing table (`.ai/01-operating-model.md`,
row *R5 impossible as specified*). No Developer-caused failure; `rework_count` does not increment.
