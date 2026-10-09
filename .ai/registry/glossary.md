---
doc_version: 2
last_updated: 2026-09-29
governed_by: [RULE-01]
---

# Glossary

The vocabulary the whole system reasons in. One term, one meaning, one spelling.

Rows are written by agents and approved by a human at merge, under CODEOWNERS (RULE-01, ADR-007).
**A new term is written at PLAN**, by `tech-lead-design`, for each term the ticket's `glossary_owed`
names, and ships in that ticket's pull request — ADR-047. `/triage` names the owed terms and writes
no row here.

*Amended 2026-09-29 by ADR-047. Read: "Human-only, per RULE-01. An agent that needs a term added
stops with `gate: BLOCKED` and states it in `blocking_reason`." — stale since ADR-007 exempted
glossary rows, and contradicted by every row added since.*

**Why this is a registry file and not a wiki page.** Agents name things from this list. A term with
two spellings becomes two field names, two DTO shapes, and a lint exemption, and the divergence is
only visible three tickets later. `.ai/standards/coding-standards.md` forbids abbreviations that are
not defined here, which is the mechanism that makes the list load-bearing rather than decorative.

**English is the identifier; Vietnamese is what the team says.** Code, field names and artifacts use
the term in the first column. The Vietnamese phrase in the second column is what the same thing is
called in conversation and in the interface, recorded here so the two never drift into being
different concepts.

## Terms

| Term | Means | Not to be confused with |
|------|-------|-------------------------|
| **Entry** | *đăng ký* — one declaration that one member will be away or remote, over one date or a run of consecutive dates. The unit everything else counts, approves and displays. | A leave request in the HR system. An entry is a plan announced to the team; it carries no employment consequence. |
| **PTO** | *nghỉ* — the member is not working. | Any distinction between paid and unpaid, or any quota. Neither is modelled — see charter refusal 1. |
| **WFH** | *làm việc từ xa* — the member **is working**, but not at the office. | PTO. A WFH member is available; this is the single most costly confusion in the domain, because both reduce office presence and only one reduces capacity. |
| **Portion** | *thời lượng* — how much of a day one entry covers: `full`, `am`, or `pm`. One entry carries exactly one, and it applies to **every** date in the entry's range (INV-06) — a five-day `pm` entry is five afternoons. | Hours. Three values, no finer resolution. Also not a per-day value: a trip leaving Wednesday afternoon and returning Monday morning is up to three entries, not one. |
| **Tentative** | *chưa chốt* — a flag on an entry meaning the member may still change it. Displayed to everyone and counted in every calculation; it differs only visually. | Approval status. These are two independent axes: a tentative entry can be approved, and a non-tentative entry can be pending. Collapsing them into one field is the modelling mistake this row exists to prevent. |
| **Approval status** | *trạng thái duyệt* — `pending`, `approved`, or `rejected`. Set by an admin or a manager (ADR-035), and **PTO and WFH alike** — decided by the operator on 2026-08-31, so `status` is meaningful on every row and INV-03 has no exception. | Tentative. See above. |
| **Absence count** | *số người vắng* — the derived number of people away on a given date, over that date's `pending` and `approved` entries **whose member was still on the team that date**: 1 per `full`, 0.5 per `am` or `pm`, PTO and WFH alike. **Rejected entries are excluded**, and so are entries of a member removed on or before the date (ADR-013). | A headcount of people. It is a decimal, it is derived and never stored, and it has exactly one definition anywhere in the system (INV-04). Not a function of the date's entries alone — it needs the roster. |
| **Threshold** | *ngưỡng* — the share of team size above which a date is overloaded. Default 50%, configurable by an admin. It multiplies the team's **current** member count, evaluated when the number is read — so a past date can change between overloaded and normal when somebody joins or leaves. | A hard limit. Nothing is ever refused because of it — charter refusal 6. Not a historical figure: membership as it stood on the date in question is deliberately not stored. |
| **Overloaded day** | *ngày quá tải* — a date whose absence count exceeds the threshold. | A blocked day. It is a warning and a visual state, nothing more. |
| **Holiday** | *ngày lễ* — a public non-working day in Vietnam, plus the swap and compensatory days the government announces each year, which an admin enters. | A day someone took off. Holidays belong to the calendar, not to any member. |
| **Bridge day** | *ngày cầu* — a working day sandwiched between a holiday and a weekend, computed from the holiday calendar. | A holiday. It is an ordinary working day that is merely very likely to be requested. |
| **Team** | The group whose members see one another's entries and against whose size the threshold is computed. | An organisation or department. Exactly one team exists in v1; multiple teams are deferred, not refused. |
| **Member** | The role that creates and edits its **own** entries and reads everyone's. | A user account in general. Every person in the system is a member; some are additionally managers or admins. |
| **Manager** | A member who may also approve or reject **another** member's entry — and nothing else a member cannot do. Added 2026-09-12 by [ADR-035](decisions/ADR-035-a-third-role-manager-decides-entries-and-nothing-else.md). | An admin with fewer buttons. A manager maintains no calendar, changes no roster and no threshold, edits nobody's entry but their own, and may not decide their own. |
| **Admin** | A member who can also approve and reject **including their own entries**, maintain the holiday calendar, invite people, and set the threshold. Since ADR-035 the approve half is shared with **Manager**; the rest is the admin's alone. | An owner or a billing role. Neither exists. |
| **Event** | *sự kiện* — a gathering one member announces, over one date or a run of dates with no times, for a scope: their own team, named people, or every team. Added 2026-09-29 by [ADR-045](decisions/ADR-045-charter-refusals-4-and-5-are-lifted-for-events.md). | An entry. An event creates no entry, is not in the absence count and is not drawn on the calendar grids; attending one says nothing about whether a person is away. |
| **Attendee** | *người tham gia* — a member whose request to join an event is approved, or who joined an event that needs no approval. Only attendees count against capacity; a pending request does not. The event's creator is not one unless they join. | A member counted in the absence count. The two never touch. |
| **Invitation** | *lời mời* — naming a person on an event whose scope is named people, which lets them see it and request to join it. It is not a pre-approval: in an approval-required event an invitee waits like anyone else. | Joining the product. The `TEA` group's *invitations*, and ADR-033's sign-up path, mean letting a person onto the board; this word means asking a person who is already on it to a gathering. |
| **Capacity** | *số chỗ* — an optional upper bound on an event's attendees, set by its creator. It may never be set below the current number of attendees, and it must hold under concurrent joins and approvals. | The threshold. Capacity refuses a join when full; the threshold refuses nothing (charter refusal 6). |
| **Guest link** | *link cho khách* — the unguessable link an event's creator, or an admin, creates by opening the event to guests. Anyone holding it reads that one event and its attendees' names without an account, whatever the event's scope; nothing lists or indexes it, and closing the event to guests stops it. Added 2026-10-09 by [ADR-052](decisions/ADR-052-an-event-can-be-opened-to-guests-without-an-account.md) decisions 1–3, from `2026-10-08-a-gathering-cannot-include-anyone-without-an-account.md` Q2, Q3, Q9 and F2. | The event's own address inside the product (`/events/:id`), which needs a sign-in and follows the event's scope. A guest's manage link (`EVT-07`, ADR-052 decision 6), which is one guest's secret for their own registration. An invitation — a guest link names nobody. |
| **Guest** | *khách* — a person without an account who registers for an event opened to guests, through its guest link, with a name and an email. A guest takes a seat and follows the event's capacity, approval mode and registration deadline exactly as a member does, and manages their registration — its status, and cancelling it — through a secret manage link shown once on screen. A guest's name is readable by everyone who can read the event; their email by the event's creator and admins only. One registration per email per event; guest data is kept indefinitely. Added 2026-10-09 by [ADR-052](decisions/ADR-052-an-event-can-be-opened-to-guests-without-an-account.md) decisions 4–9, from `2026-10-08-a-gathering-cannot-include-anyone-without-an-account.md` Q5, Q6, Q7, Q8 and F1. | A **Member** — a guest has no account, no team and no `public.member` row, and never enters an absence count (ADR-052 decision 9). An **Attendee** in this glossary's sense, which is a member — though an attending guest counts against **Capacity** like one. A pending sign-up, who is asking to join the product, not an event. |
| **Notification** | *thông báo* — one row the database writes for one person when something happens to an event that concerns them: a new event for their team or for everyone, being invited by name, their join request approved, rejected or removed, an event they take part in changed or cancelled, or — for its creator — a join request or a withdrawal. Only ever addressed to someone who can read the event at that moment; read and marked read by that person alone; never written for the person who caused it. Added 2026-10-08 by [ADR-050](decisions/ADR-050-in-app-notifications-for-events-are-written-by-the-database.md), from `2026-10-08-a-person-learns-about-an-event-only-by-going-to-look.md` Q2. | Email about an event (`EVT-05`, ADR-051) — a notification is in-app only. The overload warning — that is computed for a date and stored nowhere. A reminder — none exists; nothing is written on a schedule (ADR-050 decision 6). |
