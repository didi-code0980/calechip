---
doc_version: 1
last_updated: 2026-08-25
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

## TODO(project): this file ships empty and must be filled before the first `/spec`

Two things belong here and neither can be guessed:

1. **The group prefixes** — three uppercase letters each, one per coherent area of the product, with
   the expansion written out. Fix the set once; extending it later requires an ADR.
2. **One section per prefix**, each carrying the row table below with no rows.

Nothing else in this kit needs editing to make feature IDs work. Check D1 reads the machine-readable
prefix line below and reports any three-letter feature token in any document that does not resolve to
a row.

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

<!-- id-prefixes: -->

| Prefix | Expansion |
|--------|-----------|
| TODO(project) | one row per group, for example ORD — Orders |

## TODO(project): group sections go here

One per prefix, in the shape below. Delete this heading once the first real one exists.

| ID | Title | Group | Status | Invariants touched | Notes |
|----|-------|-------|--------|--------------------|-------|
