// The in-memory implementation. Component tests run against this.
// Parity with supabase.ts is asserted by the seam-parity test, not by convention.
//
// It reproduces the TRIGGER's behaviour, not the interface's (02-design.md section 3): an
// allow-listed address gets a member row and consumes the entry, an unlisted or already-consumed one
// succeeds and creates nothing. A mock that always created a member would make every component test
// pass against a broken trigger, which is the one failure a mock seam can cause and not catch.
import type {
  AddHolidayInput,
  ChangePasswordInput,
  CreateEntryInput,
  DataSeam,
  SetOverloadThresholdInput,
  SetOwnBusyDayInput,
  SignInInput,
  SignUpInput,
  SignUpOutcome,
  UpdateEntryInput,
  UpdateHolidayInput,
  UpdateOwnProfileInput,
} from "./index";
import type {
  MemberDecision,
  BulkRejectionOutcome,
  BusyDay,
  DateRange,
  Entry,
  EntryPortion,
  EntryStatus,
  Holiday,
  Member,
  PendingEntryPage,
  PendingEntryQuery,
  Result,
  Session,
  Team,
} from "../domain/types";
// TEA-03, and CAL-04 for the third. RUNTIME imports, not type ones - 02-design.md section 1.1.
// ADM-04 adds PENDING_PAGE_SIZE, which is a WINDOW and not a ceiling - see its own comment there.
// CAL-09 adds TEAM_ENTRY_PAGE_SIZE and TEAM_ENTRY_MAX_PAGES, which are a window and a bound on work
// for the same reason, and removes MONTH_ENTRY_LIMIT: `listTeamEntriesOverlapping` was its only
// reader here and now pages instead. The constant still exists and its docblock says why.
import { requiresEmailConfirmation } from "../config";
// SOLO, 2026-09-10. `FixtureCredential` is the shape `signIn` already searches, so an account
// created at sign-up is stored in it rather than in a second shape that would have to be kept
// compatible with it by hand.
import type { FixtureCredential } from "../fixtures";
import {
  AVATAR_CHOICES,
  HOLIDAY_LIMIT,
  PENDING_PAGE_SIZE,
  ROSTER_LIMIT,
  TEAM_ENTRY_LIMIT,
  TEAM_ENTRY_MAX_PAGES,
  TEAM_ENTRY_PAGE_SIZE,
} from "../domain/types";
import {
  FIXTURE_ADMIN,
  FIXTURE_APPROVED_ENTRY,
  FIXTURE_APPROVED_MEMBER,
  FIXTURE_APPROVED_MEMBER_CREDENTIAL,
  FIXTURE_CREDENTIALS,
  FIXTURE_HOLIDAYS,
  FIXTURE_MEMBER,
  FIXTURE_OTHER_TEAM,
  FIXTURE_OTHER_TEAM_ENTRY,
  FIXTURE_OTHER_TEAM_MEMBER,
  FIXTURE_PENDING_SIGNUP,
  FIXTURE_REMOVED_MEMBER,
  FIXTURE_SECOND_ADMIN,
  FIXTURE_TEAM,
} from "../fixtures";

// SOLO, 2026-09-10. `AllowedEmailRow` aliased the domain type until the allow-list was removed
// whole. Nothing in this file models that table any more.

// AC-4: `allowed_email.email` is citext in the migration, so the database compares without regard to
// case. The mock has no citext, so it folds on the way in and on the way out — same behaviour, and
// the fold is in one place so it cannot drift between the two lookups.
const fold = (email: string): string => email.trim().toLowerCase();


// Seeded from the shared fixture module, which holds the same rows as supabase/seed.sql
// (.ai/standards/architecture.md: "a mock, in memory, seeded from the shared fixture module").
//
// TEA-02 adds FIXTURE_MEMBER: the denial half of AC-8 needs somebody to be denied as, and
// `__setCurrentMember` below is how a test becomes them.
//
// TEA-03 adds the other two. Both exist to make a criterion OBSERVABLE that a one-team, all-active
// roster cannot show: FIXTURE_OTHER_TEAM_MEMBER is the row AC-2 says must never come back, and
// FIXTURE_REMOVED_MEMBER is the row AC-4 says the read must keep and the screen must not draw.
//
// TEA-04 adds FIXTURE_SECOND_ADMIN, for the same kind of reason: AC-13 asserts that an admin row
// which is NOT the caller carries a remove control and no promote control, and with one admin
// fixture the caller and that row are the same row.
//
// EACH ROW IS COPIED rather than referenced. TEA-04 is the first ticket whose writes MUTATE a
// seeded row - `removeMember` sets `removedAt` and `promoteMember` sets `role` - and the fixtures
// are shared module-level objects that every test and both implementations import. Holding the
// references here would let one mock write change what `FIXTURE_MEMBER` means everywhere for the
// rest of the process.
//
// CAL-02 adds FIXTURE_APPROVED_MEMBER, and it is the entry below rather than the roster that needs
// it: AC-5 and AC-6 edit an APPROVED entry, nothing in the product can create one, and neither
// FIXTURE_MEMBER nor FIXTURE_ADMIN can own it without breaking CAL-01's suite, which must pass
// unedited (01-plan.md section 4.3).
const members: Member[] = [
  { ...FIXTURE_ADMIN },
  { ...FIXTURE_MEMBER },
  { ...FIXTURE_SECOND_ADMIN },
  { ...FIXTURE_OTHER_TEAM_MEMBER },
  { ...FIXTURE_REMOVED_MEMBER },
  { ...FIXTURE_APPROVED_MEMBER },
  // SOLO, 2026-09-10. Waiting on an admin: no team, `pending`. Invisible to every roster read
  // (`listMembers` filters on `teamId`), so it moves no count and no threshold. LAST in the array
  // deliberately: two shipped tests index into this list, and inserting ahead of them changed which
  // member they were about.
  { ...FIXTURE_PENDING_SIGNUP },
];

// TEA-03, 02-design.md section 1.4. `createdAt` ascending, then `id` ascending. The id tiebreaker is
// not decoration: FIXTURE_ADMIN, FIXTURE_MEMBER and FIXTURE_REMOVED_MEMBER share a `createdAt`
// literal, so `createdAt` alone leaves their order dependent on insertion order here and on physical
// row order in PostgreSQL - two implementations that disagree about order fail nothing and produce a
// flaky test.
const byCreatedAtThenId = (a: Member, b: Member): number =>
  a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt);

// CAL-04. The mock's `team` table, and it is the first read of it anywhere.
//
// Both rows are COPIED rather than referenced, for the reason `members` records: the fixtures are
// shared module-level objects that every test imports, and nothing should be able to mutate one
// through this array. Nothing writes `team` today - `Set the overload threshold` is ADM-01's and
// this ticket's migration grants `select` and nothing else - so the copy is a precaution against the
// ticket that adds the update, not against anything here.
//
// TWO rows and not one, and the second is the whole of AC-12 on this table: `team_select_own` scopes
// the read to `id = member_team_id(auth.uid())`, and a one-team fixture passes whether that
// predicate is in the policy or absent from it. ADR-018's revert condition, one table over.
const teams: Team[] = [{ ...FIXTURE_TEAM }, { ...FIXTURE_OTHER_TEAM }];

// SOLO, 2026-09-10 — accounts created through the sign-up form, when the project is configured not
// to require email confirmation (`src/lib/config.ts`).
//
// **IT IS EMPTY AT MODULE LOAD AND RESETS WITH EVERY DOCUMENT LOAD**, exactly as `members` and
// `allowedEmails` do. Nothing seeded goes in here: this list is what the running session created,
// and a fixture that appeared in it would be a seed row with no counterpart in `supabase/seed.sql`
// — the drift `fixtures.ts` § 5.1 exists to repair.
//
// It is searched LAST by `signIn`, so a sign-up that reused a seeded address cannot shadow the
// fixture's password and change what every other spec file's sign-in means.
const signedUp: FixtureCredential[] = [];

// SOLO, 2026-09-10. The seeded allow-list stood here. The table is gone; a person who signs up now
// gets a pending member row instead, and an admin decides.

let nextUserId = 0;
const newUserId = (): string => `00000000-0000-4000-8000-${String(++nextUserId).padStart(12, "0")}`;

// TEA-05. The mock's session, and the mock now HAS one.
//
// Until this ticket there was no sign-in anywhere, so `currentMemberId` below was seeded to
// FIXTURE_ADMIN and moved only by the test hook - the mock fabricated an identity because nothing
// could establish one. It no longer fabricates: `signIn` sets both of these together and `signOut`
// clears both, which is what the real seam does by way of `auth.getUser()` reading the stored
// session. With nobody signed in, `getCurrentMember()` answers null in BOTH implementations, and
// /allow-list and /members fail safe against the mock exactly as they already do against Supabase.
//
// AMENDED on the second cycle. This paragraph read "Starting at null is the consequence, and it is
// the correct one" - and null was the wrong start, because the real seam does not start at null
// after a reload. See the block immediately below; the amendment is that sentence and nothing else.
// TEA-05 AC-7. Where the mock's session survives a page load.
//
// The real seam does not IMPLEMENT AC-7 either, it inherits it: `persistSession` is a
// @supabase/auth-js default, so the client writes the session to `localStorage` and restores it on
// the next load (supabase.ts:454). A mock holding the session only in module state answers null
// after a reload while the real one answers the session - parity in the seam's KEYS and not in its
// behaviour, and AC-7 is the criterion that difference shows up in. 01-plan.md section 5 puts
// `getSession` after `signIn` and before `signOut` opposite AC-7, and a reload sits inside that
// window. So the mock stores it too, under its own key, which the real client never reads.
const SESSION_STORAGE_KEY = "calechip.mock.session";

// `localStorage` is absent under the vitest `node` environment (vite.config.ts:17), which imports
// this module at the top of tests/seam-parity.test.ts, and a browser can refuse it outright in a
// private context. Both are read as "no stored session" rather than as an error: persistence is what
// AC-7 needs and nothing else in the mock depends on it.
function sessionStore(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

// Shape-checked rather than cast. The value comes back from a store a person can edit by hand, and a
// malformed one has to land on the sign-in screen rather than render a signed-in screen for a user
// with no id.
function readStoredSession(): Session | null {
  const store = sessionStore();
  if (!store) return null;

  try {
    const raw = store.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const { user, accessToken } = parsed as { user?: unknown; accessToken?: unknown };
    if (typeof accessToken !== "string") return null;
    if (typeof user !== "object" || user === null) return null;

    const { id, email, emailConfirmed } = user as {
      id?: unknown;
      email?: unknown;
      emailConfirmed?: unknown;
    };
    if (typeof id !== "string" || typeof email !== "string") return null;
    if (typeof emailConfirmed !== "boolean") return null;

    return { user: { id, email, emailConfirmed }, accessToken };
  } catch {
    return null;
  }
}

function writeStoredSession(session: Session | null): void {
  const store = sessionStore();
  if (!store) return;

  try {
    if (session) store.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    else store.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // A full quota or a blocked store costs persistence, not the sign-in: the in-memory session
    // stands and this load behaves exactly as the mock did before AC-7 was reproduced.
  }
}

// Restored on module load, which is the reload path: nothing above the seam re-establishes a session
// after a navigation, and `useSession` reads this through `getSession()` on its first effect.
let currentSession: Session | null = readStoredSession();

// TEA-02. Who `getCurrentMember` answers as. Since TEA-05 it follows `currentSession` and is never
// set independently except by the test hook below - including across a reload, where it is derived
// from the restored session rather than persisted a second time.
let currentMemberId: string | null = currentSession ? currentSession.user.id : null;

/** Test-only. Sets which seeded member `getCurrentMember` answers as. Not part of the seam - it is a
 *  named export beside `seam`, so seam parity, which compares the keys of `seam`, is untouched.
 *
 *  TEA-05 leaves this in place and it is now REDUNDANT rather than load-bearing: nothing in the
 *  repository calls it, and after this ticket a test signs in rather than asserting its way into a
 *  session. Removing it is a tidy-up with no criterion behind it; the next ticket to touch this file
 *  can delete it. Note that it moves the member and NOT the session, so a caller that uses it is
 *  choosing a state the application cannot reach. */
export function __setCurrentMember(id: string | null): void {
  currentMemberId = id;
}

// SOLO, 2026-09-10 — the profile screen changes passwords, and `signIn` answers from
// `FIXTURE_CREDENTIALS`, which is a FROZEN array shared with every other spec file. Rewriting an
// entry in it would change what `quan@example.com` means for the whole suite, in file order, for
// the rest of the run.
//
// So the change is recorded HERE, keyed by auth user id, and `signIn` consults this map BEFORE the
// account's own password. Module state, like `members` and `signedUp`: it resets on a document load,
// so no spec inherits a password another spec set.
const passwordOverrides = new Map<string, string>();

/** The password that is currently correct for an account — the changed one if there is one. */
const currentPasswordOf = (account: FixtureCredential): string =>
  passwordOverrides.get(account.userId) ?? account.password;

/** Every account `signIn` searches, in the order it searches them. Named once because
 *  `changePassword` has to find the caller in exactly the same list, by the same rule. */
const accounts = (): FixtureCredential[] => [
  ...FIXTURE_CREDENTIALS,
  FIXTURE_APPROVED_MEMBER_CREDENTIAL,
  ...signedUp,
];

// TEA-05 AC-6, AC-7, AC-8. The subscribers of `onAuthStateChange`, and a real unsubscribe rather
// than a no-op: a listener this mock kept forever would survive a hot reload and re-resolve against
// a stale closure, which is the leak the seam's own contract warns about.
const sessionListeners = new Set<(session: Session | null) => void>();

function setSession(session: Session | null): void {
  currentSession = session;
  currentMemberId = session ? session.user.id : null;
  // AC-7 on the way in, AC-6 on the way out: `signOut` passes null here, so the stored copy is
  // removed in the same call that clears the in-memory one. A sign-out that ended the session for
  // this page and left it in the store would be the shared-machine gap AC-6 exists to close.
  writeStoredSession(session);
  // A copy per listener, so one subscriber cannot hand a mutated session to the next.
  for (const listener of sessionListeners) listener(session ? { ...session } : null);
}

// AC-4, AC-8. The refusals below reproduce the POLICY, not the screen (02-design.md section 3): a
// mock that let a member add an address would make every component test pass against a missing
// policy. `allowed_email_insert_admin` and `allowed_email_delete_admin_unconsumed` both require an
// admin whose team is the row's team, so that is what this asks.
const currentAdmin = (): Member | null => {
  const me = members.find((m) => m.id === currentMemberId && m.removedAt === null) ?? null;
  return me && me.role === "admin" ? me : null;
};

// ADM-03 adds `holiday_date_taken` to the union. It is widened rather than replaced by
// `FailureCode`: the narrow list is what stops this file returning a code no mock path can produce,
// and a code added here is a code some function below must actually be able to reach.
const refused = (
  code: "not_permitted" | "already_allow_listed" | "already_consumed" | "holiday_date_taken",
  message: string,
): { ok: false; error: { code: typeof code; message: string } } => ({
  ok: false,
  error: { code, message },
});

// ---------------------------------------------------------------------------
// CAL-01. 01-plan.md section 5.
// ---------------------------------------------------------------------------

// The mock's entry table. CAL-01 left it EMPTY and said so: an entry a test needs, a test creates,
// the way a person does.
//
// CAL-02 SEEDS EXACTLY ONE ROW, and it is the one no person can create. AC-5 and AC-6 edit an entry
// that is already APPROVED, and `status` is withheld from both grants and from ADM-05, which does
// not exist - so this row is a human's seed statement in supabase/seed.sql and the same literals
// here, which is what the shared-fixture rule asks for rather than the drift it forbids. Every other
// entry in every test is still created through the form.
//
// In memory only, and unlike the session this is NOT persisted across a page load. The seam banner
// in App.tsx already tells every reader, on every screen, that the data lives in browser memory and
// is lost on reload - a mock that quietly contradicted its own banner would be a worse lie than the
// one it fixed. Nothing in plan section 2 requires an entry to survive a navigation, and a reload
// restores this row exactly as re-running the seed would.
// CAL-03 SEEDS A SECOND ROW, and it is the row AC-8 has nothing to assert against otherwise. The
// fixtures have held a second team and a member on it since TEA-03 and no ENTRY on it, so
// "an admin of one team may not touch an entry of another" had no entry to be refused.
//
// It is here rather than created by a test for the same reason FIXTURE_APPROVED_ENTRY is: nobody can
// create it through the product. `entry_insert_own` admits only `member_id = auth.uid()`, so an
// entry on the other team can be created only by that team's own member signing in — and every
// suite in this repository signs in on FIXTURE_TEAM.
const entries: Entry[] = [{ ...FIXTURE_APPROVED_ENTRY }, { ...FIXTURE_OTHER_TEAM_ENTRY }];

// ---------------------------------------------------------------------------
// SOLO, 2026-09-11. The mock's `busy_day` table.
// ---------------------------------------------------------------------------
//
// **SEEDED EMPTY, UNLIKE `entries`.** The two fixture entries exist because nobody can create them
// through the product — `entry_insert_own` admits only `member_id = auth.uid()`, so an approved row
// and another team's row are unreachable from a suite that signs in on FIXTURE_TEAM. A busy day has
// neither problem: it needs no approval and a test creates one with one press, so a seeded row would
// be a row every count has to remember to subtract.
//
// Module state, like `members` and `entries`: it resets on a document load, which is why the e2e
// helpers that walk browser history avoid `page.goto` mid-test.
const busyDays: BusyDay[] = [];

// The id shape `newEntryId` and `newHolidayId` already use — a `bb` prefix, so a reader can tell at
// a glance which table an id belongs to.
let nextBusyDayId = 0;
const newBusyDayId = (): string =>
  `bb000000-0000-4000-8000-${String(++nextBusyDayId).padStart(12, "0")}`;

// ---------------------------------------------------------------------------
// ADM-02. 01-plan.md sections 4.3 and 4.5.
// ---------------------------------------------------------------------------

// The mock's `holiday` table, seeded from the shared fixture module — the same four rows
// supabase/seed.sql inserts, with the same literals.
//
// COPIED, never referenced, for the reason `members` and `teams` above record: the fixtures are
// shared module-level objects that every test imports. Nothing writes this table on this branch and
// nothing can — the write policies are ADM-03's (AC-13) — so the copy is a precaution against the
// ticket that adds them rather than against anything here.
//
// ONE TABLE AND NO TEAM COLUMN, which is the whole of AC-14 reproduced: there is no `team_id` to
// scope by, so unlike every other read in this file `listHolidays` below applies no team filter.
// A mock that scoped it would pass no test and hide nothing — it would simply be a second story
// about a table `holiday_select_all` admits to everybody.
const holidays: Holiday[] = FIXTURE_HOLIDAYS.map((h) => ({ ...h }));

// ADM-03. The id a row added through the product gets, in the shape `newEntryId` and `newUserId`
// already use — a `cc` prefix, matching the four fixture rows above so a reader can tell at a glance
// which table an id belongs to.
let nextHolidayId = 0;
const newHolidayId = (): string =>
  `cc000000-0000-4000-8000-${String(++nextHolidayId + 900).padStart(12, "0")}`;

// ADM-03. The four sentences, repeated from src/lib/data/supabase.ts so the two implementations of
// the seam carry the same words — the rule CAL-01's three refusal constants already state, and the
// reason src/lib/fixtures.ts and supabase/seed.sql repeat their literals too.
const HOLIDAY_ADD_REFUSED = "Only an admin can add to the holiday calendar.";
const HOLIDAY_UPDATE_REFUSED = "Only an admin can change the holiday calendar.";
const HOLIDAY_DELETE_REFUSED = "Only an admin can remove a day from the holiday calendar.";
const HOLIDAY_DATE_TAKEN = "The calendar already has a row for that date. Edit that row instead.";

// SOLO, 2026-09-11. Repeated verbatim in src/lib/data/supabase.ts so the two implementations carry
// the same words — the rule CAL-01's three refusal constants state.
const BUSY_DAY_REFUSED = "This day could not be marked. You may only mark your own days.";

let nextEntryId = 0;
const newEntryId = (): string => `ee000000-0000-4000-8000-${String(++nextEntryId).padStart(12, "0")}`;

// INV-01, reproduced. THIS IS A SECOND IMPLEMENTATION OF AN INVARIANT and it is acceptable only
// because the mock is not a datastore anybody's data lives in - the real mechanism is the exclusion
// constraint `entry_no_overlapping_portion` (ADR-011 section 3), and this exists so AC-7 and AC-8
// are observable end-to-end without a provisioned project.
//
// The slot semantics are ADR-011's table, not a paraphrase of it: `full` covers both halves of the
// day, `am` the first, `pm` the second. Two entries conflict when the same member's date ranges
// intersect AND their slot sets intersect - which is why `full` conflicts with everything while `am`
// and `pm` do not conflict with each other. A test for equal `portion` would accept `full` beside
// `am`, which is the exact failure ADR-011 exists to record.
const PORTION_SLOTS: Record<EntryPortion, readonly number[]> = {
  full: [0, 1],
  am: [0],
  pm: [1],
};

// Inclusive on both ends, as `end_date` is (data-model.md). String comparison is correct for
// `yyyy-MM-dd` and no Date is constructed - plan section 4.5.
// CAL-02 widens the second parameter from `CreateEntryInput` to the two fields it actually reads,
// so `updateEntry` uses the same comparison rather than a second one that could drift from it.
const datesIntersect = (a: Entry, b: { startDate: string; endDate: string }): boolean =>
  a.startDate <= b.endDate && b.startDate <= a.endDate;

const slotsIntersect = (a: EntryPortion, b: EntryPortion): boolean =>
  PORTION_SLOTS[a].some((slot) => PORTION_SLOTS[b].includes(slot));

// ---------------------------------------------------------------------------
// CAL-03. 01-plan.md section 5, "the subtle shape is the mock's team scoping".
// ---------------------------------------------------------------------------

// `public.member_team_id(uuid)`, reproduced (TEA-01's migration, line 64). It answers the member's
// team and NULL for a member who does not exist OR HAS BEEN REMOVED — that `removed_at is null` is
// in the function body, not in the policies that call it, so every policy built on it inherits the
// removal filter without naming it.
const memberTeamId = (memberId: string | null): string | null =>
  members.find((m) => m.id === memberId && m.removedAt === null)?.teamId ?? null;

// The SQL comparison those policies write, and the reason it is a function rather than `===`.
//
// `entry_select_team`, `entry_update_admin` and `entry_delete_admin` all compare
// `member_team_id(member_id) = member_team_id(auth.uid())`. In SQL `null = null` is NULL and NOT
// true, so a comparison with an unknown side admits NOTHING — which means a removed member's entries
// are invisible and untouchable to everybody, and a removed caller reads no entry at all. A
// JavaScript `===` would answer TRUE for two nulls and open exactly the rows PostgreSQL closes.
const sameTeam = (a: string | null, b: string | null): boolean => a !== null && a === b;

// `entry_update_admin` and `entry_delete_admin`'s shared `using` clause, reproduced. Both policies
// carry the identical predicate, so it is one function here for the same reason it is two identical
// clauses there: they are the same rule about the same rows.
//
// THE TEAM HALF IS THE ONE WITH NO TEST BEHIND IT and is why this function exists at all. Dropping
// it leaves `me.role === "admin"`, which passes every test a one-team fixture can carry while
// letting an admin of any team edit every entry in the product — rbac-and-security.md known weakness
// 1, and the shape ADR-016 Consequences names for this ticket by name.
//
// `me.removedAt === null` is `public.is_admin`'s own filter (same migration, line 54): a removed
// admin is not an admin.
const adminMayReach = (me: Member, entry: Entry): boolean =>
  me.role === "admin" &&
  me.removedAt === null &&
  sameTeam(memberTeamId(entry.memberId), memberTeamId(me.id));

// `entry_update_own` and `entry_delete_own`'s `using (member_id = (select auth.uid()))`, CAL-02's
// and unchanged by this ticket. It is named here only so the OR below reads as the two permissive
// policies it stands for rather than as one merged predicate — 01-plan.md section 8 rejects merging
// them in the migration, and merging them here would lose the same property one layer up.
const ownsEntry = (me: Member, entry: Entry): boolean => entry.memberId === me.id;

// ---------------------------------------------------------------------------
// ADM-05. 01-plan.md sections 4.2 and 5.
// ---------------------------------------------------------------------------

// The four sentences, repeated from src/lib/data/supabase.ts so the two implementations of the seam
// carry the same words — the rule CAL-01's three refusal constants and ADM-03's four already state.
const DECISION_REFUSED =
  "Only an admin can approve or reject an entry. Nothing about this entry has changed.";
const APPROVE_REFUSED = "This entry could not be approved.";
const REJECT_REFUSED = "This entry could not be rejected.";
const REASON_REQUIRED =
  "A rejection needs a reason. Say what would work instead, so the entry can be re-planned.";

// ---------------------------------------------------------------------------
// ADM-06. 01-plan.md section 4.2.
// ---------------------------------------------------------------------------

// Two more sentences, repeated from src/lib/data/supabase.ts so the two implementations of the seam
// carry the same words — the rule CAL-01's three refusal constants and ADM-05's four already state.
const BULK_REJECT_REFUSED = "These entries could not be rejected.";
const NOTHING_SELECTED = "Select at least one entry before rejecting.";

// CLAUSES (a) AND (b) OF `public.entry_enforce_decision()`, REPRODUCED — AND THAT IS DECLARED
// RATHER THAN HIDDEN. This is a SECOND IMPLEMENTATION OF A CONTROL, not of an invariant, which is
// the strongest form of the thing this file does three times already (INV-01, INV-02, the policies).
// It is acceptable on the terms this file already states for INV-01 — the mock is not a datastore
// anybody's data lives in and the real mechanism is the trigger — and it exists so AC-8, AC-9,
// AC-16 and AC-17 are observable end to end with no provisioned project.
//
// WHAT IT PROVES AND WHAT IT DOES NOT is 01-plan.md Open questions item 2, and the honest half is
// this: ADR-016's own headline consequence asks for a member PATCHing {"status":"approved"} against
// a REAL PostgreSQL with a member's token, and no project is provisioned. Against this file AC-8 and
// AC-9 demonstrate THE SENTENCE, not the refusal. The refusal is held by the trigger.
//
// ONE FUNCTION FOR BOTH CLAUSES, because the SQL is one function: `approveEntry` and `rejectEntry`
// both go through it, so clause (a) is written once here exactly as it is written once there.
//
// CLAUSE (c) IS NOT HERE. No decision writes a substantive column, so the reset cannot fire on this
// path — and it already lives in `updateEntry`, where the edits that do fire it go through.
function applyDecision(
  me: Member,
  row: Entry,
  next: { status: EntryStatus; rejectionReason: string | null },
): Result<Entry> {
  // (a) THE GUARD. `is_admin` filters `removed_at is null` (TEA-01's migration, line 54), so a
  // removed admin is not an admin — the same filter `adminMayReach` above inherits.
  //
  // The condition is "a decision column MOVES", not "an admin is acting": an admin re-rejecting with
  // the identical wording moves nothing and would pass the guard in PostgreSQL too, and writing
  // `role !== "admin"` alone here would refuse a case the trigger admits.
  const moves = next.status !== row.status || next.rejectionReason !== row.rejectionReason;
  if (moves && !(me.role === "admin" && me.removedAt === null)) {
    return { ok: false, error: { code: "entry_decision_not_permitted", message: DECISION_REFUSED } };
  }

  const wasApproved = row.status === "approved";

  // The two columns this ticket's grant names, and no others. `tentative` is untouched (INV-05,
  // AC-6) and so are the dates, the type and the portion.
  row.status = next.status;
  row.rejectionReason = next.rejectionReason;

  // (b) PROVENANCE, NEVER FROM THE WIRE. `approvedBy` is the acting member and never a parameter —
  // there is no parameter on either seam function that could carry one (AC-7).
  //
  // Nulling `rejectionReason` on approval is FORCED, not chosen: INV-03's check is a biconditional
  // and refuses any transition off `rejected` that leaves the reason standing (AC-4).
  if (row.status === "approved" && !wasApproved) {
    row.approvedBy = me.id;
    row.approvedAt = new Date().toISOString();
    row.rejectionReason = null;
  } else if (row.status !== "approved") {
    row.approvedBy = null;
    row.approvedAt = null;
  }

  // The trigger's `new.updated_at := now()`, which is AC-15's "when the decision was recorded" —
  // the datastore's clock in the real seam, and here the only clock there is.
  row.updatedAt = new Date().toISOString();

  return { ok: true, value: { ...row } };
}

export const seam: DataSeam = {
  async ready() {
    return true;
  },

  // AC-1, AC-2, AC-3, AC-4, AC-5, AC-8, AC-9, AC-13.
  //
  // Sign-up itself never reports whether the address was allow-listed — the outcome is identical
  // either way (AC-5). The only failure modelled here is one the auth service raises before the
  // trigger ever runs; an address that already has an account is NOT one of them, because with
  // Confirm email on (which AC-7 requires) Supabase returns an obfuscated user rather than an error.
  // A second sign-up for a consumed address therefore lands on the `consumedAt` guard below, which
  // is AC-3.
  async signUp(input: SignUpInput): Promise<Result<SignUpOutcome>> {
    if (input.password.length < 6) {
      return {
        ok: false,
        error: { code: "weak_password", message: "That password is too weak. Please choose a longer one." },
      };
    }

    const userId = newUserId();
    const now = new Date().toISOString();

    // **SOLO, 2026-09-10 — EVERY SIGN-UP GETS A MEMBER ROW, AND NOBODY GETS A TEAM.** This is the
    // mock reproducing the rewritten `admit_allow_listed_member`: no allow-list lookup, `team_id`
    // null, `status` pending. The allow-list block that stood here consumed an entry and set the
    // team from it; the table is gone.
    //
    // `role` is still hard-coded and still never read from anything the caller supplied — TEA-01
    // AC-9, and it matters MORE now, because the caller is no longer somebody an admin vouched for
    // before they arrived.
    members.push({
      id: userId,
      teamId: null,
      displayName: input.displayName,
      avatar: input.avatar,
      role: "member",
      status: "pending",
      removedAt: null,
      createdAt: now,
    });

    // TEA-01 AC-7 requires Confirm email ON, and under that setting signUp returns no session. That
    // was unconditional until SOLO, 2026-09-10; the mock now models WHICHEVER setting the project is
    // configured for, and `playwright.config.ts` pins the flag ON so AC-7 still runs against the one
    // it was written for. `src/lib/config.ts` carries the reasoning and the warning that goes with
    // it — this flag does not turn confirmation off in a real project and cannot.
    if (requiresEmailConfirmation()) {
      return { ok: true, value: { needsEmailConfirmation: true, session: null } };
    }

    // **WITHOUT CONFIRMATION THE ACCOUNT HAS TO BECOME SIGN-IN-ABLE, AND THAT IS THE REAL WORK
    // HERE.** `signIn` above answers from `FIXTURE_CREDENTIALS` and nothing else — a frozen array —
    // so before this every account created through the form was one that could never sign in again,
    // under either setting. That was invisible while sign-up ended on a terminal notice: nobody got
    // as far as trying. It stops being invisible the moment sign-up hands back a session.
    //
    // `signedUp` is the mutable half of that list. It is module state and resets on a document load,
    // exactly as `members` and `allowedEmails` do, so no test inherits an account from another file.
    signedUp.push({
      email: input.email,
      password: input.password,
      userId,
      emailConfirmed: true, // Supabase sets `email_confirmed_at` at insert time with Confirm email OFF
      // SOLO, 2026-09-10. EVERY sign-up now has a member row, so this is never `member-less` — but
      // that row carries no team until an admin approves it, which is what `status` says.
      membership: "member",
    });

    // **AC-5 IS NOW TRUE BY CONSTRUCTION RATHER THAN BY CARE.** It required the success branch to be
    // identical whether or not the address was allow-listed; there is no allow-list, so there is no
    // second branch left to keep identical. Everybody gets the same session and the same pending
    // member row, and what differs afterwards is only what an admin decides.
    const session: Session = {
      user: { id: userId, email: input.email, emailConfirmed: true },
      accessToken: `mock-access-token-${userId}`,
    };
    setSession(session);
    return {
      ok: true,
      value: { needsEmailConfirmation: false, session: { ...session } },
    };
  },

  // AC-1, AC-9. Null means "this auth user has no member row" — a normal answer, not an error.
  async getOwnMember(userId: string): Promise<Member | null> {
    return members.find((m) => m.id === userId) ?? null;
  },

  // -------------------------------------------------------------------------
  // TEA-02. 02-design.md section 3.
  // -------------------------------------------------------------------------

  // TEA-02 AC-1, AC-9.
  async getCurrentMember(): Promise<Member | null> {
    return members.find((m) => m.id === currentMemberId) ?? null;
  },

  /**
   * SOLO, 2026-09-10. Everybody waiting on a decision, newest first. Replaces `listAllowedEmails`.
   *
   * **NOT TEAM-SCOPED, WHICH IS UNLIKE EVERY OTHER LIST READ HERE**, and it reproduces
   * `member_select_pending_admin` rather than inventing a rule: that policy is
   * `is_admin(uid) and team_id is null and status <> 'approved'`. A pending person is on no team, so
   * there is nothing to scope by.
   *
   * A member gets an empty list rather than an error, the shape `listAllowedEmails` used, because a
   * policy that matches no rows is not a refusal.
   */
  async listPendingMembers(): Promise<Member[]> {
    if (!currentAdmin()) return [];
    return members
      .filter((m) => m.teamId === null && m.status === "pending")
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((m) => ({ ...m }));
  },

  /**
   * SOLO, 2026-09-10. Approve or reject one waiting sign-up.
   *
   * **THE TEAM WRITTEN IS THE CALLER'S OWN AND NEVER THE ONE THEY SENT**, which is this mock
   * reproducing `member_decide_admin`'s `with check`: it compares the incoming `team_id` to
   * `member_team_id(auth.uid())`, so a caller naming another team is refused rather than obeyed.
   * Checking it here rather than trusting the argument is what makes a component test fail against a
   * missing policy instead of passing against one.
   *
   * The `using` clause admits only rows that are still `pending` with no team, so re-deciding
   * somebody already on a team is refused — that is `member_update_admin`'s territory.
   */
  async decideMember(memberId: string, decision: MemberDecision): Promise<Result<void>> {
    const me = currentAdmin();
    if (!me) return refused("not_permitted", "Only an admin can decide a sign-up.");

    const target = members.find(
      (m) => m.id === memberId && m.teamId === null && m.status === "pending",
    );
    if (!target) return refused("not_permitted", "That sign-up is not waiting for a decision.");

    if (decision.approve && decision.teamId !== me.teamId) {
      return refused("not_permitted", "An admin can only admit somebody to their own team.");
    }

    if (decision.approve) {
      target.status = "approved";
      target.teamId = me.teamId;
    } else {
      target.status = "rejected";
      target.teamId = null;
    }
    return { ok: true, value: undefined };
  },

  // -------------------------------------------------------------------------
  // TEA-03. 02-design.md sections 1.2, 1.4 and 3.
  // -------------------------------------------------------------------------

  // TEA-03 AC-1, AC-2, AC-3, AC-4, AC-6, AC-7, AC-8.
  //
  // This reproduces the two POLICIES composing, not the screen (02-design.md section 3). Row-level
  // security policies are permissive and OR together (ADR-018), and `member_team_id` filters
  // `removed_at is null`, so there are three distinct answers and the middle one is the state
  // ADR-018 created on purpose:
  //
  //   no member row      -> []                     AC-6, AC-7
  //   a REMOVED caller   -> their own row only     `member_select_own` answers; the team policy
  //                                                does not, because member_team_id filtered them
  //                                                out. Collapsing this into [] would erase the
  //                                                difference between removed and never admitted.
  //   an active caller   -> their whole team, REMOVED MEMBERS INCLUDED
  //
  // The role is not consulted anywhere below, which is AC-3: an admin cannot receive a row or a
  // field a member does not, because there is no second policy and no branch on role.
  //
  // NO `removedAt` FILTER on the team answer. A mock that filtered would make every component test
  // pass against a seam that has already made INV-04 uncomputable, and MemberList.tsx's own filter
  // would hide the difference. ADR-013, and 02-design.md section 3, "Shape 1".
  async listMembers(): Promise<Member[]> {
    const me = members.find((m) => m.id === currentMemberId) ?? null;
    if (!me) return [];

    const rows =
      me.removedAt !== null
        ? [me]
        : members.filter((m) => m.teamId === me.teamId); // INV-07: the team boundary, and nothing else

    // AC-8. The same limit and the same raise as supabase.ts. This array is bounded by the fixtures
    // so it never fires; it is here so the two implementations tell one story rather than because
    // the mock can truncate.
    const bounded = rows.slice().sort(byCreatedAtThenId).slice(0, ROSTER_LIMIT);
    if (bounded.length >= ROSTER_LIMIT) {
      throw new Error(
        `listMembers returned ${bounded.length} rows at the ${ROSTER_LIMIT} limit: the roster may ` +
          `be truncated and must not be consumed (TEA-03 AC-8)`,
      );
    }

    return bounded;
  },

  // -------------------------------------------------------------------------
  // TEA-04. 01-plan.md section 5, "What the mock must reproduce".
  // -------------------------------------------------------------------------

  // TEA-04 AC-1, AC-3, AC-6, AC-9, AC-11, AC-12.
  //
  // This reproduces the POLICY AND THE TRIGGER, never the screen, and it matters more here than in
  // any earlier ticket because six of the fifteen criteria are refusals. A mock that let a member
  // remove somebody would make every component test pass against a missing policy, and the policy
  // is the entire feature.
  //
  // The order below is the datastore's, read from the outside: `member_update_admin`'s `using`
  // tests admin-and-own-team and a row failing it simply does not match (zero rows, which is a
  // refusal); then the trigger's clauses raise `42501`. Both arrive at the seam as
  // `not_permitted`, which is why they collapse to one code here (01-plan.md section 4.1).
  async removeMember(memberId: string): Promise<Result<Member>> {
    const me = currentAdmin();
    if (!me) return refused("not_permitted", "Only an admin can remove a member.");

    // `member_update_admin.using`, both halves - INV-07 is the team comparison and nothing else.
    // A row on another team and a row that does not exist are the same answer, because the policy
    // filters rather than errors and the caller learns nothing either way.
    const target = members.find((m) => m.id === memberId && m.teamId === me.teamId);
    if (!target) return refused("not_permitted", "That member could not be removed.");

    // AC-9, the trigger comparing `old.id` to `auth.uid()`.
    if (target.id === me.id) {
      return refused("not_permitted", "You cannot remove yourself from the team.");
    }

    // The trigger's one-way clause. Removal is not undone and not re-dated - restoring a member is
    // not a decided permission, and re-dating one is ADR-013's revert condition as an ordinary
    // write.
    if (target.removedAt !== null) {
      return refused("not_permitted", "That person has already left the team.");
    }

    // AC-3. The mock's own clock, standing for the trigger's `now()`. Nothing the caller passed can
    // reach this line, here or in the real seam.
    target.removedAt = new Date().toISOString();
    return { ok: true, value: { ...target } };
  },

  // TEA-04 AC-4, AC-5, AC-6, AC-10, AC-11, AC-12.
  //
  // ONE PLACE THIS MOCK IS DELIBERATELY STRICTER THAN THE DATASTORE, called out because it will
  // otherwise read as drift: promoting somebody who is already an admin updates zero columns in
  // PostgreSQL and returns the row unchanged, so the real seam sees one row back and reports
  // success. This refuses it. Neither behaviour is reachable from the interface - AC-13 draws no
  // promote control on an admin row - and the honest reading is that `promoteMember` has no meaning
  // for a row that is already admin. If this divergence is judged wrong at review, the correction is
  // to make THIS report success, not to add a policy clause: the datastore is the authority on what
  // the policy does, and there is nothing here to enforce.
  async promoteMember(memberId: string): Promise<Result<Member>> {
    const me = currentAdmin();
    if (!me) return refused("not_permitted", "Only an admin can promote a member.");

    const target = members.find((m) => m.id === memberId && m.teamId === me.teamId);
    if (!target) return refused("not_permitted", "That person could not be promoted.");

    if (target.role === "admin") {
      return refused("not_permitted", "That person is already an admin.");
    }

    // AC-10, the trigger. `is_admin` filters `removed_at is null`, so a promoted removed member
    // would hold a role that answers false everywhere - a row that says `admin` and behaves as
    // nobody.
    if (target.removedAt !== null) {
      return refused("not_permitted", "Someone who has left the team cannot be promoted.");
    }

    target.role = "admin";
    return { ok: true, value: { ...target } };
  },

  // -------------------------------------------------------------------------
  // SOLO 2026-09-10 — the profile screen's two writes.
  // -------------------------------------------------------------------------

  // **THE REFUSALS HERE REPRODUCE THE MIGRATION, NOT THE SCREEN**, which is the contract every other
  // function in this file keeps: a mock that accepted a blank name or a stranger's avatar would make
  // the screen's tests pass against a datastore that refuses both.
  //
  // `20260910093000_solo_profile_self_update.sql` is the authority for each branch below:
  //  - the row written is `auth.uid()`'s and no other — `member_update_own`'s `using` and the
  //    trigger clause that refuses these two columns on somebody else's row. There is no `memberId`
  //    parameter, so the mock has nothing to check here and neither does the type;
  //  - a removed member writes nothing — the same policy's `removed_at is null`;
  //  - a blank display name is refused by the trigger, which trims and then raises;
  //  - an avatar outside `AVATAR_CHOICES` is refused by the `member_avatar_is_offered` check.
  async updateOwnProfile(input: UpdateOwnProfileInput): Promise<Result<Member>> {
    const me = members.find((m) => m.id === currentMemberId) ?? null;
    if (!me || me.removedAt !== null) {
      return refused("not_permitted", "Your profile could not be saved.");
    }

    // Trimmed HERE and stored trimmed, exactly as the trigger's `btrim` does it. A mock that stored
    // the untrimmed string would disagree with the datastore about what was saved, one space at a
    // time, and the disagreement would surface as a roster that renders differently after a reload.
    const displayName = input.displayName.trim();
    if (displayName.length === 0) {
      return {
        ok: false,
        error: { code: "invalid_display_name", message: "Enter a display name." },
      };
    }
    // NO UPPER BOUND, and its absence is deliberate. `member.display_name` is `text not null` with
    // no check constraint (`20260831150024_tea01_membership.sql:34`), `.ai/standards/data-model.md`
    // records no limit, and sign-up imposes none — so a cap invented here would be a rule the
    // datastore does not hold and the OTHER screen that writes this column does not apply. The
    // `invalid_display_name` code covers blank only, which is what the trigger actually raises.

    // **OR THE ONE THEY ALREADY HAVE, AND THE SECOND CLAUSE IS NOT A COURTESY.** Rows exist whose
    // avatar was never chosen from this picker: `supabase/seed.sql:170` holds `⭐` for the
    // operator's own admin account, and TEA-01's admission trigger writes `'🙂'` when sign-up
    // carries no avatar. Without this clause, everyone holding such a value is refused on every
    // save — including a save that only changes their display name — with a message telling them to
    // choose an avatar they had not touched. The rule is *keep what you have, or take one that is
    // offered*, and it is the same rule in `supabase.ts`.
    if (input.avatar !== me.avatar && !AVATAR_CHOICES.includes(input.avatar)) {
      return {
        ok: false,
        error: { code: "invalid_avatar", message: "Choose one of the avatars offered." },
      };
    }

    me.displayName = displayName;
    me.avatar = input.avatar;
    return { ok: true, value: { ...me } };
  },

  // **IT VERIFIES THE CURRENT PASSWORD, and that is the branch worth having a mock for.**
  // `supabase.auth.updateUser({ password })` verifies nothing — a live session is the whole of its
  // authorisation — so the check exists only because the real implementation performs it
  // deliberately. A mock that skipped it would let the screen's tests pass against an implementation
  // that had quietly dropped the re-authentication, which is the one failure this pair can hide.
  //
  // It is keyed on the SESSION and not on the member row: an account with no member row still has a
  // password, and changing it is not a team matter.
  async changePassword(input: ChangePasswordInput): Promise<Result<void>> {
    const session = currentSession;
    if (!session) {
      return refused("not_permitted", "Sign in again before changing your password.");
    }

    const account = accounts().find((c) => c.userId === session.user.id);
    if (!account) {
      return refused("not_permitted", "Your account could not be read.");
    }

    if (currentPasswordOf(account) !== input.currentPassword) {
      return {
        ok: false,
        error: { code: "wrong_password", message: "That is not your current password." },
      };
    }

    // The same threshold `signUp` above enforces and the same code, because it is the same
    // condition — GoTrue raises `weak_password` for both.
    if (input.newPassword.length < 6) {
      return {
        ok: false,
        error: {
          code: "weak_password",
          message: "That password is too weak. Please choose a longer one.",
        },
      };
    }

    passwordOverrides.set(account.userId, input.newPassword);
    return { ok: true, value: undefined };
  },

  // -------------------------------------------------------------------------
  // TEA-05. 01-plan.md section 5, "What the mock must reproduce".
  // -------------------------------------------------------------------------

  // TEA-05 AC-7. The session as it stands, or null.
  async getSession(): Promise<Session | null> {
    return currentSession ? { ...currentSession } : null;
  },

  // TEA-05 AC-6, AC-7, AC-8.
  //
  // EXPIRY IS NOT MODELLED, deliberately (01-plan.md section 5). AC-8 is the real client refreshing
  // a token and finally emitting with a null session; this mock has no clock and no token, and a
  // fake expiry would be a SECOND definition of when a session ends - one that drifts in the
  // direction that matters, where the mock says expired and the real client has quietly refreshed.
  // AC-8 is a real-project criterion and section 8.1 records it as one.
  onAuthStateChange(listener: (session: Session | null) => void): () => void {
    sessionListeners.add(listener);

    // **SOLO 2026-09-10 — IT EMITS ONCE ON SUBSCRIBE, BECAUSE THE REAL CLIENT DOES.** GoTrue calls
    // every new subscriber back with `INITIAL_SESSION` — the session if there is one, `null` if the
    // read failed — immediately after registering it, unconditionally
    // (`@supabase/auth-js@2.112.4/dist/module/GoTrueClient.js:3633-3644`, read on disk). Until this
    // ticket the mock did NOT, so `useSession` had to read once itself AND subscribe, and against
    // the real client that meant two `auth.getUser()` calls and two `member` selects on every mount.
    // Now one path serves both implementations, and the divergence that forced the second read is
    // gone.
    //
    // ASYNCHRONOUS, matching the real client, which emits from an async IIFE after awaiting its own
    // initialisation. A synchronous callback here would run inside the caller's `useEffect` before
    // the effect had returned its cleanup, which is a state update during an effect body rather than
    // after it — a shape React tolerates and nobody should rely on.
    //
    // The membership check is not a formality: a subscriber that unsubscribed inside the same tick —
    // which is exactly what React's StrictMode does on its throwaway first mount — must not be
    // called after its cleanup has run.
    queueMicrotask(() => {
      if (!sessionListeners.has(listener)) return;
      listener(currentSession ? { ...currentSession } : null);
    });

    return () => {
      sessionListeners.delete(listener);
    };
  },

  // TEA-05 AC-1, AC-2, AC-3, AC-4.
  //
  // This answers from FIXTURE_CREDENTIALS and from nothing else, so the mock's refusals are the
  // SEED's refusals rather than a second story about who can sign in. Reproducing the service, not
  // the screen: a mock that accepted any password would make every component test pass against a
  // sign-in that refuses nobody.
  //
  // The two refusals are in the order GoTrue answers them. An unknown address and a wrong password
  // are ONE answer with one message (AC-2) - anything else here would be an address-enumeration
  // oracle against the team roster. An unconfirmed address is a different answer (AC-3), because
  // folding it into the first would send somebody to reset a password that is correct.
  //
  // It writes NOTHING (AC-11). `members` is not touched on any path through this function, on
  // success or on either refusal, which is the mock reproducing the fact that `public.member` has
  // no insert policy and that the admission trigger fires on confirmation rather than on sign-in.
  //
  // CAL-02 adds one account to the list it searches, and adds it here rather than to
  // FIXTURE_CREDENTIALS itself so that a reader of TEA-05's array sees TEA-05's accounts. It has a
  // seed row like every other row in it.
  async signIn(input: SignInInput): Promise<Result<Session>> {
    const email = fold(input.email);
    // SOLO, 2026-09-10 — `signedUp` is third and last, so a seeded address always wins. A sign-up
    // that reused a fixture address must not shadow the fixture's password and quietly rewrite what
    // every other spec file's sign-in means.
    // SOLO, 2026-09-10 — the list moved into `accounts()` above, unchanged in order and in content,
    // because `changePassword` must find the caller by exactly the same rule.
    const account = accounts().find((c) => fold(c.email) === email);

    // `currentPasswordOf` and not `account.password`: a password changed on the profile screen is
    // held in `passwordOverrides` and the OLD one must stop working in the same call — which is the
    // only observable difference between a password that changed and one that did not.
    if (!account || currentPasswordOf(account) !== input.password) {
      return {
        ok: false,
        error: { code: "invalid_credentials", message: "That email or password is not correct." },
      };
    }

    if (!account.emailConfirmed) {
      return {
        ok: false,
        error: {
          code: "email_not_confirmed",
          message: "Open the confirmation link in your email before signing in.",
        },
      };
    }

    // AC-4's whole mechanism, and it needs no branch here: the session is established for the auth
    // user, and whether that user has a `member` row is `getCurrentMember`'s answer a moment later.
    // A mock that decided membership at sign-in would be deciding it in the wrong place.
    const session: Session = {
      user: { id: account.userId, email: account.email, emailConfirmed: true },
      accessToken: `mock-access-token-${account.userId}`,
    };
    setSession(session);
    return { ok: true, value: { ...session } };
  },

  // TEA-05 AC-6. Clears the session and notifies, which is what the listener in useSession re-
  // resolves against. It cannot fail here; the `Result` exists because it can fail in the real one.
  async signOut(): Promise<Result<void>> {
    setSession(null);
    return { ok: true, value: undefined };
  },

  // -------------------------------------------------------------------------
  // CAL-01. 01-plan.md section 5.
  // -------------------------------------------------------------------------

  // CAL-01 AC-1 ... AC-11.
  //
  // The refusals below reproduce the DATASTORE, not the screen: the policy's `with check`, the
  // withheld column grant, and INV-01's exclusion constraint. A mock that accepted an overlap would
  // make every component test pass against a missing constraint, which is the one failure a mock
  // seam can cause and not catch.
  //
  // AC-10 and AC-11 need no branch here and that is the point. `CreateEntryInput` carries neither a
  // `memberId` nor any decision column, so there is no value a caller could pass that this function
  // would have to refuse - the type is the affordance and the policy plus the grant are the control.
  // `memberId` comes from the current session and `status` is written as `pending` below.
  async createEntry(input: CreateEntryInput): Promise<Result<Entry>> {
    // AC-9, refused before anything else, exactly as the real seam refuses it before the round trip.
    if (input.endDate < input.startDate) {
      return {
        ok: false,
        error: {
          code: "invalid_date_range",
          message: "The end date must be the same as, or after, the start date.",
        },
      };
    }

    // The insert policy, reproduced: an entry belongs to a member row, and a caller with no session
    // or no member row has none. INV-07 is the not-null reference behind that.
    const me = members.find((m) => m.id === currentMemberId && m.removedAt === null) ?? null;
    if (!me) {
      return {
        ok: false,
        error: { code: "entry_not_permitted", message: "This entry could not be created." },
      };
    }

    // AC-7 and AC-8, and the pair is the test: AC-7 asserts the refusal and AC-8 asserts it is not
    // over-broad.
    const clash = entries.some(
      (e) =>
        e.memberId === me.id && datesIntersect(e, input) && slotsIntersect(e.portion, input.portion),
    );
    if (clash) {
      return {
        ok: false,
        error: {
          code: "overlapping_entry",
          message:
            "You already have an entry covering these dates and this portion. " +
            "Edit the existing entry, or choose a different range.",
        },
      };
    }

    const now = new Date().toISOString();
    const row: Entry = {
      id: newEntryId(),
      memberId: me.id,
      type: input.type,
      portion: input.portion,
      startDate: input.startDate,
      endDate: input.endDate, // AC-2 and AC-3: ONE row spanning the range, end inclusive
      tentative: input.tentative,
      // AC-6 and AC-11. `status` is the column default and never the caller's, and `tentative` does
      // not touch it - glossary.md keeps the two axes apart deliberately.
      status: "pending",
      rejectionReason: null,
      note: input.note,
      approvedBy: null,
      approvedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    entries.push(row);
    return { ok: true, value: { ...row } };
  },

  // CAL-01 AC-1, AC-2, AC-3, AC-5, AC-6, AC-8. Newest start date first, then id ascending - the same
  // two-key ordering the real implementation asks PostgreSQL for, so the two cannot disagree about
  // row order when two entries share a start date.
  //
  // An empty array is a normal answer: it is what a caller with no session gets, and it is what a
  // member with no entries gets.
  async listOwnEntries(): Promise<Entry[]> {
    if (!currentMemberId) return [];
    return entries
      .filter((e) => e.memberId === currentMemberId)
      .slice()
      .sort((a, b) =>
        a.startDate === b.startDate
          ? a.id.localeCompare(b.id)
          : b.startDate.localeCompare(a.startDate),
      )
      .map((e) => ({ ...e }));
  },

  // -------------------------------------------------------------------------
  // CAL-02. 01-plan.md sections 4.1 and 5.
  // -------------------------------------------------------------------------

  // CAL-02 AC-1, AC-2, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12.
  //
  // The refusals below reproduce the DATASTORE, not the screen: `entry_update_own`'s `using` clause,
  // the update grant's column list, INV-01's exclusion constraint and INV-02's trigger. Three of the
  // four are a SECOND IMPLEMENTATION of a mechanism that lives in PostgreSQL, and that is acceptable
  // only because the mock is not a datastore anybody's data lives in - BUG-001 pinned the acceptance
  // suite to this implementation, so this is what AC-5 to AC-9 are observed against.
  //
  // THE OWNER COMPARISON IS THE ONE THAT MATTERS. A mock that edited any id it was handed would pass
  // seam parity, pass every happy path, and leave AC-9 untestable - 01-plan.md section 5 names this
  // as the subtle shape of this ticket. The real mechanism is the policy; this is its stand-in.
  //
  // AC-8 and AC-10 need no branch here, exactly as CAL-01's `createEntry` needs none:
  // `UpdateEntryInput` carries no `memberId`, no `status` and no `rejectionReason`, so there is no
  // value a caller could pass that this function would have to refuse. The type is the affordance;
  // the withheld column privileges are the control.
  async updateEntry(entryId: string, input: UpdateEntryInput): Promise<Result<Entry>> {
    // AC-11, refused before anything else, exactly as the real seam refuses it before the round trip.
    if (input.endDate < input.startDate) {
      return {
        ok: false,
        error: {
          code: "invalid_date_range",
          message: "The end date must be the same as, or after, the start date.",
        },
      };
    }

    const me = members.find((m) => m.id === currentMemberId && m.removedAt === null) ?? null;
    if (!me) {
      return {
        ok: false,
        error: { code: "entry_not_permitted", message: "This entry could not be edited." },
      };
    }

    // AC-9, and the two cases are DELIBERATELY ONE ANSWER: "this entry is not yours" and "no such
    // entry" are indistinguishable under the policy and must stay so here, or the mock becomes an
    // oracle for which entry ids exist in the team while the real seam is not one.
    //
    // CAL-03 AC-1, AC-5, AC-8. The `||` is the two PERMISSIVE policies composing, which is what
    // PostgreSQL does by its own rule: `entry_update_own` admits the caller's own rows and
    // `entry_update_admin` admits their team's rows when the caller is an admin, and a caller gets
    // the union. CAL-02's half is `ownsEntry` and is untouched — an implementation that replaced it
    // with a single merged predicate would be the rejected alternative 1 of 01-plan.md section 8,
    // one layer up.
    //
    // CAL-03 AC-3's `entry_not_permitted` still covers "not yours", "no such entry" AND now
    // "another team's" alike, and must keep doing so. A distinct answer for the cross-team case
    // would tell an admin that an id exists in a team they cannot read.
    const row =
      entries.find((e) => e.id === entryId && (ownsEntry(me, e) || adminMayReach(me, e))) ?? null;
    if (!row) {
      return {
        ok: false,
        error: { code: "entry_not_permitted", message: "This entry could not be edited." },
      };
    }

    // AC-7. INV-01 reached on UPDATE, which is what a constraint over (member_id, date_range,
    // portion_slots) does without being told: the row being edited is EXCLUDED from the comparison,
    // because an entry cannot clash with itself.
    //
    // CAL-03 AC-9, AND THE COMPARISON KEYS ON `row.memberId` RATHER THAN ON `me.id`. That was the
    // same value through CAL-02, because the only editable row was the caller's own; it stops being
    // the same value the moment an admin edits somebody else's. `entry_no_overlapping_portion` keys
    // on the ROW's `member_id`, so an admin's edit collides with THAT MEMBER's other entries and
    // never with the admin's own — and this is the line an implementation written from the admin's
    // point of view gets wrong, in both directions at once: it would refuse an edit that clashes
    // with the ADMIN's calendar and accept one that double-books the OWNER.
    const clash = entries.some(
      (e) =>
        e.id !== row.id &&
        e.memberId === row.memberId &&
        datesIntersect(e, input) &&
        slotsIntersect(e.portion, input.portion),
    );
    if (clash) {
      return {
        ok: false,
        error: {
          code: "overlapping_entry",
          message:
            "You already have an entry covering these dates and this portion. " +
            "Edit the existing entry, or choose a different range.",
        },
      };
    }

    // INV-02, reproduced. THIS IS A SECOND IMPLEMENTATION OF AN INVARIANT: the real mechanism is
    // `public.entry_enforce_decision()` (ADR-016 clause (c), shipped by CAL-01), and the four lines
    // it writes are the four written below.
    //
    // The comparison is against the row as it stands, which is the trigger's OLD, and the carve-out
    // is data-model.md's: dates, type, portion and tentative are substantive, `note` alone is not
    // (AC-6). It is ACTOR-BLIND, as the trigger is - an admin editing their own approved entry loses
    // the approval exactly as a member does (01-plan.md Open questions item 3).
    const substantive =
      input.startDate !== row.startDate ||
      input.endDate !== row.endDate ||
      input.type !== row.type ||
      input.portion !== row.portion ||
      input.tentative !== row.tentative;

    if (substantive && row.status !== "pending") {
      row.status = "pending";
      row.approvedBy = null;
      row.approvedAt = null;
      // Forced rather than chosen: `entry_rejection_reason_iff_rejected` refuses any transition off
      // `rejected` that leaves the reason standing (INV-03).
      row.rejectionReason = null;
    }

    row.type = input.type;
    row.portion = input.portion;
    row.startDate = input.startDate;
    row.endDate = input.endDate;
    row.tentative = input.tentative;
    row.note = input.note;
    // AC-12. In the real datastore this line is the trigger's `new.updated_at := now()`, added to
    // `entry_enforce_decision()` by this ticket's migration - never the client's clock. Here there
    // is no clock but this one, and the value is the mock's stand-in for the datastore's.
    row.updatedAt = new Date().toISOString();

    return { ok: true, value: { ...row } };
  },

  // CAL-02 AC-3, AC-4, AC-9. A HARD delete: the row leaves the array and its `approvedBy` leaves
  // with it, and the dates it held are free for INV-01's next comparison (AC-4) because nothing
  // remains to intersect.
  //
  // The owner comparison is the policy's `using (member_id = auth.uid())`, and zero rows removed is
  // `entry_not_permitted` and not success - the shape the real implementation reads off the deleted
  // representation it asks for.
  //
  // CAL-03 AC-2, AC-5, AC-8, AC-12. The same `||` as `updateEntry` above, standing for the same two
  // permissive policies — `entry_delete_own` and `entry_delete_admin`. AC-12 needs no line of its
  // own: the row leaves the array carrying its `approvedBy` and `approvedAt` with it, because they
  // are fields OF the row and there is nothing left to refer to either.
  async deleteEntry(entryId: string): Promise<Result<void>> {
    const me = members.find((m) => m.id === currentMemberId && m.removedAt === null) ?? null;
    const index = me
      ? entries.findIndex((e) => e.id === entryId && (ownsEntry(me, e) || adminMayReach(me, e)))
      : -1;

    if (index === -1) {
      return {
        ok: false,
        error: { code: "entry_not_permitted", message: "This entry could not be deleted." },
      };
    }

    entries.splice(index, 1);
    return { ok: true, value: undefined };
  },

  // -------------------------------------------------------------------------
  // CAL-03. 01-plan.md sections 4.1 and 5.
  // -------------------------------------------------------------------------

  // CAL-03 AC-1, AC-2, AC-3, AC-4, AC-9, AC-10, AC-12. Newest start date first, then id ascending -
  // the same two-key ordering the real implementation asks PostgreSQL for, so the two cannot
  // disagree about row order when two entries share a start date. Across a whole team a shared start
  // date is the normal case rather than the edge one.
  //
  // THIS FUNCTION FILTERS BY TEAM AND THE REAL ONE DOES NOT, and that asymmetry is the subtle shape
  // 01-plan.md section 5 names. The real implementation issues an unfiltered select and is scoped by
  // `entry_select_team`; the mock has no policy, so the scope has to be written. A mock that returned
  // every entry it holds would pass seam parity, pass every happy path, and leave AC-8 UNTESTABLE
  // against the seam the acceptance suite actually drives - BUG-001 pinned that suite to this
  // implementation.
  //
  // `sameTeam` and not `===`: `member_team_id` is null for a removed member, and `null = null` is
  // NULL in SQL rather than true. So a removed member's entries are invisible here exactly as they
  // are there, and a removed caller reads none - which is the policy's answer and not a choice this
  // function makes.
  async listTeamEntries(): Promise<Entry[]> {
    const mine = memberTeamId(currentMemberId);

    const rows = entries
      .filter((e) => sameTeam(memberTeamId(e.memberId), mine))
      .slice()
      .sort((a, b) =>
        a.startDate === b.startDate
          ? a.id.localeCompare(b.id)
          : b.startDate.localeCompare(a.startDate),
      )
      .slice(0, TEAM_ENTRY_LIMIT);

    // The same limit and the same raise as supabase.ts, and the same reason as `listMembers`: this
    // array is bounded by the fixtures so it never fires, and it is here so the two implementations
    // tell one story rather than because the mock can truncate.
    if (rows.length >= TEAM_ENTRY_LIMIT) {
      throw new Error(
        `listTeamEntries returned ${rows.length} rows at the ${TEAM_ENTRY_LIMIT} limit: the list ` +
          `may be truncated and must not be consumed`,
      );
    }

    return rows.map((e) => ({ ...e }));
  },

  // -------------------------------------------------------------------------
  // CAL-04. 01-plan.md sections 4 and 5.
  //
  // NEITHER FUNCTION COUNTS ANYTHING. `absenceCountsFor` in ./absence.ts is INV-04's single
  // implementation and this file does not import it: with zero copies of the arithmetic in the seam
  // there is nothing for tests/seam-parity.test.ts to miss (01-plan.md section 5).
  // -------------------------------------------------------------------------

  // CAL-04 AC-7, AC-14. `team_select_own`, reproduced: `id = member_team_id(auth.uid())`.
  //
  // `memberTeamId` is null for a caller with no member row AND for a removed one, and `id = null` is
  // never true in SQL - so both read no team at all, which is the policy's answer and not a choice
  // this function makes. Null is a normal answer here for the same reason it is on
  // `getCurrentMember`: it is the NotOnATeam state and it already has a screen.
  //
  // THE OTHER TEAM'S ROW IS IN `teams` AND MUST NEVER COME BACK. A mock that returned the only row
  // it holds would pass every test a one-team fixture can carry while hiding a missing team
  // predicate - the failure ADR-018's revert condition names on `member`.
  async getTeam(): Promise<Team | null> {
    const mine = memberTeamId(currentMemberId);
    if (mine === null) return null;
    const row = teams.find((t) => t.id === mine);
    return row ? { ...row } : null;
  },

  // -------------------------------------------------------------------------
  // ADM-01. 01-plan.md sections 4.1 and 5.
  // -------------------------------------------------------------------------

  // ADM-01 AC-2, AC-5, AC-9, AC-12, AC-14.
  //
  // THIS REPRODUCES THE POLICY AND NOT THE SCREEN, for the reason `currentAdmin` above records: the
  // acceptance suite drives this seam (BUG-001 pins it, tests/e2e/seam.setup.ts), so a mock that let
  // a member through would make AC-4, AC-5 and AC-10 pass against nothing.
  //
  // `currentAdmin()` IS `team_update_admin`'s two predicates in one call. It already filters
  // `removedAt === null` and `role === "admin"`, so AC-14 is inherited here exactly as it is
  // inherited in SQL from `is_admin`'s own body - written once rather than twice.
  //
  // THE CALLER'S OWN TEAM ONLY, resolved through `memberTeamId` the way `getTeam` above does.
  // `FIXTURE_OTHER_TEAM` is in `teams` and must never be the row this writes: a mock that wrote the
  // only row it held would pass every test a one-team fixture can carry while hiding a missing team
  // predicate - the failure ADR-018's revert condition names, one table over.
  //
  // ONE FIELD IS ASSIGNED (AC-9). `name`, `id` and `createdAt` are untouched, which is the column
  // grant's effect reproduced: there is no path here that could write them.
  //
  // NO RANGE CHECK, matching supabase.ts. `[0, 100]` in whole percentage points is the SCREEN's
  // (AC-7, AC-8) and there is no `check` constraint behind the real one - 01-plan.md section 6.
  //
  // A COPY GOES BACK, never the stored object, so a caller cannot mutate the mock's table through
  // the value it was handed - the shape `getTeam` above already uses.
  async setOverloadThreshold(input: SetOverloadThresholdInput): Promise<Result<Team>> {
    const me = currentAdmin();
    if (!me) return refused("not_permitted", "Only an admin can change the threshold.");

    const row = teams.find((t) => t.id === memberTeamId(me.id));
    if (!row) return refused("not_permitted", "Could not save the threshold.");

    row.overloadThreshold = input.overloadThreshold;
    return { ok: true, value: { ...row } };
  },

  // CAL-04 AC-1 to AC-6, AC-11, AC-12.
  //
  // OVERLAP, NOT CONTAINMENT, and the comparison is the same predicate PostgreSQL evaluates for
  // `date_range=ov.[start,end]`: an entry running 2026-03-28 to 2026-04-02 comes back for April
  // because AC-2 draws its avatar on 1 and 2 April. Written as two string comparisons rather than
  // through a Date, exactly as `datesIntersect` above is - `yyyy-MM-dd` sorts lexicographically and
  // no Date is constructed anywhere in this file.
  //
  // REJECTED ROWS COME BACK. Filtering `status` here would put a second copy of INV-04's rule
  // outside `absenceCountsFor`, which is what INV-04 exists to prevent (AC-4).
  //
  // `sameTeam` and not `===`, for the reason `listTeamEntries` records: `member_team_id` is null for
  // a removed member and `null = null` is NULL in SQL rather than true, so a removed member's
  // entries are invisible here exactly as they are there.
  //
  // CAL-09 REPLACED THE CEILING WITH THE SAME ASSEMBLY supabase.ts runs, over the same order, so the
  // two implementations tell one story and the unit test can exercise the walk. The team filter, the
  // overlap predicate and the sort are unchanged; `.slice(0, MONTH_ENTRY_LIMIT)` and its raise are
  // gone, and `matching` is the filtered array's length.
  //
  // THE TEAM FILTER IS APPLIED TO THE WHOLE ARRAY BEFORE THE FIRST WINDOW IS TAKEN (INV-07, AC-9),
  // which is the mock's copy of `entry_select_team` filtering every request in the real one. A window
  // taken before the filter would page over another team's rows and then drop them, which reads as a
  // short page rather than as a scope error.
  async listTeamEntriesOverlapping(range: DateRange): Promise<Entry[]> {
    const mine = memberTeamId(currentMemberId);

    const matched = entries
      .filter((e) => sameTeam(memberTeamId(e.memberId), mine))
      .filter((e) => e.startDate <= range.end && e.endDate >= range.start)
      .slice()
      .sort((a, b) =>
        a.startDate === b.startDate
          ? a.id.localeCompare(b.id)
          : a.startDate.localeCompare(b.startDate),
      );

    const matching = matched.length;
    const assembled: Entry[] = [];
    const seen = new Set<string>();

    for (let request = 0; request < TEAM_ENTRY_MAX_PAGES; request += 1) {
      const from = assembled.length;
      const rows = matched.slice(from, from + TEAM_ENTRY_PAGE_SIZE);

      // The same two refusals as supabase.ts, and NEITHER CAN FIRE HERE: the count and the windows
      // come from one array, so a row cannot be skipped or repeated between them. They are written
      // because the two implementations must tell one story, not because the mock can truncate —
      // the same reason `listMembers` and `listTeamEntries` carry their raises.
      for (const row of rows) {
        if (seen.has(row.id)) {
          throw new Error(
            `listTeamEntriesOverlapping received entry ${row.id} twice across pages: the result is ` +
              `not a set and must not be counted (CAL-09 AC-6)`,
          );
        }
        seen.add(row.id);
        assembled.push(row);
      }

      if (assembled.length >= matching) break;
      if (rows.length === 0) break;
    }

    // AC-1, AC-5, AC-8. The bound IS reachable here, unlike the two refusals above: a fixture of more
    // than TEAM_ENTRY_PAGE_SIZE * TEAM_ENTRY_MAX_PAGES matching entries exhausts the loop and this
    // comparison throws rather than returning a short array.
    if (assembled.length !== matching) {
      throw new Error(
        `listTeamEntriesOverlapping assembled ${assembled.length} rows while ${matching} match: ` +
          `the range may be incomplete and must not be counted (CAL-09 AC-5)`,
      );
    }

    return assembled.map((e) => ({ ...e }));
  },

  // -------------------------------------------------------------------------
  // SOLO, 2026-09-11. The busy day.
  // -------------------------------------------------------------------------

  // `busy_day_select_team`, reproduced. The team filter is applied to the WHOLE array before the
  // first window is taken, which is the mock's copy of a policy filtering every request in the real
  // one — a window taken before the filter would page over another team's rows and then drop them,
  // which reads as a short page rather than as a scope error. `listTeamEntriesOverlapping` above
  // records the same reasoning at length.
  //
  // `sameTeam` and not `===`: `member_team_id` is null for a removed member and `null = null` is
  // NULL in SQL rather than true, so a removed member's marks are invisible here exactly as their
  // entries are.
  //
  // IT FILTERS NO MEMBER AND COUNTS NOTHING. `busyCountsFor` applies the removed-member rule, and it
  // is the only thing that may — the same division of labour `absenceCountsFor` has with this file.
  async listTeamBusyDaysOverlapping(range: DateRange): Promise<BusyDay[]> {
    const mine = memberTeamId(currentMemberId);

    const matched = busyDays
      .filter((b) => sameTeam(memberTeamId(b.memberId), mine))
      .filter((b) => b.date >= range.start && b.date <= range.end)
      .slice()
      .sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date)));

    const matching = matched.length;
    const assembled: BusyDay[] = [];
    const seen = new Set<string>();

    for (let request = 0; request < TEAM_ENTRY_MAX_PAGES; request += 1) {
      const from = assembled.length;
      const rows = matched.slice(from, from + TEAM_ENTRY_PAGE_SIZE);

      // The same two refusals supabase.ts carries, and NEITHER CAN FIRE HERE: the count and the
      // windows come from one array, so a row cannot be skipped or repeated between them. They are
      // written because the two implementations must tell one story, not because the mock can
      // truncate — the reason `listTeamEntriesOverlapping` gives for its own copies.
      for (const row of rows) {
        if (seen.has(row.id)) {
          throw new Error(
            `listTeamBusyDaysOverlapping received busy day ${row.id} twice across pages: the ` +
              `result is not a set and must not be counted`,
          );
        }
        seen.add(row.id);
        assembled.push(row);
      }

      if (assembled.length >= matching) break;
      if (rows.length === 0) break;
    }

    if (assembled.length !== matching) {
      throw new Error(
        `listTeamBusyDaysOverlapping assembled ${assembled.length} rows while ${matching} match: ` +
          `the range may be incomplete and must not be counted`,
      );
    }

    return assembled.map((b) => ({ ...b }));
  },

  // `busy_day_insert_own` and `busy_day_delete_own`, reproduced.
  //
  // ONE REFUSAL AND IT IS THE POLICY'S: a caller with no session, no member row, or a removed one
  // has nothing `auth.uid()` resolves to. `status` is not tested here for the same reason no other
  // mock write tests it — `member_team_id` is what gates approval in the real datastore, and the
  // mock's `memberTeamId` is that function.
  //
  // IDEMPOTENT IN BOTH DIRECTIONS, which is the contract `setOwnBusyDay` states and the reason the
  // real one can be a bare `upsert` and a bare `delete`: marking a marked day writes nothing and
  // succeeds, and unmarking an unmarked one deletes nothing and succeeds. A toggle whose next read
  // is the truth must not report "there was nothing there" as a failure.
  async setOwnBusyDay(input: SetOwnBusyDayInput): Promise<Result<void>> {
    const me = members.find((m) => m.id === currentMemberId && m.removedAt === null) ?? null;
    if (!me || memberTeamId(me.id) === null) {
      return {
        ok: false,
        error: { code: "busy_not_permitted", message: BUSY_DAY_REFUSED },
      };
    }

    const at = busyDays.findIndex((b) => b.memberId === me.id && b.date === input.date);

    if (input.busy) {
      // `unique (member_id, date)` reproduced. The constraint is the real mechanism; this exists so
      // a double press is observable end-to-end without a provisioned project.
      if (at === -1) {
        busyDays.push({
          id: newBusyDayId(),
          memberId: me.id,
          date: input.date,
          createdAt: new Date().toISOString(),
        });
      }
    } else if (at !== -1) {
      busyDays.splice(at, 1);
    }

    return { ok: true, value: undefined };
  },

  // -------------------------------------------------------------------------
  // ADM-02. 01-plan.md sections 4.2, 4.3 and 5.
  // -------------------------------------------------------------------------

  // ADM-02 AC-1, AC-2, AC-4, AC-7, AC-12, AC-14.
  //
  // NO CALLER CHECK AND NO TEAM FILTER, and both absences are the POLICY reproduced rather than a
  // shortcut. `holiday_select_all` is `for select to authenticated using (true)`: it has no team
  // predicate and no role predicate, so a member, an admin and a signed-in caller with no member row
  // all read exactly the same rows (AC-2, AC-7, AC-14). Every other read in this file narrows by
  // `memberTeamId`; this one must not, and a reviewer should read that against the migration's own
  // comment.
  //
  // WHAT IS NOT REPRODUCED: the grant is `to authenticated`, so `anon` reads nothing (AC-6). The
  // mock has no anon role to be, and the application never reaches this screen without a session —
  // App.tsx sends a signed-out caller to `/`. The real control is the grant and it is exercised by
  // no test until a project is provisioned.
  //
  // THE SAME TWO STRING COMPARISONS supabase.ts issues as `gte`/`lte`, inclusive at both ends. No
  // Date is constructed anywhere in this file, and on this table that is load-bearing rather than
  // stylistic — ADR-015 Consequences: a weekday read west of UTC turns a Thursday holiday into a
  // Wednesday one and moves the bridge day.
  //
  // SORTED HERE, above the datastore, exactly as supabase.ts sorts in the query (AC-4).
  // tests/seam-parity.test.ts compares names and arity and not row order, so an unsorted mock is a
  // divergence it cannot see — which is why FIXTURE_HOLIDAYS is deliberately not in date order.
  async listHolidays(range: DateRange): Promise<Holiday[]> {
    const rows = holidays
      .filter((h) => h.date >= range.start && h.date <= range.end)
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, HOLIDAY_LIMIT);

    // AC-12. The same limit and the same raise as supabase.ts, and the same reason as every other
    // read here: this array is bounded by the fixtures so it never fires, and it exists so the two
    // implementations tell one story rather than because the mock can truncate.
    if (rows.length >= HOLIDAY_LIMIT) {
      throw new Error(
        `listHolidays returned ${rows.length} rows at the ${HOLIDAY_LIMIT} limit: the calendar may ` +
          `be truncated and must not be consumed (ADM-02 AC-12)`,
      );
    }

    return rows.map((h) => ({ ...h }));
  },

  // -------------------------------------------------------------------------
  // ADM-03. 01-plan.md sections 4.2, 4.3 and 5.
  //
  // THESE REPRODUCE THE POLICIES AND NOT THE SCREEN, for the reason `currentAdmin` above records and
  // ADM-01's `setOverloadThreshold` repeats: the acceptance suite drives this seam (BUG-001,
  // tests/e2e/seam.setup.ts), so a mock that let a member through would make AC-14, AC-15 and AC-16
  // pass against nothing at all.
  //
  // `currentAdmin()` IS ALL THREE POLICIES' WHOLE PREDICATE. It already filters `removedAt === null`
  // and `role === "admin"`, which is `public.is_admin` reproduced — AC-16 is inherited here exactly
  // as it is inherited in SQL from that function's own body, written once rather than three times.
  //
  // AND THERE IS NO TEAM CHECK, unlike every other write in this file. That absence is the policies
  // reproduced rather than a shortcut: `holiday` has no `team_id` and none of the three carries a
  // team conjunct (ADR-015 section 1, and the migration's own comment). A mock that scoped by team
  // would refuse `FIXTURE_OTHER_TEAM`'s admin where the datastore admits them, which would be a
  // second story about a national calendar rather than a stricter one.
  //
  // ALL THREE CHECK `unique (date)` BEFORE WRITING. That is the constraint ADM-02's migration
  // carries, reproduced here for the same reason INV-01's overlap check is reproduced above: it is a
  // second implementation of a datastore mechanism, acceptable only because the mock is not a
  // datastore anybody's data lives in, and it exists so AC-6 and AC-7 are observable end-to-end
  // without a provisioned project.
  // -------------------------------------------------------------------------

  // ADM-03 AC-1, AC-2, AC-4, AC-6, AC-15, AC-16.
  //
  // NO YEAR FILTER OF ANY KIND. A row may be added in any year, including one the screen is not
  // showing — the calendar is one table and `listHolidays` is what narrows a READ to a year. AC-4 is
  // the screen noticing afterwards, not this function refusing.
  //
  // A COPY GOES BACK, never the stored object, so a caller cannot write the mock's table through the
  // value it was handed — the shape every read here already uses.
  async addHoliday(input: AddHolidayInput): Promise<Result<Holiday>> {
    const me = currentAdmin();
    if (!me) return refused("not_permitted", HOLIDAY_ADD_REFUSED);

    // AC-6. `unique (date)` met by a person: the refusal names the date rather than reporting a
    // constraint, and it is checked against the WHOLE table and not the displayed year — which is
    // the reason 01-plan.md section 8 rejected doing this in the form.
    if (holidays.some((h) => h.date === input.date)) {
      return refused("holiday_date_taken", HOLIDAY_DATE_TAKEN);
    }

    const row: Holiday = {
      id: newHolidayId(),
      date: input.date,
      name: input.name,
      kind: input.kind,
      createdAt: new Date().toISOString(),
    };
    holidays.push(row);
    return { ok: true, value: { ...row } };
  },

  // ADM-03 AC-7, AC-8, AC-10, AC-15, AC-16.
  //
  // A MISSING ROW IS `not_permitted` AND NOT A DISTINCT ANSWER, which is the filtered UPDATE
  // reproduced: in the datastore a row the policy refuses and a row that does not exist are the same
  // empty body, and a mock that told them apart would be reporting something the real seam cannot
  // know.
  //
  // ONE ROW IS ASSIGNED, field by field (AC-10). There is no path here that touches another row, and
  // `id` and `createdAt` are untouched — the three writable columns and no more.
  async updateHoliday(holidayId: string, input: UpdateHolidayInput): Promise<Result<Holiday>> {
    const me = currentAdmin();
    if (!me) return refused("not_permitted", HOLIDAY_UPDATE_REFUSED);

    const row = holidays.find((h) => h.id === holidayId);
    if (!row) return refused("not_permitted", HOLIDAY_UPDATE_REFUSED);

    // AC-7. The same constraint and the same sentence as the add, and `h.id !== holidayId` is what
    // makes saving a row onto its OWN date an ordinary edit rather than a duplicate — the behaviour
    // `unique (date)` has in the datastore, where a row does not collide with itself.
    if (holidays.some((h) => h.id !== holidayId && h.date === input.date)) {
      return refused("holiday_date_taken", HOLIDAY_DATE_TAKEN);
    }

    row.date = input.date;
    row.name = input.name;
    row.kind = input.kind;
    return { ok: true, value: { ...row } };
  },

  // ADM-03 AC-11, AC-13, AC-15, AC-16. A HARD delete, matching supabase.ts: the row leaves the array
  // and there is no trash to restore it from (01-plan.md section 8).
  //
  // EXACTLY ONE ROW LEAVES (AC-13). `splice` at the found index and nothing else, so a delete cannot
  // reach a neighbour — the failure a filter-and-reassign would make possible if the predicate were
  // ever widened.
  async deleteHoliday(holidayId: string): Promise<Result<void>> {
    const me = currentAdmin();
    if (!me) return refused("not_permitted", HOLIDAY_DELETE_REFUSED);

    const at = holidays.findIndex((h) => h.id === holidayId);
    if (at < 0) return refused("not_permitted", HOLIDAY_DELETE_REFUSED);

    holidays.splice(at, 1);
    return { ok: true, value: undefined };
  },

  // -------------------------------------------------------------------------
  // ADM-04. 01-plan.md section 4.2.
  //
  // ONE READ AND NO WRITE. Nothing here sets `status`, `rejection_reason`, `approved_by` or
  // `approved_at` — those are ADM-05's and this ticket carries no approve control and no reject
  // control (AC-9).
  // -------------------------------------------------------------------------

  // ADM-04 AC-1 to AC-8, AC-11, AC-13.
  //
  // THIS FUNCTION FILTERS BY TEAM AND THE REAL ONE DOES NOT, the same asymmetry `listTeamEntries`
  // above records: the real implementation is scoped by `entry_select_team`, the mock has no policy
  // so the scope has to be written, and a mock that returned every entry it holds would pass seam
  // parity, pass every happy path, and leave AC-13 untestable against the seam the acceptance suite
  // actually drives (BUG-001 pinned that suite to this implementation).
  //
  // `sameTeam` and not `===`, for the reason that function records: `member_team_id` is null for a
  // removed member and `null = null` is NULL in SQL rather than true.
  //
  // THE ORDER IS WRITTEN TWICE, ONCE PER IMPLEMENTATION, AND `tests/seam-parity.test.ts` CANNOT SEE
  // A DIVERGENCE — it compares names and arity, not row order. That is the one duplication this
  // codebase otherwise refuses (`absence.ts` sorts above the seam precisely to avoid it), and paging
  // is what forces it: a page boundary needs a stable SERVER-side order, and an order applied after
  // the slice would reorder one page rather than the set. 01-plan.md section 2, Open questions item
  // 5 names it, and tests/pending-entries.test.ts asserts this copy.
  //
  // `start_date` ascending, then `created_at`, then `id`. Soonest-concerning first, because the
  // decision is wanted before the date arrives (01-plan.md section 8, rejected alternative 5); two
  // deterministic tiebreakers because a boundary that shuffles between requests either repeats a row
  // or drops one, and dropping one here is an entry nobody ever decides.
  async listPendingEntries(query: PendingEntryQuery): Promise<PendingEntryPage> {
    const mine = memberTeamId(currentMemberId);

    const matching = entries
      .filter((e) => sameTeam(memberTeamId(e.memberId), mine))
      .filter((e) => e.status === "pending")
      // `null` means both types (AC-8). 01-plan.md section 2, Open questions item 1: a WFH entry
      // goes through approval exactly as a PTO entry does, and the filter is what makes the volume
      // manageable if the operator's objection turns out to be noise rather than principle.
      .filter((e) => query.type === null || e.type === query.type)
      // AC-6 and AC-7. `yyyy-MM-dd` STRING comparison, which sorts lexicographically and carries no
      // timezone — the vocabulary `Entry.startDate`, `Holiday.date` and ./absence.ts all use. The
      // boundary is the CALLER's date and never a clock read here (AC-16).
      .filter((e) =>
        query.window === "upcoming"
          ? e.endDate >= query.today
          : query.window === "past"
            ? e.endDate < query.today
            : true,
      )
      .slice()
      .sort((a, b) =>
        a.startDate !== b.startDate
          ? a.startDate.localeCompare(b.startDate)
          : a.createdAt !== b.createdAt
            ? a.createdAt.localeCompare(b.createdAt)
            : a.id.localeCompare(b.id),
      );

    // AC-3. THE EXACT SIZE OF THE MATCHING SET, and it is NOT `rows.length` — here more than
    // anywhere, because in this implementation the two happen to agree on the last page and the
    // simplification would pass every test until a queue outgrew one page.
    const total = matching.length;

    const from = query.page * PENDING_PAGE_SIZE;
    const rows = matching.slice(from, from + PENDING_PAGE_SIZE);

    // AC-5. The assertion that replaces the ceiling every other read here uses, in the same words as
    // supabase.ts. It cannot fire in this implementation — the slice and the count come from one
    // array — and it is written anyway so the two tell one story, which is the reason every other
    // truncation raise in this file exists.
    if (rows.length < PENDING_PAGE_SIZE && from + rows.length < total) {
      throw new Error(
        `listPendingEntries returned ${rows.length} of ${PENDING_PAGE_SIZE} rows on page ` +
          `${query.page} while ${total} match: the page was shortened and must not be consumed, ` +
          `because a queue that comes back short reads as an empty queue (ADM-04 AC-5)`,
      );
    }

    return {
      rows: rows.map((e) => ({ ...e })),
      total,
      page: query.page,
      pageSize: PENDING_PAGE_SIZE,
    };
  },

  // -------------------------------------------------------------------------
  // ADM-05. 01-plan.md sections 4.2 and 5.
  //
  // TWO STEPS IN THIS ORDER, IN BOTH FUNCTIONS, AND THE ORDER IS THE DATASTORE'S: the POLICIES
  // filter the row first, and the TRIGGER runs on what survives. So a row the caller may not reach
  // at all answers `entry_not_permitted` (AC-16, AC-17), and a row they CAN reach but may not decide
  // answers `entry_decision_not_permitted` (AC-8, AC-9). Reversed, a member would learn that an
  // entry of another team exists, and an admin's cross-team refusal would name a permission rather
  // than a row.
  // -------------------------------------------------------------------------

  // ADM-05 AC-1, AC-4, AC-6, AC-7, AC-10, AC-16, AC-17.
  //
  // AC-10 needs no branch and that is the point: self-approval is PERMITTED
  // (rbac-and-security.md), so an admin's own entry reaches the row through `ownsEntry` and then
  // passes the guard because they are an admin. A carve-out here would be inventing a permission row.
  async approveEntry(entryId: string): Promise<Result<Entry>> {
    const me = members.find((m) => m.id === currentMemberId && m.removedAt === null) ?? null;
    if (!me) {
      return { ok: false, error: { code: "entry_not_permitted", message: APPROVE_REFUSED } };
    }

    // The two PERMISSIVE policies composing, exactly as `updateEntry` above composes them:
    // `entry_update_own` admits the caller's own rows and `entry_update_admin` their team's rows
    // when the caller is an admin. "Not yours", "no such entry" and "another team's" stay ONE
    // answer, or this file becomes an oracle for which entry ids exist in a team nobody may read.
    const row =
      entries.find((e) => e.id === entryId && (ownsEntry(me, e) || adminMayReach(me, e))) ?? null;
    if (!row) {
      return { ok: false, error: { code: "entry_not_permitted", message: APPROVE_REFUSED } };
    }

    return applyDecision(me, row, { status: "approved", rejectionReason: row.rejectionReason });
  },

  // ADM-05 AC-2, AC-3, AC-5, AC-9, AC-16, AC-17.
  //
  // AC-3 FIRST, before anything else, exactly as the real seam refuses it before the round trip and
  // as `createEntry` and `updateEntry` refuse an inverted range. `trim()` only DECIDES: the reason is
  // stored as the admin wrote it, because `entry_rejection_reason_iff_rejected` tests emptiness with
  // `btrim` and nothing else.
  //
  // AC-5 IS THIS FUNCTION ON AN ALREADY-REJECTED ROW. `status` and `rejectionReason` are written
  // together because INV-03's biconditional refuses either one alone, and re-wording a rejection
  // creates and destroys no approval — clause (b)'s `else` branch nulls two columns that are already
  // null.
  async rejectEntry(entryId: string, reason: string): Promise<Result<Entry>> {
    if (reason.trim() === "") {
      return { ok: false, error: { code: "rejection_reason_required", message: REASON_REQUIRED } };
    }

    const me = members.find((m) => m.id === currentMemberId && m.removedAt === null) ?? null;
    if (!me) {
      return { ok: false, error: { code: "entry_not_permitted", message: REJECT_REFUSED } };
    }

    const row =
      entries.find((e) => e.id === entryId && (ownsEntry(me, e) || adminMayReach(me, e))) ?? null;
    if (!row) {
      return { ok: false, error: { code: "entry_not_permitted", message: REJECT_REFUSED } };
    }

    return applyDecision(me, row, { status: "rejected", rejectionReason: reason });
  },

  // -------------------------------------------------------------------------
  // ADM-06. 01-plan.md sections 4.2 and 5.
  // -------------------------------------------------------------------------

  // ADM-06 AC-1 to AC-11, AC-18.
  //
  // IT REPRODUCES `public.reject_entries` PLUS THE TWO CONTROLS AROUND IT, which is the third thing
  // this file reproduces and is declared for the reason it already states for INV-01 and for clauses
  // (a) and (b): the mock is not a datastore anybody's data lives in, the real mechanisms are the
  // policy and the trigger, and this exists so AC-5, AC-7, AC-8 and AC-11 are observable end to end
  // with no provisioned project. What it proves is THE SENTENCE and the arithmetic; the refusal is
  // clause (a)'s and is verified the day a project exists (01-plan.md section 3).
  //
  // THE ORDER IS THE DATASTORE'S: reason, then selection, then the policy filter, then the guard,
  // then the write. Reversed anywhere it stops modelling the thing it is modelling.
  //
  // ATOMIC ON FAILURE (AC-7): the guard is evaluated over the WHOLE admitted set before a single row
  // is written, so a refusal leaves every entry exactly as it was. Nothing here writes as it goes.
  async rejectEntries(entryIds: string[], reason: string): Promise<Result<BulkRejectionOutcome>> {
    // AC-3 FIRST, exactly as `rejectEntry` above refuses it and as the real seam refuses it before
    // the round trip. `trim()` only DECIDES: the reason is stored as the admin wrote it.
    if (reason.trim() === "") {
      return { ok: false, error: { code: "rejection_reason_required", message: REASON_REQUIRED } };
    }

    // AC-6. De-duplicated HERE rather than left to `= any(p_ids)`, which collapses them silently:
    // `requested` must be a number the returned count can be compared against.
    const ids = [...new Set(entryIds)];

    // AC-4. A refusal and not a no-op — an empty batch reporting `{ requested: 0, rejected: 0 }`
    // would be ok:true on a write that never happened.
    if (ids.length === 0) {
      return { ok: false, error: { code: "no_entries_selected", message: NOTHING_SELECTED } };
    }

    const me = members.find((m) => m.id === currentMemberId && m.removedAt === null) ?? null;
    if (!me) {
      return { ok: false, error: { code: "entry_not_permitted", message: BULK_REJECT_REFUSED } };
    }

    // The two PERMISSIVE policies composing, exactly as `approveEntry` and `rejectEntry` compose
    // them. A row neither admits is FILTERED — dropped from the set and counted out — and is never an
    // error (AC-11). An id that names no entry at all is filtered by the same expression, which is
    // what `= any(p_ids)` does in PostgreSQL: it matches rows, it does not resolve ids.
    const admitted = ids
      .map((id) => entries.find((e) => e.id === id && (ownsEntry(me, e) || adminMayReach(me, e))))
      .filter((e): e is Entry => e !== undefined);

    // Clause (a), over the whole admitted set and BEFORE any write. A rejection moves `status` or
    // `rejection_reason` on every row it touches, so a non-admin is refused for the batch as a whole
    // — which is what one statement and one transaction means (AC-7, AC-8). The condition is "a
    // decision column MOVES" and not "an admin is acting", for `applyDecision`'s reason: an admin
    // re-rejecting with the identical wording moves nothing and would pass the guard in PostgreSQL.
    const moves = admitted.some((e) => e.status !== "rejected" || e.rejectionReason !== reason);
    if (moves && !(me.role === "admin" && me.removedAt === null)) {
      return {
        ok: false,
        error: { code: "entry_decision_not_permitted", message: DECISION_REFUSED },
      };
    }

    // The write, through the SAME function the single path uses, so clause (b)'s nulling of
    // `approved_by` and `approved_at` is written once in this file rather than twice (AC-9).
    for (const row of admitted) {
      applyDecision(me, row, { status: "rejected", rejectionReason: reason });
    }

    // AC-18. `rejected` is the number of rows that were actually changed and `requested` the number
    // of distinct ids asked for. The two are separate numbers even when they are equal.
    return { ok: true, value: { requested: ids.length, rejected: admitted.length } };
  },
};
