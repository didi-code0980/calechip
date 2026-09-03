---
doc_version: 3
last_updated: 2026-09-03
governed_by: [RULE-01, RULE-05]
---

# UI design system

TODO(project): this file ships as a stub. If the system has no interface, say so in one line and
delete the rest — an empty design system that nobody deletes reads as an oversight.

## Direction

TODO(project): two or three sentences. The overall feel, and the one thing that must never happen.

## Colour

TODO(project): accent, neutrals, surfaces, and the semantic colours for success, warning and danger.
Give hex values, not names.

## Type

TODO(project): the UI family, the mono family used for codes and IDs, and the scale.

## Components

TODO(project): the shapes that recur — buttons, cards, tables, dialogs, empty states — and the one
rule each carries.

## Destructive actions

**The section that is not decoration.** Where a UI element is the last thing standing between a
mis-click and permanent loss, it carries a domain rule and must be treated as one.

The origin project had exactly one invariant of this kind: deleting a parent deleted its children,
the database cascaded silently, and the confirmation dialog naming the number of records about to be
lost was the whole of the guard. `.ai/registry/invariants.md` says a UI affordance alone is never
sufficient for an invariant — which is true, and it is also true that when the database has already
been told to cascade, the dialog is what is left. Both facts belong in the design, stated together.

TODO(project): list the destructive actions, and for each one what the confirmation must name.
"Are you sure?" names nothing and is not a confirmation.

## Language

**Every string the interface renders is in English.** Labels, headings, buttons, placeholders, empty
states, and the user-facing `message` on every error returned across the data-access seam. The
operator's instruction on 2026-09-03: *"tôi muốn tất cả content đều là tiếng anh"*.

This section exists because its absence had a cost. The file was a stub through seven shipped
tickets, so it never said what language the product speaks, and each developer inferred Vietnamese
from the conversation language — which is the one place the split in `.ai/steward/context.md` says
Vietnamese belongs. Conversation is Vietnamese; the repository and now the product are English. A
convention nobody wrote down is not a convention, it is a coincidence that held.

**Error messages are interface, wherever they live.** `src/lib/data/supabase.ts` and `mock.ts` both
return `{ code, message }`, and the `message` half is rendered to a user — so it is governed here and
not by the fact that it sits in the data layer. The `code` half is an identifier and is already
English.

### The one exception, and it is deliberate

**Display names, team names and note text in fixtures and seed data stay Vietnamese, with
diacritics.** `src/lib/fixtures.ts` and `supabase/seed.sql` do not hold interface copy — they hold
stand-in *user content*, and the users of this product are a Vietnamese team whose names carry
diacritics.

That is not a stylistic preference; it is the only coverage the product has for the requirement in
`CLAUDE.md` § *Visual direction* — a type face that renders Vietnamese diacritics correctly.
Translate `displayName: "Thành viên"` to `"Member"` and nothing anywhere renders a diacritic, so the
next font change breaks the real names of real people and every test still passes.

The line is by role, not by file: **what the product says is English; what a user typed is whatever
they typed.**

### What enforces this

**A lint rule, in `eslint.config.js`, beside the one that carries RULE-02.** Same reasoning: the
paragraphs above are unenforceable as prose, and a convention nobody checks is a coincidence that
holds until the first person who has not read this file. `no-restricted-syntax` reports a Vietnamese
diacritic in a string literal, a template literal or JSX text anywhere under `src/`. It needs no
plugin and no dependency, so R8 is untouched. It reaches every stage through machinery that already
exists — `pnpm lint` is R3 in the review checklist and Definition of Done item 3 at `/ship`.

**The seam is not exempt, unlike RULE-02's rule.** The `message` half of every `{ code, message }` it
returns is rendered to a user, so it is interface copy wherever it lives — as § Language says above.

**It is a ratchet.** The twelve files that predate this section are listed by name in `COPY_DEBT` and
exempted; OPS-001 and OPS-002 empty that list, each removing the files it translates. The rule is
therefore in force for new work from the day the section landed, rather than from the day the sweep
finishes — which is the difference between protecting the twelve features still unbuilt and not
protecting them. **The list only ever shrinks.** Adding a file to it is how a ratchet turns into a
suppression list.

**The exception above is protected by a test, not by the rule.** `tests/ui-language.test.ts` asserts
that `src/lib/fixtures.ts` and `supabase/seed.sql` **do** contain diacritics. A lint rule reports what
is present and is silent about what is missing, so nothing in the rule would notice the
find-and-replace this section predicts two paragraphs above. The same test fails when a file in
`COPY_DEBT` no longer has copy to translate, so the list cannot claim a debt that is already paid.

## Selectors

The selector attribute agreed in `.ai/standards/testing-standards.md` is not a testing detail — it is
the only channel through which QA can address a control (RULE-05). A control added without one cannot
be exercised, and the failure surfaces at the QA gate looking like a Developer problem.

## Accessibility

TODO(project): the baseline, and what is explicitly out of scope until a ticket says otherwise.
