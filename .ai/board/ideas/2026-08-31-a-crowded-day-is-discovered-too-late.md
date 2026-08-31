---
stage: IDEA
agent: product
produced_at: 2026-08-31
inputs_read:
  - product_brief.md
  - .ai/00-charter.md
  - .ai/registry/invariants.md
  - .ai/registry/features.md
  - .ai/standards/data-model.md
  - .ai/01-operating-model.md
consulted: []
gate: PASS
blocking_reason: ""
next_state: TRIAGE
---

# A crowded day is discovered after it is too late to change anyone's mind

## Problem

At the moment a person is choosing a date to be away — the only moment when the choice is still
free — they cannot see how many of their teammates have already chosen the same date, or who those
people are. They find out afterwards, usually days before, when at least one person has already paid
for something.

Everyone independently targets the same bridge day for the same reason, and each of them is making a
locally sensible choice with no way to see the other five people making it.

Stated as what a person cannot do: **a member cannot tell whether the day they are about to pick is
already crowded, and a lead cannot tell which upcoming days have become crowded.**

There is a second, smaller absence inside the same problem: the threshold that defines "crowded" is
meant to be configurable and there is nowhere for an admin to set it. A warning with no settable
threshold is a hard-coded opinion, so the two are recorded together rather than split — the first
cannot ship honestly without the second.

## Who has it

- **Every member, every single time they create an entry.** This is the highest-frequency moment in
  the product and the one the brief cares most about.
- **The lead**, continuously and passively. The brief says plainly they have no way to look at the
  coming quarter and warn anyone early.
- **The admin**, once at setup and rarely after, to decide what fraction of the team being away is
  too many for this particular team.

## Evidence

- The brief's problem section names the specific failure: four or five people out on the same day,
  found close to the date, with no time to hand work over.
- Brief goal 2 is written as a timing claim rather than a feature: every day over the threshold is
  detected **at the moment of registration**, not afterwards.
- **INV-04 and INV-05 already exist and have no surface.** INV-04 defines the absence count and
  insists there is exactly one definition of it in the whole system; INV-05 makes a tentative entry
  count like any other. Both were written for this warning.
- The charter's sixth refusal exists specifically to constrain this feature, which means the risk in
  it was recognised before it was built.

## Impact if ignored

The rest of the product becomes a record rather than a coordination tool: it will faithfully show
that five people are away on 30/4 and will do so on 29/4. Handovers stay rushed, deadlines keep
slipping, and the negotiation that the brief describes as the real cost — *"em đặt vé rồi anh ơi"* —
happens exactly as often as it does today, but now with a calendar that predicted it and said
nothing.

The bridge-day case degrades worst, because it is precisely where the choices are simultaneous and
independent.

## Constraints already known

- **Charter refusal 6 — a warning never blocks an action.** This is the boundary the whole idea sits
  inside. The warning is shown in detail and the person can always save. The charter states why: the
  moment the system can refuse a plan, it has become the approval gate that refusal 2 forbids.
- **INV-04** — one definition of the absence count, sum of 1 per `full` and 0.5 per `am` or `pm`, PTO
  and WFH alike, rejected entries excluded. The number in the warning, the number in a month cell and
  the number in any future notification are the same number, computed once.
- **INV-05** — tentative counts. A warning that discounted tentative entries would defeat the reason
  tentative exists.
- **The threshold is not an invariant.** `.ai/registry/invariants.md` records it as considered and
  rejected: it is configurable, default 50%, set by an admin.
- **What the threshold multiplies is settled and has a stated cost.** The team's **current** member
  count, read at evaluation time — so when somebody joins or leaves, a past date can flip between
  overloaded and normal. Recorded in the INV-04 note and in `.ai/standards/data-model.md`.
- **The absence count has no column.** `.ai/standards/data-model.md` records it as computed on read,
  deliberately, because storing it would create a second thing to keep true.

## Out of scope

- **Notifying anyone.** Telling a lead that a new overloaded day appeared, or nudging a member about
  next month's bridge days, is P1 in the brief and a different mechanism (a channel, a schedule, a
  delivery guarantee). This idea is about what a person sees while they are already looking.
- **Different thresholds for different periods** — a release week capped at 20%. Explicitly P2.
- **Role-based constraints** — "these two may not be away together". P2.
- **Preventing, blocking, queueing or requiring justification for a save.** Charter refusal 6.
- **Detecting bridge days.** A separate idea; this one consumes the marking if it exists.

## Open questions

1. ~~**Do a removed member's future entries still count toward the numerator?**~~ **Answered by the
   operator, 2026-08-31: they do not count.** The entries stay in the data and stay visible, but they
   leave the absence count the moment the member is removed, so numerator and denominator read the
   same set of current members and the ratio cannot disagree with itself. INV-04's note today records
   the denominator only; extending it to the numerator is a registry amendment and needs an ADR under
   RULE-01 — raise it at triage, not here. The same answer applies to the team-membership idea.
2. **What does the warning say for a multi-day range where only some days are over?** The brief's
   example is a single date. A five-day range crossing two crowded days needs a decision about
   whether it warns once, per day, or lists the days.
3. **Does the warning name people whose entries are still pending?** INV-04 counts pending and
   approved alike, so the number includes them; whether the listed names distinguish a settled
   absence from a pending one is a separate choice, and it interacts with the approval star.
4. **Where can an admin set the threshold, and is it per team?** v1 has one team, but INV-07 makes the
   team a real property of the data, and a threshold stored globally would have to move later.
