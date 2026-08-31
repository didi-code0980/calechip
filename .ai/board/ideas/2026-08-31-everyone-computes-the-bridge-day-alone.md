---
stage: IDEA
agent: product
produced_at: 2026-08-31
inputs_read:
  - product_brief.md
  - .ai/00-charter.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/features.md
  - .ai/standards/data-model.md
consulted: []
gate: PASS
blocking_reason: ""
next_state: TRIAGE
---

# Everyone works out the bridge day alone, from a news article, at the same time

## Problem

A person planning time off around a Vietnamese public holiday cannot see, in one place, which days are
holidays this year, which working days sit wedged between a holiday and a weekend, or which working
Saturday the government has swapped in to compensate. They reconstruct it from a news announcement or
from somebody's screenshot in a group chat, once a year, individually.

Two consequences follow, and only the second is obvious:

- The calendar the team plans against **disagrees with the calendar the country runs on** — a day
  shown as an ordinary working day is a national holiday, or a Saturday shown as a weekend is a
  mandated working day.
- Everyone spots the same bridge day, independently, at roughly the same moment, and each of them
  believes they are the only one who has noticed.

The brief writes this as requirement 7.5, a built-in holiday set plus automatic bridge-day detection.
The problem underneath is that **the working-day calendar is currently private knowledge, and it is
the input to every other decision the product supports.**

## Who has it

- **Every member**, around each of the five holiday clusters in a Vietnamese year — Tết Dương lịch,
  Tết Âm lịch, Giỗ Tổ Hùng Vương, 30/4–1/5, and Quốc khánh 2/9. Five well-defined moments where
  demand concentrates.
- **The admin**, once a year, when the government announces that year's swap and compensation
  schedule — a change nobody can derive and which arrives on no fixed date.

## Evidence

- The brief's problem section names the holiday pile-up as the *predictable* failure, distinct from
  ordinary crowding: *"ai cũng có xu hướng xin nghỉ/WFH 'ngày cầu'... nhưng không ai biết người khác
  cũng đang nhắm."*
- Brief 7.5 asks for the holiday set, admin-maintained swap days, and automatic bridge-day
  highlighting, in that order.
- **`.ai/registry/glossary.md` already defines a bridge day** — a working day sandwiched between a
  holiday and a weekend, computed from the holiday calendar — and warns that it is not a holiday but
  an ordinary working day that is merely very likely to be requested.
- **`.ai/standards/data-model.md` records that bridge days have no columns**: they are computed on
  read, deliberately, so that there is no second stored thing to keep true. A holiday table is
  therefore the only input the computation has, which makes its correctness load-bearing.
- The brief's late success measure — the share of entries created 30 or more days before a holiday —
  measures this specific behaviour.

## Impact if ignored

The single most contested set of dates in the year is the one the product knows least about. Members
declare against a grid that does not know 30/4 is a holiday; the crowded-day warning counts absences
on a day nobody was going to work anyway; and the bridge day — the one day where seeing other
people's intentions changes behaviour most — looks exactly like every other Tuesday.

The team also keeps paying the annual cost of somebody manually reconciling the government
announcement with everybody's assumptions, in chat, where it will not be found next year.

## Constraints already known

- **Bridge days are derived, not stored.** `.ai/standards/data-model.md`. Whatever is built here
  supplies holidays and weekends; the bridge day is a consequence.
- **A bridge day is a working day.** The glossary is explicit. It must not reduce the denominator of
  anything, and it must not be styled as a holiday — `CLAUDE.md`'s visual direction gives holidays
  lavender, and a bridge day is not one.
- **INV-04 is untouched by this.** The absence count is a sum over entries; a holiday does not change
  the formula. If a holiday should suppress the crowded-day warning, that is a separate decision and
  it is not written down anywhere.
- **Maintaining the holiday calendar is an admin-only power**, per the charter's Roles table.
- **`holiday` to `team` is an open question in `.ai/standards/data-model.md`** — whether a holiday
  belongs to a team or to the whole system is unresolved there, and it is the same question this idea
  has to answer.

## Out of scope

- **Any non-Vietnamese holiday set, region or locale.** v1 is one team in Vietnam.
- **Reminding anyone that a bridge day is coming.** P1 in the brief, and a notification mechanism
  this product does not yet have.
- **The crowded-day warning itself.** A separate idea; this one supplies a day's status, not the
  count of people on it.
- **Working-hours, shift or partial-day office policy.** Charter refusal 3.
- **Deciding company-specific days off** that are not government holidays. Not in the brief; if it is
  wanted, it is a distinct request.

## Open questions

1. ~~**Where does each year's base holiday set come from after the first year?**~~ **Answered by
   the operator, 2026-08-31: several years are seeded into the data up front, and an admin edits
   them.** No lunar-calendar computation — Tết and Giỗ Tổ are seeded at their known Gregorian dates,
   and the ngày nghỉ bù the Government announces each year arrive through the admin's own editing,
   which a computation could never have supplied. Two things this answer does not settle: **how many
   years are seeded** (question 5 asks the same thing from the other side and should be answered with
   it), and **what happens when the seed runs out** — an empty year must be visible as empty rather
   than as a year with no holidays.
2. **Is a holiday scoped to a team or to the system?** Recorded as unresolved in
   `.ai/standards/data-model.md`. v1 has one team, and INV-07 makes team a real property of the data,
   so the cheap answer now is the expensive migration later.
3. **How is a mandated working Saturday (làm bù) represented?** It is the inverse of a holiday — a
   weekend day that counts as a working day — and the brief mentions swap days without saying whether
   they are one concept with a sign or two different things.
4. **Does a holiday suppress or alter the crowded-day warning for that date?** Nobody is at work, so
   the count is arguably meaningless; nothing in the registry says either way.
5. **How far ahead must the calendar reach?** Members are expected to declare four months out and the
   year view spans 365 days, so a calendar that only holds the current year will be short exactly when
   somebody plans Tết.
