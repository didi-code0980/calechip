# TODO(project): the product name

TODO(project): one paragraph. What this system is, who uses it, and the roles it distinguishes. Two
or three sentences — this line is read by every agent in every session, so it is the cheapest place
in the repository to be wrong and the most expensive place to be vague.

**This repository was stood up from `aifw-template`.** Until the `TODO(project):` markers below and
in `.ai/` are resolved, the loop will run and produce nothing useful: `/spec` has no feature ID to
work from, `/design` has no architecture to design against, and `/qa` has no command to run. The
ordered checklist is in [SETUP.md](SETUP.md).

## Read these before doing anything

| File | What it is |
|------|------------|
| [.ai/00-charter.md](.ai/00-charter.md) | What this system is for and what it refuses to do |
| [.ai/01-operating-model.md](.ai/01-operating-model.md) | Lifecycle, stage ownership, gates, chat topology, dispatch loop |
| [.ai/registry/rules.md](.ai/registry/rules.md) | All 18 process rules, each stated exactly once |
| [.ai/registry/invariants.md](.ai/registry/invariants.md) | The domain invariants |
| [.ai/registry/features.md](.ai/registry/features.md) | The only valid source of feature IDs |
| [.ai/standards/](.ai/standards/) | Architecture, coding, data model, RBAC, testing, UI, git, integrations |
| [.claude/PERMISSIONS.md](.claude/PERMISSIONS.md) | Why each permission and hook exists |
| [.ai/steward/context.md](.ai/steward/context.md) | **How the operator wants to be worked with.** Standing instructions, and the log of what changed and why |

**Read the standing instructions in `.ai/steward/context.md` before your first reply in a session,
whichever agent you are.** They are durable operator preferences — autonomy, answer length, language,
what to verify before speaking — and they apply whether or not the current message repeats them. The
operator named "having to explain the same preference again" as a standing cost; that file is the
mechanism against it. It is board plane and agent-writable, but only the steward appends to it.

## Three rules reproduced here

These are copied verbatim from `.ai/registry/rules.md` because they are too important to sit one
indirection away. `scripts/check-docs.mjs` check D7 verifies the copies match character-for-character.
Every other rule is cited by ID, never restated.

- **RULE-01** — Changing `.ai/registry/**` requires an ADR and human approval. Enforcement is CODEOWNERS review on the pull request, not a hook.
- **RULE-02** — No component may bypass the data-access seam declared in `.ai/standards/architecture.md`. Enforced by a lint rule, not convention.
- **RULE-03** — An agent may not edit any file outside the active ticket's `allowed_paths`.

## Two planes

`.ai/registry/` and `.ai/standards/` are permanent and human-only. `.ai/board/` is transient and
agent-writable. A ticket's working directory is `.ai/board/tickets/` — never under the registry.

## Stack

TODO(project): the languages, frameworks, datastore, test runners and package manager, with versions.

**Name what is past reliable recall and say so here.** Any dependency whose current release is newer
than the model's training data must be inspected — installed types, the package's own docs, the real
config file — before config is written against it. `TODO(verify):` is the correct output when a fact
cannot be confirmed; a confident guess is not. This paragraph is not boilerplate: in the origin
project a framework major version had moved connection configuration between two files and inverted
which one wanted which URL, and writing it from memory produced migrations that failed intermittently
rather than cleanly.

## Visual direction

TODO(project): accent colour, neutrals, type, component shape — or delete this section if the system
has no interface. Details belong in
[.ai/standards/ui-design-system.md](.ai/standards/ui-design-system.md); this is the two-line summary
an agent reads without opening it.

## Working agreements

- **Windows-native.** No `.sh` files, no `chmod`, no shebang execution. Every hook is `.mjs` run via
  `node`. Delete this bullet only if the whole team is on POSIX — the hooks themselves are portable
  and stay `.mjs` either way.
- **No invention.** No invented feature IDs, acceptance criteria, database fields, or invariants.
  Missing information becomes a placeholder plus an entry under `OPEN QUESTIONS`.
- **Additive only.** Do not delete or rewrite a file you did not create in the current run.
- **Humans merge. Agents commit at `/handoff` and `/ship` only.** Every stage leaves the tree dirty.
  `/handoff` persists a finished lane and releases the branch so the next worktree can take it;
  `/ship` adds the state transition and opens the pull requests. Both classify the tree and keep
  ticket work and chore work on separate branches. Merging is permanently human — RULE-09. Scope and
  limits in [.ai/standards/git-conventions.md](.ai/standards/git-conventions.md).
- **Three worktrees, one travelling branch.** The design lane holds `orchestrator`,
  `tech-lead-design` and `ba`; the implement lane holds `developer`, `tech-lead-review` and `qa`; the
  model lane maintains the model and never holds a ticket branch. `feat/<ID>` moves design ->
  implement -> design by `/handoff`. Confirm `pwd` and `git branch --show-current` before the first
  instruction of a session — since ADR-004 nothing stops a session writing to the wrong folder's
  branch. [.ai/standards/session-model.md](.ai/standards/session-model.md).

## Replying — the sign-off is the reply

**Default to the sign-off block and nothing else.** A command that ran and passed is four lines. This
is a rule about the operator's time: they read every reply, and a wall of confirmed-fine detail buries
the one line that was not.

Add prose *above* the block only when one of these is true, and only as much as it takes:

- **You stopped.** What stopped you, and what would unblock it. Here the detail is the whole value.
- **You found something the operator has to decide**, or something true that nobody asked about and
  nobody would otherwise notice. One or two sentences.
- **You did something other than what was asked**, or did nothing where something was expected.

**Never include:**

- A narration of the steps you ran. Git, the artifacts and the gate front-matter are the record; a
  transcript of them in chat is a second, worse copy that goes stale immediately.
- A table of checks that all passed. *Passed* is one word.
- The file classification you already acted on — `git show --stat` holds it, and the commit has
  happened, so printing it invites review of something already done.
- A restatement of what the command file says the command does. The operator can read it, and it is
  in the repository where it stays true.

**Evidence belongs in the repository, not in the reply.** If a claim you want to make cannot be
checked from a file or a commit, that is a reason to write the file — not a reason to write more chat.

### The block

**End every reply to the operator with this block, whoever you are.** Four lines, this order, nothing
else in it.

**The labels are in the conversation language named in `.ai/steward/context.md`.** That file ships
carrying the origin operator's preference, which is Vietnamese; the block below is shown in that form
because a template that showed English would silently contradict the standing instruction beside it.
TODO(project): if the conversation language here is different, translate the four labels once, in
this block, and nowhere else.

```
---
**Tôi là `<agent>`.** Vừa <what you did> — <TICKET-ID>, gate <PASS | FAIL | BLOCKED | n/a>.
**Xong lúc:** <output of `date '+%Y-%m-%d %H:%M %Z'`>
**Branch:** <output of `git branch --show-current`, or `detached @ <sha>`>
**Tiếp theo:** <command> — trong folder <design | implement | model>
```

- **Read the time and the branch. Never supply them from context.** `date` and
  `git branch --show-current`, every time, even when you are confident. A sign-off is a claim about a
  machine's state, and an invented one is worse than none because it looks measured.
- **No `Bash` tool means `unavailable — no Bash tool`**, not a guess. `product` is the only agent in
  this position today.
- **Quote the gate from your artifact's front-matter.** If your reply completes no command, write
  `gate n/a` and say what you are waiting on in the *Tiếp theo* line.
- **Name the folder, not just the command.** Three worktrees make a correct command in the wrong
  folder a silent write to the wrong branch.
- **On a FAIL, *Tiếp theo* is the routed command**, per the routing table in
  `.ai/01-operating-model.md` — not the next happy-path stage. On `ESCALATED`, it is a human decision
  and there is no command; say so.
- **Never put this block in an artifact.** It is conversation. Artifacts carry front-matter, and that
  is the record.

## Commands

**The loop**, which builds the product — `/idea` `/triage` `/next-ticket` `/spec` `/design`
`/handoff` `/implement` `/review` `/qa` `/handoff` `/ship` `/sprint-status` `/pull-tickets`
`/sync-tracker` `/docs-audit`

**The model**, which maintains the loop — `/thuki` (steward: rules, hooks, checks, registry; never
ticket work) and `/status` (reads the board; reports what is true and what waits on a human).

One file each in [.claude/commands/](.claude/commands/); policy lives in the operating model.
