---
doc_version: 1
last_updated: 2026-08-25
governed_by: [RULE-01, RULE-02, RULE-09]
---

# Architecture

TODO(project): this file ships as a stub. It is the document RULE-02 points at, so **the loop cannot
enforce RULE-02 until the seam below is named.**

**The products are not named here.** Which datastore, which framework, which client library — those
are in [tech-stack.md](tech-stack.md), named once. This file names the *shape*: where the one door to
data is, what may import what, and where authorization stands. The split is deliberate, and it is
what keeps RULE-02 checkable — check R4 points at a directory, and a directory does not change when a
package does.

## The data-access seam

RULE-02 says no component may bypass the seam declared here. Three things have to be written before
that sentence is enforceable:

1. **The seam's path.** One directory. Everything that talks to the datastore lives inside it and
   nothing outside it imports a datastore client.
2. **The mechanism.** The exact lint rule and config file that make an import from outside the seam a
   build failure. Record it in the enforcement map in `.ai/registry/rules.md` at the same time.
3. **The implementations.** At minimum one real and one mock, with identical exported names and
   arity — see the seam-parity test in `.ai/standards/testing-standards.md`.

The seam is what makes the permission model checkable: if there is exactly one path to data, there is
exactly one place authorization has to hold, and review check R4 has somewhere to point.

## Layers

TODO(project): the layers, top to bottom, and what may import what. Draw the arrows one way.

## Where authorization lives

TODO(project): one answer, not two. Two layers enforcing permissions is a drift source — they agree
until they do not, and the disagreement is invisible until a role is added. If a second layer is
adopted anyway, that is an ADR with a revert condition, not a paragraph here.

## Boundaries the audit enforces

`.ai/registry/boundaries.json` holds the machine-checkable boundaries, and check D12 in
`scripts/check-docs.mjs` enforces them. It ships empty.

**Add an entry the moment an ADR names an observable revert condition** of the form *this package
must not enter the dependency tree*, or *it may only be reachable from this directory*. The reason to
put it in a file rather than in prose is that a decision nobody re-reads is a decision nobody keeps:
the origin project left a boundary as prose for eleven days and only found out it had been crossed
when the audit was taught to look.

## Configuration and environment

TODO(project): which settings are environment-dependent, where they are read, and which of them a
test run must never inherit from a developer machine.

## Rejected alternatives

TODO(project): at least one, with the reason. A design with one option presented is a design whose
reasoning cannot be checked, only agreed with — the same standard design section 7 holds every ticket
to.
