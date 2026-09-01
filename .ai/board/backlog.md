---
doc_version: 1
last_updated: 2026-09-01
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

Tickets that have been through SPEC and passed the full Definition of Ready. **READY means
specified, sized, and safe to design** — the next stage for a row here is DESIGN, not SPEC.

| # | Ticket | Title | Size | Depends on |
|---|--------|-------|------|------------|

## BACKLOG

Tickets awaiting SPEC. **Ordered.** A human reorders; the orchestrator takes the top.

Under the current gate placement a ticket sits here until it has been specified — DoR is evaluated
*after* SPEC. A row still at `BACKLOG` has not failed DoR; it has not reached it.

| # | Ticket | Title | State | Blocked on |
|---|--------|-------|-------|------------|
| 1 | TEA-03 | Team member list | BACKLOG | TEA-01 |
| 2 | TEA-04 | Remove a member, and promote a member to admin | BACKLOG | TEA-01 |
| 3 | CAL-01 | Create an entry for themselves, over a range of dates | BACKLOG | TEA-01 |
| 4 | CAL-02 | Edit or delete their own entry | BACKLOG | CAL-01 |
| 5 | CAL-03 | Edit or delete another member's entry, as an admin | BACKLOG | CAL-02 |
| 6 | CAL-04 | Month view — a day grid showing who is away and which days are overloaded | BACKLOG | CAL-01, TEA-03 |
| 7 | CAL-05 | Week view — per-person detail for one week, with half-days, notes and who approved | BACKLOG | CAL-04 |
| 8 | CAL-06 | Year view — one row per member across 365 days | BACKLOG | CAL-04, TEA-03 |
| 9 | ADM-01 | Set the overload threshold | BACKLOG | TEA-01 |
| 10 | CAL-07 | Overload warning shown while choosing dates, before the entry is saved | BACKLOG | CAL-01, CAL-04 |
| 11 | ADM-02 | The national holiday calendar, seeded and readable | BACKLOG | TEA-01, ADM-01 |
| 12 | ADM-03 | Add, edit or delete a holiday or swap day | BACKLOG | ADM-02 |
| 13 | CAL-08 | Holidays and bridge days shown in the calendar views | BACKLOG | ADM-02, CAL-04, CAL-05, CAL-06 |
| 14 | ADM-04 | The worklist of entries awaiting a decision | BACKLOG | CAL-01, TEA-03, ADM-01 |
| 15 | ADM-05 | Approve or reject an entry, with a reason on rejection | BACKLOG | ADM-04, CAL-02 |
| 16 | ADM-06 | Reject several entries at once, with one reason for the batch | BACKLOG | ADM-05 |
| 17 | TEA-05 | Sign in, sign out, and the member-less landing state | BACKLOG | TEA-01 |

**TEA-05 was appended, not inserted.** This file's header says it is an ordered list that a human
reorders, so placing the row anywhere above 17 would have renumbered sixteen rows a human placed.
`product` asserts nothing about its position. Two facts a human reordering it should have:
`depends_on` is `[TEA-01]`, which is `DONE`, so nothing blocks it; and no row above it names TEA-05
in `Blocked on`, although each of them describes something a signed-in person does.

## BLOCKED

Tickets that cannot proceed until a human decides something. Name the decision, not the topic.

| # | Ticket | Blocked on | Since | Who decides |
|---|--------|------------|-------|-------------|

## ARCHIVE (last 20)

| # | Ticket | Title | Shipped | PR |
|---|--------|-------|---------|-----|
| 1 | TEA-01 | Sign up and establish the member record | 2026-08-31 | [#11](https://github.com/didi-code0980/calechip/pull/11), merged 16:49:02Z; board and registry in [#12](https://github.com/didi-code0980/calechip/pull/12), merged 16:50:48Z |
| 2 | TEA-02 | Manage the allow-list | 2026-09-01 | [#13](https://github.com/didi-code0980/calechip/pull/13) |

**TEA-01 shipped with its QA gate passed by operator waiver.** Ten of twelve acceptance criteria
have no test; `tests/permission-model.test.ts` does not exist because no database was provisioned.
Under ADR-005 the row-level policies are the entire authorization model, so what is unverified is the
authorization model. The waiver is marked `temporary: true` in `06-test-report.md` and is reversed by
deleting the `waiver:` block. The work that retires it honestly is *Appendix A* of `02-design.md`.

**TEA-02 shipped with its QA gate waived per ADR-017.** Acceptance criteria and policy enforcement
are untested by automated suites because no live test runner is configured.
