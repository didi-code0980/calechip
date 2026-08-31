---
doc_version: 1
last_updated: 2026-08-31
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
| **Portion** | *thời lượng* — how much of a day one entry covers: `full`, `am`, or `pm`. | Hours. The system has exactly three values and no finer resolution. |
| **Tentative** | *chưa chốt* — a flag on an entry meaning the member may still change it. Displayed to everyone and counted in every calculation; it differs only visually. | Approval status. These are two independent axes: a tentative entry can be approved, and a non-tentative entry can be pending. Collapsing them into one field is the modelling mistake this row exists to prevent. |
| **Approval status** | *trạng thái duyệt* — `pending`, `approved`, or `rejected`. Set by an admin. | Tentative. See above. |
| **Absence count** | *số người vắng* — the derived number of people away on a given date. A `full` entry counts 1, an `am` or `pm` entry counts 0.5, and PTO and WFH count alike. | A headcount of people. It is a decimal, and it is derived — never a stored total. |
| **Threshold** | *ngưỡng* — the share of team size above which a date is overloaded. Default 50%, configurable by an admin. | A hard limit. Nothing is ever refused because of it — charter refusal 6. |
| **Overloaded day** | *ngày quá tải* — a date whose absence count exceeds the threshold. | A blocked day. It is a warning and a visual state, nothing more. |
| **Holiday** | *ngày lễ* — a public non-working day in Vietnam, plus the swap and compensatory days the government announces each year, which an admin enters. | A day someone took off. Holidays belong to the calendar, not to any member. |
| **Bridge day** | *ngày cầu* — a working day sandwiched between a holiday and a weekend, computed from the holiday calendar. | A holiday. It is an ordinary working day that is merely very likely to be requested. |
| **Team** | The group whose members see one another's entries and against whose size the threshold is computed. | An organisation or department. Exactly one team exists in v1; multiple teams are deferred, not refused. |
| **Member** | The role that creates and edits its **own** entries and reads everyone's. | A user account in general. Every person in the system is a member; some are additionally admins. |
| **Admin** | A member who can also approve and reject, maintain the holiday calendar, invite people, and set the threshold. | An owner or a billing role. Neither exists. |
