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
