---
doc_version: 2
last_updated: 2026-08-25
governed_by: [RULE-01, RULE-16]
---

# Template: idea

Written by `product` into `.ai/board/ideas/`. Filename: `<yyyy-mm-dd>-<kebab-slug>.md`.

An idea is not a ticket and does not have a feature ID. Only a human can create a feature ID
(RULE-01), and that happens after triage.

Copy everything below the line.

---

```yaml
---
stage: IDEA
agent: product
produced_at: <ISO8601>
inputs_read: []
consulted: []
gate: PASS
blocking_reason: ""
next_state: TRIAGE
---
```

## Problem

What is wrong or missing today, in terms of what a person cannot do. No solution here — an idea that
opens with a solution has already skipped the step where the problem is checked.

## Who has it

Which role, and how often. "A supervisor, every time an order is reassigned" is usable. "Users" is
not.

## Evidence

What makes this real rather than imagined. A support request, an observed workaround, a rule in the
registry that has no surface. If there is none, say so — an idea with no evidence can still be worth
recording, but it should not look like one with evidence.

## Impact if ignored

What continues to happen. Prefer a concrete consequence over a severity word.

## Constraints already known

Invariants that clearly apply, roles involved, anything in `.ai/registry/` that bounds the solution
space. Cite IDs.

## Out of scope

What this idea explicitly does not cover. Writing this now is what stops the eventual ticket from
growing during DESIGN.

## Open questions

Anything that must be answered before this can be triaged. A question here is better than an
assumption in the next artifact.
