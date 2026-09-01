// The shared fixture module. 02-design.md section 1.5 names this file, closing the
// `TODO(project): name the shared fixture module` in .ai/standards/testing-standards.md.
//
// supabase/seed.sql inserts the SAME rows with the SAME literals. That is the whole point: the
// standard forbids tests inventing entities inline because a fixture that exists in one place drifts
// from the seed and produces failures that reproduce in CI and not locally. Change a value here and
// change it there in the same commit.
//
// The uuids are fixed literals and never generated, for the same reason.
import type { Member } from "./domain/types";

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
