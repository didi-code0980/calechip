---
ticket: TEA-05
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-01T15:18:50+07:00
inputs_read:
  - .ai/board/tickets/TEA-05/01-plan.md
  - .ai/board/tickets/TEA-05/03-impl-log.md
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: QA
---

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | [.ai/board/tickets/TEA-05/ticket.yaml:41-53](file:///Users/mpa/Downloads/aifw-template/.ai/board/tickets/TEA-05/ticket.yaml#L41-L53); `scripts/check-allowed-paths.mjs` exits 0 |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` exit 0 |
| R3 | lint exit 0 | PASS | `pnpm exec eslint .` exit 0 |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | [src/hooks/useSession.ts:16](file:///Users/mpa/Downloads/aifw-template/src/hooks/useSession.ts#L16); [src/App.tsx:8-9](file:///Users/mpa/Downloads/aifw-template/src/App.tsx#L8-L9); [eslint.config.js:30-55](file:///Users/mpa/Downloads/aifw-template/eslint.config.js#L30-L55) |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | [src/lib/domain/types.ts:42,62](file:///Users/mpa/Downloads/aifw-template/src/lib/domain/types.ts#L42-L62); [src/lib/data/index.ts:27,167,184,194,201](file:///Users/mpa/Downloads/aifw-template/src/lib/data/index.ts#L27-L201); [src/lib/data/supabase.ts:446,463,480,493](file:///Users/mpa/Downloads/aifw-template/src/lib/data/supabase.ts#L446-L493); [src/lib/data/mock.ts:407,418,440,474](file:///Users/mpa/Downloads/aifw-template/src/lib/data/mock.ts#L407-L474); [src/hooks/useSession.ts:19-88](file:///Users/mpa/Downloads/aifw-template/src/hooks/useSession.ts#L19-L88); [src/routes/SignIn.tsx:22-118](file:///Users/mpa/Downloads/aifw-template/src/routes/SignIn.tsx#L22-L118); [src/routes/NotOnATeam.tsx:20-59](file:///Users/mpa/Downloads/aifw-template/src/routes/NotOnATeam.tsx#L20-L59); [src/routes/Home.tsx:28-89](file:///Users/mpa/Downloads/aifw-template/src/routes/Home.tsx#L28-L89); [src/App.tsx:23,44-110](file:///Users/mpa/Downloads/aifw-template/src/App.tsx#L23-L110) |
| R6 | Permission gating matches plan section 3 | PASS | [src/App.tsx:67,87](file:///Users/mpa/Downloads/aifw-template/src/App.tsx#L67-L87); [src/routes/Home.tsx:70-76](file:///Users/mpa/Downloads/aifw-template/src/routes/Home.tsx#L70-L76); [src/lib/data/supabase.ts:480-488](file:///Users/mpa/Downloads/aifw-template/src/lib/data/supabase.ts#L480-L488) |
| R7 | Every test selector in plan section 8 exists in the markup | PASS | [src/App.tsx:27,35,49](file:///Users/mpa/Downloads/aifw-template/src/App.tsx#L27-L49); [src/routes/SignIn.tsx:72,85,96,102](file:///Users/mpa/Downloads/aifw-template/src/routes/SignIn.tsx#L72-L102); [src/routes/NotOnATeam.tsx:37,49](file:///Users/mpa/Downloads/aifw-template/src/routes/NotOnATeam.tsx#L37-L49); [src/routes/Home.tsx:46,50,53,72,79](file:///Users/mpa/Downloads/aifw-template/src/routes/Home.tsx#L46-L79); [src/routes/MemberList.tsx:235](file:///Users/mpa/Downloads/aifw-template/src/routes/MemberList.tsx#L235) |
| R8 | No invariant violated (RULE-07) | PASS | INV-04 verified; see detail below |
| R9 | No dependency added without an ADR | PASS | [package.json:1-47](file:///Users/mpa/Downloads/aifw-template/package.json#L1-L47) untouched in diff |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| §4.1 `Membership` three-state union | [src/lib/domain/types.ts:42-45](file:///Users/mpa/Downloads/aifw-template/src/lib/domain/types.ts#L42-L45) | Yes |
| §4.1 `email_not_confirmed` FailureCode | [src/lib/domain/types.ts:62](file:///Users/mpa/Downloads/aifw-template/src/lib/domain/types.ts#L62) | Yes |
| §4.1 No other types changed | [src/lib/domain/types.ts](file:///Users/mpa/Downloads/aifw-template/src/lib/domain/types.ts) | Yes |
| §4.2 `SignInInput` interface | [src/lib/data/index.ts:27](file:///Users/mpa/Downloads/aifw-template/src/lib/data/index.ts#L27) | Yes |
| §4.2 `getSession(): Promise<Session \| null>` (DataSeam) | [src/lib/data/index.ts:167](file:///Users/mpa/Downloads/aifw-template/src/lib/data/index.ts#L167) | Yes |
| §4.2 `getSession` (Supabase seam) | [src/lib/data/supabase.ts:446](file:///Users/mpa/Downloads/aifw-template/src/lib/data/supabase.ts#L446) | Yes |
| §4.2 `getSession` (Mock seam) | [src/lib/data/mock.ts:407](file:///Users/mpa/Downloads/aifw-template/src/lib/data/mock.ts#L407) | Yes |
| §4.2 `onAuthStateChange(listener: (session: Session \| null) => void): () => void` (DataSeam) | [src/lib/data/index.ts:184](file:///Users/mpa/Downloads/aifw-template/src/lib/data/index.ts#L184) | Yes |
| §4.2 `onAuthStateChange` (Supabase seam) | [src/lib/data/supabase.ts:463](file:///Users/mpa/Downloads/aifw-template/src/lib/data/supabase.ts#L463) | Yes |
| §4.2 `onAuthStateChange` (Mock seam) | [src/lib/data/mock.ts:418](file:///Users/mpa/Downloads/aifw-template/src/lib/data/mock.ts#L418) | Yes |
| §4.2 `signIn(input: SignInInput): Promise<Result<Session>>` (DataSeam) | [src/lib/data/index.ts:194](file:///Users/mpa/Downloads/aifw-template/src/lib/data/index.ts#L194) | Yes |
| §4.2 `signIn` (Supabase seam) | [src/lib/data/supabase.ts:480](file:///Users/mpa/Downloads/aifw-template/src/lib/data/supabase.ts#L480) | Yes |
| §4.2 `signIn` (Mock seam) | [src/lib/data/mock.ts:440](file:///Users/mpa/Downloads/aifw-template/src/lib/data/mock.ts#L440) | Yes |
| §4.2 `signOut(): Promise<Result<void>>` (DataSeam) | [src/lib/data/index.ts:201](file:///Users/mpa/Downloads/aifw-template/src/lib/data/index.ts#L201) | Yes |
| §4.2 `signOut` (Supabase seam) | [src/lib/data/supabase.ts:493](file:///Users/mpa/Downloads/aifw-template/src/lib/data/supabase.ts#L493) | Yes |
| §4.2 `signOut` (Mock seam) | [src/lib/data/mock.ts:474](file:///Users/mpa/Downloads/aifw-template/src/lib/data/mock.ts#L474) | Yes |
| §4.3 `SessionState` interface & `useSession()` hook | [src/hooks/useSession.ts:19,33](file:///Users/mpa/Downloads/aifw-template/src/hooks/useSession.ts#L19-L33) | Yes |
| §4.3 Resolution order & cleanup | [src/hooks/useSession.ts:47-88](file:///Users/mpa/Downloads/aifw-template/src/hooks/useSession.ts#L47-L88) | Yes |
| §4.3 `useSession` called once in `App.tsx`, passed as props | [src/App.tsx:23](file:///Users/mpa/Downloads/aifw-template/src/App.tsx#L23) | Yes |
| §4.4 `SignIn.tsx` | [src/routes/SignIn.tsx:22-118](file:///Users/mpa/Downloads/aifw-template/src/routes/SignIn.tsx#L22-L118) | Yes |
| §4.4 `NotOnATeam.tsx` | [src/routes/NotOnATeam.tsx:20-59](file:///Users/mpa/Downloads/aifw-template/src/routes/NotOnATeam.tsx#L20-L59) | Yes |
| §4.4 `Home.tsx` | [src/routes/Home.tsx:28-89](file:///Users/mpa/Downloads/aifw-template/src/routes/Home.tsx#L28-L89) | Yes |
| §4.4 Routing table in `App.tsx` | [src/App.tsx:44-110](file:///Users/mpa/Downloads/aifw-template/src/App.tsx#L44-L110) | Yes |

## R8 detail

| Invariant | Held by | Citation |
|---|---|---|
| INV-04 — one definition of the absence count | Nothing in this ticket writes `public.member` on any path. `signIn` and `signOut` touch authentication only. Presenting `NotOnATeam` creates no member row (AC-11). The sole writer of `public.member` remains the `admit_allow_listed_member` trigger on `auth.users` firing on confirmation. The denominator cannot move. | [src/lib/data/supabase.ts:480-488](file:///Users/mpa/Downloads/aifw-template/src/lib/data/supabase.ts#L480-L488); [src/lib/data/mock.ts:440-470](file:///Users/mpa/Downloads/aifw-template/src/lib/data/mock.ts#L440-L470) |

## Findings

None. All checks pass.

## Verdict

`PASS`. Under ADR-021 re-arming the QA stage, `next_state` is `QA`.
