---
description: Capture a request as an idea and triage it into REJECT, NEEDS-ADR, or PROMOTE
argument-hint: <raw request in quotes> | <idea-filename>
---

Dispatch `product` and `tech-lead-design`.

**This command absorbed `/idea` — ADR-019.** There is no longer a separate IDEA stage: writing the
idea and judging it happen in one run. `$ARGUMENTS` is therefore one of two things, and you decide
which by looking:

| `$ARGUMENTS` is | What you do |
|---|---|
| A filename that exists under `.ai/board/ideas/` | Skip step 0. Judge the file as it stands. |
| Anything else — a sentence, a paragraph, a complaint | Step 0 first: write the idea file, then judge it. |

## Step 0 — write the idea, when there is not one yet

**Template:** `.ai/templates/idea.md`
**Output:** a new file in `.ai/board/ideas/`, named `<yyyy-mm-dd>-<kebab-slug>.md`
**Gate for this half:** the file states a **problem, not a solution**, and carries no feature ID.

**Write it before you judge it, and write it as though somebody else would judge it.** That order is
the only thing left of the separation this command absorbed — the same run now states the problem and
rules on it, so a problem quietly narrowed to fit the verdict its author already has in mind is the
failure mode, and nothing catches it except writing the problem down first.

An idea has no feature ID. The ID is issued below, on PROMOTE, and not before.

## The verdict

**Input:** the idea file, plus `.ai/registry/**`
**Output:** the verdict appended to that idea file
**Gate:** exactly one verdict, with a reason.

| Verdict | Means |
|---|---|
| REJECT | Not worth doing, or already covered. Say which. |
| NEEDS-ADR | Needs a registry, schema, or dependency decision. **Write the ADR** — see below. |
| PROMOTE | Worth building. Write the feature row. |

**On NEEDS-ADR, draft the ADR — do not hand the operator homework.** Every ADR in this repository
was written by an agent from a sentence the operator said; asking them to author one contradicts how
the model actually works. Produce the whole document: context, the options with their trade-offs, a
recommendation, consequences including what gets worse, and a revert condition.

Then one of two things, and the test is not a judgement call:

- **The decision sits inside what is already decided** — accept it yourself, `ACCEPTED by <agent>`
  (RULE-09, ADR-008). The operator reviews it at merge.
- **The decision would supersede or reverse an accepted ADR** — stop and ask, in one question. That
  is changing the envelope rather than working inside it, and `ACCEPTED by the operator` is a claim
  about a person that you may not write on their behalf.

**On PROMOTE, `product` writes the row to `.ai/registry/features.md`** — ADR-007. Allocate the next
free number in the group, set `Status` to `PLANNED`, and **put the idea filename in the `Notes`
column**. That citation is not decoration: it is the only provenance a reviewer has, and a row
without one is indistinguishable from an invented feature.

**Then create the ticket, per row** — ADR-010. A promoted feature that appears in no ticket and no
backlog row is a decision to build something the board cannot see, and `/next-ticket` will correctly
report nothing to do.

1. `.ai/board/tickets/<ID>/ticket.yaml`, copied from `.ai/templates/ticket.yaml`, `state: BACKLOG`.
2. Fill **Definition of Ready items 1, 3, 4 and 6** — all four are produced at BACKLOG:
   `feature_ids`, `depends_on`, `schema_delta` with its ADR linked when it is not `none`, and one
   feature group per ticket.
3. Append a row to `## BACKLOG` in `.ai/board/backlog.md`.

**Leave `invariants_touched` and `size_estimate` empty.** They are items 2 and 5, they belong to
PLAN, and the gate sits after PLAN precisely so they can. Filling them here is inventing an
acceptance criterion's worth of judgement before the plan exists.

**`product` writes the row, not `tech-lead-design`** — including here, where both are dispatched
together. `tech-lead-design` writes the plan later, at `/plan`, and the role that will write the plan
is never the role that granted the ID it writes against. That separation survived ADR-019; it is the
last one in the front half of the loop, which is why it is stated rather than assumed.

The operator approves at merge, under CODEOWNERS — which is where RULE-01 says enforcement lives.
Nothing here is committed; the row travels with the ticket and lands on the ticket branch at
`/ship`, in the same pull request as the ship — ADR-023.

Policy lives in `.ai/01-operating-model.md`.

---

## Last step: sign off

**End your reply with the block in `## Replying` (`CLAUDE.md`).** It is not a footer on the reply —
for most runs it *is* the reply. Do not stop at the step above and leave the operator to work out who
answered, whether it passed, where the repository is, and what runs next.

This command writes no artifact and passes no gate, so the first line ends `gate n/a`. *Tiếp theo* names
whatever the board says runs next, **with the session it belongs in** — not a topic, a command.
**You hold no `Bash` tool**, so you cannot run `date` or `git branch --show-current`. Write
`unavailable — no Bash tool` on both lines. Guessing either is worse than leaving them blank.
