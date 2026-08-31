# CaleChip

A planning board on which every member of one team declares, as far ahead as they know, when they
will be on leave (PTO) or working from home (WFH) — so the team can see a crowded day while it is
being created rather than the night before. It distinguishes exactly two roles: **members**, who
create and edit their own entries and read everyone's, and **admins**, who additionally approve,
reject, maintain the Vietnamese holiday calendar, invite people and set the overload threshold.
It is not an HR system, it holds no leave quota, and a warning here never blocks an action —
[.ai/00-charter.md](.ai/00-charter.md) carries the six refusals and the reason for each.

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
| [.ai/standards/](.ai/standards/) | Tech stack, architecture, coding, data model, RBAC, testing, UI, git, sessions, integrations |
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

**[.ai/standards/tech-stack.md](.ai/standards/tech-stack.md) is the single source.** Language,
framework, datastore, runners and package manager are named there once, and cited everywhere else.
Do not restate any of them here — a second copy is a second thing to keep true, and the copy is
always the one that goes stale.

Two things that file will tell you and that are worth knowing before you write a line of config:
it records **majors, never resolved versions** (the manifest and the lockfile carry those), and it
carries a list of dependencies that are **past reliable recall**. For anything on that list, open the
real file — the installed types, the package's own docs, the config on disk — before writing config
against it. `TODO(verify):` is the correct output when a fact cannot be confirmed; a confident guess
is not.

## Visual direction

Pastel and rounded on the surface, dense and precise in the grid. PTO is peach, WFH is mint,
holidays are lavender, an overloaded day is a soft pink that is deliberately not an alarming red.
Tentative entries are a dashed border at reduced opacity; approved ones carry a small star. Type is a
rounded face with correct Vietnamese diacritics — Nunito or Baloo 2, never Quicksand.

**The calendar grid is the most-used screen and information density wins there every time.** Charm
belongs in the empty states, the mascots and the approval moment; it never costs a row in the year
view. Details, and the Vui/Gọn density toggle, are in
[.ai/standards/ui-design-system.md](.ai/standards/ui-design-system.md).

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
The conversation language here **is** Vietnamese, confirmed 2026-08-31, so the four labels below
stand as shipped and no translation is owed.

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
