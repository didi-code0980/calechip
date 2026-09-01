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
  // TEA-02, 02-design.md section 1.1. The three expected failures of the allow-list writes.
  | "already_allow_listed" // AC-5: the address is on the list, disregarding case
  | "already_consumed" // AC-7: the entry has admitted somebody and cannot be removed
  | "not_permitted" // AC-4, AC-8: the policy refused the write
  | "unknown";

export interface Failure {
  code: FailureCode;
  message: string; // already in the conversation language; safe to render
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: Failure };

/** A row of `public.allowed_email`, in application casing. TEA-02, 02-design.md section 1.1. */
export interface AllowedEmail {
  email: string; // citext in the datastore; already folded by PostgREST on the way out
  teamId: string;
  addedBy: string; // member id of the admin who added it
  addedAt: string; // ISO 8601
  consumedAt: string | null; // null means the invitation is still open
}

/** How an entry is displayed (AC-1). Derived, never stored - `consumedAt` is the only source. */
export type AllowedEmailState = "open" | "joined";

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

// ---------------------------------------------------------------------------
// TEA-03. 02-design.md section 1.1.
// ---------------------------------------------------------------------------

/**
 * AC-8. The explicit row limit the roster read asks for, and the count at which it refuses to
 * answer. Above any plausible team size — the glossary records exactly one team in v1 and the
 * brief's worked example is ten people — and deliberately far below the datastore's own cap, so
 * that this assertion fires before the server's silent one does.
 *
 * It lives here and NOT in src/lib/data/index.ts because both implementations need it at RUNTIME.
 * They already import types from `./index`, and those imports are erased at build; a runtime import
 * would not be, and `index.ts` imports both implementations — that is a real cycle at load time.
 * This module imports nothing from src/lib/data/.
 *
 * The constant's validity has one external dependency, cited rather than re-raised: the assertion
 * only fires if this number sits BELOW the datastore's own `max-rows` cap. That unknown cap is the
 * `TODO(verify):` already carried by CAL-04, ADM-02 and ADM-04 in .ai/registry/features.md. If it
 * turns out to be lower, the fix is this one number.
 */
export const ROSTER_LIMIT = 500;
