---
doc_version: 1
last_updated: 2026-08-25
governed_by: [RULE-01]
---

# Model debt

Defects in the operating model itself, found while running it. Not ticket work — these are gaps in
the rules, the commands, or the guards.

Recorded here rather than fixed on discovery: patching the model mid-run makes it impossible to tell
whether a ticket succeeded because of the design or because of the patch.

Reviewed after each ticket closes.

**This register is the register of record.** `.ai/board/model-defects.md` exists alongside it and
holds the same kind of entry in a longer form; the origin project ended up with both and never merged
them. Pick one on day one — this file, unless there is a reason — and delete or repurpose the other
before either has entries. Two registers with independent numbering is a defect that only shows up
when two sessions append on the same afternoon.

**There is no ID allocator.** Two sessions appending in parallel will both reach the next number. The
cheap habit that avoids it: a branch that has been open across someone else's merge re-reads this
file before it pushes, not only when git complains.

| ID | Found | Defect | Severity | Fix shape |
|----|-------|--------|----------|-----------|

## Carried in from the origin project, unfixed and known

These are not hypothetical. They were observed in a running loop and they arrive with this kit
because the code that produces them arrives with it. Give each a real ID above on the first steward
run rather than leaving them here as prose.

- **`bugfix/` branches run with RULE-03 unenforced.** Both path resolvers hard-code `feat/`, so a
  bugfix branch gets no `allowed_paths` enforcement at write time and no CI check on the diff — for
  work that touches shipped code, which is when it matters most. `ops/` being exempt is correct;
  `bugfix/` is exempt by accident of string matching. **No `bugfix/` branch exists yet in a fresh
  repository, which makes now the cheapest moment to fix it.**
- **`scripts/check-allowed-paths.mjs` exits 0 on any branch not named `feat/<ID>`.** Ticket work
  committed on an `ops/` branch is therefore never checked. Fix shape: resolve the ticket from
  something the committer cannot rename, and refuse to pass vacuously when the diff touches source
  while no ticket resolves.
- **RULE-03 has no pre-write enforcement at all.** `guard-allowed-paths.mjs` is unwired per ADR-004.
  What remains runs after the fact: review check R1, and the CI script above. This is the accepted
  cost of ADR-004, recorded so it is a known price rather than a discovery.
- **`guard-allowed-paths.mjs`, when wired, is wired to `Edit|Write` only.** A file written through
  `Bash` — a heredoc, `sed -i`, a `node -e` — is never seen. Every agent holding `Bash` can write
  outside `allowed_paths` undetected. Wiring the guard to `Bash` would mean parsing shell grammar,
  which is the same class of mistake the settings metacharacter test already warns about.
- **Sessions carry no role identity.** `agent_type` in a hook payload is populated only when the
  caller is a subagent. Under the session model each role runs as its own top-level session, so any
  guard that wants to key on the running role has nothing to key on. `chat-guard.mjs` and
  `guard-read-scope.mjs` both depend on it and both are broader or quieter than their rule as a
  result.
- **D5 cannot distinguish a route from a slash command.** A path-shaped token such as `/orders` in a
  human-owned document is reported as a command with no definition. Scoping D5 to human-owned files
  removed the agent-facing false positives; the residue needs a convention or an allow-list, and both
  are decisions rather than implementations.
- **Nothing checks that a claim about an agent's tools matches that agent's frontmatter.** Three
  documents in the origin project asserted that two roles held no `Bash` tool, and used it to justify
  a routing rule. It had never been true. The frontmatter is machine-readable and the assertions are
  greppable, so a D-series check could catch it.
