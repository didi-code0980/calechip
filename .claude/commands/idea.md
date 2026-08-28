---
description: Capture a raw request as a written idea under .ai/board/ideas/
argument-hint: <text>
---

Dispatch the `product` subagent.

**Input:** `$ARGUMENTS`
**Template:** `.ai/templates/idea.md`
**Output:** a new file in `.ai/board/ideas/`, named `<yyyy-mm-dd>-<kebab-slug>.md`
**Gate:** the file states a problem, not a solution; it has no feature ID.

An idea has no feature ID and does not become one here. Only a human writes to
`.ai/registry/features.md` (RULE-01).

Policy lives in `.ai/01-operating-model.md`. Do not restate it; follow it.

---

## Last step: sign off

**End your reply with the block in `## Replying` (`CLAUDE.md`).** It is not a footer on the reply —
for most runs it *is* the reply. Do not stop at the step above and leave the operator to work out who
answered, whether it passed, where the repository is, and what runs next.

This command writes no artifact and passes no gate, so the first line ends `gate n/a`. *Tiếp theo* names
whatever the board says runs next, **with its folder** — not a topic, a command.
**You hold no `Bash` tool**, so you cannot run `date` or `git branch --show-current`. Write
`unavailable — no Bash tool` on both lines. Guessing either is worse than leaving them blank.
