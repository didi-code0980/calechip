---
stage: TRIAGE
agent: product
produced_at: 2026-10-14T11:58:00Z
inputs_read:
  - CLAUDE.md
  - .ai/steward/context.md
  - .ai/templates/idea.md
  - .ai/registry/features.md
  - .ai/registry/decisions/ADR-052-an-event-can-be-opened-to-guests-without-an-account.md
  - .ai/registry/decisions/ADR-059-calechip-becomes-multi-tenant-system-org-team.md
  - .ai/registry/decisions/ADR-061-invitations-reach-every-event-scope-and-a-signed-in-reader-leaves-the-guest-page.md
  - src/routes/EventDetail.tsx
  - src/routes/GuestEvent.tsx
  - src/components/EventAttendancePanel.tsx
  - src/routes/SignIn.tsx
  - src/routes/SignUp.tsx
  - src/routes/AwaitingApproval.tsx
  - src/App.tsx
consulted: [operator]
gate: PASS
blocking_reason: ""
next_state: TRIAGE
verdict: ""
verdict_reason: ""
ticket_id: ""
awaiting_adrs: []
operator_request: "Make the “Join event” registration block the primary call to action.\n\n* The registration block should stay visible (sticky/floating) while the user scrolls through the event article.\n* For guests (not logged in / no account): show a sign-up / log-in prompt fixed to the header or footer."
---

# The way to join an event scrolls out of sight, and a guest cannot sign in from it

## Problem

*Derived from the request above. The operator stated a solution, not a problem.*

1. **On both event pages the way to join sits below everything else.** On `/events/:id` the join
   control is inside `EventAttendancePanel`, rendered after the name, dates, scope, creator,
   location, description and named list (`src/routes/EventDetail.tsx:242-323`). On `/guest/:token`
   the register form comes after the description and the seats line
   (`src/routes/GuestEvent.tsx:189-221`). Since EVT-10 and EVT-11 a description can hold formatted
   text and pictures, so it can be long. A reader has to scroll past all of it before they find the
   one thing the page asks them to do, and it is gone again once they scroll back up.
2. **Someone reading a guest link has no way from that page to sign in or make an account.** The
   guest page renders inside `BareLayout`, with no top bar and no link to `/signin` or `/signup`
   (`src/routes/GuestEvent.tsx:3-5`). A member who opened a forwarded link while signed out has to
   find the sign-in page on their own. If they do sign in, they land on `/` and lose the event,
   because `/signin` has no return-to (`src/routes/SignIn.tsx`, which reads no redirect target).

## Who has it

- **Any approved member opening `/events/:id`**, on every event with a description longer than one
  screen.
- **Anyone opening `/guest/<token>`**: an outsider, or a member who is signed out. This happens on
  every opened event, and since EVT-08, EVT-09 and EVT-12 it happens on every emailed invitation.

## Evidence

No support request or observed workaround is on file. The evidence is the code paths cited under
`## Problem`, and the operator's request.

**Questions asked in this session and the operator's answers, verbatim.** Each question was put
with both branches costed. The question text is condensed here and the answers are exact.

- **Q1. Which pages get the sticky join block?** A: both `/events/:id` and `/guest/:token`, which
  means splitting the join action and status out of `EventAttendancePanel` and making the guest
  form sticky too. B: `/events/:id` only. C: `/guest/:token` only.
  **Operator: "A"**
- **Q2. Does guest registration without an account (EVT-07) stay?** A: yes, and the sign-in/sign-up
  prompt is an additional path with no permission change. B: no, an account becomes mandatory,
  which needs an ADR reversing part of ADR-052.
  **Operator: "A"**
- **Q3. After "Log in" from the prompt, where does the reader land?** A: back on the same event.
  This needs a return-to on `/signin`. Once EVT-13 ships, a reader who can read the event ends on
  `/events/:id` and one who cannot comes back to the guest page. B: `/`, as today, which builds
  nothing but loses the event.
  **Operator: "A"**
- **Q4. What does "Sign up" do?** A new account is a pending sign-up that waits for an admin
  (`src/routes/AwaitingApproval.tsx:38-44`), and ADR-059 has no self-serve org signup, so signing up
  does not let anyone join this event now. A: show Sign up and link to `/signup` as it is, with the
  prompt saying that approval is needed. This is a link only. B: Log in only, no Sign up.
  C: signing up from an event grants something, such as auto-approval or the creator's team, which
  is a new permission and needs an ADR and a migration.
  **Operator: "A"**
- **Q5. Does a signed-in reader who stays on the guest page (EVT-13: they cannot read the event)
  see the prompt?** A: no, the prompt is for signed-out readers only, so the guest page reads the
  session (EVT-13 has to as well). B: everyone sees it, with no session read.
  **Operator: "A"**

**Guesses by `product`, not the operator's.** Each was named to the operator before the answers
above, with an invitation to overturn it, and none was overturned. PLAN may still overturn any of
them:

- **G1.** The sticky block always shows the reader's current state: *Join* / *Register*, or
  *Request to join*, or waiting for a decision, going, closed, or full. It does not disappear once
  the reader has joined.
- **G2.** A guest can dismiss the prompt for the current page view only. Nothing is persisted.
- **G3.** No schema change. Nothing here reads or writes anything new in the database.

**Layout is `tech-lead-design`'s** (CLAUDE.md carve-out, `ui-design-system.md` § *Visual
specification*). That covers whether the block is a sidebar, a bottom bar or a floating card, how it
differs between desktop and mobile, and whether the prompt sits in the header or the footer. None of
it was asked.

## Impact if ignored

Readers keep missing the one action an event page exists for, and missing it more often as
descriptions get longer with pictures. A signed-out member who opens an invitation link registers as
a guest with their email instead of joining as themselves. That puts them in the event's guest list,
not its member attendance, and nothing links the two.

## Constraints already known

- **Every control here is an affordance (ADR-005).** Making the block sticky changes where it is
  drawn, not what `event_attendance_guard`, `register_guest` or `event_guest_guard` allow.
- **EVT-06 AC-16 says the guest page is the same for every reader, and reads no session**
  (`src/routes/GuestEvent.tsx:3-4`). ADR-061 decision 8 amends that only for a signed-in reader who
  *can* read the event (the redirect). **Q5-A goes further:** it shows a signed-in reader who *cannot*
  read the event a different page (no prompt). TRIAGE judges whether that needs an ADR amendment or
  fits within ADR-061. The operator's decision is recorded above either way.
- **Return-to on `/signin` (Q3-A) must accept only an in-app path.** A target taken from the URL is
  an open redirect if it can name another origin. PLAN states the rule.
- **Depends on EVT-13 (PLANNED) for the Q3-A destination to be right.** Without EVT-13, returning to
  `/guest/<token>` after sign-in shows the guest page with the prompt now hidden (Q5-A). That is
  correct but less useful. TRIAGE decides whether to sequence this after EVT-13 or accept it.
- **Sign-up still produces a pending account (Q4-A).** ADR-059 decision 1 and its deferred item 5
  (no self-serve org signup) are untouched.
- **Visual direction:** pastel and rounded, *Full* in the overloaded-day pink and never red
  (`GuestEvent.tsx:211`), Nunito / Baloo 2. The member page is not the calendar grid, so the density
  rule does not constrain it.
- `Invariants touched`: none that `product` can see. This reads no absence count. PLAN answers.

## Out of scope

- **Making an account mandatory to register** (Q2-B, decided against). EVT-07 stays as it is.
- **Any new permission from signing up on an event page**, such as auto-approval or auto-joining the
  creator's team (Q4-C, decided against).
- **A sticky block on the calendar grids, `/events` or any other surface.** Only the two event
  article pages (Q1-A).
- **Linking a guest registration to a member account** after the guest signs in or up.
- **The redirect itself.** That is EVT-13, and this idea only depends on it.
- **Persisting a dismissed prompt** across visits (G2).

## Open questions

None outstanding for the operator. G1 to G3 are guesses PLAN may overturn, and the AC-16 point under
`## Constraints already known` is TRIAGE's to judge.
