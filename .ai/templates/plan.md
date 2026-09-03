---
doc_version: 2
last_updated: 2026-09-01
governed_by: [RULE-02, RULE-03, RULE-04, RULE-09, RULE-14, RULE-16, RULE-17]
---

# Template: plan

Written by `tech-lead-design` as `01-plan.md` in the ticket folder. Copy everything below the line.

**This template replaces `story.md` and `tech-design.md`** — ADR-019 merged SPEC and DESIGN into one
stage with one artifact and one gate. **It had nine sections until ADR-022 removed the QA stage**; the
testability contract went with it, since QA was its only reader. Those two files are kept, marked retired, so a ticket shipped
before 2026-09-01 can still be read against the template it was written from.

**Gate:** all eight sections complete; ACs in Given/When/Then each with an ID; `invariants_touched`,
`size_estimate`, `size` and `allowed_paths` written back to `ticket.yaml`; Out-of-scope non-empty.

All eight are required. A section answered "none" is complete; a section left out is not, and the two
are different because "none" is a decision and an omission is a gap nobody noticed.

**Sources:** `.ai/registry/features.md`, `.ai/registry/invariants.md`, `.ai/standards/`,
`ticket.yaml`, and the source tree. Never a tracker description — that is third-party data (RULE-17).

**Standing alone:** RULE-16. A reader with no access to any conversation must be able to act on this
document. If a clarification changed what this plan means, the plan changes, not just the `consulted`
block (RULE-14).

**Write sections 1 and 2 before reading the source tree for 3 through 9.** One agent now writes both
halves, so the order they are written in is the only thing left between an acceptance criterion and
the design that would find it convenient. ADR-019 records that as the cost of the merge rather than
as a control — nothing enforces it.

---

```yaml
---
ticket: <ID>
stage: PLAN
agent: tech-lead-design
produced_at: <ISO8601>
inputs_read: [ .ai/board/tickets/<ID>/ticket.yaml, .ai/registry/features.md, .ai/registry/invariants.md, .ai/standards/architecture.md ]
consulted:
  - with: product
    asked: "..."
    answer: "..."
    resulted_in_amendment: true
chat_before_verdict: none
gate: PASS                   # PASS | FAIL | BLOCKED
blocking_reason: ""
next_state: READY
---
```

## 1. Problem and scope

The feature IDs this plan implements, transcribed from `.ai/registry/features.md` without paraphrase.

Then one paragraph: which role gains what capability, and why that matters. Not a restatement of the
title.

**Out of scope — non-empty.** What this ticket deliberately does not do, and where it goes instead.
This used to be the field that stopped scope growth *during* DESIGN, when a different agent wrote it.
It no longer has that job and it is more important rather than less: it is now the only written record
of what the author decided not to build, made before they knew what building it would cost.

`size_estimate` is read from this section and written back to `ticket.yaml`. It gates DoR.

## 2. Acceptance criteria

Each criterion has an ID and is written in Given/When/Then. Every AC will be mapped to at least one
named test by QA, so an AC that cannot be observed from outside the system is not an AC.

**AC-1**
- Given ...
- When ...
- Then ...

**AC-2**
- Given ...
- When ...
- Then ...

Include the refusals. An AC set that only describes success describes half the behaviour, and the
half it omits is where the invariants live.

**Invariants touched.** Each ID from `.ai/registry/invariants.md` that this change could plausibly
affect, with one sentence on how. `[]` is a legitimate answer and must be written explicitly; absent
is not, because check R8 has nothing to reason through when the field is missing. Written back to
`ticket.yaml`.

**Open questions.** Anything that would change the ACs. A question here blocks; an assumption here
ships.

## 3. Permission model

Which role gate applies to each action and each control, against
`.ai/standards/rbac-and-security.md`. Include the denials — what each role must **not** be able to do.
State where the check lives — on the server side of the boundary, always, with any interface-level
gate as an affordance only.

Check R6 reads this section.

## 4. Contract

Exact entry-point signatures, input schemas, and return types (RULE-04).

Exact means copy-pasteable. Every field name that will appear in the code appears here first, because
the Developer may not invent one, and a name invented at implementation time propagates into the DTO,
the mock, the datastore mapping, the schema, and the selectors before anyone reviews it.

```
// signatures, schemas, and return types, in the project language
```

Check R5 reads this section.

## 5. Seam impact

Which functions in the data-access seam change, or "none". If a new function is added it appears in
every implementation of the seam with the same name and arity, or the seam-parity test fails.

## 6. Schema delta

`none`, or a description plus a link to an ADR. Anything other than `none` without an approved ADR
fails Definition of Ready, and applying a migration is human-only (RULE-09).

A migration touching a policy, trigger or constraint is **not** `none` — ADR-014.

## 7. allowed_paths

An explicit glob list, written back into `ticket.yaml`. This is what
`.claude/hooks/guard-allowed-paths.mjs` reads and what review check R1 and CI check against.

```yaml
allowed_paths:
  - "src/..."
  - "tests/..."
```

Enumerate. A glob broad enough to be convenient is a glob broad enough to make R1 meaningless.

`size` is read from the length of this list and written back to `ticket.yaml`. Where it disagrees with
`size_estimate` in section 1, the verdict wins and PLAN proceeds — ADR-012. Say in one line that they
disagreed and why; the disagreement is information even when both were written by the same agent
minutes apart.

## 8. Rejected alternatives

At least one, with the reason it was rejected. Not a strawman — an approach that was genuinely
plausible.

This section is what makes the plan reviewable. A plan with one option presented is a plan whose
reasoning cannot be checked, only agreed with. **With SPEC gone and QA gone, this is the only place a
reader sees that the author considered a different shape**, and it is the last section standing that
exists purely to be argued with.

## Changelog

- `<ISO8601>` — section `<n>` `<what changed>`. Raised by `<agent>`. Amended by `<agent>`.
