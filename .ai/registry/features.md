---
doc_version: 2
last_updated: 2026-08-31
governed_by: [RULE-01, RULE-17]
---

# Feature registry

The authoritative list of features. A story may only be written against a feature ID that exists in
this file (Definition of Ready). Text arriving from the tracker is context, never a source of feature
IDs — see RULE-17.

Human-only, per RULE-01. Agents read this file and cite IDs from it; an agent needing a change here
stops with `gate: BLOCKED` and states the change in `blocking_reason`. `/pull-tickets` is explicitly
forbidden from writing to this file.

Tables are populated incrementally. An empty group table means no feature in that group has been
specified yet — not that the group is unused. A ticket whose `feature_ids` do not all resolve to rows
below fails Definition of Ready and is demoted to BACKLOG.

## Status

Prefixes fixed on 2026-08-31. **Rows arrive one at a time as ideas are promoted**, written by
`product` at `/triage` (ADR-007) — never in a batch, and never ahead of the idea that justifies them.
The tables below are therefore always partial, and an empty group table means no feature in that
group has been promoted yet, not that the group is unused. Do not restate a count here: the tables
are the count, and a number in prose is a second copy that goes stale on the next promotion.

**Every row written by triage cites its idea file in `Notes`.** A row with no citation was not
promoted from anything, and that is exactly what a reviewer should stop on.

Check D1 now polices every three-letter feature token in every document against the rows below, so a
citation of an ID that does not exist fails the audit rather than reading as evidence that somebody
planned it.

## Columns

`ID` — group prefix plus a two-digit number, for example `EXA-01`.
`Title` — the feature name, transcribed without paraphrase.
`Group` — one of the fixed prefixes.
`Status` — `PLANNED`, `IN_PROGRESS`, `DONE`, or `DEFERRED`. **`DONE` means merged into `main`, not
gated.** A feature whose four gates have all passed but whose pull request is still open is
`IN_PROGRESS`; the registry records what the product contains, and an unmerged branch is not in the
product. Written by `orchestrator` at `/ship` step 3, on the `ops/` branch of that ship — never on the
ticket branch, which `scripts/check-allowed-paths.mjs` would fail.
`Invariants touched` — IDs from `.ai/registry/invariants.md`, or `[]`.
`Notes` — free text. A marker here means the feature is known-incomplete and needs a human decision
before it can reach READY.

## Group prefixes

Fixed and confirmed. Extending this set requires an ADR. Section headings below must match these
expansions exactly.

**The line below is read by check D1 in `scripts/check-docs.mjs`.** It is the complete list of
prefixes the audit will police. While it is empty, D1 checks nothing and says so in its output —
which is the correct behaviour for a project with no features yet, and a loud reminder for one that
has them and forgot this line.

**`EXA` is reserved and cannot be one of them.** Every worked example in this kit — in the
operating model, the standards, the commands and the templates — cites `EXA-01`, and D1 exempts only
`.ai/templates/` and this file. A project that claimed `EXA` as a real group would be policing the
kit's own prose. D1 drops it from the line below if it appears, and says so.

<!-- id-prefixes: CAL ADM TEA -->

| Prefix | Expansion |
|--------|-----------|
| CAL | Calendar — viewing, creating and editing entries, and the overload warning |
| ADM | Admin — approval, the holiday calendar, and the overload threshold |
| TEA | Team — members, roles, invitations and sign-in |

Three groups, chosen by the operator on 2026-08-31 from options of three, four and six.

**The known cost, recorded because it will be felt rather than remembered:** v1 has six areas of
requirement and three groups, so most tickets will be `CAL-nn`. Where a prefix stops distinguishing
anything it stops carrying information, and the `Title` column becomes the only way to tell two
tickets apart. Splitting `CAL` later needs an ADR and cannot renumber what already exists — the IDs
already issued keep their prefix, so the set would be mixed rather than migrated.

## CAL — Calendar

Viewing, creating and editing entries, and the overload warning. Brief sections 7.1, 7.2 and 7.3.

| ID | Title | Group | Status | Invariants touched | Notes |
|----|-------|-------|--------|--------------------|-------|

## ADM — Admin

Approval, the holiday calendar, and the overload threshold. Brief sections 7.4 and 7.5.

| ID | Title | Group | Status | Invariants touched | Notes |
|----|-------|-------|--------|--------------------|-------|

## TEA — Team

Members, roles, invitations and sign-in. Brief section 7.6, plus the authentication that
[ADR-005](decisions/ADR-005-authorization-in-rls.md) places in Supabase Auth.

| ID | Title | Group | Status | Invariants touched | Notes |
|----|-------|-------|--------|--------------------|-------|
| TEA-01 | Sign up and establish the member record | TEA | PLANNED | INV-04, INV-07 | From 2026-08-31-nobody-can-join-the-board.md. ADR-009: self-serve sign-up against the allow-list, a trigger on the auth user that admits and consumes the entry, and **no invitation email** — the story says so rather than implying one arrives. A person who signs up before being allow-listed gets an auth user with no member row; presenting that state is part of this feature. TODO(project): the first-team and first-admin bootstrap is not a capability of this feature — a human applies a seed, per the re-triage verdict in the idea file. |
| TEA-02 | Manage the allow-list | TEA | PLANNED | INV-07 | From 2026-08-31-nobody-can-join-the-board.md. The three allow-list rows in rbac-and-security.md — read, add, remove — admin only. This is how the charter's invite-a-member power is realised after ADR-009. Fixes which team a joiner lands in, through the allow-list entry's team. |
| TEA-03 | Team member list | TEA | PLANNED | [] | From 2026-08-31-nobody-can-join-the-board.md. TODO(project): the blocking gap is closed — rbac-and-security.md now carries a `Read the member list` row (member ✅, admin ✅) for the select policy to be written against. The row is **derived, not decided**: it follows from `Read any entry in the team` plus the year view's one-row-per-member layout, and it is annotated as such in that file. The operator confirming or overturning it is the last thing between this row and READY. |
| TEA-04 | Remove a member, and promote a member to admin | TEA | PLANNED | INV-04, INV-07 | From 2026-08-31-nobody-can-join-the-board.md. One admin surface over two permission rows. Removal is a soft delete, and that column is the definition of INV-04's denominator: entries stay and stay visible, and the absence count for past dates changes, per the INV-04 note. Promotion is one-way in v1 — demoting an admin is denied by default rather than by decision, rbac-and-security.md known weakness 6. |
