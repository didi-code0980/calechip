---
doc_version: 2
last_updated: 2026-10-13
governed_by: [RULE-01, RULE-09]
---

# ADR-059 — Delivery work (CI, image build, release, deploy) is filed as a seventh feature group, `DLV`

## Status

`PROPOSED` — 2026-10-13, at `/triage` of
`.ai/board/ideas/2026-10-13-a-red-main-merges-unnoticed-and-no-release-is-built-or-deployed.md`.

**This needs the operator's decision. `product` may not accept it.** The request reserves the choice
in words: *"If there is no prefix for ops work, propose one and wait for Ming to approve it. Do not
invent one silently."* Accepting it under ADR-008 would be exactly that silent invention.

**The question, answered by editing this line:** file the CI/CD work as **A — a new group `DLV`**
(recommended), as **B — a new group `OPS`**, or as **C — `ops/<slug>` chore work outside the feature
registry**? Write `ACCEPTED by the operator` with the letter, or `REJECTED by the operator`.

## Context

`.ai/registry/features.md` declares six groups: `CAL`, `ADM`, `TEA`, `UIE`, `EVT` and `TSK`. It says
*"Extending this set requires an ADR."* Every one of the six names something a **role can do in the
product**.

The CI/CD request names none of that. What it describes is how the operator gets merged code
checked, built, released and onto the home server. Nothing in it is a capability a member or an
admin gains.

The loop still needs a feature ID. Definition of Ready item 1 requires `feature_ids` to resolve to
`features.md`, and `/plan`, `/review` and `/ship` all work against one. The request asks for exactly
that loop: *"so it enters the normal ticket loop"*.

There is a second route already defined. `.ai/standards/git-conventions.md:33` names chore, model
and tooling work `ops/<slug>`, landed outside the loop, and the allowed-paths check is inactive on
those branches.

`OPS` is the request's own word, and it is already in use. `OPS-001`, `OPS-002` and `OPS-004` are
ticket IDs that carry feature IDs from `CAL` and `TEA`, and the board cites them 253 times. Check D1
matches `OPS-\d{2}\b`, so it would not mistake `OPS-001` for a feature. A reader would.

## Options

**A — `DLV`, *Delivery — checking, building, releasing and deploying the product*.** (Recommended.)
- Each pipeline phase becomes a row and a ticket, with plans, reviews, `allowed_paths` and a ship.
  That is what the request asks for.
- It shares no letters with an existing ticket ID.
- Cost: the first group that is not a product capability. `features.md` § *Columns* says `DONE`
  means *merged*. For a deploy workflow, merged and working are further apart than for a screen.
  Phase 6's dry run is what closes that gap.

**B — `OPS`, the request's own word.**
- Same as A.
- Cost: `OPS-01` and `OPS-001` would sit on one board and mean different things. The `OPS-0nn`
  tickets are delivered product copy and bootstrap work, not pipelines.

**C — no group; `ops/<slug>` chore work.**
- No registry change. The work lands fastest.
- Cost: none of the loop's gates apply. There is no plan, no isolated review and no
  `allowed_paths`. The request explicitly asks for them, so this contradicts its § 1.

## Decision

Proposed: **A**.
- `DLV` joins the `<!-- id-prefixes: -->` line, the prefix table, and a `## DLV — Delivery`
  section in `.ai/registry/features.md`.
- Rows are issued by `product` at the re-triage that follows acceptance (ADR-007), one per pipeline
  phase. The idea file proposes six.
- ADR-028's step 2 reads *"`CAL`, `ADM`, `TEA`, `EVT`, `TSK` or `DLV`, by area"*, as ADR-058
  extended it before.

## Consequences

- **A `DLV` ticket's `allowed_paths` names `.github/workflows/**` and `docs/ops/**` entries
  explicitly.** `scripts/check-allowed-paths.mjs` and `mir-tracking` stay unchanged, as the request
  says.
- **The `devops` agent becomes the developer for `DLV` tickets.** Its description already scopes it
  to `.github/workflows/` and the scripts they call. `/implement` dispatches `developer` today, so
  `/plan` names which one each ticket uses.
- **Delivery tickets cannot meet "verify green" until the first one turns `main` green.** That ticket
  carries the exception, in its own Definition of Done. The request's own rule — *"never mark a
  ticket shipped with a red required check"* — applies from the moment the check is required, which
  is CHECKPOINT 1.
- `features.md` `doc_version` moves when the prefix lands.

## Revert condition

The operator rejects this at merge, or chooses B or C. Before any `DLV` row is issued, reverting
means deleting this file's effect: the prefix line, the table row and the section. After rows are
issued, nothing is renumbered, and a superseding ADR moves new work.

## Affected documents

| File | `doc_version` |
|------|---------------|
| `.ai/registry/features.md` | 5 → 6, when accepted: prefix line, prefix table, `## DLV — Delivery`, written with the first rows |
| `.ai/registry/decisions/ADR-028-uie-is-a-fourth-feature-group.md` | none — its step 2 list is read as extended |
