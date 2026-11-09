---
ticket: MIR-17-e
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-09T22:17:39+07:00
inputs_read:
  - .ai/board/tickets/MIR-17-e/01-plan.md
  - .ai/board/tickets/MIR-17-e/03-impl-log.md
  - .ai/board/tickets/MIR-17-e/ticket.yaml
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-092-the-entry-and-event-affordances-ask-the-role-helpers-and-the-rest-of-p4-2-is-mir-17-f.md
  - .ai/01-operating-model.md
  - .ai/templates/review-report.md
  - git diff origin/main...HEAD
consulted: []
chat_before_verdict: none
gate: FAIL
blocking_reason: "R5 impossible as specified: 01-plan.md § 4's Sidebar.tsx row (and AC-4's clause 'each imports mayAdminister') targets src/components/Sidebar.tsx:540, which sits inside a JSX comment (:533-545). Adding the required import gives an unused-import lint error, so the row cannot be met together with R3. The Developer left the file unchanged and narrowed AC-4 to 'imports something from @/lib/roles' — a change to an acceptance criterion, which belongs to tech-lead-design. Amend § 2 AC-4 and § 4 (drop or rewrite the Sidebar row). ADR-092:23 also cites Sidebar.tsx:540 as a live site."
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
| R1 | Committed and uncommitted paths within `allowed_paths` | PASS | `node scripts/check-allowed-paths.mjs` → `13 changed file(s) … allowed-paths: PASS`; `node scripts/check-carry.mjs MIR-17-e` → `0 uncommitted path(s) … PASS — nothing stray`. Every non-ticket path is in `ticket.yaml:19-29`; `.ai/board/backlog.md` is ship-owned |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` (`tsc --noEmit`) exit 0, no output |
| R3 | lint exit 0 on changed files | PASS | `pnpm lint` (`eslint .`) exit 0, repo-wide, no output |
| R4 | No datastore access outside the seam | PASS | The diff adds only `import { mayAdminister } from "@/lib/roles"` (`src/routes/EditEntry.tsx:47`, `src/routes/EventEditor.tsx:37`, `src/routes/EventDetail.tsx:40`, `src/components/EventAttendancePanel.tsx:31`); `roles.ts` imports domain types only (`src/lib/roles.ts:14`); `git diff --name-only origin/main...HEAD -- supabase src/lib/data` is empty |
| R5 | Every § 4 contract item implemented | **FAIL** | Sidebar row not applied: `src/components/Sidebar.tsx:540` unchanged and no `mayAdminister` import (`:75` imports only `ROLE_LABELS`). Impossible as specified — the site is inside the JSX comment at `src/components/Sidebar.tsx:533-545`. See *Findings* |
| R6 | Permission gating matches § 3 | PASS | § 3 says nothing changes. `mayAdminister` is `role === "admin"` (`src/lib/roles.ts:24`), so each replacement has the same truth table as the literal it replaces: `src/routes/EditEntry.tsx:89`, `src/routes/EventEditor.tsx:283`, `src/routes/EventDetail.tsx:89`, `src/components/EventAttendancePanel.tsx:139`. No migration or policy is in the diff |
| R7 | No invariant violated | PASS | `invariants_touched: []` (`ticket.yaml:18`); per-ID reasoning below |
| R8 | No dependency added without an ADR | PASS | `git diff --name-only origin/main...HEAD -- package.json pnpm-lock.yaml` is empty; the only new imports are from the in-repo `@/lib/roles` (`src/routes/EditEntry.tsx:47`) |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| `EditEntry.tsx:88` → `me !== null && mayAdminister(me.role)` | `src/routes/EditEntry.tsx:89`, import `:47` | Yes |
| `EventEditor.tsx:282` → `!(me !== null && mayAdminister(me.role))` | `src/routes/EventEditor.tsx:283`, import `:37` | Yes |
| `EventDetail.tsx:87` → `mayAdminister(me.role)` | `src/routes/EventDetail.tsx:89`, import `:40` | Yes |
| `EventDetail.tsx:85` comment cites ADR-092 decision 2 | `src/routes/EventDetail.tsx:85-87` | Yes |
| `EventAttendancePanel.tsx:138` → `mayAdminister(me.role)` | `src/components/EventAttendancePanel.tsx:139`, import `:31` | Yes |
| `Sidebar.tsx:540` → `mayAdminister(member.role)`, plus the import | **Not applied.** `src/components/Sidebar.tsx:540` is unchanged, inside the comment `:533-545`; no `mayAdminister` import (`:75`) | **No — impossible as specified** |
| `roles.ts:44-57` comment and eslint-disable reason; code unchanged | `src/lib/roles.ts:55-60`; body `:61-62` unchanged in diff | Yes |
| `tests/role-guards.test.ts`: `FILES` gains five paths | `tests/role-guards.test.ts:28-33` | Yes |
| describe titled "the twelve files" | `tests/role-guards.test.ts:39` | Yes |
| new `it`: `roles.ts` lacks "kept for MIR-17" | `tests/role-guards.test.ts:62-68`; `pnpm exec vitest run tests/role-guards.test.ts` → 26 passed | Yes |

## R7 detail

`invariants_touched` is `[]` (`ticket.yaml:18`). There are no IDs to work through one by one. Instead,
each registry invariant that the diff could plausibly touch was checked against what the diff changes:

| Invariant | Held by | Citation |
|---|---|---|
| INV-01, INV-02, INV-03, INV-06 (entry shape and transitions) | The database. The diff has no migration, seam or entry-write code; `EditEntry` changes only which read it chooses, with the same truth table | `src/routes/EditEntry.tsx:89-92`; `git diff --name-only origin/main...HEAD -- supabase src/lib/data` empty |
| INV-04, INV-05 (absence count) | Untouched. No count code is in the diff | diff file list: six `src/`/`tests/` files, none under `src/lib/data` or count code |
| INV-07 (one owner per entry) | Unchanged. The `me === null` branch still yields `isAdmin = false` and so `listOwnEntries` | `src/routes/EditEntry.tsx:89`, `:92` |

## Findings

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|
| 1 | R5 | § 4's Sidebar row, and AC-4's clause *"each imports `mayAdminister` from `@/lib/roles`"*, both target `src/components/Sidebar.tsx:540`. That line is inside a JSX comment (`:533-545`) and has rendered nothing. Replacing it and adding the import gives an unused import, which fails lint (R3). So the row cannot be met together with the gate. The Developer left the file unchanged (`03-impl-log.md` *Deviations*). That avoids the lint failure, but it reads AC-4 as *"imports something from `@/lib/roles`"*, and the AC does not say that. Narrowing an acceptance criterion belongs to design. `Sidebar.tsx` has no live literal comparison (the role-guards test passes), so no behaviour is wrong; the plan and its AC are. ADR-092:23 lists the same line as a live site. | `tech-lead-design` (R5 impossible as specified, `.ai/01-operating-model.md:184`) | No |

## Verdict

`FAIL`. `tech-lead-design` should amend `01-plan.md` § 2 AC-4 and § 4 for `Sidebar.tsx`: drop the row,
or restate AC-4 so that it does not require a `mayAdminister` import. Then re-review in a new session.
The other five rows, the `roles.ts` item and the test item are implemented, and their gates pass.
