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
  // ADM-03, 01-plan.md section 4.1. AC-6, AC-7: `unique (date)` refused the write (SQLSTATE 23505).
  //
  // NOT `already_allow_listed`, which is the other 23505 this seam maps and whose message names an
  // email address. One code carrying two sentences is how a wrong message reaches a screen — the
  // reason CAL-01 gave for `entry_not_permitted`, applied to the constraint rather than to the
  // policy.
  //
  // THERE IS NO `holiday_not_permitted` BESIDE IT. The policy refusal reuses `not_permitted` with a
  // sentence written at its own call site, which is what `removeMember`, `promoteMember` and
  // ADM-01's `setOverloadThreshold` all do; CAL-01's contrary precedent turned on a shared constant
  // message, which is not the shape here.
  | "holiday_date_taken"
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

// ---------------------------------------------------------------------------
// CAL-05. 01-plan.md section 4.1.
//
// One shape, and it is beside `AbsenceCounts` because it is the third answer derived from the same
// pass: the count, the members, and — here — the members WITH the entry that puts them there.
// ---------------------------------------------------------------------------

/**
 * CAL-05. One absent person on one date, and the entry that puts them there.
 *
 * It is a domain shape rather than a seam one: `absentEntriesFor` builds it from rows the seam
 * already returns, and a component holds it without importing the seam
 * (.ai/standards/architecture.md, "Layers").
 *
 * BOTH HALVES, and not an entry carrying a display name. The week view draws the member (avatar,
 * display name) and the entry (type, portion, note, approver) side by side, and flattening the two
 * into one record would put a second representation of `Member` in reach of a component — the same
 * reason `Entry` does not carry `date_range`.
 */
export interface AbsenceDetail {
  entry: Entry;
  member: Member;
}

// ---------------------------------------------------------------------------
// ADM-02. 01-plan.md section 4.1.
//
// Three additions and nothing existing changes shape — which is why this is not the "changes a
// shared type module" clause of .ai/01-operating-model.md:375: that clause is about a shape that
// ripples outward, and no existing caller must change. The precedent is direct — CAL-04 added
// `Team`, `AbsenceCounts` and `AbsenceDetail` to this file and was sized M.
// ---------------------------------------------------------------------------

/**
 * ADM-02. ADR-015 section 2. THE VALUES NAME THE EFFECT ON THE WORKING CALENDAR, NOT THE
 * VIETNAMESE LABEL — `name` already carries the label.
 *
 * `working` is a mandated Saturday: a weekend day the government turns into a working day, the
 * exact inverse of a holiday. A `holiday` row with `kind = 'working'` is a holiday that is not a
 * holiday, and ADR-015 records that naming smell rather than renaming the table: `holiday` is the
 * word glossary.md defines and the word rbac-and-security.md's permission row uses.
 */
export type HolidayKind = "non_working" | "working";

/** A row of `public.holiday`, in application casing. ADR-015 section 3. NO `teamId`: the calendar
 *  is national and there is no foreign key. */
export interface Holiday {
  id: string;
  date: string; // yyyy-MM-dd. Never a Date — see below.
  name: string;
  kind: HolidayKind;
  createdAt: string; // ISO 8601
}

/**
 * The explicit row limit `listHolidays` asks for, and the count at which it refuses to answer. Same
 * shape and same reasoning as ROSTER_LIMIT, OWN_ENTRY_LIMIT, TEAM_ENTRY_LIMIT and
 * MONTH_ENTRY_LIMIT: it must sit BELOW the datastore's own `max-rows` cap so this assertion fires
 * before the server's silent one does.
 *
 * ADR-015 asks for "an explicit limit above the widest possible range (366 plus margin)". A
 * Vietnamese year carries on the order of fifteen rows, so 1000 is roughly sixty years of calendar
 * and comfortably above any range this screen can request.
 *
 * TODO(verify): the datastore's default `max-rows`. The same unknown is carried by the four limits
 * above and by CAL-04, ADM-02 and ADM-04 in .ai/registry/features.md. If it is lower than this, the
 * fix is this one number.
 */
export const HOLIDAY_LIMIT = 1000;

// `date` IS A STRING AND NEVER A `Date`, and on this table it is the difference between a correct
// and an incorrect feature. ADR-015 Consequences names the trap and predicts it will pass every test
// run in Vietnam: `new Date('2026-06-11')` parses as UTC midnight, and a weekday read west of UTC
// yields the previous day — so a Thursday holiday becomes a Wednesday and the bridge day moves. ICT
// is UTC+7 and CI is UTC, so it is correct in both and wrong for a developer in the Americas. Every
// comparison in this feature is on `yyyy-MM-dd` strings, which sort lexicographically, exactly as
// src/lib/data/absence.ts already does.

// ---------------------------------------------------------------------------
// CAL-08. 01-plan.md section 4.1.
//
// Two additions beside `Holiday`, and nothing existing changes shape — so no existing caller
// changes and this is not the "changes a shared type module" clause of
// .ai/01-operating-model.md:375. The precedent is direct and immediately above: ADM-02 added
// `HolidayKind`, `Holiday` and `HOLIDAY_LIMIT` here and was sized M, as CAL-04 was before it.
// ---------------------------------------------------------------------------

/**
 * CAL-08. Why a day is not a working day, when it is not one.
 *
 * `holiday` wins over `weekend` when a `non_working` row falls on a Saturday or a Sunday: the row is
 * the more specific fact and it carries a name to draw.
 */
export type NonWorkingReason = "weekend" | "holiday";

/**
 * CAL-08. The status of one date.
 *
 * NOT a flat `"working" | "weekend" | "holiday" | "bridge"` union. A bridge day IS a working day, and
 * a caller asking "is this a working day" must be able to read the answer without knowing that
 * `bridge` implies it — .ai/registry/features.md:95 states that as a requirement on this type.
 */
export interface DayStatus {
  date: string; // yyyy-MM-dd. Never a Date — the trap is named beside `Holiday.date` above.
  /** The one question every caller asks. True for a bridge day and for a mandated `working` Saturday. */
  working: boolean;
  /** Null EXACTLY when `working` is true. */
  nonWorkingReason: NonWorkingReason | null;
  /** The row on this date, of EITHER kind, or null when there is none. It carries the name to draw. */
  holiday: Holiday | null;
  /** Implies `working === true`. A bridge day is a working day and gets no lavender (glossary.md). */
  bridge: boolean;
}

/**
 * Every date in the requested range, present as a key including the ordinary ones — the contract
 * `AbsenceCounts` already keeps, so a caller iterating one map can index the other with no fallback.
 */
export type DayStatuses = ReadonlyMap<string, DayStatus>;
