// Domain types. Shared and importable from any layer (.ai/standards/architecture.md, "Layers") —
// they live outside src/lib/data/ precisely so a component can hold a Member without importing the
// seam and tripping the RULE-02 lint rule.
//
// Every name here comes from 02-design.md section 1.1 or from .ai/standards/data-model.md. RULE-04:
// nothing is invented at implementation time.

export type MemberRole = "member" | "admin";

/** A row of `public.member`, in application casing. */
export interface Member {
  id: string; // = the Supabase Auth user id (data-model.md)
  teamId: string;
  displayName: string;
  avatar: string;
  role: MemberRole;
  removedAt: string | null; // ISO 8601, null means active
  createdAt: string; // ISO 8601
}

/** The authenticated identity. Never the member; the two are separate on purpose (AC-5). */
export interface AuthUser {
  id: string;
  email: string;
  emailConfirmed: boolean;
}

export interface Session {
  user: AuthUser;
  accessToken: string;
}

/** Expected failures are returned, not thrown (.ai/standards/coding-standards.md, Error handling). */
export type FailureCode =
  | "invalid_credentials"
  | "email_already_registered"
  | "weak_password"
  | "rate_limited"
  | "network"
  | "unknown";

export interface Failure {
  code: FailureCode;
  message: string; // already in the conversation language; safe to render
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: Failure };

/**
 * The avatar set offered at sign-up (AC-8). `member.avatar` is `text not null` and
 * .ai/standards/data-model.md records that the prototype stores an emoji, which is why these are
 * character literals rather than asset names. The "no emoji in source files" bullet in
 * .ai/standards/coding-standards.md sits under Comments and governs prose; this is domain data the
 * data model requires.
 *
 * TODO(project): the contents of this array are a placeholder and are the operator's to set — see
 * `## Open questions` in 02-design.md. The *name*, the *location* and the *type* are decided in
 * design section 1.1 and are not placeholders; only the twelve values are.
 */
export const AVATAR_CHOICES: readonly string[] = [
  "🐱",
  "🐶",
  "🐰",
  "🦊",
  "🐻",
  "🐼",
  "🐨",
  "🐯",
  "🦁",
  "🐸",
  "🐧",
  "🦉",
];
