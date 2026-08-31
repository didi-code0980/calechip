---
doc_version: 2
last_updated: 2026-08-25
governed_by: [RULE-01, RULE-03, RULE-04, RULE-05, RULE-06, RULE-07, RULE-08, RULE-09, RULE-10, RULE-11, RULE-12, RULE-13, RULE-14, RULE-15, RULE-16, RULE-17]
---

# Operating model

How work moves from an idea to an open pull request, who owns each step, and what must be true for it
to advance.

This document cites rule IDs. It does not restate rule text; `.ai/registry/rules.md` holds it, once.

**Domain-free by construction.** Nothing below names a product, a framework, or a datastore. Where an
example is needed it uses a neutral one — `EXA-01`, an order, the invoice list. The places this
document defers to the project are marked `TODO(project):` and are all the same shape: the name of a
command the project runs, or the name of a directory the project chose.

## Two planes

|  | Registry plane | Board plane |
|---|---|---|
| Path | `.ai/registry/`, `.ai/standards/` | `.ai/board/` |
| Lifetime | Permanent | Transient |
| Writes | Humans only (RULE-01) | Agents |

A ticket's working directory is `.ai/board/tickets/` — never under `.ai/registry/`. This is not a
filing convention. It is what makes RULE-01 enforceable by a path check
(`.claude/hooks/guard-registry.mjs`) instead of by an agent's judgement about whether an edit was
important enough to count.

## Lifecycle

```
IDEA -> TRIAGE -> [PROMOTE writes the feature row] -> BACKLOG
  -> SPEC -> [DoR] -> READY -> DESIGN -> IN_PROGRESS -> REVIEW -> QA -> DONE
                                            ^              |       |
                                            +--- REWORK <--+-------+
                                                    |  (rework_count >= 2, RULE-06)
                                                    v
                                              ESCALATED -> human
```

**A `PROMOTE` verdict writes the feature row itself** — ADR-007 removed the human step that used to
sit here. A ticket still cannot pass DoR unless its feature IDs exist in
`.ai/registry/features.md`; what changed is who puts them there.

Two things keep that from becoming a licence to invent a feature. **The ID is issued at TRIAGE by
`product`, never at SPEC by `ba`** — the role that will write the story is not the role that grants
the ID it writes against. And **every row written this way cites the idea file it came from**, so a
fabricated feature has no provenance and the pull request has something concrete to check. The
operator's approval did not disappear; it moved to CODEOWNERS review at merge, which is where RULE-01
always said enforcement lives.

**SPEC runs directly out of BACKLOG. The DoR gate sits between SPEC and READY.** Two of its six items
are produced by the BA at SPEC, so a gate placed before SPEC could never read them. READY means
"specified, sized, and safe to design" — the last checkpoint before design effort is spent.

A ticket that fails DoR after SPEC returns to BACKLOG with the failing item named. That is not REWORK
and does not increment `rework_count`: nothing has been built, and the defect is in the specification
or in the registry, not in an implementation.

## State enum

`IDEA` `TRIAGE` `BACKLOG` `SPEC` `READY` `DESIGN` `IN_PROGRESS` `REVIEW` `QA` `REWORK` `ESCALATED`
`DONE`

These twelve values are the complete enum for `ticket.yaml`'s `state` field. Check D10 verifies that
this list and the stage ownership table below stay in agreement in both directions.

## Stage ownership

| State | Agent | Reads | Writes | Gate |
|---|---|---|---|---|
| IDEA | `product` | `.ai/registry/**` | `.ai/board/ideas/**` | An idea file exists with a problem statement, not a solution |
| TRIAGE | `product` + `tech-lead-design` | idea, registry | idea file; `features.md` on PROMOTE | Verdict is one of REJECT, NEEDS-ADR, PROMOTE, with a reason. On PROMOTE, a row exists citing the idea file |
| BACKLOG | `orchestrator` | `features.md`, `backlog.md` | `backlog.md` | Feature IDs exist in the registry |
| SPEC | `ba` | registry, `ticket.yaml` | `01-story.md`, `ticket.yaml` | ACs in Given/When/Then, each with an ID; `invariants_touched` populated; `size_estimate` set; Out-of-scope non-empty |
| READY | `orchestrator` | `ticket.yaml`, `01-story.md`, `features.md` | `ticket.yaml`, `backlog.md` | Full DoR, below |
| DESIGN | `tech-lead-design` | everything | `02-design.md`, `ticket.yaml` | Sections 1-7 complete; `allowed_paths` enumerated; `size` set |
| IN_PROGRESS | `developer` | design first, then the source tree within `allowed_paths` | code, `03-impl-log.md` | typecheck + lint exit 0; every contract item implemented |
| REVIEW | `tech-lead-review` | story, design, impl-log, `git diff` | `04-review.md` | R1-R9, each citing `file:line` |
| QA | `qa` | story, design section 6, test plan | the test tree, `05-`, `06-` | Every `AC-n` maps to at least one named test; the test suites exit 0 |
| REWORK | routed agent | the failing verdict plus its own prior artifact | its own artifact, code | The specific failed checks now pass |
| ESCALATED | human | everything | anything | A human decides; the ticket does not self-resume |
| DONE | `orchestrator` | all | `ticket.yaml`, `backlog.md`, `metrics.md` | Full DoD; opens PR (human merges, RULE-09) |

The six rows from SPEC through QA are the implementation loop. The other six exist so that every
value in the state enum has a declared owner — a state nobody owns is a state where a ticket stops
silently.

## `02-design.md` sections — all seven required

1. **Contract** — exact function or endpoint signatures, input schemas, return types (RULE-04)
2. **Permission model** — which role gate applies to each action and each control
3. **Seam impact** — which functions in the data-access seam change, or "none"
4. **Schema delta** — `none`, or a description plus an ADR link
5. **allowed_paths** — explicit glob list
6. **Testability contract** — every test selector, with the element it identifies (RULE-05)
7. **Rejected alternatives** — at least one, with the reason

Section 6 is the load-bearing one. QA never reads the implementation source (RULE-05), so a selector
that is not in section 6 does not exist as far as QA is concerned. A design that omits it produces a
test suite that cannot address the interface, and the failure surfaces at the QA gate as something
that looks like a Developer problem and is not.

Section 5 is what `.claude/hooks/guard-allowed-paths.mjs` reads. Until DESIGN writes it,
`allowed_paths` is `[]` and the hook blocks every write outside the ticket folder. That emptiness is
a control, not an initial value.

## Review checklist

| # | Check |
|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) |
| R2 | typecheck exit 0 |
| R3 | lint exit 0 |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) |
| R5 | Every contract item in design section 1 is implemented (RULE-04) |
| R6 | Permission gating matches design section 2 |
| R7 | Every test selector in design section 6 exists in the markup |
| R8 | No invariant violated — reason through each ID in `invariants_touched` (RULE-07) |
| R9 | No dependency added without an ADR |

**An item with no `file:line` citation counts as failed.** Not "counts as unverified" — failed. A
reviewer that cannot point at a line has not checked anything, and a checklist that accepts assertion
in place of citation is a checklist that always passes.

## Failure routing

| Failing check | Route to | Increments `rework_count` |
|---|---|---|
| R1, R2, R3, R4, R5 implementable, R9 | `developer` | Yes |
| R5 impossible as specified, R7 | `tech-lead-design` | No |
| R6, QA: AC ambiguous or untestable | `ba` | No |
| QA: behaviour wrong | `developer` | Yes |
| **R8** | **human, immediately** | ESCALATE (RULE-07) |
| DoR item unsatisfied at the READY gate | `ba` if the item is produced at SPEC, otherwise a human | No |

Per RULE-08, upstream defects must not burn the downstream agent's rework budget. A Developer who
correctly implemented an incoherent design has not failed, and charging that failure to the Developer
would exhaust the budget under RULE-06 for a defect it did not cause and cannot fix.

## Handoff and bounded chat

Clarification and adjudication are different things, and the distinction is the whole basis of the
chat model. See `.ai/registry/decisions/ADR-001-bounded-agent-chat.md`.

|  | Clarification | Adjudication |
|---|---|---|
| Shape | question then answer | position, negotiation, verdict |
| Direction | downstream asks upstream about intent | judge and judged converge |
| Effect on artifact | improves accuracy | contaminates it |

### Chat topology

Every allowed edge points **backwards**, toward whoever declared intent.

| Pair | Before verdict | After verdict |
|---|---|---|
| `developer` to `tech-lead-design` | allowed | allowed |
| `developer` to `ba` | allowed | allowed |
| `qa` to `ba` | allowed | allowed |
| `qa` to `tech-lead-design` | allowed | allowed |
| `ba` to `product` | allowed | allowed |
| `tech-lead-design` to `ba` | allowed | allowed |
| `developer` and `tech-lead-review` | **forbidden** (RULE-12) | allowed |
| `developer` and `qa` | **forbidden** | allowed |
| `qa` and `tech-lead-review` | **forbidden** | allowed |

Enforced by `.claude/hooks/chat-guard.mjs`, which also enforces the RULE-15 budget of six messages
per pair per ticket, tracked in `ticket.yaml` under `chat_budget`.

### Transport: chat is a file, not a message

There is no live message channel between agents. A question is a **file write**, and the answer is an
**amendment to the answering agent's own artifact**. See `.ai/standards/session-model.md`.

1. The asking session writes `.ai/board/tickets/<ID>/99-questions.md`, whose front-matter carries
   `to: <agent>` and `asked_at: <ISO8601>`.
2. The answering session amends its own artifact — the story, the design — appends a `## Changelog`
   line per RULE-14, and answers in `99-questions.md` beneath the question.
3. `chat-guard.mjs` inspects writes to `99-questions.md` and blocks when `to:` names a pair the
   topology forbids before a verdict exists (RULE-12). The same hook counts entries against
   `chat_budget` (RULE-15).

This is what makes RULE-14 mechanical rather than aspirational. A clarification that reveals an
incomplete upstream artifact **must** amend that artifact, and here there is nowhere else for the
answer to live — it cannot be spoken and forgotten, because speaking it means writing it down.

### Session lifecycle

RULE-13's requirement is that REVIEW and QA see files only, with no message channel and no inherited
context. That is delivered by session lifetime, not by tearing down a shared team session.

| Agent | Session | Closes when |
|---|---|---|
| `orchestrator` | persistent | end of run |
| `ba` | persistent | end of run |
| `tech-lead-design` | persistent | end of run |
| `developer` | ephemeral | ticket DONE or ESCALATED — **survives REWORK** |
| `tech-lead-review` | ephemeral | after **each** verdict, including a re-review |
| `qa` | ephemeral | after **each** verdict |
| `product`, `devops` | ephemeral | task done |

**Roles that get asked stay alive; roles that pass judgement die after speaking.**

The BA and the Tech Lead are asked to explain what they meant, sometimes several tickets later, and a
session that remembers the intent behind a decision answers better than one re-reading its own output
cold.

A reviewer is the opposite. A `tech-lead-review` session that remembers checking R4 last time will
not really check it again — but the code changed between passes, which is the entire reason there is
a second pass. Its memory is a liability, so it dies after each verdict. Same for QA.

The Developer sits between: ephemeral, but it **survives REWORK**. Rework is a continuation of the
same work with new information, and making the Developer re-derive the design from scratch on every
cycle would burn the RULE-06 budget on rediscovery rather than on fixing what the reviewer found.

## Artifact front-matter

Every artifact opens with:

```yaml
---
ticket: <ID>
stage: DESIGN
agent: tech-lead-design
produced_at: <ISO8601>
inputs_read: [ .ai/board/tickets/<ID>/01-story.md, .ai/registry/invariants.md ]
consulted:
  - with: ba
    asked: "..."
    answer: "..."
    resulted_in_amendment: true
chat_before_verdict: none    # required and must be `none` on 04-review.md and 06-test-report.md
gate: PASS                   # PASS | FAIL | BLOCKED
blocking_reason: ""
next_state: IN_PROGRESS
---
```

`chat_before_verdict: none` is an attestation (RULE-12). If a reviewer cannot truthfully write it,
the review is void and the stage re-runs in a clean session.

An artifact whose content reflects a chat but whose `consulted` block is empty is a gate failure. That
is a provenance lie, and provenance is how a bad output is diagnosed six tickets later.

## Orchestrator loop

**The orchestrator is the lead session, not a dispatched subagent.** It reads the board, decides what
is next, and **prints the command to run and the session to run it in**. It does not invoke the stage
owner.

That is what makes the session lifecycle above enforceable. A subagent cannot open a fresh top-level
session for the reviewer, nor keep the BA's session alive across tickets — so an orchestrator that
dispatched would have to fake both, and RULE-13 would come back to depending on an agent's good
behaviour instead of on how the sessions are actually started. A printed instruction that a human
runs is a real context boundary; a nested call is not.

`/next-ticket` therefore emits something like:

```
EXA-01 is in BACKLOG. Run /spec EXA-01 in the BA session.
```

```
loop:
  tickets = read all .ai/board/tickets/*/ticket.yaml
  if any state == ESCALATED:            notify human; halt that ticket
  if count(state in SPEC..QA) >= WIP:   wait
  t = first ordered ticket in backlog.md whose state != DONE
  if t.state == BACKLOG:                PRINT "/spec <id> in the BA session"; continue
  if t.state == SPEC and gate passed:   evaluate DoR
                                          pass -> t.state = READY
                                          fail -> demote to BACKLOG; name the failing item; continue
  if t.state == REVIEW or QA:           require a FRESH session (RULE-13); never reuse a prior one
  PRINT the next command and the session it belongs in     <-- does not dispatch
  read result front-matter
  PASS -> t.state = next_state ; FAIL -> REWORK, route per table
  write ticket.yaml; repair backlog.md; append metrics.md
```

`ARTIFACTS_FOR[state]`, never the whole ticket folder. Feeding an agent every artifact defeats the
isolation the model depends on, especially for QA: a QA agent that can see `04-review.md` is testing
the reviewer's conclusions rather than the story.

| State | ARTIFACTS_FOR |
|---|---|
| SPEC | `ticket.yaml`, registry |
| DESIGN | `ticket.yaml`, `01-story.md`, registry, standards |
| IN_PROGRESS | `ticket.yaml`, `01-story.md`, `02-design.md`, standards |
| REVIEW | `01-story.md`, `02-design.md`, `03-impl-log.md`, `git diff`, registry |
| QA | `01-story.md`, section 6 of `02-design.md`, `05-test-plan.md` |

## Backlog

`.ai/board/backlog.md` is an **ordered list, not a scored one**. A human reorders rows; the
orchestrator takes the top. There is deliberately no priority algorithm — scoring invites agents to
argue about priority, which is not their job and not a thing they are good at.

Sections: `## READY`, `## BACKLOG`, `## BLOCKED`, `## ARCHIVE (last 20)`.

`backlog.md` is a view. `ticket.yaml` is authoritative. On disagreement the orchestrator repairs
`backlog.md` and does not touch `ticket.yaml` to make the view right.

## ID scheme

Ticket ID equals feature ID in the 1:1 case. Splits get `-a`, `-b`. Defects are `BUG-nnn`, chores are
`OPS-nnn`, decisions are `ADR-nnn`.

## Definition of Ready

**DoR gates the SPEC to READY transition.** The question it answers is not "may this ticket be
specified" but "is this ticket safe to design and build". Four of its six items are produced at
BACKLOG, by `/triage` when it creates the ticket (ADR-010); two are produced by the BA at SPEC. Every item names its producing stage, and every
producing stage sits at or before the gate.

Checked mechanically by the orchestrator.

| # | Item | Produced at | By |
|---|------|-------------|-----|
| 1 | `feature_ids` non-empty, and every ID present in `.ai/registry/features.md` | BACKLOG | `product`, when promoting the idea (ADR-007) |
| 2 | `invariants_touched` explicit — may be `[]`, never absent | SPEC | `ba` |
| 3 | Every ticket in `depends_on` is `DONE` | BACKLOG | `product`, when creating the shell (ADR-010) |
| 4 | `schema_delta` is `none`, or an approved ADR is linked | BACKLOG | `product` + `tech-lead-design`; a schema change needs its ADR before the ticket exists (RULE-09) |
| 5 | `size_estimate` is S or M | SPEC | `ba`, from the story's scope and its Out-of-scope section |
| 6 | Exactly one feature group, or a stated split rationale | BACKLOG | `product`, or `ba` at SPEC if the story reveals a second group |

`[]` and absent are different answers. `[]` says the BA considered the invariants and found none
engaged. Absent says nobody looked, and check R8 has nothing to reason through.

Two earlier versions of this document placed the DoR gate before SPEC, which made items 2 and 5
unsatisfiable: both are produced at SPEC, and SPEC was downstream of the gate that required them.
Moving the owner of item 5 earlier did not fix it, because the gate itself was in the wrong place.
Check D13 exists because of that defect and verifies that no DoR item names a producing stage later
than the gate.

## Definition of Done

- four gates `passed: true` with timestamps
- diff is a subset of `allowed_paths`
- typecheck, lint, unit tests and end-to-end tests exit 0
- every AC maps to a named test
- zero invariant violations
- `03-impl-log.md` lists every file touched with a one-line reason

**TODO(project): name the four commands.** Typecheck, lint, unit and end-to-end are roles, not
command names. Write the exact invocations into `.ai/standards/testing-standards.md` once, and let
every other document go on referring to the role.

## Sizing

| Size | Files | Handling |
|---|---|---|
| S | up to 6 | proceed |
| M | up to 12 | proceed |
| L | more than 12 | must split at DESIGN |
| XL | any size, if it changes the schema, or changes the signature of an existing seam function, or changes a shared type module | escalate |

Adding new functions to the data-access seam is ordinary feature work, not XL — every feature ticket
does it. XL is for changes that break the seam's existing contract: a schema migration, a changed
signature that existing callers must follow, or a shared type shape that ripples outward. The test is
whether existing callers must change, not whether the seam was touched at all. An earlier wording
read "touches the seam", under which every feature ticket escalated and the table meant nothing.

Split by operation first (read path, then write path), then by surface, then by role. **Never split
backend from frontend alone.** That produces a ticket that cannot be exercised end to end, which
means the QA gate has nothing to run, which means the ticket reaches DONE with a gate that was
skipped rather than passed.

Two fields, two owners. `size_estimate` is the BA's judgement at SPEC, read from the story's scope;
it gates DoR. `size` is the Tech Lead's verdict at DESIGN, read from the enumerated `allowed_paths`;
it decides whether the ticket splits.

They are separate because the gate needs an estimate and only design produces a verdict. A single
field could not be both without making one of the two stages impossible to reach.

When they disagree, the verdict wins, and the gap is worth noticing: a story estimated M that designs
out to L means the story was under-specified, and DESIGN routes that back to SPEC rather than
splitting silently.

## WIP

**WIP = 1** for the validation run.

Parallel dispatch is permitted only when `allowed_paths` are pairwise disjoint after glob expansion,
there is no mutual dependency, each ticket has its own working tree, and combined WIP is 3 or less.

**Since ADR-006 that condition is unreachable, not merely hard to satisfy.** There is one working
directory, so one branch is checked out and one ticket is in flight. WIP is 1 because git makes it 1,
and the paragraph below is kept as the reasoning behind why parallelism was not worth buying.

**Read that condition against your own codebase before relying on it.** In the origin project it
turned out to be unsatisfiable for exactly the tickets it governed: every feature added a type to one
shared module, so no two feature tickets ever had disjoint `allowed_paths`. The arrangement that
worked instead is in `.ai/standards/session-model.md` — a single writer, so overlapping lists are
harmless. If your codebase has a file every ticket touches,
the same will be true here, and the honest move is to say so rather than to assert a condition
nothing can meet.
