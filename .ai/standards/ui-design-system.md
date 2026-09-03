---
doc_version: 3
last_updated: 2026-09-01
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

## Selectors

The selector attribute agreed in `.ai/standards/testing-standards.md` is not a testing detail — it is
the only channel through which QA can address a control (RULE-05). A control added without one cannot
be exercised, and the failure surfaces at the QA gate looking like a Developer problem.

## Accessibility

TODO(project): the baseline, and what is explicitly out of scope until a ticket says otherwise.
