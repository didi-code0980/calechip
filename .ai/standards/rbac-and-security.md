---
doc_version: 2
last_updated: 2026-08-31
governed_by: [RULE-01, RULE-02, RULE-09]
---

# Roles, permissions and security

Design section 2 gates against this file and review check R6 compares an implementation to it.

## Roles

Two, in rank order. The rank is what a permission helper compares, and it is what makes the model
testable — two unrelated role names are not comparable, two ranks are.

| Rank | Role | The difference from the rank below |
|---|---|---|
| 1 | `member` | The baseline. Writes their own entries, reads everyone's. |
| 2 | `admin` | A member who also decides — approval, the holiday calendar, who is in the team, and the threshold — and who may edit any entry rather than only their own. |

There is no third rank, no owner, and no billing role. `.ai/00-charter.md` carries the same two and
is the authority on what the product is; this file is the authority on what each may do.

## The permission table

Both directions. A table listing only what each role may do cannot be tested for what it must not do,
and the permission-model test in [testing-standards.md](testing-standards.md) requires the denials.

| Action | `member` | `admin` |
|---|---|---|
| Read any entry in the team | ✅ | ✅ |
| Create an entry for themselves | ✅ | ✅ |
| Create an entry on behalf of another member | ❌ | ❌ **not decided — denied until it is** |
| Edit or delete their own entry | ✅ | ✅ |
| Edit or delete another member's entry | ❌ | ✅ |
| Approve or reject another member's entry | ❌ | ✅ |
| Approve or reject their own entry | ❌ | ✅ |
| Read the holiday calendar | ✅ | ✅ |
| Add, edit or delete a holiday or swap day | ❌ | ✅ |
| Invite a member | ❌ | ✅ |
| Remove a member | ❌ | ✅ |
| Promote a member to admin | ❌ | ✅ |
| Demote an admin to member | ❌ | ❌ **not decided — denied until it is** |
| Read the allow-list | ❌ | ✅ |
| Add an address to the allow-list | ❌ | ✅ |
| Remove an address from the allow-list | ❌ | ✅ |
| Read the overload threshold | ✅ | ✅ |
| Set the overload threshold | ❌ | ✅ |

Every row above except the two marked was decided by the operator on 2026-08-31 or is stated in
`.ai/00-charter.md`. The two marked rows are denials by default rather than by decision: a denial
that turns out to be wrong surfaces as a blocked story, which is cheap; a permission that turns out
to be wrong surfaces as data somebody should not have touched.

**The allow-list is how somebody joins** ([ADR-009](../registry/decisions/ADR-009-how-a-person-becomes-a-member.md)).
A member must not read it: it is a list of people who have been invited and have not yet arrived, and
that is admin information rather than team information. Sign-up itself needs no permission — the
trigger refuses to create a `member` row for an address that is not listed, so an unlisted sign-up
produces an auth user with no membership and sees nothing.

**Removing a member does not remove their entries.** They stay, and the absence count for past dates
changes because team size is read at evaluation time — the consequence recorded in the INV-04 note in
`.ai/registry/invariants.md`.

**Rejection always carries a reason** (INV-03). It is the one admin action with a mandatory field,
because a rejection with nothing attached gives the member nothing to act on.

## Where the check runs

**In row-level security policies, and nowhere else.**
[ADR-005](../registry/decisions/ADR-005-authorization-in-rls.md).

This is not the usual answer and the reason is in the deployment shape rather than in taste: there is
no server, so the browser holds the user's own token and reaches PostgREST directly. A check written
in the interface — or in the data seam, which also runs in the browser — can be skipped by issuing
the same request from anywhere else. Such a check is an **affordance**: it hides a control the user
cannot use, avoids a pointless round trip, and shows a better message. It is decoration over the
policy, and every one of them carries a comment saying so.

TODO(project): name the SQL helper that performs the rank comparison — something of the shape
`is_admin(uid)` — and cite the migration that defines it, once migrations exist. Until then this
section describes an intent rather than a mechanism, which is the failure the *Known weaknesses*
section below exists to prevent going unrecorded.

## Authentication

**Supabase Auth.** It establishes identity; the policies above decide what that identity may do. No
authentication API is written — ADR-005.

**Which surfaces may construct a client:** only `src/lib/data/`, the data-access seam declared in
[architecture.md](architecture.md). A Supabase client constructed anywhere else is a second door into
the data, so this is not left to review — it is the `supabase-client-in-seam` boundary in
[boundaries.json](../registry/boundaries.json), enforced by check D12, and it is what the RULE-02
lint rule will enforce at build time once it is written.

TODO(project): name where the session is read on the client, and what happens on expiry.

## Secrets

| Secret | Where it lives | Who may see it |
|---|---|---|
| Supabase project URL | Build-time environment, prefixed for Vite | Everyone. It ships in the bundle. |
| Anon / publishable key | Build-time environment, prefixed for Vite | Everyone. **It ships in the bundle by design.** |
| Service role key | Nowhere in this repository and nowhere in the browser | Nobody, in normal operation |

**The anon key being public is not a leak, it is the design.** It identifies the project, not the
user; what it may do is decided entirely by the policies. This is worth stating because it looks
alarming and is not, and because the thing that *is* alarming sits next to it.

**The service role key bypasses row-level security entirely.** Under ADR-005 that is not one control
among several — it is the whole authorization model in a single string. It must never be committed,
never be prefixed for Vite, and never be present in a browser build.

TODO(project): Vite exposes only variables prefixed `VITE_`, so an unprefixed name cannot reach the
bundle by accident. Confirm the exact prefix against the installed Vite major before writing it into
config — the major in use is on the *past reliable recall* list in
[tech-stack.md](tech-stack.md).

## Known weaknesses

The controls that are weaker than they read. A permission held **by intent rather than by a control**
is the most expensive kind of documentation error, because every downstream reader assumes a
guarantee.

1. **Row-level security is not the last line of defence. It is the only one.** The anon key is public
   and the endpoint is reachable without this application, so there is nothing behind a policy. A
   policy written too permissively **fails open and silently** — no error, no log, just data that
   should not have been returned. The only thing that catches it is the permission-model test
   asserting the denials; a test asserting only the allowed cases stays green after the policy is
   deleted.

2. **`.gitignore` does not ignore `.env` or `.env.local`.** Operator decision, 2026-08-31, taken
   after the exposure was raised. Any file with those names is one `git add -A` away from the remote,
   and a service-role key published to a remote is not undone by deleting the file afterwards —
   rotation is the only remedy. Nothing in this repository prevents that; the control is attention.

3. **An admin may edit any member's entry, and v1 records no trace of it.** The change feed is on the
   brief's P1 list, so until it exists an admin's edit to somebody else's entry is indistinguishable
   from that member's own. The entry stops being purely its author's statement, which is a change to
   what the product is — recorded in the charter amendment of the same date.

4. **Approval is not an independent check on an admin's own entries.** Self-approval is permitted, so
   the star on an admin's entry means "an admin said so" and that admin is themselves. This was
   chosen deliberately: with one admin on a small team, forbidding it would leave that person's
   entries permanently unapproved.

5. **RULE-02's lint rule is not written yet.** Until it is, nothing prevents a component importing
   the Supabase client at build time. D12 reports a manifest or import crossing after the fact and
   review check R4 reads the diff; neither stops the write. The enforcement map in
   [rules.md](../registry/rules.md) says the same thing.

6. **Two permission rows are denials by default rather than by decision** — creating an entry on
   behalf of another member, and demoting an admin. They will read as settled to anyone who does not
   notice the marking.
