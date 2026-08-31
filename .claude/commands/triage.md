---
description: Triage an idea into REJECT, NEEDS-ADR, or PROMOTE
argument-hint: <idea-filename>
---

Dispatch `product` and `tech-lead-design` against the idea named in `$ARGUMENTS`.

**Input:** `.ai/board/ideas/$ARGUMENTS`, plus `.ai/registry/**`
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

**Leave `invariants_touched` and `size_estimate` empty.** They are items 2 and 5, they belong to the
BA at SPEC, and the gate sits after SPEC precisely so they can. Filling them here is inventing an
acceptance criterion's worth of judgement before the story exists.

**`tech-lead-design` does not write the row.** Neither does `ba`, later, at `/spec`. The role that
will write the story is never the role that granted the ID it writes against.

The operator approves at merge, under CODEOWNERS — which is where RULE-01 says enforcement lives.
Nothing here is committed; the row travels with the ticket and lands on the `ops/` branch at
`/ship`.

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
