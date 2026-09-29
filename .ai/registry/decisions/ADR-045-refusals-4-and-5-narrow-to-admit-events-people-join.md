---
doc_version: 2
last_updated: 2026-09-29
governed_by: [RULE-01, RULE-09]
---

# ADR-045 — Refusals 4 and 5 narrow to admit an event that people join

> **Written by the steward (`/thuki`) on the operator's instruction.** `.ai/registry/**` and the
> charter are human-owned under RULE-01, whose enforcement is CODEOWNERS review on the pull request.
> The decision to amend is the operator's, quoted in § Status. The wording below is the steward's,
> and the operator had not seen it when it was written.

## Status

`ACCEPTED by the operator`: **the decision to amend refusals 4 and 5**, 2026-09-29. A `/solo` plan
for an "events" feature stopped on charter refusals 4 and 5. The operator was asked
*"Có gỡ refusal 4 và 5 không?"* and answered, verbatim:

> *"(a) Có. Viết ADR sửa charter qua /thuki, rồi làm tính năng qua /idea và loop."*

**That answer accepts that the refusals are amended. It does not accept this text.** The scope of
the amendment below, which parts of each refusal still stand, and the boundary this ADR leaves open
are the steward's reading of the answer. The operator accepts that text by approving the pull
request under CODEOWNERS, and not before. If the review changes what is lifted, this ADR changes
with it, and the decision to amend still stands.

## Context

The operator wants a feature in which **a user creates an event and other people click to join
it**. The invite scope is one of three:

- a chosen team;
- specific users;
- public to all users.

`.ai/00-charter.md` (v2) refuses this twice:

- **Refusal 4.** *"It will never model group activity. Everyone registers independently. Whether
  people are travelling together is outside the system."* An event that several people join is
  group activity by definition.
- **Refusal 5.** *"It will never be a booking tool. No reserving slots, no invitations, no
  negotiating a day with another person inside the app. This is an information board; the
  negotiating happens between people."* An invite scope is an invitation.

The charter says a refusal can be removed *"only by arguing with the reason beside it"*. This ADR
makes that argument for each refusal and lifts only what the argument covers.

## Decision

### 1. Refusal 4 is narrowed

**Lifted:** the system may record an **event**, meaning a named occasion that one person creates,
and the set of people who have each chosen to join it.

**Still standing:**

- **An absence entry is still one person's own declaration.** No entry is joint, shared or group.
  An event creates, edits or implies no PTO or WFH entry for anyone. Its creator does not get one,
  and neither does anyone who joins.
- **Each person joins for themselves.** Nobody is entered into an event by another person's action,
  including the creator's. An invitation makes an event visible to someone. It does not make them
  a participant.
- **Travelling together for leave is still outside the system.** Whether two people's PTO
  coincides because they planned it together stays a matter between them, not a relation between
  two entries.

### 2. Refusal 5 is narrowed

**Lifted:** **invitations**, only in the sense of an event's **invite scope**, which decides who can
see an event and join it. The scope is one of a chosen team, specific users, or all users.

**Still standing:**

- **No reserving slots.** An event does not hold a time slot, a room or a resource on anyone's
  behalf.
- **No capacity limits.** Nothing has a seat count, a maximum number of participants or a waitlist,
  and a join is never refused because an event is full.
- **No negotiating a day off with another person.** Nothing in the app asks someone to take, move,
  swap or cover a day, or accepts or declines another person's leave on their behalf. That includes
  polling for a date that suits everyone.
- **Joining obliges nobody and decides nothing.** A join is not an approval, and it changes no
  entry's status. Refusal 2 is untouched: this is still not the official leave process.
- **Refusal 6 holds for events too.** No event, join or invite scope ever refuses a person's save of
  their own entry.

### 3. INV-04 is untouched

**Joining an event does not count toward INV-04's absence count, and neither does creating one**,
unless a separate ADR says otherwise. An event is not an entry, so it is not in INV-04's numerator.
`.ai/registry/invariants.md` does not change.

### 4. The read boundary is not decided here

**Two of the three invite scopes cross ADR-040's read boundary.** Today a non-admin reads only their
own team's rows, through `public.member_team_id`. ADR-040 gave cross-team reads to admins only,
read-only, through `security definer` functions that test `public.is_admin`.

- **An invitation to a chosen team** that is not the creator's own lets a member of that team read a
  row authored on another team. It also shows them the creator's name.
- **An invitation to specific users** needs a picker. A creator who can name users on other teams can
  enumerate people across teams, which is a new read of the member list (ADR-018).
- **Public to all users** lets every approved user read the event, its creator and its participant
  list, whatever their team.

In each case the participants' names cross the team boundary too. **Whether and how that boundary
widens is decided at `/idea` or at PLAN**, is recorded in an ADR of its own, and changes
`.ai/standards/rbac-and-security.md`. This ADR admits the three scopes as a product intent. It does
not admit the read they require.

### 5. Left to `/idea`

These are deliberately not decided here: who may create an event; whether events appear on the
calendar grid; whether an event has a date or a time; whether and by whom an event is edited or
cancelled; whether and how a person leaves an event they joined.

## Rationale

### The reason beside refusal 4

The reason given is *"Everyone registers independently."* What that protects is the entry. An
absence entry is one person's statement about their own day, which is what makes INV-04 a count of
people and what makes an approval a decision about one person. **An event does not touch that.** It
is a different object, it sits beside the entries rather than merging them, and joining one is still
an independent act: one person, one click, for themselves. The refusal was written as *"never model
group activity"*, which is wider than its reason. This ADR cuts it back to its reason.

*"Whether people are travelling together is outside the system"* is kept. It is about leave, and an
event is not leave.

### The reason beside refusal 5

The reason given is *"This is an information board; the negotiating happens between people."* An
event with an invite scope and a join button is information: *this is happening, and these people
say they are coming.* It asks nobody for a day and holds nothing for anyone, and it does not settle
an argument between two people's plans. **The refusal named invitations alongside two things that
are negotiation, reserving slots and negotiating a day, and an invitation to an occasion is not
one of them.** Those two stay refused, and capacity limits are refused with them explicitly,
because a capacity is a slot with a number on it.

### Alternatives rejected

- **Remove refusals 4 and 5 outright.** That is simpler to write. It also leaves the charter silent
  on joint absence entries, seat booking and day-swapping, none of which was asked for. The next
  plan would read the silence as permission, which is the drift the refusals exist to prevent.
- **Keep the refusals and build the feature as "not really an event".** Calling it an announcement
  or a post would reach the same product while the charter still said it was refused. A charter
  that the code contradicts stops being read, which is refusal 1's own reason turned on the charter.

## Consequences

- **The product gains a second kind of object on a date.** Until now everything on a day was an
  absence entry or a holiday. Any screen that shows both has to keep them apart visually and in
  counting, and § Decision 3 forbids an event from reaching the count.
- **Refusal 5's wording loses "no invitations".** A later request for RSVP obligations, reminders
  that nag, or a "decline with reason" flow will cite this ADR as precedent. § Decision 2 is the
  line, and it has to be read with the request.
- **ADR-040's boundary is under pressure before the feature has a plan.** Two of the three scopes
  the operator named cannot ship without widening it. If `/idea` decides against widening it, the
  feature ships with the same-team scope only, and the other two wait for their own ADR.
- **Nothing is built by this ADR.** There is no feature ID, no table and no permission row. Those
  arrive through `/idea` and the loop, as the operator directed.

## Revert condition

Any of the following, observed in a merged change:

- an event row, or a join, contributes to an INV-04 count without an ADR that says so;
- an event creates, alters or changes the status of any absence entry;
- an event carries a capacity, a seat count or a waitlist, or a join is refused because an event is
  full;
- a person becomes a participant through someone else's action.

Any one means the amendment is being read wider than it was decided. **Revert the charter's refusals
4 and 5 to their v2 text**, which is quoted in § Context. The event feature is then out of charter
and comes out with them.

## Affected documents

| File | Change | `doc_version` | Status |
|---|---|---|---|
| `.ai/00-charter.md` | Refusals 4 and 5 amended in place, with the v2 text kept beside each and this ADR cited. Still six refusals | **3** | done in this ADR's pull request |
| `.ai/registry/features.md` | A row for the event feature | n/a | owed: `/idea`, then `/triage` |
| `.ai/standards/rbac-and-security.md` | Rows for create, read, join and (if decided) leave, edit or cancel an event, and the cross-team read decided under § Decision 4 | next | owed: PLAN |
| `.ai/standards/data-model.md` | The event and participation tables | next | owed: PLAN |
| `.ai/registry/glossary.md` | *Event*, *invite scope*, *join* | n/a | owed: `/triage` |
| `.ai/registry/decisions/ADR-040-an-admin-reads-any-teams-calendar-read-only.md` | Annotated or superseded in part if § Decision 4 widens the read boundary. Not before | n/a | conditional |
| `.ai/registry/invariants.md` | **Deliberately absent.** INV-04 is not changed (§ Decision 3) | unchanged | n/a |
