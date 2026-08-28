---
doc_version: 1
last_updated: 2026-08-25
governed_by: [RULE-01]
---

# Glossary

The vocabulary the whole system reasons in. One term, one meaning, one spelling.

Human-only, per RULE-01. An agent that needs a term added stops with `gate: BLOCKED` and states it in
`blocking_reason`.

**Why this is a registry file and not a wiki page.** Agents name things from this list. A term with
two spellings becomes two field names, two DTO shapes, and a lint exemption, and the divergence is
only visible three tickets later. `.ai/standards/coding-standards.md` forbids abbreviations that are
not defined here, which is the mechanism that makes the list load-bearing rather than decorative.

## TODO(project): this file ships empty

Fill it before the first `/spec`. Two kinds of entry earn a row:

- **Domain nouns** the product is about, especially any whose everyday meaning is wider or narrower
  than the meaning here. The narrowing is the entry.
- **Process terms this repository uses in a specific way** that a newcomer would otherwise read
  loosely — for example *gate*, *seam*, *plane*, *lane*.

Do not add a term because it appears often. Add it because getting it wrong would produce a wrong
field name or a wrong acceptance criterion.

## Terms

| Term | Means | Not to be confused with |
|------|-------|-------------------------|
