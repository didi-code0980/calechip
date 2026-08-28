---
doc_version: 1
last_updated: 2026-08-25
governed_by: [RULE-01, RULE-02, RULE-09]
---

# Roles, permissions and security

TODO(project): this file ships as a stub. Design section 2 gates against it and review check R6
compares an implementation to it, so **R6 is unenforceable until the role model below is written.**

## Roles

TODO(project): the roles, in rank order, with the one-line difference between adjacent ranks. Rank
order matters: a permission helper that compares ranks is testable in a way that a set of unrelated
role names is not.

## The permission table

TODO(project): every action against every role, both directions. Include the denials — a permission
table that lists only what each role may do cannot be tested for what it must not do, and the
permission test in `.ai/standards/testing-standards.md` requires both.

| Action | Role A | Role B | Role C |
|---|---|---|---|

## Where the check runs

**One place, on the server side of the boundary.** A control hidden in the interface is a convenience,
not a permission: the same entry point is reachable without the interface. State the single place the
check lives, and treat any interface-only gate as decoration that must be backed by it.

TODO(project): name that place, and the helper that performs the comparison.

## Authentication

TODO(project): the provider, where the session is read, and — the part that is usually left implicit
— **which surfaces may construct a client for it**. A client constructed in the browser is a second
door into the data, and it is exactly the kind of decision that should be an entry in
`.ai/registry/boundaries.json` so check D12 enforces it rather than a reviewer remembering it.

## Secrets

TODO(project): where secrets live, what is committed, and what is not. Nothing here should be
discoverable from the repository.

## Known weaknesses

TODO(project): the controls that are weaker than they read. Write them down here rather than nowhere.

An invariant or a permission that is held **by intent rather than by a control** is the most expensive
kind of documentation error, because every downstream reader assumes a guarantee. If a mechanism is
client-side, or depends on a setting a user can change, say so in the sentence that describes it.
