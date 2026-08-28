---
doc_version: 1
last_updated: 2026-08-25
governed_by: [RULE-01, RULE-04, RULE-09]
---

# Data model

TODO(project): this file ships as a stub. It is where field names become real, which makes it the
document RULE-04 depends on: the Developer may not invent a field name, so every name has to exist
here or in design section 1 first.

## Entities

TODO(project): one section per entity — its fields, their types, and their constraints. Transcribe
names exactly as they will appear in the schema; a name that differs by one character between this
file and the schema is a defect that surfaces three tickets later as a mapping bug.

## Relationships

TODO(project): cardinality, and what happens on delete. **State the delete behaviour explicitly for
every relationship, including the ones where the answer is "refuse".** A cascade that nobody decided
is a cascade the database performs silently, and the invariant it breaks is discovered by its
absence.

## Where invariants are held

TODO(project): a table mapping each ID in `.ai/registry/invariants.md` to the mechanism that holds
it — a database constraint, a check inside the seam, or a refusal in the write path.

Two rules apply whatever the datastore:

- **A UI affordance alone never holds an invariant.** It is a convenience for the user, not a
  control; the same write is reachable by any other caller.
- **An invariant that no listed mechanism holds must say so here.** An invariant claimed and not held
  is worse than one never claimed, because a reader of the ledger assumes a guarantee that does not
  exist.

## Migrations

Applying a migration is human (RULE-09). Drafting one is design work; running one is not. A ticket
whose `schema_delta` is anything but `none` needs an approved ADR linked before it can pass Definition
of Ready.

TODO(project): the migration tool, where migrations live, and the one command that applies them.

## Seed data

TODO(project): where the seed lives, and the rule that tests share it. A test fixture that exists only
in one test file drifts from the seed and produces failures that reproduce in CI and not locally.
