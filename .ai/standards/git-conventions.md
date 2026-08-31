---
doc_version: 2
last_updated: 2026-08-31
governed_by: [RULE-03, RULE-09, RULE-10]
---

# Git conventions

## Line endings

`.gitattributes` sets `* text=auto eol=lf`, with explicit `eol=lf` for `.mjs`, `.md`, `.json`,
`.yaml`, and `.yml`. It should be the first file in a repository, before any other content, so that
nothing is ever committed with the wrong endings.

A system `core.autocrlf=true` does not override it — `.gitattributes` wins per path. Do not configure
an editor or a hook to change this.

This matters more than it looks. CRLF in a `.mjs` file that another tool executes, or in a fixture a
test compares against, produces failures that reproduce on one machine and not another.

## Branches

One branch per ticket. **The name is not decoration** — `.claude/hooks/guard-allowed-paths.mjs` and
`scripts/check-allowed-paths.mjs` both resolve the active ticket by parsing it, and both treat
anything that does not begin `feat/` as chore work and let it through unchecked.

### The four names

| Kind | Pattern | Example | Cut from | Path guard |
|---|---|---|---|---|
| Feature ticket | `feat/<FEATURE-ID>` | `feat/EXA-01` | `origin/main` | **active** |
| Bugfix on a shipped feature | `bugfix/BUG_<FEATURE-ID>_<NN>` | `bugfix/BUG_ORD-01_01` | `origin/main` | inactive |
| Chore, model, tooling | `ops/<slug>` | `ops/single-folder` | `origin/main` | inactive, correctly |
| — | `fix/` | — | — | **retired** |

`<FEATURE-ID>` is a row in `.ai/registry/features.md` and nothing else — RULE-17, and check D1 fails
the audit on an ID that does not resolve. `<NN>` is two digits, sequential per feature, starting `01`.
The bug ID carries its parent feature inside it on purpose: a bug branch that cannot be traced to a
feature is a bug nobody can decide the priority of.

**`fix/` is retired**, replaced by `bugfix/` with a structured ID. It had no ID scheme, so two defects
on the same feature produced two branch names with nothing in common.

**`bugfix/` runs with the path guard disabled, and that is a defect rather than a decision.** Both
resolvers hard-code the string `feat/`. A bugfix branch therefore gets no `allowed_paths` enforcement
at write time and no CI check on the diff — for work that touches shipped code, which is when it
matters most. This is carried from the origin project unfixed, deliberately: the fix is a change to
two guarded files with their own tests, and it is worth reviewing on its own. **No `bugfix/` branch
exists in a fresh repository, which makes the moment you adopt this kit the cheapest one to fix it.**
Record it in `.ai/board/model-debt.md` on day one so it is not discovered by the first hotfix.

### The branch check every ticket command runs

Every command that takes a `<TICKET-ID>` opens with the same four reads, before it writes anything:

```
pwd
git branch --show-current
git fetch origin --quiet
git status --porcelain
```

Then one of two modes. **Which mode a command is in is stated in that command's step 0 and is not the
running agent's to choose.**

| Mode | Commands | When the branch does not exist |
|---|---|---|
| **create** | `/spec` only | `git switch -c feat/<ID> origin/main` |
| **stop** | every other ticket command | **Stop and report to the operator.** Do not create it. |

**Only `/spec` may bring a `feat/` branch into existence.** Every later stage arriving at a missing
branch means something upstream did not happen — SPEC was never run, or the branch was never created,
or the ID is wrong. Creating it there would manufacture an empty branch that looks like progress and
hides which of the three it was.

Common to both modes, in every command:

- **A dirty tree is a stop.** `git switch` carries modified and untracked files onto the branch you
  arrive at, which is how one ticket's artifacts land on another ticket's branch. Print the paths and
  say which ticket they belong to.
- **Existence is two refs, not one.** Check `refs/heads/<branch>` and `refs/remotes/origin/<branch>`
  separately. A branch that was pushed and then merged still exists on the remote after the local one
  is deleted, and a branch created locally and never pushed exists only here.
- **Cut from `origin/main`, never local `main`.** No lane checks `main` out, so nothing updates it;
  a branch cut from local `main` looks correct and silently omits everything merged since.

## Commits

**Agents do not commit — with one exception, and the exception is keyed to the command rather than to
a role.** Every other stage leaves the working tree dirty. That is deliberate: a commit is an
assertion that a change is coherent, and that assertion is one of the things being validated.

The exception exists because one command cannot complete without it. `/ship` step 7 requires an open
pull request, a pull request requires commits on a pushed branch, and nothing else in the loop
produces them.

**One commit point per ticket, and it is `/ship`.**
[ADR-006](../registry/decisions/ADR-006-single-working-directory.md) removed `handoff` along with
the three worktrees it existed to serve: with a single working tree there is no next folder that
needs the work committed before it can read it.

| Command | Run by | Commits |
|---|---|---|
| `/ship` | `orchestrator` | the story, the design, the source tree, the test tree, artifacts 01–06, `state: DONE`, the board files — then the pull request |

**What this costs, and it is a real cost rather than a footnote.** Everything a ticket produces stays
uncommitted from `/spec` to `/ship`. There is no intermediate save point, no continuous integration
result until the end, and nothing in history to revert to. ADR-006 records both the acceptance and
the revert condition: the first time a ticket's work is lost or lands on the wrong branch is enough
to restore `handoff` as a checkpoint.

**So the dirty-tree stop above is no longer defence in depth. It is the defence.** `git switch`
carries modified and untracked files onto whichever branch is arrived at, and with a whole ticket
uncommitted that is not an inconvenience — it is the loss.

**RULE-09 is unchanged and needs no ADR to permit this.** It names schema changes, ADRs, registry
edits and PR merges. Committing was never among them — the prohibition lives here, in a standard, and
it is this standard that carries the exception. Recorded because the shape recurs: a belief about
what a rule says, held confidently by every document that cites it, and contradicted by the ledger.

### What the orchestrator decides

How the work is grouped. It classifies the working tree, chooses which files form one coherent
change, how many commits there are, and what each message says. That judgement is its own and this
document does not constrain it.

### What it does not decide

**The branch boundary, because CI is branch-scoped and not commit-scoped.**
`scripts/check-allowed-paths.mjs` computes its diff as `origin/main...HEAD` — the whole branch.
Splitting mixed work into separate *commits* on `feat/<TICKET-ID>` therefore buys nothing: the
`allowed-paths` check still sees every file on the branch, fails, and branch protection then blocks
the very merge a human is meant to perform. The split has to be by branch.

| Set | Contents | Branch | Result |
|---|---|---|---|
| Ticket | paths matching `allowed_paths`, plus `.ai/board/tickets/<TICKET-ID>/**` | `feat/<TICKET-ID>` | the ticket's pull request |
| Everything else | model, registry, standards, hooks, scripts, tooling | `ops/<slug>` cut from `main` | a second pull request, reviewed on its own |

The `ops/` branch is not a lesser pull request, and committing a CODEOWNERS path is not a rule being
bent. `.github/CODEOWNERS` requires human review on the registry, the standards, `.claude/`,
`.github/` and `.mcp.json`. That is what makes recording such a change safe to automate: the
orchestrator records it, a human still approves it. **Recording is not authoring.** RULE-01 governs
who *writes* the registry, and that is untouched by this exception.

Two limits are not the orchestrator's to weigh:

- **`main` is never a commit or a push target.** `git push origin main` and `git push --force` stay
  denied in settings.
- **Merging stays human.** RULE-09. `gh pr merge` stays denied.

`git push` is deliberately absent from the allow list, so every push prompts once. That prompt is the
last point at which a human sees a branch name before history exists.

### The second exception: a direct instruction

**Any agent may commit and push when the operator instructs it to, in that session, for that work.**
The authorization is the instruction; it does not generalize to the next run, and no agent infers it
from having been given it before.

This is stated rather than left implicit because the alternative is worse in both directions.
Unstated, it makes the first paragraph of this section false the first time an operator says "commit
this" to anything but the orchestrator — and a standard that everyone routinely violates stops being
read as a standard. Stated too broadly, it becomes the exception that swallows the rule. So it is
narrow on purpose: an instruction, in the session, for the work in front of it. Two things it never
grants, because they are not this document's to grant: a merge (RULE-09) and a write to
`.ai/registry/**` (RULE-01).

Work that is not a ticket does not go on `feat/<TICKET-ID>` — that name activates the path guard
against a ticket the work has nothing to do with. Chore work is `ops/<slug>`.

The message references the ticket ID and the stage, whoever writes it:

```
<TICKET-ID>: implement the order list read path

Design contract items 1-4. Files listed in 03-impl-log.md.
```

## Pull requests

The loop's terminal output is an **open pull request**, never a merge. Per RULE-09, merges are
permanently human.

`/ship` runs the build, marks the ticket DONE, and opens the PR with `gh pr create`. `gh pr merge` is
in the settings deny list, so an agent that tries to merge is blocked rather than trusted not to.

The PR body links the ticket folder and lists the four gate timestamps.

## Protected operations

Denied in `.claude/settings.json`:

- `git push --force`
- `git push origin main`
- `git reset --hard`
- `gh pr merge`

`git reset --hard` is denied because an agent recovering from a confusing state will reach for it,
and the state it discards includes the artifacts that explain how the confusion happened.

## Branch protection

Points at exactly two status checks: `verify` and `allowed-paths`.

**Do not enable it until the `verify` workflow has passed at least once.** A required check that has
never passed blocks every pull request, including the operator's, and the only way out is to disable
the protection you just configured.

TODO(project): `.github/workflows/` ships empty in this kit. Both status checks have to exist before
branch protection is switched on; `scripts/check-allowed-paths.mjs` is the whole of `allowed-paths`,
and `verify` is the project's own typecheck, lint and test commands plus `node scripts/check-docs.mjs`.

## CODEOWNERS

`.github/CODEOWNERS` requires human review on `.ai/registry/`, `.ai/standards/`, `.claude/`,
`.github/`, and `.mcp.json`. These are the paths where RULE-01 and RULE-09 apply, and CODEOWNERS is
the mechanism that makes them apply to a pull request rather than only to a hook.

TODO(project): add the schema directory to that list once the datastore is chosen. A migration is
RULE-09 human, and CODEOWNERS is where that becomes true of a pull request.

## Git is the source of truth

RULE-10. The tracker mirrors state and is never read back to decide what happens next. A ticket's
state is what `ticket.yaml` says on disk, not what a tracker status field says.
