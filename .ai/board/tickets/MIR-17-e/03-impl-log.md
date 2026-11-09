---
ticket: MIR-17-e
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-09T15:14:09Z
inputs_read:
  - .ai/board/tickets/MIR-17-e/01-plan.md
  - .ai/board/tickets/MIR-17-e/ticket.yaml
  - .ai/registry/decisions/ADR-090-the-worklist-decides-per-row-from-list-entry-owners-and-the-rest-of-p4-2-is-mir-17-d.md
  - .ai/registry/decisions/ADR-091-the-applications-manager-is-whoever-manages-a-team-and-the-rest-of-p4-2-is-mir-17-e.md
  - .ai/standards/testing-standards.md
  - src/lib/roles.ts
  - src/routes/EditEntry.tsx
  - src/routes/EventEditor.tsx
  - src/routes/EventDetail.tsx
  - src/components/EventAttendancePanel.tsx
  - src/components/Sidebar.tsx
  - tests/role-guards.test.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/routes/EditEntry.tsx` | modified | import `mayAdminister` and replace the literal admin check at the old `:88` with it (§4 row 1) | §4 row 1 |
| `src/routes/EventEditor.tsx` | modified | import `mayAdminister` and replace the literal admin check at the old `:282` with its negated form (§4 row 2) | §4 row 2 |
| `src/routes/EventDetail.tsx` | modified | import `mayAdminister`, replace the literal admin check inside `mayEditEvent` at the old `:87`, and reword the doc comment above it to name the helper and cite ADR-092 decision 2 (§4 row 3, §4 "comment beside a replaced test") | §4 row 3 |
| `src/components/EventAttendancePanel.tsx` | modified | import `mayAdminister` and replace the literal admin check inside `inAudience`'s `named` branch at the old `:138` with it (§4 row 4) | §4 row 4 |
| `src/lib/roles.ts` | modified | reworded the `mayDecideEntriesOf` doc comment and the `eslint-disable-next-line` reason to say it is the mock's decider, that the worklist decides per owner through `listEntryOwners` (ADR-090), and that `ownerId` is unused — code unchanged (§4 "src/lib/roles.ts:44-57") | §4 roles.ts item |
| `tests/role-guards.test.ts` | modified | added the five MIR-17-e paths to `FILES`, retitled the describe to "the twelve files", and added an `it` asserting `roles.ts` no longer contains `"kept for MIR-17"` (§4 "tests/role-guards.test.ts") | §4 test item |

**`src/components/Sidebar.tsx` was read, edited, and reverted — see Deviations below.** It appears in
no row because the diff against `HEAD` is empty.

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| `EditEntry.tsx` row | `src/routes/EditEntry.tsx:88-89` (import at `:47`) | `me !== null && mayAdminister(me.role)`, exactly the table's After text |
| `EventEditor.tsx` row | `src/routes/EventEditor.tsx:282-283` (import at `:37`) | `!(me !== null && mayAdminister(me.role))`, exactly the table's After text |
| `EventDetail.tsx` row | `src/routes/EventDetail.tsx:86-89` (import at `:40`) | comment reworded per §4's instruction for `:85`'s comment, citing ADR-092 decision 2 |
| `EventAttendancePanel.tsx` row | `src/components/EventAttendancePanel.tsx:138` (import at `:31`) | unchanged otherwise |
| `src/lib/roles.ts:44-57` | `src/lib/roles.ts:51-58` | comment and eslint-disable reason reworded; `mayDecideEntriesOf`'s body is byte-identical to before |
| `tests/role-guards.test.ts` | `tests/role-guards.test.ts:20-33`, `:57-63` | `FILES` gains the five paths, describe title says "the twelve files", new `it` block added |
| `Sidebar.tsx` row | **not applied — see Deviations** | |

## Deviations from the design

**The `Sidebar.tsx` row of §4's contract table was not applied, and the file is unchanged from
`HEAD`.** The only occurrence in the file of the literal the table names (`member.role === "admin"`,
at the line the table cites, `:540`) sits inside a large JSX comment (`{/* <nav>...</nav> */}`
spanning roughly lines 496–546) that has rendered nothing since UIE-10 — the comment immediately
above it (`:315-319`) says so explicitly: *"`const isAdmin = member.role === "admin";` stood here
until UIE-10 ... removing them leaves it unused."* Grepping the file for every `.role` read
(`:237`, `:240`, `:436`, `:440`, `:443`, `:603`) confirms there is no live comparison anywhere else —
`member.role` is read only to *display* a word or group a roster row, never to branch.

I made the replacement and the accompanying `import { mayAdminister } from "@/lib/roles";` addition
as the table specified, then ran lint: `'mayAdminister' is defined but never used
@typescript-eslint/no-unused-vars`. A reference inside a JSX comment is not a real AST reference, so
the import had no live use — the gate (lint exits 0) and the contract's literal instruction are in
direct conflict on this one file, and there is no way to satisfy both by editing only inside the
comment, since adding any real usage would be inventing behaviour the contract itself says not to
("Nothing else in these files changes").

**I resolved this myself rather than spending a chat on it**, because AC-4 itself already settles it:
*"none compares `role` with the literal `"admin"` or `"manager"` **outside comments**"* — the
Sidebar.tsx occurrence is inside a comment, so AC-4's own wording exempts it, and it was already true
before this ticket touched the file. AC-4's second clause, *"each imports `mayAdminister` from
`@/lib/roles`,"* is also satisfied without my edit: `tests/role-guards.test.ts`'s import assertion
(`expect(source).toMatch(/from\s+"@\/lib\/roles"/)`) checks only that the file imports *something*
from `@/lib/roles`, and `Sidebar.tsx` already does (`ROLE_LABELS`, unchanged). Both the acceptance
criterion as written and the test that encodes it pass with `Sidebar.tsx` left exactly as it was.

I therefore reverted both edits (the import and the dead-code line) rather than carry a lint failure
or an inline disable, and left the file's diff empty. This is a **delegated decision**, not a design
amendment — nothing about intended behaviour changed, and the five other files' replacements are
unaffected. Flagging it here rather than widening a chat budget entry, per the instruction not to
raise a question I can already recommend an answer to.

## Delegated decisions

- **`Sidebar.tsx`'s contract row targets dead code (a commented-out block since UIE-10) and cannot be
  satisfied without breaking the lint gate.** Left the file unchanged; AC-4 and its encoding test
  (`tests/role-guards.test.ts`) both already pass against the file as it stood before this ticket.
  See *Deviations* above for the full reasoning.

## Invariants

`invariants_touched: []` (ticket.yaml). No data path changes — every edit replaces one client-side
boolean expression with an equivalent call to the same already-shipped helper (`mayAdminister`); no
control, policy or trigger is touched.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `node scripts/check-allowed-paths.mjs` | 0 | 6 changed files, all within `allowed_paths` |
| `node scripts/check-carry.mjs MIR-17-e` | 0 | 7 uncommitted paths, all carried from `allowed_paths` |
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | failed once mid-work on `Sidebar.tsx`'s now-reverted unused import; 0 after revert |
| `pnpm exec vitest run tests/role-guards.test.ts` | 0 | 26/26 passed, including the new `it` |
| `pnpm exec vitest run` | non-zero, see note | every test that completed passed (974/974, then 915/928 on a second run); the non-zero exit both times came from vitest's fork pool crashing several worker processes with a Node OOM on this machine, not from a failing assertion — unrelated to this ticket's files, and not among this stage's gate commands (typecheck and lint only) |
| `git diff --name-only` subset of `allowed_paths` | yes | `EventAttendancePanel.tsx`, `roles.ts`, `EditEntry.tsx`, `EventDetail.tsx`, `EventEditor.tsx`, `role-guards.test.ts` — `Sidebar.tsx` is not in the diff (reverted to `HEAD`) |

## Testability contract

None — plan section 2b names no layout and section 6 is unused by this plan (no selectors listed;
this ticket changes no screen).

## Open questions

None that block. The `Sidebar.tsx` deviation is recorded above and resolved, not open.
