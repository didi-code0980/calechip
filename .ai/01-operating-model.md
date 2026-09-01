---
doc_version: 5
last_updated: 2026-09-01
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
TRIAGE -> [PROMOTE writes the feature row and the ticket shell] -> BACKLOG
  -> PLAN -> [DoR] -> READY -> IN_PROGRESS -> REVIEW -> QA -> DONE
                                   ^            |       |
                                   +-- REWORK <-+-------+
                                          |  (rework_count >= 2, RULE-06)
                                          v
                                    ESCALATED -> human
```

**A `PROMOTE` verdict writes the feature row itself** — ADR-007 removed the human step that used to
sit here. A ticket still cannot pass DoR unless its feature IDs exist in
`.ai/registry/features.md`; what changed is who puts them there.

Two things keep that from becoming a licence to invent a feature. **The ID is issued at TRIAGE by
`product`, never at PLAN by `tech-lead-design`** — the role that will write the plan is not the role
that grants the ID it writes against. And **every row written this way cites the idea file it came
from**, so a
fabricated feature has no provenance and the pull request has something concrete to check. The
operator's approval did not disappear; it moved to CODEOWNERS review at merge, which is where RULE-01
always said enforcement lives.

**PLAN runs directly out of BACKLOG. The DoR gate sits between PLAN and READY.** Two of its six items
are produced at PLAN, so a gate placed before PLAN could never read them. READY means "planned,
sized, and safe to build" — the last checkpoint before implementation effort is spent.

**There is no separate IDEA stage and no separate SPEC stage** — ADR-019. TRIAGE absorbed the first
and PLAN absorbed the second. What each cost and what each was carrying is in that ADR; this document
records only the shape that resulted.

A ticket that fails DoR after PLAN returns to BACKLOG with the failing item named. That is not REWORK
and does not increment `rework_count`: nothing has been built, and the defect is in the specification
or in the registry, not in an implementation.

## State enum

`TRIAGE` `BACKLOG` `PLAN` `READY` `IN_PROGRESS` `REVIEW` `QA` `REWORK` `ESCALATED` `DONE`

These ten values are the complete enum for `ticket.yaml`'s `state` field. Check D10 verifies that
this list and the stage ownership table below stay in agreement in both directions.

## Stage ownership

| State | Agent | Reads | Writes | Gate |
|---|---|---|---|---|
| TRIAGE | `product` + `tech-lead-design` | the raw request, registry | `.ai/board/ideas/**`; `features.md` and the ticket shell on PROMOTE | An idea file exists stating a problem and not a solution, **and** a verdict of REJECT, NEEDS-ADR or PROMOTE with a reason. On PROMOTE, a feature row exists citing that idea file |
| BACKLOG | `orchestrator` | `features.md`, `backlog.md` | `backlog.md` | Feature IDs exist in the registry |
| PLAN | `tech-lead-design` | registry, standards, `ticket.yaml`, the source tree | `01-plan.md`, `ticket.yaml` | Sections 1-9 complete; ACs in Given/When/Then each with an ID; `invariants_touched` populated; `size_estimate` and `size` set; `allowed_paths` enumerated; Out-of-scope non-empty |
| READY | `orchestrator` | `ticket.yaml`, `01-plan.md`, `features.md` | `ticket.yaml`, `backlog.md` | Full DoR, below |
| IN_PROGRESS | `developer` | the plan first, then the source tree within `allowed_paths` | code, `03-impl-log.md` | typecheck + lint exit 0; every contract item implemented |
| REVIEW | `tech-lead-review` | plan, impl-log, `git diff` | `04-review.md` | R1-R9, each citing `file:line` |
| QA | `qa` | plan sections 1, 2 and 8, test plan | the test tree, `05-`, `06-` | Every `AC-n` maps to at least one named test; the test suites exit 0 |
| REWORK | routed agent | the failing verdict plus its own prior artifact | its own artifact, code | The specific failed checks now pass |
| ESCALATED | human | everything | anything | A human decides; the ticket does not self-resume |
| DONE | `orchestrator` | all | `ticket.yaml`, `backlog.md`, `metrics.md` | Full DoD; opens PR (human merges, RULE-09) |

The four rows from PLAN through QA are the implementation loop. The other six exist so that every
value in the state enum has a declared owner — a state nobody owns is a state where a ticket stops
silently.

## `01-plan.md` sections — all nine required

Sections 1 and 2 are what `01-story.md` used to carry; 3 through 9 are what `02-design.md` used to
carry. One artifact, one author, one gate — ADR-019.

1. **Problem and scope** — what this ticket does, and an explicit **Out-of-scope** that is never empty
2. **Acceptance criteria** — Given/When/Then, each with an `AC-n` ID
3. **Permission model** — which role gate applies to each action and each control
4. **Contract** — exact function or endpoint signatures, input schemas, return types (RULE-04)
5. **Seam impact** — which functions in the data-access seam change, or "none"
6. **Schema delta** — `none`, or a description plus an ADR link
7. **allowed_paths** — explicit glob list
8. **Testability contract** — every test selector, with the element it identifies (RULE-05)
9. **Rejected alternatives** — at least one, with the reason

Section 8 is the load-bearing one. QA never reads the implementation source (RULE-05), so a selector
that is not in section 8 does not exist as far as QA is concerned. A plan that omits it produces a
test suite that cannot address the interface, and the failure surfaces at the QA gate as something
that looks like a Developer problem and is not. It was dormant from 2026-09-01 while ADR-017 waived
QA and was required to be written anyway; ADR-021 put its reader back.

Section 7 is what `.claude/hooks/guard-allowed-paths.mjs` reads. Until PLAN writes it,
`allowed_paths` is `[]` and the hook blocks every write outside the ticket folder. That emptiness is
a control, not an initial value.

**Sections 1 and 2 are written before 3 through 9 are read.** The order is the whole of what survives
of the SPEC/DESIGN separation: one agent now writes both halves, so the only thing standing between an
acceptance criterion and the design that finds it convenient is the order they are written in.
ADR-019 records this as the cost it is, not as a safeguard.

## Review checklist

| # | Check |
|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) |
| R2 | typecheck exit 0 |
| R3 | lint exit 0 |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) |
| R6 | Permission gating matches plan section 3 |
| R7 | Every test selector in plan section 8 exists in the markup |
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
| R6, QA: AC ambiguous or untestable | `tech-lead-design` | No |
| QA: behaviour wrong | `developer` | Yes |
| **R8** | **human, immediately** | ESCALATE (RULE-07) |
| DoR item unsatisfied at the READY gate | `tech-lead-design` if the item is produced at PLAN, otherwise a human | No |

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
stage: PLAN
agent: tech-lead-design
produced_at: <ISO8601>
inputs_read: [ .ai/board/tickets/<ID>/ticket.yaml, .ai/registry/invariants.md ]
consulted:
  - with: product
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
EXA-01 is in BACKLOG. Run /plan EXA-01 in the tech-lead-design session.
```

```
loop:
  tickets = read all .ai/board/tickets/*/ticket.yaml
  if any state == ESCALATED:            notify human; halt that ticket
  if count(state in PLAN..QA) >= WIP:   wait
  t = first ordered ticket in backlog.md whose state != DONE
  if t.state == BACKLOG:                PRINT "/plan <id> in the tech-lead-design session"; continue
  if t.state == PLAN and gate passed:   evaluate DoR
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
| PLAN | `ticket.yaml`, registry, standards, the source tree |
| IN_PROGRESS | `ticket.yaml`, `01-plan.md`, standards |
| REVIEW | `01-plan.md`, `03-impl-log.md`, `git diff`, registry |
| QA | sections 1, 2 and 8 of `01-plan.md`, `05-test-plan.md` |

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

**DoR gates the PLAN to READY transition.** The question it answers is not "may this ticket be
specified" but "is this ticket safe to design and build". Four of its six items are produced at
BACKLOG, by `/triage` when it creates the ticket (ADR-010); two are produced at PLAN. Every item names its producing stage, and every
producing stage sits at or before the gate.

Checked mechanically by the orchestrator.

| # | Item | Produced at | By |
|---|------|-------------|-----|
| 1 | `feature_ids` non-empty, and every ID present in `.ai/registry/features.md` | BACKLOG | `product`, when promoting the idea (ADR-007) |
| 2 | `invariants_touched` explicit — may be `[]`, never absent | PLAN | `tech-lead-design` |
| 3 | Every ticket in `depends_on` is `DONE` | BACKLOG | `product`, when creating the shell (ADR-010) |
| 4 | `schema_delta` is `none`, or an approved ADR is linked | BACKLOG | `product` + `tech-lead-design`; a schema change needs its ADR before the ticket exists (RULE-09). **A migration touching a policy, trigger or constraint is not `none`** — ADR-014 |
| 5 | `size_estimate` is S or M | PLAN | `tech-lead-design`, from plan section 1 and its Out-of-scope |
| 6 | Exactly one feature group, or a stated split rationale | BACKLOG | `product`, or `tech-lead-design` at PLAN if the plan reveals a second group |

`[]` and absent are different answers. `[]` says the BA considered the invariants and found none
engaged. Absent says nobody looked, and check R8 has nothing to reason through.

Two earlier versions of this document placed the DoR gate before the stage that produced items 2 and
5, which made them unsatisfiable: the producing stage was downstream of the gate that required them.
Moving the owner of item 5 earlier did not fix it, because the gate itself was in the wrong place.
Check D13 exists because of that defect and verifies that no DoR item names a producing stage later
than the gate.

## Definition of Done

1. four gates `passed: true` with timestamps
2. diff is a subset of `allowed_paths`
3. typecheck, lint, unit tests and end-to-end tests exit 0
4. every AC maps to a named test
5. zero invariant violations
6. `03-impl-log.md` lists every file touched with a one-line reason

All six are required again. **Items 3 and 4 were suspended from 2026-09-01 while ADR-017 waived the
QA stage, and are restored by ADR-021** — three tickets shipped under that waiver, and all four
commands in `.ai/standards/testing-standards.md` now run. The numbering is kept because the
suspension named these two by number and the record has to stay legible.

**TODO(project): name the four commands.** Typecheck, lint, unit and end-to-end are roles, not
command names. Write the exact invocations into `.ai/standards/testing-standards.md` once, and let
every other document go on referring to the role.

## Sizing

| Size | Files | Handling |
|---|---|---|
| S | up to 6 | proceed |
| M | up to 12 | proceed |
| L | more than 12 | must split at PLAN |
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

Two fields, one owner now. `size_estimate` is read from plan section 1 and its Out-of-scope, and it
gates DoR. `size` is read from the enumerated `allowed_paths` in section 7, and it decides whether the
ticket splits. Both are written at PLAN, by `tech-lead-design`.

**They stay two fields even though one agent writes both**, because they are read at different moments
by different readers and one of them is a gate input. Collapsing them would put the gate's input and
the splitting verdict in the same cell, and a disagreement between an estimate and a verdict is
information — ADR-012 exists because of one.

They are separate because the gate needs an estimate and only design produces a verdict. A single
field could not be both without making one of the two stages impossible to reach.

**When they disagree, the verdict wins and PLAN proceeds** — ADR-012. There is no longer anyone to
ask: the estimate and the verdict are the same agent's, written minutes apart. The second pass would read the same design and
reach the same size, because the size comes from the enumerated `allowed_paths` rather than from
anything the story could have said differently.

The gap is recorded rather than routed: plan section 7 states both numbers and one line on why they
differ, and `.ai/board/metrics.md` keeps the pair, so a BA whose estimates are consistently low shows
up in the data. Per RULE-08 nothing increments `rework_count`.

**The table above is untouched by that.** An `L` still must split at PLAN and an `XL` still
escalates — a ticket that designs out to L is stopped by the split requirement, not by the
disagreement. ADR-012 removes one of the two reasons such a ticket stops; it does not remove the
other. Its revert condition is three consecutive tickets whose `size` exceeds `size_estimate`, which
nothing will stop for and which therefore has to be watched in the metrics.

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
