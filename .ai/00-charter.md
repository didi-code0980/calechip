---
doc_version: 1
last_updated: 2026-08-25
governed_by: [RULE-01, RULE-09]
---

# Charter

What this system is for, and what it refuses to do.

**TODO(project): this file ships as a stub and is the first thing to write.** It is deliberately not
pre-filled: a charter inherited from another product is worse than no charter, because every agent
reads it as true and nothing in the audit can tell that it describes something else.

## What this is

TODO(project): two or three paragraphs. The problem the system exists to solve, for whom, and the
boundary of the thing being built. Write what is in scope in terms a person outside the team would
recognise, not in terms of the modules that will implement it.

## What it refuses to do

TODO(project): a numbered list of refusals — capabilities this system will deliberately never grow,
each with the reason.

**This is the half that earns the file.** A scope statement expands quietly; a refusal has to be
argued with before it can be removed, and the argument is what surfaces the change of direction. Two
things worth knowing before writing them:

- **A refusal that no ticket has ever pushed against is not yet load-bearing.** Write it anyway, but
  expect the real list to be discovered by the first three tickets that want to cross one.
- **A refusal that becomes false must be amended, not left standing.** ADR-004 is the case on record:
  a project refusing to let agents change the rules they are judged by removed the guard that made
  that true, and the ADR amends the charter in the same commit rather than leaving a sentence that
  reads correct and is not.

## Roles

TODO(project): the roles the system distinguishes, and the one-line difference between them. This is
what design section 2 gates against and what `.ai/standards/rbac-and-security.md` expands.

## What this document is not

Not a requirements list, not a roadmap, not a feature registry. Features live in
`.ai/registry/features.md` and are added by a human (RULE-01). A charter that starts listing features
has become a backlog with no ordering.
