---
doc_version: 1
last_updated: 2026-09-03
governed_by: [RULE-06, RULE-10]
---

# Backlog

**An ordered list, not a scored one.** A human reorders rows; the orchestrator takes the top of
READY. There is deliberately no priority algorithm, no score column, and no estimate-derived ranking.

**This is a view.** `ticket.yaml` is authoritative. On disagreement the orchestrator repairs this
file and does not touch `ticket.yaml` to make the view right.

**Do not run a generic prioritisation tool over this file.** It will produce a scored, reordered
list, which is exactly what the first sentence says it must never be.

## READY

Tickets that have been through PLAN and passed the full Definition of Ready. **READY means
planned, sized, and safe to build** — the next stage for a row here is IN_PROGRESS, not PLAN.

| # | Ticket | Title | Size | Depends on |
|---|--------|-------|------|------------|

## BACKLOG

Tickets awaiting PLAN. **Ordered.** A human reorders; the orchestrator takes the top.

Under the current gate placement a ticket sits here until it has been planned — DoR is evaluated
*after* PLAN. A row still at `BACKLOG` has not failed DoR; it has not reached it.

| # | Ticket | Title | State | Blocked on |
|---|--------|-------|-------|------------|
| 1 | CAL-04 | Month view — a day grid showing who is away and which days are overloaded | BACKLOG | CAL-01, TEA-03 |
| 2 | CAL-05 | Week view — per-person detail for one week, with half-days, notes and who approved | BACKLOG | CAL-04 |
| 3 | CAL-06 | Year view — one row per member across 365 days | BACKLOG | CAL-04, TEA-03 |
| 4 | ADM-01 | Set the overload threshold | BACKLOG | TEA-01 |
| 5 | CAL-07 | Overload warning shown while choosing dates, before the entry is saved | BACKLOG | CAL-01, CAL-04 |
| 6 | ADM-02 | The national holiday calendar, seeded and readable | BACKLOG | TEA-01, ADM-01 |
| 7 | ADM-03 | Add, edit or delete a holiday or swap day | BACKLOG | ADM-02 |
| 8 | CAL-08 | Holidays and bridge days shown in the calendar views | BACKLOG | ADM-02, CAL-04, CAL-05, CAL-06 |
| 9 | ADM-04 | The worklist of entries awaiting a decision | BACKLOG | CAL-01, TEA-03, ADM-01 |
| 10 | ADM-05 | Approve or reject an entry, with a reason on rejection | BACKLOG | ADM-04, CAL-02 |
| 11 | ADM-06 | Reject several entries at once, with one reason for the batch | BACKLOG | ADM-05 |
| 12 | OPS-002 | UI copy to English — entry screens and the seam's error messages | BACKLOG | — |

**OPS-001 shipped from row 12 while CAL-04 sat at row 1, and the rows above it did not move.**
Recorded because this file's header reserves reordering to a human and says the orchestrator takes
the top — so this ship did not follow the order, and nothing in the table shows it. Only OPS-002
renumbered, 13 to 12, which is the ordinary bookkeeping when a row leaves. **CAL-04 is still row 1
and is still the top of this list.** If OPS-001 was meant to come first, the row a human moves is
the one that records it; if it was not, the order is intact and this paragraph is the only trace.

**Renumbered again to 1–11 by `orchestrator` at /ship on 2026-09-03**, when CAL-03 left this table
for `## ARCHIVE`. Bookkeeping, not a reordering. **CAL-04 is now row 1**, and it is the first row in
months whose `Blocked on` was never CAL-01 alone — it names TEA-03 too, and both are DONE.

**BOTH PRECONDITIONS BELOW ARE NOW DISCHARGED — `Blocked on` repaired to `—` by `orchestrator` on
2026-09-03.** PR #37 merged as `3424f89`, so `§ Language` is on `main` and both tickets are valid
rather than hypothetical; CAL-03 shipped as PR #38 and its row is in `## ARCHIVE`, so the file
collision that produced `depends_on: [CAL-03]` is gone. **Neither ticket is blocked on anything.**
The three paragraphs below are left exactly as `product` wrote them, because they are the record of
what the dependency was and why — and the first of them is the only place the pull-request
precondition is written down at all.

**OPS-001 and OPS-002 were appended at rows 12 and 13 by `product` at /triage on 2026-09-03, and
`product` asserts nothing about their position.** Same stance as the TEA-05 and BUG-001 paragraphs
below: this file's header says a human reorders, so placing either row higher would have moved eleven
rows a human placed. Nothing was renumbered and no row moved relative to another. They are from
`.ai/board/ideas/2026-09-03-the-interface-and-its-standard-speak-different-languages.md`; the verdict
section of that file is the reasoning.

**Three facts a human needs in order to place them, and the first one is not a priority question.**

1. **`Blocked on` names a pull request, and no ticket field can carry that.** Both tickets exist to
   satisfy `§ Language` in `.ai/standards/ui-design-system.md`, which lives in exactly one commit —
   `3ccbd37`, the sole commit of `ops/ui-language-english`, **open as PR #37 and unmerged**. It is not
   on `main`. **If PR #37 does not merge, both tickets are invalid rather than blocked** and should be
   closed. `depends_on` names tickets and is graded against ticket state, so this precondition is in
   prose here and in §0 of each `ticket.yaml`, because there is no field for it and nothing in the
   loop will ask.
2. **Both are `depends_on: [CAL-03]`, which is row 1 and not yet DONE — so both fail Definition of
   Ready item 3 today, deliberately.** The dependency is a file collision rather than a behavioural
   one: CAL-03's `allowed_paths` claim five of the thirteen files in scope — `src/App.tsx` and
   `src/routes/Home.tsx` for OPS-001, and `src/routes/EditEntry.tsx`, `src/lib/data/mock.ts` and
   `src/lib/data/supabase.ts` for OPS-002. One working directory, one branch (ADR-006).
3. **Waiting costs something measurable, which is the argument for placing them early once CAL-03
   ships.** Twelve `PLANNED` rows above will each be built in English by the standard alone, at no
   cost, while the seven shipped features stay Vietnamese — so every row that ships before these two
   adds another screen where the two languages meet. CAL-03 is already the first: its new
   `src/routes/TeamEntries.tsx:43-60` declares English label maps against `src/components/EntryForm.tsx:34-46`
   in Vietnamese, a third copy of the same label sets, and its own developer wrote the handover into
   the file at `:40-42`. **OPS-002 is the ticket that reconciles all three.**

**Neither branch is `ops/<slug>`.** `feat/OPS-001` and `feat/OPS-002`, because
`scripts/check-allowed-paths.mjs:96-98` exits 0 with *"nothing to check"* on any branch not beginning
`feat/` — so an `ops/` name would run RULE-03 unenforced across shipped application files. That is the
same trade-off the operator settled for `feat/BUG-001` on 2026-09-03, and the residual contradiction
with `git-conventions.md:36` is recorded in each ticket's §4 rather than reopened.

**CORRECTION, `orchestrator` at /ship on 2026-09-03 — the two rows above are now 12 and 13, and the
paragraph that opens this block is left standing rather than rewritten.** It says *appended at rows 13
and 14* and *nothing was renumbered*, and both were true when `product` wrote them: CAL-03 was still
row 1. CAL-03 shipped in the same hour and left this table, so every row below it moved up one.
**Bookkeeping, not a reordering** — no row moved relative to another, and `product` still asserts
nothing about their position.

**Their point 2 is overtaken: `depends_on: [CAL-03]` now passes Definition of Ready item 3**, because
CAL-03 is `DONE`. The file collision it describes is spent — CAL-03's `allowed_paths` are released and
its five contested files reach `main` with [#38](https://github.com/didi-code0980/calechip/pull/38).
**Point 1 is untouched and is the one that still blocks:** both tickets rest on `§ Language` in
`.ai/standards/ui-design-system.md`, which exists only in commit `3ccbd37` on `ops/ui-language-english`,
open as PR #37 and unmerged. If #37 does not merge, both tickets are invalid rather than blocked. No
ticket field carries that, which is why it is prose — and why nothing in the loop will ask.

**Renumbered again to 1–12 by `orchestrator` at /ship on 2026-09-03**, when CAL-02 left this table
for `## ARCHIVE`. Bookkeeping, not a reordering. **CAL-03 is now row 1 and is blocked on nothing** —
its `Blocked on` names CAL-02, which is now DONE.

**Renumbered again to 1–13 by `orchestrator` at /ship on 2026-09-03**, when CAL-01 left this table
for `## ARCHIVE`. Bookkeeping, not a reordering. **CAL-02 is now row 1 and it is blocked on nothing**
— its `Blocked on` names CAL-01, which is now DONE.

**Renumbered again to 1–14 by `orchestrator` at /ship on 2026-09-03**, when TEA-05 left this table
for `## ARCHIVE`. Bookkeeping, not a reordering. **CAL-01 is now row 1**, and it is there because
every row a human placed above it has shipped — not because anyone moved it.

**The rows above were renumbered to 1–15 by `orchestrator` at /ship on 2026-09-03**, when BUG-001
left this table for `## ARCHIVE`. **Bookkeeping, not a reordering** — no row moved relative to
another, and TEA-05 is row 1 again by the same operator placement recorded below, not by a new one.

**The operator placed TEA-05 at row 1 on 2026-09-01**, and the fourteen rows below it moved down one.
That is a reordering, not the bookkeeping renumbering described below — a human moved a row relative
to the others, which is the only way that is allowed to happen.

*The paragraph below was written by `product` when the row was appended, and is kept because it names
the two facts the reorder rested on.* **TEA-05 was appended, not inserted.** This file's header says
it is an ordered list that a human reorders, so placing the row anywhere above 17 would have
renumbered sixteen rows a human placed. `product` asserts nothing about its position. Two facts a human reordering it should have:
`depends_on` is `[TEA-01]`, which is `DONE`, so nothing blocks it; and no row above it names TEA-05
in `Blocked on`, although each of them describes something a signed-in person does.

**The rows above have been renumbered twice by `orchestrator` on 2026-09-01** — to 1–16 when
TEA-03 left this table for `## READY`, and to 1–15 when TEA-04 did. `product`'s paragraph is left as
written; read its *17* and *sixteen rows* as the positions at the time it was written. TEA-05 is now
row 1, placed there by the operator on 2026-09-01. **The renumbering is
bookkeeping and never a reordering** — no row has moved relative to another since a human placed it.

**BUG-001 was appended at row 16 by `product` on 2026-09-01, and `product` asserts nothing about its
position.** Same stance as the TEA-05 paragraph above: this file's header says a human reorders, so
placing a row anywhere above 16 would have moved fifteen rows a human placed. The fact a human needs
in order to place it: **ADR-021 §Consequences requires this ticket ahead of CAL-01, which is row 2**,
and states why in its own words — *"Until it lands, no ticket can pass the QA gate, because Definition
of Done item 3 requires the suites to exit 0."* Item 3 was suspended under ADR-017 and is restored by
ADR-021, so this is not a preference about ordering: **until BUG-001 lands, no ticket in this table can
pass the QA gate at all**, on any machine carrying a `.env`. It is `depends_on: []` and blocked on
nothing, so it can be placed anywhere. `.ai/board/tickets/BUG-001/ticket.yaml` §4 carries one thing a
human must settle before it starts, and it is not its position: the branch name.

**The operator placed BUG-001 at row 1 on 2026-09-01**, above TEA-05, and the fifteen rows below it
moved down one. That is a reordering, not the bookkeeping renumbering described above — a human moved
a row relative to the others, which is the only way that is allowed to happen. `product`'s paragraph
immediately above is left as written; read its *row 16* as the position at the time it was written.
The operator was asked because ADR-021 §Consequences requires this ticket ahead of CAL-01 while this
file's own header reserves reordering to a human, and those two are only reconcilable by asking.

**The branch name was settled in the same exchange: `bugfix/BUG_TEA-01_01`**, which is
`.ai/standards/git-conventions.md:32` followed exactly. The operator was shown, and accepted, that
`bugfix/` branches run with the RULE-03 path guard inactive in both resolvers
(`git-conventions.md:44-49`) and that this ticket edits shipped test files. `branch` is set in
`.ai/board/tickets/BUG-001/ticket.yaml`; the guard consequence is recorded there in §4 so that
whoever runs `/implement` reads it rather than rediscovering it.

**CORRECTION, `orchestrator` at /ship on 2026-09-03 — the branch is `feat/BUG-001`, and the paragraph
above is left standing rather than rewritten.** The operator superseded the 2026-09-01 choice on
2026-09-03, after `tech-lead-design` measured a fact that was not available at triage:
`scripts/check-allowed-paths.mjs:90` resolves a `feat/` branch to its ticket and finds
`.ai/board/tickets/BUG-001/ticket.yaml`, so the option triage had presented as *unavailable* is the
only one under which RULE-03 is enforced in CI — a `bugfix/` branch exits 0 saying "nothing to
check" (`:85-87`). So the guard consequence the paragraph above warns about **does not apply**:
`allowed_paths` is checked mechanically on this branch, and `/ship` step 6 is where that check runs
against the committed diff. The full record, including what the new name costs against
`git-conventions.md:36`, is the §4 CORRECTION block at the end of that `ticket.yaml`.

## BLOCKED

Tickets that cannot proceed until a human decides something. Name the decision, not the topic.

| # | Ticket | Blocked on | Since | Who decides |
|---|--------|------------|-------|-------------|

## ARCHIVE (last 20)

| # | Ticket | Title | Shipped | PR |
|---|--------|-------|---------|-----|
| 1 | TEA-01 | Sign up and establish the member record | 2026-08-31 | [#11](https://github.com/didi-code0980/calechip/pull/11), merged 16:49:02Z; board and registry in [#12](https://github.com/didi-code0980/calechip/pull/12), merged 16:50:48Z |
| 2 | TEA-02 | Manage the allow-list | 2026-09-01 | [#13](https://github.com/didi-code0980/calechip/pull/13) |
| 3 | TEA-03 | Team member list | 2026-09-01 | [#17](https://github.com/didi-code0980/calechip/pull/17) |
| 4 | TEA-04 | Remove a member, and promote a member to admin | 2026-09-01 | [#20](https://github.com/didi-code0980/calechip/pull/20) |
| 5 | BUG-001 | The end-to-end suite does not pin which seam it drives | 2026-09-03 | [#27](https://github.com/didi-code0980/calechip/pull/27); board files in [#28](https://github.com/didi-code0980/calechip/pull/28) |
| 6 | TEA-05 | Sign in, sign out, and the member-less landing state | 2026-09-03 | [#29](https://github.com/didi-code0980/calechip/pull/29); board and registry in [#30](https://github.com/didi-code0980/calechip/pull/30) |
| 7 | CAL-01 | Create an entry for themselves, over a range of dates | 2026-09-03 | [#32](https://github.com/didi-code0980/calechip/pull/32); board and registry in [#34](https://github.com/didi-code0980/calechip/pull/34) |
| 8 | CAL-02 | Edit or delete their own entry | 2026-09-03 | [#36](https://github.com/didi-code0980/calechip/pull/36) |
| 9 | CAL-03 | Edit or delete another member's entry, as an admin | 2026-09-03 | [#38](https://github.com/didi-code0980/calechip/pull/38) |
| 10 | OPS-001 | UI copy to English — chrome, account and team screens | 2026-09-03 | [#40](https://github.com/didi-code0980/calechip/pull/40) |

**OPS-001 is the first ticket that ships no capability at all** — it translates the copy of seven
already-shipped screens and changes no behaviour. Its five `feature_ids` are all TEA rows, and four
of the five were already `DONE`, so `/ship` step 3 had almost nothing to write.

**The exception is TEA-02, and it was stale rather than open.** That row read `IN_PROGRESS` with a
Notes sentence saying *"PR #13 open"*. [#13](https://github.com/didi-code0980/calechip/pull/13) merged
on 2026-08-31, hours after that sentence was written, and nothing updated the row for three days —
the exact silent drift `/ship` step 3 names as the reason it is the column's only writer. It is
corrected to `DONE` here, on the fact of the merge rather than on this ticket's work.

**Its `gates:` block was already correct** — `plan` and `review`, no `spec`, `design` or `qa`. First
ticket to reach `/ship` that way, because `product` created the shell on 2026-09-03 from the current
template. The five before it were each created before 2026-09-01 and each had to be migrated by
whichever role noticed.

**CAL-03 completes the write path on `entry`: CAL-02 gave a member their own rows, this gives an
admin every row on their own team.** Two policies and nothing else — `entry_update_admin` and
`entry_delete_admin`, both `using (is_admin(uid) and the entry's member is on the caller's team)`,
the update one additionally `with check` on team so an admin cannot move an entry to another team.
No new grant (CAL-02's are role-blind and already held), no insert policy, no change to
`entry_enforce_decision()`, and CAL-02's policies untouched. **Approving and rejecting is not here** —
that is ADM-05, and this row deliberately stops at edit and delete.

**Its `gates:` block still carried the four pre-ADR-019 keys — the fourth ticket running.** TEA-05
was migrated at PLAN, CAL-01 at `/implement`, CAL-02 and CAL-03 at `/ship`: four tickets, three
roles, none of them instructed to. Every remaining shell created before 2026-09-01 is the same.

**CAL-02 is the first ticket to ship under ADR-023 — one pull request, not two.** The three
ship-owned paths (`backlog.md`, `metrics.md`, `features.md`) ride on the ticket branch, exempted by
name in `scripts/check-allowed-paths.mjs`. The three ships before it — BUG-001, TEA-05, CAL-01 — each
produced two pull requests that had to be merged together, and #29 merging before #30 is the
demonstration ADR-023 cites.

**Its `gates:` block still carried the four pre-ADR-019 keys and nobody had migrated it.** Third
ticket running, and a different role did it each time — `tech-lead-design` at PLAN for TEA-05,
`developer` at `/implement` for CAL-01, `orchestrator` at `/ship` here, none of them instructed to.
Every remaining shell created before 2026-09-01 carries the same four keys.

**Definition of Ready item 4 failed at BACKLOG and was discharged at PLAN by linking rather than
authoring.** `schema_delta` is not `none` — two policies, a column-scoped update grant excluding
`member_id`, `status` and `rejection_reason`, a delete grant, and a `create or replace` of the
INV-02 trigger — and PLAN linked ADR-005, ADR-014 and ADR-016, all already approved, then corrected
`requires_adr` from `false` to `true`.

**CAL-01 is the first ticket to ship a migration, and the first whose invariants are enforced by the
database rather than by code.** Five of the seven are touched — INV-01 by an exclusion constraint
over `date_range` (needing the `btree_gist` extension), INV-02 by a trigger, INV-03 by a check, and
INV-06 and INV-07 by the table's own shape. ADR-005 and ADR-011 are the linked decisions; ADR-014 is
why `schema_delta` could not be `none`. **One implement cycle, no rework, R1–R8 all PASS.**

**All four verify commands were re-run at REVIEW and exit 0** — typecheck, lint, `vitest run`, and
`playwright test` with 32 passing, which is this ticket's eleven plus the four earlier suites
unedited. `/ship` did not re-run them; the operator instructed step 1 to be skipped.

**TEA-05 completes TEA-01, and both feature rows go to `DONE` together.** TEA-01 delivered sign-up
only; the sign-in half was carved out at DESIGN on 2026-08-31 and reached a ticket a day later
(MD-017). `.ai/board/tickets/TEA-01/01-story.md:212` says the feature is delivered only when both
halves are DONE, so `/ship` step 3's singular *"this feature's `Status`"* is read as plural here —
the instruction predates any ticket carrying two `feature_ids`.

**TEA-05 carries a `qa` gate reading `FAIL`, and it is not a waiver.** `06-test-report.md` failed on
2026-09-01 because the end-to-end suite was unpinned and ran against the live Supabase project —
that is BUG-001, archived directly above, which shipped the same day this did. ADR-022 then removed
the QA stage, so nothing produces that gate any more. Cycle 2 re-ran all four commands on 2026-09-03
at exit 0, including `pnpm exec playwright test` with 21 tests. **One rework cycle**, and
`rework_count` was corrected from 0 to 1 at ship; nothing had incremented it.

**AC-3 and AC-8 have never been observed against a real Supabase project**, which `01-plan.md`
section 8.1 declares as the plan's own limit rather than a gap the implementation opened. MD-014 is
the standing proof that the difference is not theoretical: seeded accounts could not sign in at all,
and no test noticed for a day.

**TEA-01 shipped with its QA gate passed by operator waiver.** Ten of twelve acceptance criteria
have no test; `tests/permission-model.test.ts` does not exist because no database was provisioned.
Under ADR-005 the row-level policies are the entire authorization model, so what is unverified is the
authorization model. The waiver is marked `temporary: true` in `06-test-report.md` and is reversed by
deleting the `waiver:` block. The work that retires it honestly is *Appendix A* of `02-design.md`.

**TEA-02 shipped with its QA gate waived per ADR-017.** Acceptance criteria and policy enforcement
are untested by automated suites because no live test runner is configured.

**TEA-03 and TEA-04 shipped with their QA gates waived per ADR-017**, on the same terms. No test
plan, no test report and no test file exists for either.

**TEA-04 IS THE THIRD TICKET TO REACH DONE UNDER ADR-017, WHICH FIRES ITS REVERT CONDITION 2** —
*"Three tickets reach DONE under this waiver"*, counted from `metrics.md` archive rows. TEA-02,
TEA-03 and TEA-04 are the three. Reverting is registry work under RULE-01 and belongs to the
steward, not to `/ship`: ADR-017's `Status` becomes `SUPERSEDED`, *The QA stage is waived* comes out
of `.ai/01-operating-model.md`, and a ticket opens to retire the untested surface. Under ADR-005 the
row-level policies are the entire authorization model, so that surface is the authorization model
across three tickets. Nothing counts this automatically — MD-016.

**TEA-03 shipped with its QA gate waived per ADR-017.** Acceptance criteria and policy enforcement
are untested by automated suites because no live test runner is configured.
