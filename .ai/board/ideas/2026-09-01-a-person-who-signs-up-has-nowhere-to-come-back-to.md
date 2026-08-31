---
stage: IDEA
agent: product
produced_at: 2026-09-01
inputs_read:
  - .ai/steward/context.md
  - .ai/templates/idea.md
  - .ai/00-charter.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/rules.md
  - .ai/registry/decisions/ADR-005-authorization-in-rls.md
  - .ai/registry/decisions/ADR-009-how-a-person-becomes-a-member.md
  - .ai/registry/decisions/ADR-010-triage-creates-the-ticket-shell.md
  - .ai/standards/rbac-and-security.md
  - .ai/01-operating-model.md
  - .ai/board/backlog.md
  - .ai/board/model-debt.md
  - .ai/board/ideas/2026-08-31-nobody-can-join-the-board.md
  - .ai/board/tickets/TEA-01/01-story.md
  - .ai/board/tickets/TEA-01/02-design.md
  - .ai/board/tickets/TEA-02/01-story.md
  - .ai/board/tickets/TEA-02/02-design.md
  - .ai/board/tickets/TEA-02/ticket.yaml
  - src/App.tsx
  - src/routes/SignUp.tsx
  - src/routes/AllowList.tsx
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
consulted: []
gate: PASS
blocking_reason: ""
next_state: TRIAGE
---

# A person who signs up has nowhere to come back to

## Problem

**The product has a door in and no door back.** A person can create an account, confirm their
address, and then find that there is nothing in CaleChip that will let them in again. There is no
screen that accepts an address and a password, nothing in the running application ever establishes a
session, and every address other than `/signup` and `/allow-list` is redirected to the sign-up form —
`src/App.tsx:41`. The application therefore has no signed-in state at all: not for a member, not for
an admin, not for the operator's own seeded admin account.

Three separate people are stopped by the same absence:

- **The person who just signed up.** `src/routes/SignUp.tsx:61-72` ends on a notice telling them to
  check their email. That notice is the last screen the product has for them. Confirming the address
  leads back to a sign-up form they have already used.
- **The admin.** Everything the charter gives only to an admin — approve, maintain the calendar,
  invite, set the threshold — is a policy written against `auth.uid()` under ADR-005, and there is no
  `auth.uid()`. The one admin screen that exists today, the allow-list at `/allow-list`, refuses
  everybody: `src/routes/AllowList.tsx:47` renders `allow-list-refused` when `getCurrentMember()`
  returns null, and `src/lib/data/supabase.ts:209-211` states in a comment that null is what it
  returns on every call until sign-in exists.
- **The person who signed up without being on the allow-list.** ADR-009 *Consequences* says they get
  an auth user with no member row, and that this state *"must be handled in the interface, not left
  to look like a bug."* No interface can handle it, because handling it requires knowing who is
  asking, which requires a session.

**This is stated as an absent state rather than as "build a login screen" deliberately.** The missing
thing is not one form. It is the product's ability to know who is looking at it, which every feature
in `.ai/board/backlog.md` assumes it already has.

### Why it is missing, which is the operator's actual question

Nobody decided not to build it. **It was specified, carved out of a ticket at DESIGN, recorded in
four places, and then fell through a hole in the loop**, because no command in the model creates a
ticket for half of a feature.

- `.ai/board/tickets/TEA-01/02-design.md` sized TEA-01 at L against an estimate of M and failed its
  gate. `.ai/01-operating-model.md:386` says an L ticket *must split at DESIGN*, and DoR item 5 makes
  re-estimating to L unreachable — so the story was reworked and split.
- The BA put the split in `01-story.md` *Out of scope* and correctly refused to create the sibling
  ticket: *"Shells are created by `product` at `/triage` (ADR-010) … so the BA cannot write a sibling
  ticket's shell from here even if the model wanted it to."* (`01-story.md:224-227`).
- ADR-010 §Decision creates a shell **on a PROMOTE verdict, per feature row**. This half is not a
  feature row — TEA-01's story fixes both halves at `feature_ids: [TEA-01]` — so there was no verdict
  to attach a shell to, and `/triage` had already run.
- The board bears this out exactly: `.ai/board/tickets/` holds **eighteen shells, one per row in
  `features.md`**, and none for the sign-in half. The board can represent a feature. It cannot
  represent half of one.

So the answer to *"why doesn't the app have login yet?"* is: **the work was written down and never
turned into an idea, and an idea is the only input `/triage` accepts.** This file is that missing
input.

### Not a duplicate of `2026-08-31-nobody-can-join-the-board.md`

That idea was promoted on 2026-08-31 into TEA-01 through TEA-04. It is about **admission** — how a
person becomes a member of a team at all, which ADR-009 answered with the allow-list and the trigger
on the auth user. Its Problem statement is *"there is no way for a person to become a member of this
team inside the product"*, and that is now half-built and shipped.

This idea is about **return**. Admission happens once; returning happens every day, and it is a
different operation with a different failure. Concretely:

| | `nobody-can-join-the-board` | this idea |
|---|---|---|
| The act | sign up, once, and acquire a `member` row | sign in, repeatedly, and acquire a session |
| Enforcement point | the trigger on `auth.users` (ADR-009) | Supabase Auth issuing a token; RLS then reads `auth.uid()` |
| State of the work | promoted, four rows, TEA-01 shipped as its sign-up half | never promoted, no row, no ticket, no board entry |
| Data written | a `member` row and a consumed allow-list entry | none |

They also fail differently. Before that idea, nobody could *exist*; after it, several people exist
and none of them can *arrive*. The overlap is one sentence and it is deliberately carried here rather
than restated: the member-less state ADR-009 created is presented on the return path, not on the
admission path, which is why TEA-01's split put `NotOnATeam.tsx` on this side of the line.

## Who has it

- **Every person who completes sign-up, once, at the moment they finish** — and it is the moment they
  are least willing to absorb a defect, because they have just typed a password and been told to
  check their email. Team size is five to thirty (charter, *Who uses it*), so this is between five and
  thirty occurrences during onboarding and one per new joiner thereafter.
- **The single admin, every single time they open the product.** Today that is the operator's own
  `admin@calechip.com` account, seeded on 2026-09-01 (`.ai/steward/context.md`, session log). They
  cannot reach the allow-list screen that TEA-02 has just built, and TEA-02 is at `state: REVIEW`
  (`.ai/board/tickets/TEA-02/ticket.yaml:8`).
- **Every member, once per feature, for the rest of the backlog.** Sixteen rows in
  `.ai/board/backlog.md` § BACKLOG describe things a signed-in person does. None of them can be
  demonstrated to a human being until this exists.
- **The operator, now.** They asked why the application has no login, which is itself the observation
  that the board does not show the missing half anywhere they could have seen it.

## Evidence

This idea needs no user research: the gap is recorded, in words, in four artifacts and in the source,
by the agents that created it.

**1. TEA-01's story carved it out and named its contents.** `.ai/board/tickets/TEA-01/01-story.md`
§*Out of scope*, heading at line 194: *"Carved out by the split of 2026-08-31 — signing in, and the
person who is not on a team"*. The table at lines 207-212 says:

> | Criteria | AC-6 as written above the split, plus a criterion for signing in itself that this story does not write — the ticket that owns the operation writes its own |
> | Files, from `02-design.md` section 5 | `src/hooks/useSession.ts`, `src/routes/SignIn.tsx`, `src/routes/NotOnATeam.tsx`, `src/routes/Home.tsx`, a second pass over `src/App.tsx`, and the session half of the seam — `getSession`, `onAuthStateChange`, `signIn`, `signOut` |
> | Estimate | S |
> | Feature | **TEA-01.** Both halves carry `feature_ids: [TEA-01]`; the split is of the work, not of the capability, and the feature is delivered only when both are DONE |

**2. The registry says the feature is unfinished, and says why.** The TEA-01 row in
`.ai/registry/features.md:116` carries `Status: IN_PROGRESS` and states: *"the feature was split at
SPEC: ticket TEA-01 delivers sign-up only, while signing in and the member-less state were carved out
to a sibling ticket that `product` has not yet created."* That row is the lead this idea was asked to
confirm, and it holds against the story.

**3. TEA-02's story says the same thing from the other side, and calls it a hard prerequisite.**
`.ai/board/tickets/TEA-02/01-story.md:165-170`: *"**Every criterion above begins 'given a signed-in
admin', and today there is no way to sign in.**  … It is named here because it is a hard prerequisite
for TEA-02 being exercisable end to end, and because the board currently shows no row for it."*

**4. TEA-02's design states the cost in one sentence.**
`.ai/board/tickets/TEA-02/02-design.md:358-370`, *Prerequisites this ticket does not own*: *"In a real
build `getCurrentMember()` returns null on every call, because nothing ever creates a session. **The
screen will render `allow-list-refused` for everybody, including a real admin.** … **Every criterion
is verifiable and the feature is not usable.** That is a true and uncomfortable pair, and it is the
cost of TEA-01 shipping as a half."*

**5. What the running application actually does today**, read from the source rather than assumed:

- `src/App.tsx` declares three routes: `/signup` (line 32), `/allow-list` (line 37) and a catch-all
  `<Navigate to="/signup" replace />` (line 41). The comment above the catch-all names its successor:
  *"The sign-in half replaces this with /signin and /."* There is no navigation of any kind and no
  link between the two screens.
- **The seam has no session half.** `src/lib/data/index.ts:34-84` declares `DataSeam` with seven
  functions — `ready`, `signUp`, `getOwnMember`, `getCurrentMember`, `listAllowedEmails`,
  `addAllowedEmail`, `removeAllowedEmail`. None of `signIn`, `signOut`, `getSession` or
  `onAuthStateChange` appears anywhere under `src/lib/data/`. Under RULE-02 the seam is the only place
  they could appear.
- `getCurrentMember()` is documented as permanently null in a real build, in both the interface
  (`src/lib/data/index.ts:64-65`) and the implementation (`src/lib/data/supabase.ts:209-211`).
- **The mock seam carries a test-only door where the session should be.** `src/lib/data/mock.ts:57-66`
  exports `__setCurrentMember`, commented: *"The sign-in half of TEA-01 does not exist, so there is no
  session to read this from."* Every end-to-end test of the allow-list therefore drives
  `VITE_DATA_SEAM=mock` and asserts against a caller nobody authenticated.
- **Sign-up terminates deliberately.** `src/routes/SignUp.tsx:61-72` renders `signup-confirm-notice`
  and nothing else; TEA-01 AC-13 required exactly that, *"and it does not redirect to a signed-in
  view"*, because there is no signed-in view to redirect to.

**6. Authentication itself is not the missing piece — the surface is.** The steward's log entry of
2026-09-01 records that after the migration and seed were applied, *"all three sign-ins behave
correctly, and the admin's own token — not the service-role key — reads its `member` row as
`role: admin`"*. That was exercised against the real project from outside the application. So
Supabase Auth works, the policies work, and the product cannot reach either.

**7. The gap is in no register that anything acts on.** `.ai/board/backlog.md` has one READY row
(TEA-02) and sixteen BACKLOG rows, none of them this. `.ai/registry/features.md` § TEA has four rows,
none of them this. `.ai/board/model-debt.md` runs to MD-016 and none of them is this.
`.ai/standards/rbac-and-security.md:114` carries an unclosed `TODO(project): name where the session is
read on the client, and what happens on expiry.` The only places the gap is written down are three
ticket artifacts and one registry note — all of them prose, none of them a row a command reads.

**8. One fact on the TEA-01 row has gone stale, noted rather than corrected** (this is board plane and
`features.md` is not): the row gives as its first reason that *"the pull request opened 2026-08-31 is
unmerged"*, while `.ai/board/backlog.md` § ARCHIVE records PR #11 merged at 16:49:02Z the same day.
The row's conclusion — `IN_PROGRESS`, not `DONE` — is still correct, on its second reason, which is
this idea.

## Impact if ignored

**TEA-02 reaches DONE as a screen no human can open.** It is at REVIEW now. Its own design says every
criterion is verifiable and the feature is not usable; nothing in the gates stops that, because QA
drives the mock seam. The product would then contain two shipped tickets and zero usable screens.

**Every subsequent ticket inherits the same shape, and the cost compounds rather than repeats.** Each
one adds a surface whose end-to-end test authenticates nobody, and each one adds policies that no test
run has ever exercised through a real token. Under ADR-005 the policies **are** the authorization
model, so what accumulates is untested authorization — the exact debt ADR-017's waiver, MD-014 and
MD-016 are already about. The first sign-in ticket is also the first thing that would have caught the
seed defect MD-014 records, which survived a day precisely because nothing signs a seeded user in.

**A concrete second-order consequence, not a severity word:** CAL-01 writes an `entry` whose
`member_id` is `auth.uid()`. With no session `auth.uid()` is null, the insert policy refuses, and the
first calendar ticket's demo is a form that returns a PostgREST `403`. That is three tickets away in
`.ai/board/backlog.md`.

**The board keeps reporting a state that is not true.** `/status` and `/next-ticket` read
`features.md` and `backlog.md`; neither contains this work, so the honest answer to *"what is left in
TEA?"* is three rows, and the real answer is four. TEA-01 can never legitimately become `DONE`, and
the reason it cannot is invisible to every command that reads the board.

**And the human cost, which is why this was noticed at all:** the operator seeded themselves an admin
account on 2026-09-01 and cannot use it. Every check of the product's actual behaviour has to be done
with `psql` or raw HTTP against PostgREST, by the one person who should be able to just open it.

## Constraints already known

Cited, not restated. Each of these bounds the eventual solution and none of them is chosen here.

- **[ADR-005](../../registry/decisions/ADR-005-authorization-in-rls.md)** — Supabase Auth provides
  authentication; RLS provides authorization; **no authentication API is written and there is no
  server.** Whatever this becomes runs on the ordinary browser client. A session check written in
  TypeScript is an affordance and must be commented as one.
- **RULE-02** — the Supabase client may be imported only inside `src/lib/data/`, enforced by
  `no-restricted-imports` in `eslint.config.js` and by the `supabase-client-in-seam` boundary. So the
  session functions the TEA-01 split named belong to the seam, and the seam-parity test means the mock
  gains them at the same moment.
- **[ADR-009](../../registry/decisions/ADR-009-how-a-person-becomes-a-member.md) §Consequences** — a
  person who signs up before being allow-listed gets an auth user with no member row, and *"that state
  must be handled in the interface, not left to look like a bug. It is also a small privacy surface:
  sign-up succeeds and reveals nothing, which is the correct behaviour."* Any screen that announces
  *"you are not on the allow-list"* to an unauthenticated caller would undo TEA-01's AC-5.
- **TEA-01 AC-5 and AC-7** — sign-up cannot reveal whether an address is allow-listed, and the member
  row appears only on confirmation. The story records at `01-story.md:102-105` that the moved AC-6 is
  half of what keeps AC-5 from being an address-enumeration oracle: **only somebody who controls the
  mailbox may learn their allow-list status.** That is a constraint on where the member-less answer is
  allowed to be shown.
- **`.ai/00-charter.md` § Roles** — two roles and no third. Nothing here introduces a guest, a
  read-only visitor or a public calendar; the whole team's calendar is readable *by the team*.
- **`.ai/standards/rbac-and-security.md`** — the permission table has no row for signing in or signing
  out, and says sign-up needs no permission because the trigger is the gate. Line 114's open
  `TODO(project)` about where the session is read and what happens on expiry is the file's own
  acknowledgement that this half is unwritten.
- **The invariants are not engaged, stated rather than left blank**, per the warning in
  `.ai/registry/invariants.md` that concluding no invariant is engaged is where the reasoning is
  usually skipped. INV-01, INV-02, INV-03, INV-05 and INV-06 all constrain `entry` rows and nothing
  here writes one. **INV-04 and INV-07 are the two worth arguing**, because TEA-01's row carries both:
  they are engaged by the creation of a `member` row, and signing in creates no rows at all — it reads
  the row TEA-01's trigger already created. The member-less state is the case to watch: presenting it
  must not create a member, or INV-04's denominator moves for somebody nobody admitted.
- **[ADR-010](../../registry/decisions/ADR-010-triage-creates-the-ticket-shell.md)** — ticket shells
  are created by `product` at `/triage`, on a PROMOTE verdict, one per feature row. This idea's work
  already has a feature row (TEA-01), which is a case that ADR neither covers nor forbids. See open
  question 1.
- **The sizing table**, `.ai/01-operating-model.md:383-398` — TEA-01's story already estimated this
  half at **S** from an enumerated file list, and the split rule *"never split backend from frontend
  alone"* is already satisfied: the design's own defence is that this half is a whole operation with
  an end-to-end test of its own.
- **`.ai/standards/testing-standards.md` and ADR-017** — the QA waiver is in force and MD-016 records
  that nothing counts it. Whether this ticket's gate may be waived is not this idea's to decide, but
  it is the ticket for which a waiver would be most expensive: a sign-in feature verified only against
  the mock seam has verified nothing about signing in.

## Out of scope

- **Any change to the authentication mechanism.** ADR-005 and ADR-009 stand. No Edge Function, no
  service-role key, no custom auth API, no second identity provider. Reaching for any of them means
  superseding ADR-005 on its own terms first.
- **Password reset, changing an email address, and deleting an account.** TEA-01's story already
  places all three out of scope and no feature row exists for any of them. They are adjacent and they
  will be tempting the moment a sign-in form exists; each is its own idea.
- **Social sign-in, SSO, and Slack / Teams / Zalo identity.** P1 in the brief and a different problem
  — where a person is *notified*, not how they get in.
- **The product's navigation and the signed-in home screen's content.** `src/App.tsx:33-36` records
  that TEA-02's AC-9 is satisfied today by the absence of a menu and that *"the first ticket that adds
  a menu inherits the real version of that criterion"* — so a menu is a thing this work could grow
  into, and it must not. The month view is CAL-04, and it is six rows down the backlog behind CAL-01.
  What a signed-in member sees before CAL-04 exists is open question 4, not licence to build a board.
- **The member list, removal and promotion** — TEA-03 and TEA-04, unchanged.
- **The first-team and first-admin bootstrap.** A human applies a seed; TEA-01's row and story both
  record it as not a capability of the product, and that does not change because a sign-in screen
  exists.
- **Retiring the QA waiver, provisioning a CI database, and MD-014's seed defect.** Related, recorded,
  and each already has its own register entry.
- **Repairing the loop so that a mid-ticket split produces a shell.** This idea is the workaround for
  that hole, not the fix. The fix is `/thuki`'s and is named in open question 1.

## Open questions

Each of these must be answered before or at triage; none is answered here.

1. **Does this become a new feature row, or a second ticket against TEA-01?** ADR-007 lets `/triage`
   write a row on PROMOTE and `features.md` requires every row to cite the idea it came from —
   but TEA-01's story fixes both halves at `feature_ids: [TEA-01]`, so a fifth TEA row would split one
   capability across two IDs after the fact. A second ticket against an existing row has no mechanism:
   ADR-010 creates one shell per promoted row. **This is a process question, and it is the reason the
   work went missing in the first place.** Whichever answer triage takes, the model still has no owner
   for a shell created by a split at DESIGN, and that belongs in `.ai/board/model-debt.md` rather than
   inside this idea.
2. **What is the ticket's directory and branch name?** `.ai/board/tickets/TEA-01/` is taken.
   TEA-01's story asserts *"the ID scheme gives splits `-a` and `-b`"* (`01-story.md:225`), and that
   scheme appears **nowhere else in the repository** — no template, no command, no standard, no script
   (searched `.ai/` and `.claude/`). `scripts/check-allowed-paths.mjs:90` derives the ticket id from
   whatever follows `feat/` in the branch name, so a suffixed id would work mechanically; nothing
   decides it, and `guard-allowed-paths.mjs` scopes writes by that name.
3. **The text of AC-6 was lost.** `01-story.md:86-90` says AC-6 *"reads there exactly as it read
   here"* and deletes it in the same edit, so *"AC-6 as written above the split"* points at text that
   is not in the working tree. What survives is indirect: `02-design.md:160-163` (a three-state union
   distinguishing signed-out from member-less from member), `02-design.md:818` (*"the exact state the
   sign-in half's AC-6 exists to make rare"*), and `01-story.md:102-105` (it is half of what keeps
   AC-5 from being an enumeration oracle). `TODO(verify):` whether the original wording survives in
   git history — this session holds no `Bash` tool and cannot look. If it does not, the BA writes the
   criterion afresh from those three fragments rather than claiming to transcribe it.
4. **Where does a signed-in member land, given that nothing exists for them to look at?** TEA-01's
   design named `src/routes/Home.tsx`, and the month view that would fill it is CAL-04, which depends
   on CAL-01. So the landing screen is real and its content is not decided by any document. This is
   the question most likely to grow the ticket during DESIGN, which is why it is written now.
5. **Is sign-out in scope?** The carved-out file list names `signOut`, and no acceptance criterion,
   permission row or standard mentions it anywhere. On a shared machine, in a product where every
   member reads the whole team's calendar, a session nobody can end is a real question rather than a
   tidiness one.
6. **What happens on expiry, and where is the session read?** This is
   `.ai/standards/rbac-and-security.md:114` verbatim, still open, and it is a standards question
   rather than a story question — the answer belongs in that file, which is human plane under RULE-01.
7. **Must this ticket's QA gate run against a real Supabase project?** Every end-to-end test in the
   repository today drives `VITE_DATA_SEAM=mock`, and the mock's `__setCurrentMember` fabricates
   exactly the thing this ticket exists to produce. A green mock-driven suite would say nothing about
   whether anybody can sign in. Related to ADR-017 and MD-016, and not decided by either.
