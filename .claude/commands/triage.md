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
| NEEDS-ADR | Needs a registry, schema, or dependency decision. Name what must be decided. |
| PROMOTE | Worth building. Write the feature row. |

**On PROMOTE, `product` writes the row to `.ai/registry/features.md`** — ADR-007. Allocate the next
free number in the group, set `Status` to `PLANNED`, and **put the idea filename in the `Notes`
column**. That citation is not decoration: it is the only provenance a reviewer has, and a row
without one is indistinguishable from an invented feature.

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
