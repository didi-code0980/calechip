// The data-access seam. Declared in .ai/standards/architecture.md; RULE-02 says nothing outside this
// directory may import the Supabase client, and eslint.config.js enforces it.
//
// This file carries the SHAPE only. The functions a feature needs are declared by the Tech Lead in
// design section 1 and added here — RULE-04 forbids inventing them ahead of a design.
//
// Two implementations exist and must stay in parity: `supabase.ts` and `mock.ts`. The seam-parity
// test in tests/ asserts identical exported names and equal arity, which is what makes swapping them
// a configuration change rather than a rewrite.
import type {
  AllowedEmail,
  DateRange,
  Entry,
  EntryPortion,
  EntryType,
  Holiday,
  HolidayKind,
  Member,
  PendingEntryPage,
  PendingEntryQuery,
  Result,
  Session,
  Team,
} from "../domain/types";
import { seam as mockSeam } from "./mock";
import { seam as supabaseSeam } from "./supabase";

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
  avatar: string;
}

/** TEA-02, 02-design.md section 1.2. */
export interface AddAllowedEmailInput {
  email: string;
}

/** TEA-05, 01-plan.md section 4.2. Email and password only — it is what TEA-01's sign-up creates. */
export interface SignInInput {
  email: string;
  password: string;
}

/** CAL-01, 01-plan.md section 4.2.
 *
 *  NO `status`, `approvedBy`, `approvedAt` or `rejectionReason`. Not an oversight and not a
 *  convenience: those columns are withheld from the insert grant (plan section 3), so a field here
 *  would be a field the datastore refuses — a DTO that accepts a value the database rejects invites
 *  the write that AC-11 exists to refuse.
 *
 *  NO `memberId` EITHER. The policy's `with check` supplies it from `auth.uid()`; a parameter would
 *  imply a caller could pass somebody else's and be answered. Same reasoning that kept `teamId` off
 *  `addAllowedEmail`. */
export interface CreateEntryInput {
  type: EntryType;
  portion: EntryPortion;
  startDate: string; // yyyy-MM-dd
  endDate: string; // yyyy-MM-dd, inclusive; equal to startDate for a single day
  tentative: boolean;
  note: string | null;
}

/** CAL-02, 01-plan.md section 4.1.
 *
 *  The same six fields as `CreateEntryInput`, and a SEPARATE interface rather than an alias. Two
 *  reasons: the two diverge the moment ADM-05 adds a decision path that updates `status` and creates
 *  nothing, and an alias would make `createEntry` and `updateEntry` look interchangeable to a caller
 *  who never reads the seam.
 *
 *  NO `memberId`, NO `status`, NO `rejectionReason`, NO `approvedBy`, NO `approvedAt`. Each is
 *  withheld from the update grant (plan section 6), so a field here would be a field the datastore
 *  refuses — and `memberId`'s absence is INV-07's control, not a convenience.
 *
 *  THIS IS A FULL REPLACEMENT OF THE SIX FIELDS, not a patch of the changed ones. A partial shape
 *  would make "the caller did not send `note`" and "the caller cleared `note`" the same request,
 *  and it would create a second place where "is this edit substantive" is answered — INV-02's
 *  trigger compares OLD against NEW and is the only judge of that (plan section 8). */
export interface UpdateEntryInput {
  type: EntryType;
  portion: EntryPortion;
  startDate: string; // yyyy-MM-dd
  endDate: string; // yyyy-MM-dd, inclusive
  tentative: boolean;
  note: string | null;
}

/** ADM-01, 01-plan.md section 4.1.
 *
 *  ONE FIELD, and that is a contract rather than an omission: `setOverloadThreshold` carries no
 *  `name`, no `id` and no `createdAt`, so there is no shape in which a caller could send another
 *  column and have it reach the datastore (AC-9). The column-level grant in the migration is what
 *  makes the same thing true one layer down.
 *
 *  NO `teamId`. The policy resolves the row from `auth.uid()`; a team parameter would be a value
 *  the CALLER supplies, which is the shape `addAllowedEmail`, `listMembers` and `getTeam` all
 *  refused before it. */
export interface SetOverloadThresholdInput {
  /**
   * A FRACTION in [0, 1] inclusive, never a percentage. `Team.overloadThreshold` is a share
   * (glossary, *Threshold*) and `src/lib/data/absence.ts` compares against a share; the screen is
   * the one edge that speaks percent and it converts there. Two representations of one number on
   * the seam is how a factor of one hundred gets applied twice.
   */
  overloadThreshold: number;
}

/** ADM-03, 01-plan.md section 4.2. AC-1, AC-2, AC-5.
 *
 *  THE THREE COLUMNS AN ADMIN MAY SET, and no more. `id` and `createdAt` are the datastore's — the
 *  grant behind this one is table-wide rather than column-scoped, unlike ADM-01's and TEA-04's, so
 *  unusually for this seam the DTO is the only thing withholding them. 01-plan.md Open question 1
 *  records why the grant is transcribed that way and carries the narrowing to the operator.
 *
 *  NO `teamId`, and here that is not a refusal of a caller-supplied value the way it is on
 *  `addAllowedEmail` — the calendar is NATIONAL and the column does not exist (ADR-015 section 1).
 *
 *  `name` ARRIVES TRIMMED. The screen refuses a blank or whitespace-only name before calling
 *  (AC-5), the way `EntryForm` already trims `note` on its way out. */
export interface AddHolidayInput {
  date: string; // yyyy-MM-dd. Never a Date — see the note beside `Holiday.date`.
  name: string;
  kind: HolidayKind;
}

/** ADM-03, 01-plan.md section 4.2. AC-7, AC-8.
 *
 *  The same three fields: an edit may move the date, correct the label and flip the effect. A
 *  SEPARATE interface rather than an alias, for the reason `CreateEntryInput` and `UpdateEntryInput`
 *  are separate — the two writes answer to different policies and will not stay identical, and an
 *  alias would make `addHoliday` and `updateHoliday` look interchangeable to a caller who never
 *  reads the seam.
 *
 *  A FULL REPLACEMENT OF THE THREE FIELDS, not a patch of the changed ones: a partial shape would
 *  make "the caller did not send `kind`" and "the caller chose `non_working`" the same request. */
export interface UpdateHolidayInput {
  date: string;
  name: string;
  kind: HolidayKind;
}

export interface SignUpOutcome {
  /** True when the project has Confirm email on and the address is not yet confirmed. */
  needsEmailConfirmation: boolean;
  /** Non-null only when the project has Confirm email off. AC-13: the screen ignores it either way. */
  session: Session | null;
}

/** Every implementation of the seam satisfies this. It grows one entry per designed contract item. */
export interface DataSeam {
  /** Liveness probe. Present so the seam and its parity test are exercisable before any feature. */
  ready(): Promise<boolean>;

  /**
   * AC-1, AC-5, AC-8, AC-13. Creates the auth user and nothing else — the `member` row is the
   * trigger's work, never this function's. It returns the same shape whether or not the address is
   * allow-listed, and it cannot tell the difference; that is what makes AC-5 hold.
   */
  signUp(input: SignUpInput): Promise<Result<SignUpOutcome>>;

  /**
   * AC-1, AC-9. Null means "this auth user has no member row", which is a normal answer and not an
   * error. Under `member_select_own` (design section 4) a caller can only ever address their own
   * row, so `userId` is a readability parameter and not a permission surface.
   *
   * Nothing in this ticket's interface calls it — the sign-up screen ends on its own notice (AC-13).
   * Its caller here is tests/permission-model.test.ts, which is how AC-1 and AC-9 are observed
   * through the seam rather than only through raw SQL.
   */
  getOwnMember(userId: string): Promise<Member | null>;

  // -------------------------------------------------------------------------
  // TEA-02 - manage the allow-list. 02-design.md section 1.2.
  // -------------------------------------------------------------------------

  /**
   * AC-1, AC-9. The caller's own member row, or null when nobody is signed in or the auth user has
   * no member row. Null is a normal answer and not an error.
   *
   * The sign-in half of TEA-01 does not exist, so in a real build this returns null on every call -
   * see "Prerequisites this ticket does not own" in 02-design.md section 5.
   */
  getCurrentMember(): Promise<Member | null>;

  /**
   * AC-1. Every allow-list entry the caller may read, newest first. Takes no team parameter: the
   * policy scopes the rows to the caller's team, and a parameter would imply the caller could ask
   * for another team's and be answered.
   */
  listAllowedEmails(): Promise<AllowedEmail[]>;

  /**
   * AC-2, AC-4, AC-5. `teamId` is never a parameter - the policy's `with check` supplies it, so
   * there is no value a caller could pass that would move an entry to another team.
   */
  addAllowedEmail(input: AddAllowedEmailInput): Promise<Result<AllowedEmail>>;

  /** AC-6, AC-7, AC-8. Refused by the policy for a consumed entry and for a non-admin. */
  removeAllowedEmail(email: string): Promise<Result<void>>;

  // -------------------------------------------------------------------------
  // TEA-03 - the team member list. 02-design.md section 1.2.
  // -------------------------------------------------------------------------

  /**
   * TEA-03 AC-1, AC-2, AC-3, AC-4, AC-6, AC-7, AC-8. The caller's team roster.
   *
   * Takes no team parameter: `member_select_team` scopes the rows to the caller's own team, and a
   * parameter would imply the caller could ask for another team's and be answered - the same
   * reasoning that kept `teamId` off `addAllowedEmail`.
   *
   * RETURNS REMOVED MEMBERS, carrying `removedAt`. Which rows the screen draws is a display
   * decision above the seam; which rows the read returns is not - ADR-013 and the INV-04 note
   * require the counting function to be GIVEN the roster with `removedAt` per member, because it
   * cannot derive membership-as-of-a-date from the entries. A filter here would make INV-04
   * uncomputable for every past date, and CAL-04 and CAL-06 unbuildable against this read.
   *
   * Ordered by `createdAt` ascending, then `id` ascending. Deterministic in both implementations -
   * `FIXTURE_ADMIN` and `FIXTURE_MEMBER` share a `createdAt` literal, so the id tiebreaker is what
   * stops the two implementations disagreeing about row order (02-design.md section 1.4).
   *
   * An empty array is a normal answer and not an error: it is what the policy returns to a caller
   * with no member row (AC-7) and to a caller with no session (AC-6).
   *
   * THROWS on a transport failure and on a possibly-truncated answer (AC-8). There is no
   * caller-visible failure shape, so a `Result` would have nothing to carry; returning `[]` for a
   * broken connection would report "you are on no team" for what is a network fault, and returning
   * a short list for a capped read is the exact failure AC-8 exists to prevent.
   */
  listMembers(): Promise<Member[]>;

  // -------------------------------------------------------------------------
  // TEA-04 - remove a member, and promote a member to admin. 01-plan.md section 4.2.
  // -------------------------------------------------------------------------

  /**
   * TEA-04 AC-1, AC-3, AC-6, AC-9, AC-11, AC-12. Soft-removes a member of the caller's own team.
   *
   * TAKES NO TIMESTAMP. `removed_at` is written by the datastore's own clock and a caller-supplied
   * value is discarded by the trigger (AC-3) - ADR-013's revert condition is a backdated removal
   * moving every past absence count silently and everywhere, so there is no parameter here that
   * could carry one.
   *
   * `memberId` is an ADDRESS and not a permission surface. It names an existing row that the policy
   * then filters by team and by the caller's role - the shape `removeAllowedEmail(email)` already
   * uses. It is unlike the `teamId` deliberately kept off `addAllowedEmail`, which would have
   * SUPPLIED a value that landed in the row.
   *
   * Returns the updated row. The `.select()` in the real implementation is not a convenience: under
   * row-level security a refused UPDATE is FILTERED, not errored - it matches nothing and PostgREST
   * answers 200 with an empty body (ADR-016 section 4, behaviour 2). Zero rows returned is a
   * refusal and is mapped to `not_permitted`; treating `!error` as success would report a refusal
   * as done.
   */
  removeMember(memberId: string): Promise<Result<Member>>;

  /**
   * TEA-04 AC-4, AC-5, AC-6, AC-10, AC-11, AC-12. Promotes a member of the caller's own team to
   * admin. ONE-WAY: there is no `demoteMember`, and adding one would be inventing a permission -
   * `Demote an admin to member` is not decided and is denied until it is.
   *
   * Returns the updated row, and treats zero rows as a refusal, for the same reason as above.
   */
  promoteMember(memberId: string): Promise<Result<Member>>;

  // -------------------------------------------------------------------------
  // TEA-05 - sign in, sign out, and the session. 01-plan.md section 4.2.
  // -------------------------------------------------------------------------

  /**
   * TEA-05 AC-7, AC-8, AC-9. The session as it stands right now, or null. Null is a normal answer
   * and not an error: nobody being signed in is the ordinary state of the application.
   *
   * It READS persisted state and prompts for nothing. AC-7 is the client persisting the session
   * across a reload, which is library behaviour rather than behaviour this seam builds.
   */
  getSession(): Promise<Session | null>;

  /**
   * TEA-05 AC-6, AC-7, AC-8. Calls `listener` whenever the session appears, changes or goes away.
   * Returns the unsubscribe function; the caller MUST call it on unmount, because a leaked
   * subscription survives a hot reload and then re-resolves against a stale closure.
   *
   * The listener takes `Session | null` and NOT the underlying client's event union. That union is
   * a datastore type, and .ai/standards/architecture.md ("Layers") says code above the seam works
   * in domain types and never in a client's vocabulary - passing it through would put a Supabase
   * type in a hook and make RULE-02 a matter of which import you happened to write.
   *
   * It is lossless for every criterion here: each event the hook reacts to carries the session or
   * null, and nothing above the seam branches on which one arrived. The day a screen needs to tell
   * a deliberate sign-out from a failed refresh, the seam can carry a domain enum of its own
   * (01-plan.md section 9).
   */
  onAuthStateChange(listener: (session: Session | null) => void): () => void;

  /**
   * TEA-05 AC-1, AC-2, AC-3. Email and password only.
   *
   * Expected failures are RETURNED, not thrown (.ai/standards/coding-standards.md). Two codes reach
   * a sentence on screen: `invalid_credentials` for AC-2, which must stay ONE message for both an
   * unknown address and a wrong password - two messages would let anybody test whether a colleague
   * has an account here - and `email_not_confirmed` for AC-3.
   */
  signIn(input: SignInInput): Promise<Result<Session>>;

  /**
   * TEA-05 AC-6. Ends the session. Returns `Result<void>`; a failure here is rare and is still
   * returned rather than thrown, because a sign-out that silently did nothing on a shared machine
   * is the failure this function exists to prevent.
   */
  signOut(): Promise<Result<void>>;

  // -------------------------------------------------------------------------
  // CAL-01 — create an entry. 01-plan.md section 4.2.
  // -------------------------------------------------------------------------

  /**
   * CAL-01 AC-1 … AC-11. Creates ONE entry for the CALLER, over one date or a run of consecutive
   * dates. A contiguous range declared in one action is one entry and never one per day (AC-2) —
   * .ai/registry/invariants.md records that as considered and rejected as an invariant precisely so
   * it would land as an acceptance criterion.
   *
   * Expected failures are RETURNED, not thrown (.ai/standards/coding-standards.md). Three codes
   * reach a sentence on screen and each maps to a specific database refusal (plan section 4.3):
   *   `overlapping_entry`   — INV-01's exclusion constraint, SQLSTATE 23P01, arriving as a 409
   *   `invalid_date_range`  — end before start, refused in the seam BEFORE the round trip (AC-9)
   *   `entry_not_permitted` — the insert policy or a withheld column privilege, 42501 / 403
   *
   * Returns the created row. The `.select()` is not a convenience: under row-level security a
   * refused INSERT that the policy filters returns no representation, and treating `!error` as
   * success would report a refusal as done — the same trap TEA-04's `removeMember` records.
   */
  createEntry(input: CreateEntryInput): Promise<Result<Entry>>;

  /**
   * CAL-01 AC-1, AC-2, AC-3, AC-5, AC-6, AC-8. The CALLER'S OWN entries, newest start date first.
   *
   * Deliberately narrow, and this is the boundary with CAL-04. It takes NO date range and NO member
   * parameter, so it cannot become the team-wide, range-shaped read that CAL-04 owns — that read
   * filters `date_range=ov.…` and feeds INV-04's counting function, and building it here would put
   * a second entry read in the seam before the one that matters exists.
   *
   * It exists because every criterion in plan section 2 has to be observable from outside the system
   * and a confirmation message proves only that the form ran. `entry_select_team` admits the whole
   * team's rows; this function narrows to the caller's in the query, which is an affordance and not
   * a control — the policy is what stops anybody reading another team's.
   *
   * THROWS on a transport failure and on a possibly-truncated answer, the shape `listMembers` uses:
   * there is no caller-visible failure to carry, `[]` for a broken connection would report "you have
   * no entries", and a short list for a capped read is the failure OWN_ENTRY_LIMIT exists to
   * prevent.
   */
  listOwnEntries(): Promise<Entry[]>;

  // -------------------------------------------------------------------------
  // CAL-02 — edit or delete their own entry. 01-plan.md section 4.1.
  // -------------------------------------------------------------------------

  /**
   * CAL-02 AC-1, AC-2, AC-5, AC-6, AC-7, AC-8, AC-10, AC-11, AC-12. Replaces the six substantive
   * fields of ONE entry belonging to the caller.
   *
   * `entryId` is an ADDRESS and not a permission surface — the shape `removeMember(memberId)` uses.
   * It names a row that `entry_update_own` then filters by owner.
   *
   * Expected failures are RETURNED, not thrown. Three codes, all three already in `FailureCode`
   * from CAL-01 — this ticket adds none:
   *   `overlapping_entry`   — INV-01's exclusion constraint, SQLSTATE 23P01, arriving as a 409
   *   `invalid_date_range`  — end before start, refused in the seam BEFORE the round trip (AC-11)
   *   `entry_not_permitted` — the policy filtered the row, or a withheld column privilege refused
   *                           the statement (42501 / 403)
   *
   * RETURNS THE UPDATED ROW, AND ZERO ROWS IS A REFUSAL. Under row-level security a refused UPDATE
   * is FILTERED rather than errored: it matches nothing and PostgREST answers 200 with an empty
   * body (ADR-016 section 4, behaviour 2). An `!error` check would report AC-9's refusal as success.
   *
   * `entry_not_permitted` deliberately covers BOTH "this entry is not yours" and "no such entry".
   * Under the policy the two are indistinguishable and must stay so — a distinct `not_found` would
   * turn this function into an oracle for which entry ids exist in the team.
   *
   * INV-02 IS NOT IMPLEMENTED HERE AND MUST NOT BE. The reset of `status`, `approved_by`,
   * `approved_at` and `rejection_reason` on a substantive edit is `entry_enforce_decision()`'s,
   * shipped by CAL-01; this function observes it in the row it reads back.
   */
  updateEntry(entryId: string, input: UpdateEntryInput): Promise<Result<Entry>>;

  /**
   * CAL-02 AC-3, AC-4, AC-9. Hard-deletes ONE entry belonging to the caller. There is no soft
   * delete: `entry` carries no such column and the feature row settles that the row and its
   * `approved_by` disappear together.
   *
   * Returns `Result<void>`. **The real implementation must ask for the deleted representation and
   * count it** — a DELETE the policy filters answers 200 with an empty body exactly as an UPDATE
   * does, so zero rows deleted is `entry_not_permitted` and not success. This is AC-9's delete half
   * and it is the one an implementation is most likely to get wrong, because a delete has no
   * obvious return value to inspect.
   */
  deleteEntry(entryId: string): Promise<Result<void>>;

  // -------------------------------------------------------------------------
  // CAL-03 — edit or delete another member's entry, as an admin. 01-plan.md section 4.1.
  //
  // ONE READ IS ADDED AND NO WRITE IS. `updateEntry` and `deleteEntry` above were written at CAL-02
  // as POLICY-DRIVEN operations: they take an entry id, issue the statement, and read the affected
  // row count to tell success from a filtered refusal. Neither mentions ownership, because ownership
  // was never theirs to decide. `entry_update_admin` and `entry_delete_admin` widen what those same
  // two functions may reach, with no change to either signature or body — which is what ADR-005
  // predicts when authorization lives entirely in the datastore, and is the cleanest available
  // evidence that CAL-02 put the check in the right place.
  // -------------------------------------------------------------------------

  /**
   * CAL-03 AC-1, AC-2, AC-3, AC-4, AC-9, AC-10, AC-12. Every entry of the caller's team, newest
   * start date first — the caller's own included.
   *
   * DELIBERATELY FLAT, and this is the boundary with CAL-04. It takes NO date range, returns no
   * count, and is not the read the month grid issues: CAL-04's is range-shaped (`date_range=ov.…`),
   * feeds INV-04's `absenceCountsFor`, and is given the roster. This one answers "which entries
   * exist for this team" so an admin can reach a row, and it must not grow a range parameter — the
   * moment it does there are two team-entry reads and one of them will be the one nobody updated.
   * The same reasoning that kept `listOwnEntries` narrow at CAL-01.
   *
   * NO ROLE PARAMETER AND NO `is_admin` CHECK INSIDE IT. `entry_select_team` admits the team's rows
   * to every member, because `Read any entry in the team` is checked for BOTH roles in
   * .ai/standards/rbac-and-security.md — so this read is not where the admin capability lives. What
   * an admin may do with a row it returns is decided by `entry_update_admin`, in the datastore.
   *
   * THROWS on a transport failure and on a possibly-truncated answer, the shape `listMembers` and
   * `listOwnEntries` use. There is no caller-visible failure to carry; `[]` for a broken connection
   * would report "this team has no entries", and a short list would hide entries from the one person
   * able to correct them — which is the failure TEAM_ENTRY_LIMIT exists to turn into an error.
   */
  listTeamEntries(): Promise<Entry[]>;

  // -------------------------------------------------------------------------
  // CAL-04 — the month grid. 01-plan.md section 4.
  //
  // TWO READS AND NO WRITE. Neither function computes a count: `absenceCountsFor` in
  // ./absence.ts is INV-04's single implementation and it is deliberately NOT a seam method
  // (01-plan.md section 5). With zero copies of the arithmetic in the seam there is nothing for
  // tests/seam-parity.test.ts to miss — the seam only ever returns rows.
  // -------------------------------------------------------------------------

  /**
   * CAL-04 AC-7, AC-14. The caller's own team row, or null when the caller has no member row.
   *
   * NO PARAMETER. The team is resolved by `team_select_own` from `auth.uid()`; a `teamId` argument
   * would be a value the caller SUPPLIES, which is the shape `addAllowedEmail` deliberately refused.
   *
   * `null` rather than a throw for the member-less caller, matching `getCurrentMember` — it is the
   * NotOnATeam state, which is a normal answer and already has a screen.
   *
   * IT CARRIES NO WRITE HALF AND MUST NOT GROW ONE. `Set the overload threshold` is ADM-01's and
   * `rbac-and-security.md:48` grants it to `admin` alone; the migration this ticket ships grants
   * `select` and nothing else, so an `updateTeam` here would be a function every call refuses.
   */
  getTeam(): Promise<Team | null>;

  /**
   * ADM-01 AC-2, AC-5, AC-9, AC-12, AC-14. Sets the caller's OWN team's threshold. Admin only; the
   * policy is the control and this function is the affordance.
   *
   * TAKES NO TEAM PARAMETER, for the reason `getTeam()` already records above: `team_update_admin`
   * resolves the row from `auth.uid()`, and a `teamId` argument would be a value the CALLER
   * supplies.
   *
   * IT IS A SEPARATE FUNCTION AND NOT A WRITE HALF OF `getTeam()`, which the comment above forbids
   * in terms.
   *
   * IT CARRIES NO OTHER COLUMN (AC-9). `SetOverloadThresholdInput` has one field and the column
   * grant in supabase/migrations/20260905000000_adm01_team_threshold.sql withholds every other.
   *
   * Returns the updated row. The `.select()` in the real implementation is NOT a convenience: under
   * row-level security a refused UPDATE is FILTERED, not errored — it matches nothing and PostgREST
   * answers 200 with an empty body, which `removeMember` and `promoteMember` already document in
   * src/lib/data/supabase.ts. Zero rows returned is a refusal and maps to `not_permitted`; treating
   * `!error` as success would report a refusal as done. This is the one behaviour in this contract a
   * developer will get wrong in good faith, and AC-5 is the test that catches it.
   *
   * NO RANGE CHECK HERE. `[0, 100]` in whole percentage points is a product decision the SCREEN
   * enforces before it issues anything (AC-7, AC-8, 01-plan.md section 4.3); there is no `check`
   * constraint behind this and section 6 says why.
   */
  setOverloadThreshold(input: SetOverloadThresholdInput): Promise<Result<Team>>;

  /**
   * CAL-04 AC-1 to AC-6, AC-12. Every entry of the caller's team whose date range OVERLAPS `range`.
   *
   * THIS IS THE RANGE-SHAPED READ `listTeamEntries` refuses to become. That boundary is recorded on
   * `listTeamEntries` above and at CAL-01 on `listOwnEntries`: the flat read answers "which entries
   * exist for this team", and the moment it grows a range parameter there are two team-entry reads
   * and one of them is the one nobody updated. This is the second read, declared separately on
   * purpose.
   *
   * OVERLAP, NOT CONTAINMENT: an entry running 2026-03-28 to 2026-04-02 MUST be returned for April,
   * because AC-2 draws its avatar on 1 and 2 April. The real implementation filters on the generated
   * `date_range` column ADR-011 created for exactly this; the mock compares
   * `startDate <= range.end && endDate >= range.start`, which is the same predicate.
   *
   * RETURNS REJECTED ROWS TOO. Filtering `status` here would put a second copy of INV-04's rule
   * outside `absenceCountsFor`, which is what INV-04 exists to prevent. The one implementation of
   * the rule excludes them (AC-4).
   *
   * THROWS on a transport failure and on a possibly-truncated answer, the shape `listTeamEntries`,
   * `listOwnEntries` and `listMembers` all use. AC-11 is that throw: a capped read SUMS what it was
   * given and produces a believable wrong answer with no error anywhere, and on this screen the
   * count is the product.
   */
  listTeamEntriesOverlapping(range: DateRange): Promise<Entry[]>;

  // -------------------------------------------------------------------------
  // ADM-02 — the national holiday calendar, read only. 01-plan.md section 4.2.
  //
  // ONE READ AND NO WRITE. `holiday_insert_admin`, `holiday_update_admin` and
  // `holiday_delete_admin` are ADM-03's, and until they ship NEITHER ROLE can change the calendar
  // (AC-13) — so an `addHoliday` here would be a function every call refuses, which is the shape
  // `getTeam()` above already forbids itself.
  // -------------------------------------------------------------------------

  /**
   * ADM-02 AC-1, AC-2, AC-4, AC-12. Every holiday row whose date falls inside `range`, ascending.
   *
   * NO TEAM PARAMETER AND NO TEAM SCOPE. The calendar is national (ADR-015 section 1), so unlike
   * every other list read on this seam there is nothing here to narrow — `holiday_select_all` is
   * `using (true)` and a caller on any team reads the same rows (AC-14).
   *
   * A PLAIN TWO-SIDED FILTER ON A SCALAR COLUMN, and this is where ADR-011's pattern deliberately
   * does NOT transfer. `entry` needed the generated `date_range` column and `ov.` because an entry
   * SPANS a range and PostgREST filters columns rather than expressions. `holiday.date` is a scalar
   * served by the btree index `unique (date)` already builds, so there is no daterange, no
   * generated column and no `btree_gist` here. Copying that shape would be cost with no property
   * bought — ADR-015 section 6.
   *
   * INCLUSIVE AT BOTH ENDS, matching `DateRange` everywhere else on this seam.
   *
   * THROWS on a transport failure and on a possibly-truncated answer, the shape `listMembers`,
   * `listOwnEntries`, `listTeamEntries` and `listTeamEntriesOverlapping` all use. The throw is
   * AC-12, and the reason it matters more here than anywhere else is in that criterion: one
   * truncation produces two opposite errors — a holiday rendered as an ordinary working day AND a
   * mandated Saturday rendered as an inert weekend — and both surface on a date other than the one
   * whose row was dropped.
   */
  listHolidays(range: DateRange): Promise<Holiday[]>;

  // -------------------------------------------------------------------------
  // ADM-03 — the WRITE half of the same table. 01-plan.md section 4.2.
  //
  // THE THREE FUNCTIONS THE COMMENT ABOVE SAID WOULD ARRIVE HERE, and the sentence that forbade
  // them is now spent: `holiday_insert_admin`, `holiday_update_admin` and `holiday_delete_admin`
  // ship in supabase/migrations/20260905140000_adm03_holiday_writes.sql, so these are no longer
  // functions every call would refuse. `listHolidays` above is UNCHANGED — not one character —
  // which is AC-18.
  //
  // NO TEAM PARAMETER ON ANY OF THE THREE, for the reason `listHolidays` already records: the
  // calendar is national and there is nothing to narrow. This is the only place on this seam where
  // that is true of a WRITE, and the three policies carry no team conjunct for the same reason.
  //
  // THEY DO NOT SHARE ONE SUCCESS TEST, and that is the single thing a developer gets wrong here in
  // good faith. Under row-level security a refused INSERT is REFUSED — `42501` arrives as an error
  // — but a refused UPDATE or DELETE is FILTERED: it matches no row and PostgREST answers 200 with
  // an empty body. So `addHoliday` may read an error, and the two below must count rows.
  // -------------------------------------------------------------------------

  /**
   * ADM-03 AC-1, AC-2, AC-6, AC-15, AC-16. Adds one row. Admin only; `holiday_insert_admin` is the
   * control and this function is the affordance.
   *
   * Returns the stored row, so the screen can say which year it landed in (AC-4) rather than
   * assuming the one it is displaying.
   *
   * `holiday_date_taken` ON A SECOND ROW FOR ONE DATE (AC-6). That is `unique (date)`, which ADM-02
   * created and this ticket only makes a person meet — the seam translates `23505` into a sentence
   * and nothing above it re-implements the constraint.
   */
  addHoliday(input: AddHolidayInput): Promise<Result<Holiday>>;

  /**
   * ADM-03 AC-7, AC-8, AC-10, AC-15, AC-16. Replaces the three writable columns of ONE row.
   *
   * ZERO ROWS RETURNED IS A REFUSAL, not a success — the shape `removeMember`, `promoteMember` and
   * `setOverloadThreshold` all document. Treating `!error` as success would report a member's
   * refused edit as done (AC-15).
   *
   * `holiday_date_taken` when the edit moves the row onto an occupied date (AC-7). Deliberately the
   * same code and the same sentence as `addHoliday`'s: it is the same constraint, and a second code
   * would be a second thing for a screen to branch on for no difference in what happened.
   */
  updateHoliday(holidayId: string, input: UpdateHolidayInput): Promise<Result<Holiday>>;

  /**
   * ADM-03 AC-11, AC-13, AC-15, AC-16. Removes one row. HARD delete: nothing references `holiday`,
   * there is no cascade anywhere in this model (data-model.md) and there is no trash — 01-plan.md
   * section 8 rejects a `deleted_at` column and says why.
   *
   * IT COUNTS THE DELETED ROW AS ITS SUCCESS TEST, for the reason `deleteEntry` records: a refused
   * DELETE is filtered, matches nothing, and answers 200 with an empty body. A delete has no
   * obvious return value to inspect, so without asking for the deleted representation every refusal
   * would be reported as a completed delete. Zero rows is `not_permitted` (AC-15).
   */
  deleteHoliday(holidayId: string): Promise<Result<void>>;

  // -------------------------------------------------------------------------
  // ADM-04 — the worklist of entries awaiting a decision. 01-plan.md section 4.2.
  //
  // ONE READ AND NO WRITE, and the absence is the ticket's defining constraint rather than an
  // omission. `product` argued at triage that a read-only worklist is not separable from the action
  // and lost; the losing argument is kept in .ai/registry/features.md:103 precisely so nobody
  // re-argues it here. Approving and rejecting are ADM-05's, they consume `entry_update_admin` and
  // `public.entry_enforce_decision()`, and neither is reachable from this surface (AC-9).
  // -------------------------------------------------------------------------

  /**
   * ADM-04 AC-1 to AC-8, AC-11, AC-13. One page of the entries awaiting a decision, with the EXACT
   * size of the matching set.
   *
   * NOT `listTeamEntries` WITH ARGUMENTS. That read is deliberately flat and its own comment above
   * says it must not grow a parameter — "the moment it does there are two team-entry reads and one
   * of them will be the one nobody updated". This is a different question over a different set with
   * a different failure mode, and it answers with a different shape.
   *
   * NO ROLE PARAMETER AND NO `is_admin` CHECK INSIDE IT, for the reason `listTeamEntries` already
   * records: `entry_select_team` admits the team's rows to BOTH roles, so this read is not where the
   * admin capability lives. There is no admin capability behind this screen at all — the refusal on
   * it is an affordance, and a member who deleted it would see rows they can already read at
   * `/entries/team` (01-plan.md section 3).
   *
   * THE TEAM PREDICATE IS NOT WRITTEN IN THE QUERY. `entry_select_team` supplies it, and a copy here
   * would be a second expression of INV-07 above the seam (AC-13).
   *
   * ONE RESPONSE CARRIES BOTH HALVES, AND THAT IS THE DECISION. `features.md:103` requires the
   * outstanding count to derive from an exact count and never from `data.length`, and requires that
   * the badge and the list not be able to disagree. Two calls — one counting, one listing — CAN
   * disagree, because a write can land between them; one response cannot. 01-plan.md section 8,
   * rejected alternative 1.
   *
   * IT PAGES RATHER THAN TRUNCATING, which is the one read on this seam that does. A ceiling turns a
   * long queue into an error, and a queue long enough to trip it is precisely the queue an admin
   * most needs to work through (01-plan.md section 8, rejected alternative 4).
   *
   * THROWS on a transport failure, and on a SHORT PAGE THAT IS NOT THE LAST PAGE — `rows.length <
   * pageSize` while `page * pageSize + rows.length < total`. That is the datastore capping the read,
   * and it is the truncation hazard in the direction the feature row names: a queue that comes back
   * short reads as *the queue is empty*, with no error anywhere and no decision ever made (AC-5). It
   * does NOT throw on a full page — a full page is normal and is what `total` and `page` exist to
   * navigate.
   */
  listPendingEntries(query: PendingEntryQuery): Promise<PendingEntryPage>;
}

export type { DataSeam as Seam };

// Which implementation a build resolves to. 02-design.md section 6.2.
//
// This file is the one door, and it makes the choice — nothing above the seam names an
// implementation. The first two revisions of the design were silent on this, so SignUp.tsx imported
// `./supabase` by hand and the end-to-end build constructed a real client against an absent
// VITE_SUPABASE_URL, which raises `supabaseUrl is required.` on submit. QA found it as five failing
// tests with no error on screen.
//
// Importing both implementations is safe: supabase.ts builds its client lazily, and that laziness
// already exists for this exact reason. The two `import type` lines back from mock.ts and
// supabase.ts are erased at build, so there is no runtime cycle.
const usesMock = import.meta.env.VITE_DATA_SEAM === "mock" || !import.meta.env.VITE_SUPABASE_URL;

/**
 * Read by `App.tsx` to render `seam-banner`. A silent fallback to a fake datastore is the failure
 * that rule exists to prevent: a deployment that forgets one environment variable would otherwise
 * accept sign-ups into memory and look entirely normal.
 */
export const seamName: "mock" | "supabase" = usesMock ? "mock" : "supabase";

export const seam: DataSeam = usesMock ? mockSeam : supabaseSeam;
