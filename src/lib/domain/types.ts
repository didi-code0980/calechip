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

/**
 * TEA-05, 01-plan.md section 4.1. The three states a caller can be in, and they are three rather
 * than two on purpose: "signed in" and "on a team" are different facts, and ADR-009 creates people
 * who are the first without being the second.
 *
 * TEA-01's design reserved this union for the sign-in half rather than defining it with no consumer
 * (02-design.md:160-163). This is that consumer: `useSession` resolves to exactly one of these and
 * `App.tsx` routes on it.
 */
export type Membership =
  | { state: "signed-out" }
  | { state: "member-less"; user: AuthUser }
  | { state: "member"; user: AuthUser; member: Member };

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
  // TEA-05, 01-plan.md section 4.1. AC-3: an account that exists and has not confirmed its address.
  // Kept out of `invalid_credentials` deliberately — folding the two would send somebody to reset a
  // password that is correct. Verified on disk: the code is in
  // @supabase/auth-js@2.112.4/dist/module/lib/error-codes.d.ts.
  | "email_not_confirmed"
  // CAL-01, 01-plan.md section 4.1. The three expected failures of creating an entry.
  | "overlapping_entry" // AC-7: INV-01's exclusion constraint refused the write (SQLSTATE 23P01)
  | "invalid_date_range" // AC-9: end_date is before start_date
  // AC-10, AC-11: the insert policy or a withheld column privilege refused the write. NOT
  // `not_permitted`: that code's message is written about the allow-list, and one code carrying two
  // sentences is how a wrong message reaches a screen.
  | "entry_not_permitted"
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

// ---------------------------------------------------------------------------
// CAL-01. 01-plan.md section 4.1.
//
// Every name below is .ai/standards/data-model.md's or ADR-011's, in the application casing this
// file already uses. Nothing here is invented (RULE-04).
// ---------------------------------------------------------------------------

/** `entry_type` in the datastore. A WFH member IS working - glossary.md calls this the single most
 *  costly confusion in the domain. */
export type EntryType = "pto" | "wfh";

/** `entry_portion`. One value per entry, applying to every date in the range (INV-06). */
export type EntryPortion = "full" | "am" | "pm";

/** `entry_status`. Independent of `tentative` - glossary.md keeps the two axes apart deliberately. */
export type EntryStatus = "pending" | "approved" | "rejected";

/**
 * A row of `public.entry`, in application casing.
 *
 * `date_range` and `portion_slots` are DELIBERATELY ABSENT. ADR-011 creates them as stored generated
 * columns and says they are never written; they exist for the exclusion constraint and for
 * PostgREST's `date_range=ov.…` filter, both of which live inside the seam. Surfacing them here
 * would put a PostgreSQL range literal above the seam, which architecture.md's "Layers" forbids, and
 * would put a second representation of the same three fields in reach of a component - where
 * ADR-011's canonicalisation footgun (a one-day entry reads back as `[d, d+1)`) would be read as
 * "the entry ends the following day". The seam may name them; nothing above it may.
 */
export interface Entry {
  id: string;
  memberId: string;
  type: EntryType;
  portion: EntryPortion;
  startDate: string; // yyyy-MM-dd. Never a Date - see 01-plan.md section 4.5.
  endDate: string; // yyyy-MM-dd, INCLUSIVE. Equal to startDate for a single day.
  tentative: boolean;
  status: EntryStatus;
  rejectionReason: string | null;
  note: string | null;
  approvedBy: string | null;
  approvedAt: string | null; // ISO 8601
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

/**
 * The explicit row limit `listOwnEntries` asks for, and the count at which it refuses to answer.
 * Same shape and same reasoning as ROSTER_LIMIT (TEA-03): it must sit BELOW the datastore's own
 * `max-rows` cap so that this assertion fires before the server's silent one does. A truncated read
 * here is a member being told an entry they created does not exist.
 *
 * TODO(verify): the datastore's default `max-rows`. The same unknown is already carried by CAL-04,
 * ADM-02 and ADM-04 in .ai/registry/features.md. If it turns out lower than this, the fix is this
 * one number.
 */
export const OWN_ENTRY_LIMIT = 500;

// ---------------------------------------------------------------------------
// CAL-03. 01-plan.md section 4.1.
// ---------------------------------------------------------------------------

/**
 * The explicit row limit `listTeamEntries` asks for, and the count at which it refuses to answer.
 *
 * SEPARATE from OWN_ENTRY_LIMIT rather than shared with it, for the same reason ROSTER_LIMIT is its
 * own constant: a team's entries outnumber one member's, and the two numbers move for different
 * reasons. One constant serving both would be raised for whichever pressed first and would silently
 * move the other.
 *
 * It must sit BELOW the datastore's own `max-rows` cap or the assertion never fires and the server's
 * silent truncation happens first. A short list here hides entries from the one person able to
 * correct them, which is worse than an error and is what this limit exists to turn into one.
 *
 * TODO(verify): the datastore's default `max-rows`. The same unknown is carried by CAL-04, ADM-02,
 * ADM-04 and OWN_ENTRY_LIMIT above. If it is lower than this, the fix is this one number.
 */
export const TEAM_ENTRY_LIMIT = 2000;

// ---------------------------------------------------------------------------
// CAL-04. 01-plan.md section 4.
//
// Every name below is .ai/standards/data-model.md's or the plan's contract, in the application
// casing this file already uses. Nothing here is invented (RULE-04).
// ---------------------------------------------------------------------------

/** The caller's own team. One row in v1; `data-model.md` section team. */
export interface Team {
  id: string;
  name: string;
  /** The Threshold. A SHARE, not a count. Compared with `>`, never `>=` — INV-04, AC-7. */
  overloadThreshold: number;
  createdAt: string; // ISO 8601
}

/**
 * Both ends INCLUSIVE, matching `Entry.endDate` and ADR-011's `'[]'` constructor.
 *
 * It is two `yyyy-MM-dd` strings and never two `Date`s, for the reason `Entry` already records:
 * `new Date('2026-04-30')` parses as UTC midnight and a day-of-month read west of UTC yields the
 * previous day.
 */
export interface DateRange {
  start: string; // yyyy-MM-dd
  end: string; // yyyy-MM-dd
}

/**
 * The explicit row limit `listTeamEntriesOverlapping` asks for, and the count at which it refuses to
 * answer.
 *
 * Same shape and same reasoning as TEAM_ENTRY_LIMIT: it must sit BELOW the datastore's own
 * `max-rows` cap so a truncated read is detectable here rather than invisible. A month of one team
 * cannot approach it; the number exists so AC-11 has something to assert against, and AC-11 matters
 * more here than on any earlier read — a capped read SUMS what it was given and produces a
 * believable wrong count with no error anywhere, and on this screen the count is the product.
 *
 * SEPARATE from TEAM_ENTRY_LIMIT rather than shared with it, for the reason ROSTER_LIMIT is its own
 * constant: the two reads are bounded by different things — a whole team's entries against one
 * month's — and one constant serving both would be raised for whichever pressed first and would
 * silently move the other.
 *
 * TODO(verify): the datastore's default `max-rows`. The same unknown is carried by ROSTER_LIMIT,
 * OWN_ENTRY_LIMIT and TEAM_ENTRY_LIMIT above, and by CAL-04, ADM-02 and ADM-04 in
 * .ai/registry/features.md. If it turns out to be lower, the fix is this one number.
 */
export const MONTH_ENTRY_LIMIT = 2000;

/**
 * The absence count for each date in a range. Keys are `yyyy-MM-dd`; EVERY date in the range is
 * present, including those with a count of 0 — a caller that had to distinguish "absent key" from
 * "zero" would be re-deciding INV-04's arithmetic at the call site.
 */
export type AbsenceCounts = ReadonlyMap<string, number>;
