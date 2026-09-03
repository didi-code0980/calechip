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
| 1 | TEA-05 | Sign in, sign out, and the member-less landing state | BACKLOG | TEA-01 |
| 2 | CAL-01 | Create an entry for themselves, over a range of dates | BACKLOG | TEA-01 |
| 3 | CAL-02 | Edit or delete their own entry | BACKLOG | CAL-01 |
| 4 | CAL-03 | Edit or delete another member's entry, as an admin | BACKLOG | CAL-02 |
| 5 | CAL-04 | Month view — a day grid showing who is away and which days are overloaded | BACKLOG | CAL-01, TEA-03 |
| 6 | CAL-05 | Week view — per-person detail for one week, with half-days, notes and who approved | BACKLOG | CAL-04 |
| 7 | CAL-06 | Year view — one row per member across 365 days | BACKLOG | CAL-04, TEA-03 |
| 8 | ADM-01 | Set the overload threshold | BACKLOG | TEA-01 |
| 9 | CAL-07 | Overload warning shown while choosing dates, before the entry is saved | BACKLOG | CAL-01, CAL-04 |
| 10 | ADM-02 | The national holiday calendar, seeded and readable | BACKLOG | TEA-01, ADM-01 |
| 11 | ADM-03 | Add, edit or delete a holiday or swap day | BACKLOG | ADM-02 |
| 12 | CAL-08 | Holidays and bridge days shown in the calendar views | BACKLOG | ADM-02, CAL-04, CAL-05, CAL-06 |
| 13 | ADM-04 | The worklist of entries awaiting a decision | BACKLOG | CAL-01, TEA-03, ADM-01 |
| 14 | ADM-05 | Approve or reject an entry, with a reason on rejection | BACKLOG | ADM-04, CAL-02 |
| 15 | ADM-06 | Reject several entries at once, with one reason for the batch | BACKLOG | ADM-05 |

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
