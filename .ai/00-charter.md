---
doc_version: 2
last_updated: 2026-08-31
governed_by: [RULE-01, RULE-09]
---

# Charter

What this system is for, and what it refuses to do.

Written from `product_brief.md` (Draft v1, Min). Where this file and the brief disagree, this file is
authoritative and the brief is history.

The product is **CaleChip**, named on 2026-08-31.

## What this is

A planning board on which every member of a team **declares in advance** when they intend to be on
leave (PTO) or working from home (WFH), for as far ahead as they know.

It exists because absence plans currently live in chat threads, in individual heads, or in an HR
request submitted too late to change anything. The cost is not administrative: it is a handover
arranged the night before, a deadline that slips, and the conversation nobody wants to have —
*"I already booked the flight."* Around public holidays it is worse and more predictable, because
everyone independently targets the same bridge day and none of them can see the others doing it.

The system's whole job is to make those plans visible early enough that the team can adjust. It
coordinates; it does not administer.

**Who uses it.** One team of five to thirty people. Every member reads the whole team's calendar —
transparency is a deliberate design decision, not an oversight in the permission model.

**What "working" looks like.** Plans are entered three to four weeks ahead rather than days ahead; a
day on which more than half the team is away is noticed while it is being created rather than
afterwards; and a lead can answer *"what does next month look like?"* in under ten seconds.

## What it refuses to do

Each of these is a capability the system will deliberately never grow. A refusal can be removed, but
only by arguing with the reason beside it — and that argument is the point.

1. **It will never track remaining leave quota.** Those numbers belong to the HR system. Two systems
   holding the same balance disagree eventually, and on the day they disagree every other number in
   this app stops being believed.

2. **It will never replace the official leave request.** This is a planning layer that sits *in front
   of* the HR process, not a substitute for it. An approval here is a team-coordination signal, not
   an employment decision.

3. **It will never do timekeeping, payroll, or hours tracking.** A different problem, an order of
   magnitude more complexity, and a class of risk this system is not built to carry.

4. **It will never model group activity.** Everyone registers independently. Whether people are
   travelling together is outside the system.

5. **It will never be a booking tool.** No reserving slots, no invitations, no negotiating a day with
   another person inside the app. This is an information board; the negotiating happens between
   people.

6. **A warning will never block an action.** Overload is reported, in detail, at the moment of
   choosing — and the person can always save anyway. The instant this system can refuse someone's
   plan it becomes an approval gate, which is refusal 2 arriving through the back door.

**These are refusals, not a backlog.** The brief's P2 list — multiple teams in one workspace,
role-based constraints, per-period thresholds, two-way HR sync, a year-end recap — is *deferred*, not
refused. Nothing above forbids them, and the data model is expected to leave room.

## Roles

Two, and the difference is narrow on purpose.

| Role | What only this role can do |
|---|---|
| **Member** | Create, edit and delete their **own** entries, at any time. Reads the whole team's calendar. |
| **Admin** | Everything a member can do, plus: edit or delete **any** member's entry, approve or reject entries including their own, maintain the holiday calendar including government-announced swap days, invite and remove members, promote a member to admin, and set the overload threshold. |

*Amended 2026-08-31.* The admin row previously read *"approve or reject entries, maintain the holiday
calendar, invite people, and set the overload threshold"* and was silent on four powers the product
turns out to need. The operator decided all four that day: an admin may edit another member's entry,
may approve their own, may remove a member, and may promote one. The first is the one that changes
what the product is — an entry is no longer only its author's statement — and its cost is recorded
under *Known weaknesses* in `.ai/standards/rbac-and-security.md`, because until the change feed
arrives (brief P1) an admin's edit is indistinguishable from the member's own.

**Reading is not a privilege here.** Every member sees every other member's entries in full. This is
the mechanism the product runs on, not a permission that was left open — a plan nobody can see
coordinates nothing.

Rejection is the one admin action that must always carry a reason, because a rejection without one
gives the member nothing to act on.

`.ai/standards/rbac-and-security.md` expands this into the table design section 2 is checked against.

## What this document is not

Not a requirements list, not a roadmap, not a feature registry. Features live in
`.ai/registry/features.md` and are added by a human (RULE-01). A charter that starts listing features
has become a backlog with no ordering.
