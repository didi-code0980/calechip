---
stage: TRIAGE
agent: product
produced_at: 2026-08-31
inputs_read:
  - product_brief.md
  - .ai/00-charter.md
  - .ai/registry/invariants.md
  - .ai/registry/features.md
  - .ai/registry/rules.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-005-authorization-in-rls.md
  - .ai/registry/decisions/ADR-007-triage-issues-feature-ids.md
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/01-operating-model.md
consulted:
  - tech-lead-design
gate: PASS
blocking_reason: ""
next_state: TRIAGE
---

# Nobody can join the board, so there is no team for a calendar to belong to

## Problem

There is no way for a person to become a member of this team inside the product, and no way for the
product to tell one person's declaration from another's. A new joiner cannot get onto the board at
all. Somebody who leaves stays on it. And the number the whole coordination mechanism divides by —
how many people are on this team right now — has no source.

This is stated as a problem rather than as "build sign-in and invitations" deliberately: the brief
writes it as a requirement (7.6), and the thing underneath the requirement is that **every other part
of the product is a statement about a person and a team, and neither exists yet.**

## Who has it

- **An admin**, each time somebody joins or leaves the team. On a team of five to thirty, several
  times a year, and every occurrence is silent — nothing prompts it and nothing shows it is overdue.
- **Every new member**, exactly once, at the moment they first have a plan to declare. This is the
  worst possible moment for friction: they came to the product with something to say and cannot say
  it.

## Evidence

Three registry statements exist today with no surface in the product to hold them:

- **INV-07** — every entry belongs to exactly one member and is counted only against that member's
  team. There is no member and no team.
- **INV-04** — the absence count's threshold multiplies the team's **current** member count. Nothing
  supplies that count.
- The charter's Roles table names *invite and remove members* and *promote a member to admin* as
  powers only an admin has. None of the three is reachable.

Two further facts from decisions already recorded, both of which make this idea's shape less free
than it looks:

- [ADR-005](../../registry/decisions/ADR-005-authorization-in-rls.md) places authentication in
  Supabase Auth and authorization in row-level security. Every policy in the system will be written
  against an authenticated identity that currently has no way to come into existence.
- `.ai/standards/data-model.md` records that a member row cannot precede its auth user, because the
  member's primary key **is** that user's id. So "invite a member" is an Auth invitation, not a row
  this application inserts, and how the row then appears is open — it is that file's open question 4.

## Impact if ignored

Nothing else in the product can be built. An entry has no author, a calendar has no roster to draw
rows for, the overload threshold has no denominator, and an approval has nobody who is entitled to
give it. This is not the most valuable idea on the board; it is the one that the valuable ones are
standing on.

The second-order cost, if it is built late and thinly: the team's roster becomes whoever happened to
sign in, the absence count starts dividing by a number nobody maintains, and the warning that the
product exists to produce quietly reports the wrong thing while looking correct.

## Constraints already known

- **INV-07** — one member, one team, and the count is taken against that team. The data has to carry
  the team from the first migration even though v1 has one team.
- **INV-04** — the denominator is the current member count, read at evaluation time, and
  `.ai/standards/data-model.md` defines "current" as the team's members with `removed_at` null. So
  removal is a soft delete, and this idea inherits that.
- **`.ai/00-charter.md` Roles** — two roles only. An admin may invite, remove and promote; a removed
  member's entries stay.
- **`.ai/standards/rbac-and-security.md`** records two rows as **denied by default rather than by
  decision**: creating an entry on behalf of another member, and demoting an admin. Neither is
  settled; both sit inside this idea's boundary.
- **ADR-005** — no custom authentication API. Whatever this becomes, it is Supabase Auth plus
  row-level security, and a permission expressed only in the interface is not a control.

## Out of scope

- **Multiple teams or departments in one workspace.** Deferred to P2 by the brief and explicitly not
  refused by the charter. This idea must leave room for it (INV-07 already does) and must not build
  it.
- **Slack, Teams or Zalo identity.** P1, and a different problem — this idea is about who is on the
  team, not about where they are notified.
- **Role-based constraints** such as "these two may not be away on the same day". P2.
- **Anything about leave quota or the HR record of a person.** Charter refusal 1.

## Open questions

1. **How does a member row come into existence after an Auth invitation?** Three defensible answers —
   a database trigger on the auth user, creation at first sign-in, or an admin completing a profile.
   Open question 4 in `.ai/standards/data-model.md`, unanswered, and it decides the shape of the
   whole invitation flow.
2. **Is an invitation a single-use email invite, a reusable team link, or both?** The brief (7.6) says
   *"qua email hoặc link"* and does not say whether the link expires, or who may hold it.
3. ~~**Do a removed member's future entries still count toward the absence count?**~~ **Answered by
   the operator, 2026-08-31: they do not count** — the entries stay and stay visible, but they leave
   the absence count on removal. Extending INV-04's note from the denominator to the numerator is a
   registry amendment; it needs an ADR under RULE-01. Original wording follows.
   The operator decided
   their entries stay. INV-04's *denominator* is current members only, but the invariant says nothing
   about excluding a removed member's entries from the *numerator* — so a departed colleague can make
   a future day look overloaded. This needs an answer before the warning is built, not after.
4. **Who is the first admin?** Nothing in the brief or the charter says how the first account of a
   brand-new team acquires the admin role.

## Triage verdict: NEEDS-ADR

**Decided 2026-08-31 by `product` and `tech-lead-design`**, running the two halves of triage
independently and reaching the same verdict without reconciling first.

**`next_state` is `TRIAGE`, deliberately.** The state enum in
[.ai/01-operating-model.md](../../01-operating-model.md) has twelve values and none of them means
*waiting on a human decision at the board plane*. `ESCALATED` is the closest in meaning — *a human
decides; it does not self-resume* — but it is a `ticket.yaml` state on the implementation loop and
this idea has no ticket. So the idea stays where it is and is re-triaged once the ADR lands.

### Why

The idea is correct, it is foundational, and nothing in `.ai/registry/features.md` covers it — the
`TEA` table is empty and no other idea on the board claims this ground. It does not fail on merit. It
fails on a decision that was already recorded as unanswered and already declared blocking:
[.ai/standards/data-model.md](../../standards/data-model.md) open question 4 says of itself
*"Blocks: the first story touching team management"*, and this is that story. The same file's
*Migrations* section is independently decisive: *"A ticket whose `schema_delta` is anything but
`none` needs an approved ADR linked before it can pass Definition of Ready"* — which is also item 4
of the Definition of Ready table in `.ai/01-operating-model.md`. This idea creates the first
migration in the project. There is no version of it with `schema_delta: none`.

One ADR settles all of it, because every item below is the same question at a different depth: **how
does a person become a member of this team.** Writing it is the operator's, under RULE-09 and
RULE-01; `/thuki` records it once the decision exists in words. No feature row is issued at
NEEDS-ADR — ADR-007 authorises a row on `PROMOTE` only.

### What the ADR must decide

1. **How a `member` row comes into existence after an Auth invitation** — *schema, and under ADR-005
   also security.* Three defensible answers (a trigger on `auth.users`, creation at first sign-in, an
   admin completing a profile) and they are not equivalent: the trigger option is a `SECURITY
   DEFINER` write path that row-level security does not see, which under ADR-005 is the entire
   authorization model being bypassed by design rather than by accident.
2. **Where `display_name` and `avatar` come from** — *schema.* Both are `not null` with no default in
   `.ai/standards/data-model.md`, so whichever answer item 1 takes has to supply two values at the
   moment the row appears. First sign-in and a trigger can supply neither without a source.
3. **Whether an invited-but-not-yet-signed-in person is a member** — *registry.* This is not
   bookkeeping: `removed_at is null` is the definition of INV-04's denominator, so if the row exists
   at invitation the team size rises — and every overload warning in the product changes — on the day
   the invite is sent rather than the day the person arrives.
4. **The invitation model, and whether an `invitation` entity exists at all** — *schema.* The brief
   (7.6) says *"qua email hoặc link"* and does not say whether a link expires or who may hold it.
   A reusable link with no entity behind it and a single-use invite with one are different data
   models, not different copy.
5. **Where the invite is sent from** — *dependency.* See *The architectural fork* below. This is the
   item most likely to change the answer to item 4.
6. **The first-team and first-admin bootstrap** — *schema.* `data-model.md` gives `team` one row in
   v1 and no creation path, and `member.role` defaults to `member`. As the model stands, a correctly
   built product has one team nobody created and zero admins, permanently. Whether the first admin is
   a product capability or a seed step decides whether it is a feature at all.
7. **The name of the `is_admin(uid)` helper, and the migration that defines it** — *registry.*
   [.ai/standards/rbac-and-security.md](../../standards/rbac-and-security.md) still carries this as
   `TODO(project)` and says plainly that until it is filled the section *"describes an intent rather
   than a mechanism"*. Every admin action in this idea — invite, remove, promote — is a policy that
   calls it.

### Invariants engaged

- **INV-07**, directly. Every `member` row this idea creates carries `team_id`, from the first
  migration, and `.ai/registry/invariants.md` records that this has to be a property of the data
  rather than a constant parameterised later.
- **INV-04**, twice and indirectly. Once through item 3 above — when a member enters the denominator.
  Once through removal: `removed_at` is that denominator's definition, so removing somebody changes
  the absence count for **past** dates, which the INV-04 note already records as an accepted
  consequence.
- **INV-01, INV-02, INV-03, INV-05, INV-06 — not engaged.** This idea writes no `entry` row. Stated
  rather than left blank, because `.ai/registry/invariants.md` warns that concluding no invariant is
  engaged is exactly where the reasoning is usually skipped.

### The architectural fork this idea missed

The idea treats *"invite a member"* as settled to mean a Supabase Auth invitation. It is not settled,
and this is the most consequential finding of the run.

`inviteUserByEmail` is a method on the **admin** surface — see
[GoTrueAdminApi.d.ts:131](../../../node_modules/.pnpm/@supabase+auth-js@2.112.4/node_modules/@supabase/auth-js/dist/module/GoTrueAdminApi.d.ts),
read from the installed types rather than recalled. That surface is keyed by the service role key,
which `.ai/standards/rbac-and-security.md` places **nowhere in this repository and nowhere in the
browser**, and names as *"the whole authorization model in a single string"*. ADR-005 leaves no
server to call it from.

So the admin invite path forces a choice the idea does not contain:

- **An Edge Function**, which is precisely the *thin server seam* ADR-005 rejected — and its revert
  condition is *"the first permission requirement that cannot be expressed as an RLS policy without
  duplicating the rule in application code"*. Sending an invite may or may not meet that test; that
  is the operator's call, and it is a call about ADR-005, not only about this idea.
- **Or a different model** — self-serve `signUp` behind an allow-list table, or a claim token the
  admin generates and the joiner redeems — which keeps everything inside row-level security and
  changes what an invitation *is*.

`TODO(verify):` confirm against Supabase's own documentation which invite paths exist without a
service-role key, before the ADR is drafted. `.ai/standards/tech-stack.md` lists the Supabase client
under *versions the model cannot recall*, and this is the exact case that list exists for.

### Proposed feature split — a proposal, not issued

**No row was written to `.ai/registry/features.md`, and no ID exists.** The two halves of triage
disagreed on the split and the disagreement is recorded rather than resolved, because the ADR may
settle it either way: if item 4 above concludes there is no `invitation` entity, one of the proposed
rows disappears; if it concludes there is, that row may split into issuing and redeeming.

- **`product` proposed five `TEA` rows**, in build order: *Sign in and establish the member record*,
  *Invite a member*, *Team member list*, *Remove a member*, *Promote a member to admin*. The last
  three titles are transcribed from the permission table in `.ai/standards/rbac-and-security.md`.
  Deliberately not a sixth: *the first admin*, because a row for it presumes the answer to item 6.
- **`tech-lead-design` proposed three**, on the grounds that the member list is a surface rather than
  a feature and that removal and promotion are one admin screen.

Both readings are defensible and neither is adopted here. The split is settled at re-triage, after
the ADR.

### Two consequences that are decisions-by-default

Both are already true in the registry, and both will read as settled to anyone who does not notice
the marking — `.ai/standards/rbac-and-security.md` lists them as known weakness 6.

1. **Promotion is one-way in v1.** *Demote an admin to member* is denied by default rather than by
   decision, so a member promoted in error can only be un-promoted by removing them from the team.
2. **No permission row exists for reading the member list.** The permission table has fifteen actions
   and none of them is this one. A member's right to see the roster is currently inferred from *"read
   any entry in the team"*, and an inference is not a policy — under ADR-005 somebody has to write
   the `select` policy on `member`, and there is nothing to write it against.

### Open question 3 does not block this idea

Extending INV-04 from the denominator to the numerator — so that a removed member's future entries
leave the absence count — is a **separate registry chore for `/thuki`**, not a blocker here. Removal
in this idea only sets `removed_at`; the numerator is read by the count. It is needed before the
overload warning is built, not before this idea proceeds.

One caveat worth carrying, from `tech-lead-design`: because INV-04 insists there is **exactly one**
implementation of the count — a single function inside the seam, per
[.ai/standards/architecture.md](../../standards/architecture.md) and the *Where invariants are held*
table in `data-model.md` — the amendment changes that one function's filter regardless of which
ticket owns the UI. It cannot be scoped to whichever view happens to be built first.

That amendment needs its own ADR: `.ai/registry/invariants.md` is **not** exempt under ADR-007, which
exempts feature and glossary rows only.
