---
description: Build, mark the ticket DONE, and open a pull request
argument-hint: <TICKET-ID>
---

Run in the **orchestrator session** (`.ai/standards/session-model.md`). Nothing is dispatched.

Since ADR-006 this is **the only command in the loop that commits.** Every stage before it left the
tree dirty, so the whole ticket — story, design, source, tests, all six artifacts — is sitting
uncommitted when you arrive.

**Preconditions — all four gates `passed: true` with timestamps.** Verify against `ticket.yaml`, not
against a summary.

Steps:

0. **Confirm the branch. Mode: stop** — the table in `.ai/standards/git-conventions.md`, *The branch
   check every ticket command runs*. `pwd`, `git branch --show-current`, `git fetch origin --quiet`,
   `git status --porcelain`, then `git switch feat/$ARGUMENTS && git pull --ff-only`.

   **If the branch does not exist, stop and report**; this command never creates one.

   **Expect a dirty tree full of source files — that is the normal state here, not a warning sign.**
   Nothing before this command commits. What you must not find is work belonging to a *different*
   ticket: read `git status` in full and classify every path before staging anything. A file you
   cannot place belongs to a human, not to a guess.

1. Run the project's verify command — typecheck, lint, unit, build — named in
   `.ai/standards/testing-standards.md`. Any non-zero exit stops here.
2. Confirm the full Definition of Done in `.ai/01-operating-model.md`, item by item.
3. Set `state: DONE`, move the row to `## ARCHIVE` in `backlog.md`, append to `metrics.md`, **and set
   this feature's `Status` to `DONE` in `.ai/registry/features.md`.**

   **This step is the only writer of that column.** In the origin project it had no writer at all for
   two tickets and drifted silently. `Status` means **merged**, not gated — so you are writing the
   value the pull request you are about to open will make true, and a human merging it is what makes
   it so.

   `features.md` is registry plane. It goes in the **second set** at step 4 and ships on the `ops/`
   branch at step 8, never on `feat/$ARGUMENTS` — `scripts/check-allowed-paths.mjs` fails the ticket
   branch on any path outside `allowed_paths`, and no ticket's list contains the registry. Say so in
   that pull request's body, per step 8's CODEOWNERS clause.
4. **Classify the working tree.** `git status --porcelain`, and sort every dirty path into two sets
   against `allowed_paths` in `ticket.yaml`:

   - **Ticket set** — matches `allowed_paths`, or sits under `.ai/board/tickets/$ARGUMENTS/`. After
     step 0 this is normally only what step 3 just wrote: `ticket.yaml`, `backlog.md`, `metrics.md`.
   - **Everything else** — model, registry, standards, hooks, scripts, tooling, stray files.

   A path you cannot classify goes in the second set; you do not guess it into the ticket. **Do not
   print the two sets** — the commit is the record. Print only the paths that made you stop.

   **`metrics.md` and `backlog.md` are yours and only yours.** No other command writes them — see
   *The one surface that still collides* in `.ai/standards/session-model.md`. They sit outside every
   `allowed_paths`, and they belong in the ticket set anyway, because a board that records a ship in a
   separate pull request from the ship is a board that can be merged out of order.

5. **Commit the ticket set on `feat/$ARGUMENTS`.** Confirm the branch first; if it is anything else,
   stop. `git add` with explicit paths — never `-A`, never `.`. This is the **only** commit the
   ticket gets: the artifacts, the source, the tests, the state transition and the board files, all
   of it. Message form per `.ai/standards/git-conventions.md`. Then
   `git push origin feat/$ARGUMENTS`, which prompts.

6. `node scripts/check-allowed-paths.mjs`. It diffs `origin/main...HEAD` — the **whole branch**, not
   your last commit. A FAIL here means the ticket branch carries a file outside `allowed_paths`, and
   the fix is to move that file to the second set, never to widen the list.

7. **Open the pull request against `main`**, body linking `.ai/board/tickets/$ARGUMENTS/` and listing
   the four gate timestamps.

   `gh pr create` when `gh auth status` reports a logged-in host. **When it does not, the fallback is
   not an improvisation — it is this, and it counts as step 7 completed:** print a
   `github.com/<owner>/<repo>/compare/main...feat/$ARGUMENTS?expand=1&title=…&body=…` URL with the
   title and body already percent-encoded into it, so the operator lands on a filled form and presses
   one button.

   **Check `gh auth status` before composing either, and never run `gh auth login`.** It is an
   interactive TUI: it waits on stdin for an account, a protocol, and a pasted device code, and from a
   non-interactive session it hangs until it is killed. Authenticating is the operator's to do, once,
   outside the loop.

   **This step failed on every ship that reached it in the origin project** — `gh` not installed,
   then `gh` unauthenticated — and each time the outcome was a ticket marked DONE with an empty PR
   column and a human left to guess the next move. A branch name is not a request; it is homework.
   Check `gh auth status` once, before the first ship, rather than discovering it at the last step.

8. **If the second set is non-empty, it gets its own branch and its own pull request.** `git switch
   -c ops/<slug> main`, commit it there in whatever grouping you judge coherent, push, `gh pr
   create`. Name the slug for the work, not for the ticket. Do **not** leave it dirty and do not
   fold it into the ticket branch — step 6 will fail if you do, and branch protection will then
   block the merge a human is waiting to make.

   If that set touches a CODEOWNERS path — `.ai/registry/`, `.ai/standards/`, `.claude/`,
   `.github/`, `.mcp.json` — say so explicitly in the PR body, file by file. You are recording a
   human's change so it can be reviewed, not authoring one: RULE-01 still governs who writes the
   registry, and `guard-registry.mjs` still refuses you.

9. If `tracker.sync_enabled` is true, push `gate_state` and `pr_url`. If it is false, skip silently —
   that is the expected state for early tickets.

10. **Sign off — and the pull request URL goes above the block.** The next command and its folder are
    the *Tiếp theo* line of the block in `CLAUDE.md`; the PR link is the one thing a ship produces that
    the operator cannot get anywhere else, so it goes in the prose above it. Everything else — the
    gates you checked, the files you classified, the commands you ran — stays out. `git show --stat`
    and the ticket folder hold all of it.

    Name the session, not just the command. RULE-13 makes a correct command in a reused session a
    verdict that was not really reached.

11. **Leave the branch where it is.** The pull request is open and the branch belongs to whoever
    merges it. Do not switch away, do not delete it, and do not update local `main` — the next
    `/spec` cuts from `origin/main` and fetches for itself.

    There is nothing to release: with one working directory nothing else is waiting for the name.

**The output is an open pull request. Never a merge.** RULE-09 makes merging permanently human, and
`gh pr merge` is denied in settings.

You commit here and nowhere else. Every stage leaves its tree dirty and this command is the only one
that persists it. Two things are never yours: `main` as a target, and the merge.

**Definition of Done item 2 — "diff is a subset of `allowed_paths`" — is a statement about the
ticket branch**, which is why step 8 exists. It was written when nothing was ever committed, so it
never had to say which branch it meant. It means `feat/$ARGUMENTS`.
