// The shared fixture module. 02-design.md section 1.5 names this file, closing the
// `TODO(project): name the shared fixture module` in .ai/standards/testing-standards.md.
//
// supabase/seed.sql inserts the SAME rows with the SAME literals. That is the whole point: the
// standard forbids tests inventing entities inline because a fixture that exists in one place drifts
// from the seed and produces failures that reproduce in CI and not locally. Change a value here and
// change it there in the same commit.
//
// The uuids are fixed literals and never generated, for the same reason.
import type { AuthUser, Member } from "./domain/types";

export const FIXTURE_TEAM: { id: string; name: string; overloadThreshold: number } = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "CaleChip",
  overloadThreshold: 0.5,
};

/**
 * The seeded first admin. The story puts the first team and the first admin out of scope as a
 * capability — a human applies the seed — so this row exists only because `allowed_email.added_by`
 * references a member and AC-11/AC-12 need an admin to read the allow-list as.
 *
 * `id` is the Supabase Auth user id (data-model.md): the same literal is the auth user in the seed.
 */
export const FIXTURE_ADMIN: Member = {
  id: "22222222-2222-4222-8222-222222222222",
  teamId: FIXTURE_TEAM.id,
  displayName: "Quản trị",
  avatar: "🦉",
  role: "admin",
  removedAt: null,
  createdAt: "2026-08-31T00:00:00+00:00",
};

/** An unconsumed allow-list address. AC-1, AC-2, AC-4 sign up as this one. */
export const FIXTURE_ALLOWED_EMAIL: string = "an@example.com";

/** A consumed one, for AC-3: it is on the list and must admit nobody. */
export const FIXTURE_CONSUMED_EMAIL: string = "binh@example.com";

/** Not on the list at all, for AC-5: sign-up succeeds and no member row is created. */
export const FIXTURE_UNLISTED_EMAIL: string = "khach@example.com";

// ---------------------------------------------------------------------------
// TEA-02. 02-design.md section 1.5.
// ---------------------------------------------------------------------------

/**
 * A member-role member. The permission-model test needs a token per role and the seed had only an
 * admin, so AC-8's denials had nobody to be denied as.
 *
 * DEVIATION from 02-design.md section 1.5, which names the id
 * `33333333-3333-4333-8333-333333333333`. That literal was taken by an operator-added admin account
 * in supabase/seed.sql on 2026-09-01, after the design was written. Reusing it would have made the
 * seed's `on conflict (id) do nothing` silently drop this row and leave the member-role member
 * absent - the exact gap section 4.2 exists to close. Everything else in section 1.5 is unchanged.
 */
export const FIXTURE_MEMBER: Member = {
  id: "55555555-5555-4555-8555-555555555555",
  teamId: FIXTURE_TEAM.id,
  displayName: "Thành viên",
  avatar: "🐱",
  role: "member",
  removedAt: null,
  createdAt: "2026-08-31T00:00:00+00:00",
};

/** A second team, for AC-4. Nothing renders it; it exists so that "another team" is a real id. */
export const FIXTURE_OTHER_TEAM_ID: string = "44444444-4444-4444-8444-444444444444";

// ---------------------------------------------------------------------------
// TEA-03. 02-design.md section 1.5.
// ---------------------------------------------------------------------------

/**
 * The second team, behind the id above. `FIXTURE_OTHER_TEAM_ID` was a bare id and needs a real
 * `team` row now, because `member.team_id` references `team(id)` and AC-2 needs a member on it.
 *
 * Exactly one team exists in v1, so AC-2 is unobservable through the interface and is asserted
 * against seeded data instead — ADR-018's revert condition names this data specifically. A one-team
 * fixture passes whether the team scope is in the policy predicate or absent from it.
 */
export const FIXTURE_OTHER_TEAM: { id: string; name: string; overloadThreshold: number } = {
  id: FIXTURE_OTHER_TEAM_ID,
  name: "Nhóm khác",
  overloadThreshold: 0.5,
};

/** A member of the OTHER team. AC-2: no read by anybody on FIXTURE_TEAM may ever return this row. */
export const FIXTURE_OTHER_TEAM_MEMBER: Member = {
  id: "66666666-6666-4666-8666-666666666666",
  teamId: FIXTURE_OTHER_TEAM.id,
  displayName: "Người nhóm khác",
  avatar: "🐰",
  role: "member",
  removedAt: null,
  createdAt: "2026-08-31T00:00:00+00:00",
};

/**
 * A removed member of FIXTURE_TEAM. AC-4: the READ returns this row carrying `removedAt`, and the
 * screen does not list it. The two halves are different layers and this fixture is what separates
 * them — a seam that filtered it would pass every component test and leave INV-04 uncomputable.
 */
export const FIXTURE_REMOVED_MEMBER: Member = {
  id: "77777777-7777-4777-8777-777777777777",
  teamId: FIXTURE_TEAM.id,
  displayName: "Đã rời nhóm",
  avatar: "🐶",
  role: "member",
  removedAt: "2026-08-31T12:00:00+00:00",
  createdAt: "2026-08-31T00:00:00+00:00",
};

// ---------------------------------------------------------------------------
// TEA-04. 01-plan.md section 6.1.
// ---------------------------------------------------------------------------

/**
 * A SECOND admin on FIXTURE_TEAM. AC-13 needs an admin row that is not the caller, in order to
 * assert *a remove control and no promote control* on it — and today FIXTURE_ADMIN is the only admin
 * fixture on this team, so the caller and the only admin row are the same row and the criterion is
 * unobservable.
 *
 * It also makes AC-9 concrete rather than hypothetical: with two admins, refusing self-removal costs
 * nobody the ability to leave.
 *
 * `createdAt` is the shared literal, so this row's position in the roster is decided by the `id`
 * tiebreaker — 02-design.md section 1.4, and the reason that tiebreaker exists.
 */
export const FIXTURE_SECOND_ADMIN: Member = {
  id: "88888888-8888-4888-8888-888888888888",
  teamId: FIXTURE_TEAM.id,
  displayName: "Quản trị hai",
  avatar: "🦊",
  role: "admin",
  removedAt: null,
  createdAt: "2026-08-31T00:00:00+00:00",
};

// ---------------------------------------------------------------------------
// TEA-05. 01-plan.md section 5.1.
// ---------------------------------------------------------------------------

/**
 * An auth user with NO `member` row. AC-4 needs one and none exists: every seeded account has a
 * member row, so the state ADR-009 §Consequences says "must be handled in the interface, not left
 * to look like a bug" has nobody to be.
 *
 * This is the state sign-up produces for an address that was not on the allow-list — the trigger
 * fires, finds no entry, and creates nothing. The seed reproduces it the same way: an `auth.users`
 * row with `email_confirmed_at` set and no allow-list entry for the address.
 *
 * It is an `AuthUser` and not a `Member` on purpose. The two are separate types precisely so that
 * "signed in" and "on a team" cannot be confused, which is the whole of `Membership`.
 */
export const FIXTURE_MEMBER_LESS: AuthUser = {
  id: "99999999-9999-4999-8999-999999999999",
  email: "hoa@example.com",
  emailConfirmed: true,
};

/**
 * An auth user who has signed up and NOT confirmed their address. AC-3.
 *
 * NOT NAMED IN 01-plan.md, and declared as a deviation in 03-impl-log.md. Section 5's mock table
 * requires "an address flagged unconfirmed in the fixture" and section 5.1 scopes
 * `FIXTURE_CREDENTIALS` to SEEDED addresses, so an unconfirmed address has to be both — a fixture
 * flag with no seed row behind it is the drift section 5.1 exists to repair, one file over.
 *
 * `emailConfirmed: false` is the whole of it: `admit_allow_listed_member` returns early on a null
 * `email_confirmed_at`, so this account has no member row either, and GoTrue refuses the sign-in
 * before membership is ever consulted.
 */
export const FIXTURE_UNCONFIRMED: AuthUser = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  email: "khanh@example.com",
  emailConfirmed: false,
};

/**
 * The password every seeded fixture account carries. One literal, in one place, matching the
 * `extensions.crypt(...)` argument in supabase/seed.sql for each of these rows.
 *
 * The operator's own account in the seed is deliberately absent from this module: it was added by
 * hand on 2026-09-01, it is not a fixture, and mirroring its credential here would put a
 * development password in a file the tests import.
 */
export const FIXTURE_PASSWORD: string = "password123";

/** What a fixture account is expected to resolve to once it is signed in. */
export type FixtureMembership = "member" | "member-less";

/**
 * A seeded account, as a sign-in sees it. AC-1, AC-2, AC-3, AC-4, AC-10.
 *
 * `userId` is the `auth.users` id, which is `member.id` when a member row exists (data-model.md).
 * `emailConfirmed` is false for exactly one row, and that row is what makes AC-3 observable.
 * `membership` is the state a successful sign-in resolves to, so a test can name an account by the
 * criterion it serves rather than by remembering which uuid is which.
 */
export interface FixtureCredential {
  email: string;
  password: string;
  userId: string;
  emailConfirmed: boolean;
  membership: FixtureMembership;
}

/**
 * Every seeded address, with its password and its expected membership. The mock's `signIn` answers
 * from this list and from nothing else, which is what makes the mock's refusals the seed's refusals
 * rather than a second story about who can sign in.
 *
 * EVERY ROW HERE HAS A ROW IN supabase/seed.sql, and that is the point — the standard's own reason
 * is that a fixture existing in one place drifts from the seed and produces failures that reproduce
 * in CI and not locally. Two of these rows are new in TEA-05 (`FIXTURE_MEMBER`'s, whose seed row was
 * missing entirely, and `FIXTURE_MEMBER_LESS`'s); one more is `FIXTURE_UNCONFIRMED`'s.
 */
export const FIXTURE_CREDENTIALS: readonly FixtureCredential[] = [
  {
    email: "quan@example.com",
    password: FIXTURE_PASSWORD,
    userId: FIXTURE_ADMIN.id,
    emailConfirmed: true,
    membership: "member",
  },
  // AC-10's other half. Until TEA-05 this account had no seed row at all, so the only member-role
  // person in the product was unseeded and "no allow-list link for a member" had nobody to be.
  {
    email: "thanh@example.com",
    password: FIXTURE_PASSWORD,
    userId: FIXTURE_MEMBER.id,
    emailConfirmed: true,
    membership: "member",
  },
  {
    email: "dung@example.com",
    password: FIXTURE_PASSWORD,
    userId: FIXTURE_SECOND_ADMIN.id,
    emailConfirmed: true,
    membership: "member",
  },
  {
    email: "chi@other.example.com",
    password: FIXTURE_PASSWORD,
    userId: FIXTURE_OTHER_TEAM_MEMBER.id,
    emailConfirmed: true,
    membership: "member",
  },
  {
    email: "cu@example.com",
    password: FIXTURE_PASSWORD,
    userId: FIXTURE_REMOVED_MEMBER.id,
    emailConfirmed: true,
    membership: "member",
  },
  // AC-4. Signed in, and on no team.
  {
    email: FIXTURE_MEMBER_LESS.email,
    password: FIXTURE_PASSWORD,
    userId: FIXTURE_MEMBER_LESS.id,
    emailConfirmed: true,
    membership: "member-less",
  },
  // AC-3. The one unconfirmed row. Its `membership` is `member-less` because that is what it is —
  // the trigger never ran for it — but no sign-in ever reaches that state, because the refusal
  // happens first.
  {
    email: FIXTURE_UNCONFIRMED.email,
    password: FIXTURE_PASSWORD,
    userId: FIXTURE_UNCONFIRMED.id,
    emailConfirmed: false,
    membership: "member-less",
  },
];
