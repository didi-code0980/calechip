---
doc_version: 2
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
| MD-012 | 2026-08-31 | Check D8 warns when a document restates a rule at high overlap without declaring `verbatim_in`, and it fires on ADRs that record a rule amendment. Those documents must quote the new text exactly — an ADR is a snapshot of what a rule became on a date, not a copy to be kept in step, and the two have opposite maintenance rules. The risk is not the warning itself but the reflex it trains: the cheapest way to silence it is to reword the ADR so it no longer says what the rule says, which destroys the record. | low | Scope D8 to exclude `.ai/registry/decisions/**`, and give the narrowing a test in both directions — an ADR quoting a rule must not be reported, and a standards document quoting the same rule must be. `.ai/standards/testing-standards.md` requires that shape for any narrowing, because the way this fix fails is by narrowing to nothing. |
| MD-011 | 2026-08-31 | Check D6 resolves path references only in files under `.ai/`. `SETUP.md`, `README.md` and `CLAUDE.md` are never scanned for them, so a path that has moved or been deleted stays unreported in the three documents a newcomer reads first — and `SETUP.md` is almost entirely instructions containing paths. Demonstrated the same day: two files were deleted, references to them were left in `SETUP.md` and `README.md`, and the audit stayed green. Those particular references are deliberate, but nothing distinguished them from a broken one. `CLAUDE.md` is already in `allDocs` for D5 and D7, so its exclusion from D6 specifically looks like an oversight rather than the scoping decision that excluded `.ai/board/**`. | medium | Extend D6's file set from `aiFiles` to `aiFiles` plus `CLAUDE.md`, `README.md` and `SETUP.md` — all three are human-owned, so the rule in `.ai/standards/testing-standards.md` about scoping checks to what humans own is satisfied. Expect a first run to report deliberate references to deleted paths; those want the `git log -- <path>` form or a code span the path matcher does not read as a path. Per that same standard the change owes a real-file test against `SETUP.md` as it stands, in both directions. |
| MD-010 | 2026-08-31 | `scripts/tests/init-project.test.mjs` copies the **real repository** as its fixture — deliberately, so the script's anchors are tested against the actual files — and then runs the bootstrap in the copy. The bootstrap consumes those anchors and refuses a second run, so from the moment `init-project.mjs` is used, all ten of its tests fail permanently. SETUP step 0 tells the operator the suite must be green and step 0.5 tells them to run the bootstrap; doing both in that order makes the instruction unsatisfiable. A permanently red suite is worse than a missing one, because people stop reading it. | high | In a stood-up project: delete `scripts/init-project.mjs` and its test — the script cannot run again and its tests test a script that cannot run. Update SETUP step 0's expected count, step 0.5, the README line, and the `init` entry in `package.json`. **Upstream in the template this needs a different fix**: the test should restore the four anchor strings into the copy before invoking the script, accepting that this weakens it into a fixture, or the suite should be split so the bootstrap's tests are not part of the gate a live project runs. |
| MD-009 | 2026-08-31 | RULE-01's only mechanism is CODEOWNERS review, and in this repository CODEOWNERS names `@didi-code0980` — the same account that opens every pull request. GitHub does not let an author approve their own pull request, so once SETUP step 8 turns on branch protection requiring code-owner review, every pull request including registry changes becomes unmergeable except by admin bypass. "The registry is human-only" then has either no mechanism or a mechanism that is routinely overridden, and an override that happens every time stops being noticed. | high | Name a second reviewer in CODEOWNERS before enabling the requirement, or accept the solo case explicitly: leave the review unrequired, and record in the enforcement map in `.ai/registry/rules.md` that RULE-01 is held by convention rather than by a control. The second option is honest and the current text is not. Do not enable branch protection requiring CODEOWNERS review while the file names one account. |
| MD-008 | 2026-08-31 | Nothing enforces that `.ai/standards/tech-stack.md` is the *only* place a language, framework, datastore, runner or package manager is named. The file was introduced with the other documents rewritten to cite it, but a future edit can reintroduce a second copy and no check will report it. This is the same failure this register already carries for itself and `model-defects.md`: two sources, independent drift, and only one ever updated. | medium | A D-series check that reads the product and tool names out of `tech-stack.md` and reports any of them appearing in another human-owned document. It reports nothing while the file is a stub, and must say so in the report rather than passing silently — the shape D1 and D12 already use. Scope it to the human-owned plane per the rule in `.ai/standards/testing-standards.md`, and give it a real-file test against `tech-stack.md` itself. |

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
