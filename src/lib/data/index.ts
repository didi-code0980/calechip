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
  Entry,
  EntryPortion,
  EntryType,
  Member,
  Result,
  Session,
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
