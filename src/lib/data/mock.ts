// The in-memory implementation. Component tests run against this.
// Parity with supabase.ts is asserted by the seam-parity test, not by convention.
//
// It reproduces the TRIGGER's behaviour, not the interface's (02-design.md section 3): an
// allow-listed address gets a member row and consumes the entry, an unlisted or already-consumed one
// succeeds and creates nothing. A mock that always created a member would make every component test
// pass against a broken trigger, which is the one failure a mock seam can cause and not catch.
import type {
  AddAllowedEmailInput,
  CreateEntryInput,
  DataSeam,
  SetOverloadThresholdInput,
  SignInInput,
  SignUpInput,
  SignUpOutcome,
  UpdateEntryInput,
} from "./index";
import type {
  AllowedEmail,
  DateRange,
  Entry,
  EntryPortion,
  Member,
  Result,
  Session,
  Team,
} from "../domain/types";
// TEA-03, and CAL-04 for the third. RUNTIME imports, not type ones - 02-design.md section 1.1.
import { MONTH_ENTRY_LIMIT, ROSTER_LIMIT, TEAM_ENTRY_LIMIT } from "../domain/types";
import {
  FIXTURE_ADMIN,
  FIXTURE_ALLOWED_EMAIL,
  FIXTURE_APPROVED_ENTRY,
  FIXTURE_APPROVED_MEMBER,
  FIXTURE_APPROVED_MEMBER_CREDENTIAL,
  FIXTURE_CONSUMED_EMAIL,
  FIXTURE_CREDENTIALS,
  FIXTURE_MEMBER,
  FIXTURE_OTHER_TEAM,
  FIXTURE_OTHER_TEAM_ENTRY,
  FIXTURE_OTHER_TEAM_MEMBER,
  FIXTURE_REMOVED_MEMBER,
  FIXTURE_SECOND_ADMIN,
  FIXTURE_TEAM,
} from "../fixtures";

// 02-design.md section 1.1 promotes this row shape to a domain type, so the local interface that
// stood here is now that type. The alias keeps the name the rest of this file already uses and
// removes the second copy - two structurally identical declarations are two things to keep true.
type AllowedEmailRow = AllowedEmail;

// AC-4: `allowed_email.email` is citext in the migration, so the database compares without regard to
// case. The mock has no citext, so it folds on the way in and on the way out — same behaviour, and
// the fold is in one place so it cannot drift between the two lookups.
const fold = (email: string): string => email.trim().toLowerCase();

const SEEDED_AT = FIXTURE_ADMIN.createdAt;

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

const allowedEmails: AllowedEmailRow[] = [
  {
    email: fold(FIXTURE_ALLOWED_EMAIL),
    teamId: FIXTURE_TEAM.id,
    addedBy: FIXTURE_ADMIN.id,
    addedAt: SEEDED_AT,
    consumedAt: null,
  },
  {
    email: fold(FIXTURE_CONSUMED_EMAIL),
    teamId: FIXTURE_TEAM.id,
    addedBy: FIXTURE_ADMIN.id,
    addedAt: SEEDED_AT,
    consumedAt: SEEDED_AT,
  },
];

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

const refused = (
  code: "not_permitted" | "already_allow_listed" | "already_consumed",
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
        error: { code: "weak_password", message: "Mật khẩu quá yếu. Đặt dài hơn giúp mình nhé." },
      };
    }

    const userId = newUserId();
    const now = new Date().toISOString();

    // AC-2 and AC-3 in one step, as the trigger does it in one UPDATE ... RETURNING: only an entry
    // that is still unconsumed admits anybody, and claiming it and creating the row happen together.
    const entry = allowedEmails.find((a) => a.email === fold(input.email) && a.consumedAt === null);

    if (entry) {
      entry.consumedAt = now;
      members.push({
        id: userId,
        teamId: entry.teamId, // INV-07: the team comes from the entry and from nowhere else
        displayName: input.displayName,
        avatar: input.avatar,
        role: "member", // AC-9. Never from anything the caller supplied.
        removedAt: null,
        createdAt: now, // AC-2: the same instant as consumedAt
      });
    }

    // AC-7 requires Confirm email on, and under that setting signUp returns no session. The mock
    // models that setting because it is the one the product is specified against.
    return { ok: true, value: { needsEmailConfirmation: true, session: null } };
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

  // TEA-02 AC-1, AC-8. `allowed_email_select_admin` gives a member no rows rather than an error, so
  // this returns an empty list and not a failure. Newest first.
  async listAllowedEmails(): Promise<AllowedEmail[]> {
    const me = currentAdmin();
    if (!me) return [];
    return allowedEmails
      .filter((a) => a.teamId === me.teamId)
      .slice()
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  },

  // TEA-02 AC-2, AC-4, AC-5.
  //
  // `team_id` and `added_by` come from the caller's own member row and from nowhere else, which is
  // what the policy's `with check` re-derives and refuses a mismatch on. There is no parameter here
  // that could name another team, so AC-4 has no path through any client this repository builds.
  async addAllowedEmail(input: AddAllowedEmailInput): Promise<Result<AllowedEmail>> {
    const me = currentAdmin();
    if (!me) return refused("not_permitted", "Chỉ quản trị viên mới thêm được địa chỉ.");

    const email = fold(input.email);

    // AC-5. `email` is the PRIMARY KEY and citext, so the clash is global rather than per-team —
    // an address already allowed on another team collides too. The real datastore raises 23505 for
    // exactly this, and matching it here is what keeps the two implementations telling one story.
    if (allowedEmails.some((a) => a.email === email)) {
      return refused("already_allow_listed", "Địa chỉ này đã có trong danh sách rồi.");
    }

    const row: AllowedEmailRow = {
      email,
      teamId: me.teamId, // INV-07: this is where the joiner's team is fixed
      addedBy: me.id,
      addedAt: new Date().toISOString(),
      consumedAt: null,
    };
    allowedEmails.push(row);
    return { ok: true, value: { ...row } };
  },

  // TEA-02 AC-6, AC-7, AC-8.
  //
  // The order of the three refusals is the policy's, read from the outside: the delete's `using`
  // clause tests admin, then team, then `consumed_at is null`, so a row that fails any of them
  // simply does not match and the statement removes nothing. Zero rows removed is NOT success —
  // 02-design.md section 3 — and the follow-up read is what tells "yours, already used" apart from
  // "not yours at all", because the two are different sentences on screen.
  async removeAllowedEmail(email: string): Promise<Result<void>> {
    const me = currentAdmin();
    if (!me) return refused("not_permitted", "Chỉ quản trị viên mới gỡ được địa chỉ.");

    const folded = fold(email);
    const index = allowedEmails.findIndex((a) => a.email === folded && a.teamId === me.teamId);
    const row = index === -1 ? undefined : allowedEmails[index];

    if (!row) return refused("not_permitted", "Không tìm thấy địa chỉ này trong danh sách.");

    // AC-7. `added_by` is the only provenance for who let somebody in
    // (.ai/standards/data-model.md), and this is the refusal that keeps it.
    if (row.consumedAt !== null) {
      return refused("already_consumed", "Địa chỉ này đã có người dùng để vào nhóm, không gỡ được.");
    }

    allowedEmails.splice(index, 1);
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
    if (!me) return refused("not_permitted", "Chỉ quản trị viên mới gỡ được thành viên.");

    // `member_update_admin.using`, both halves - INV-07 is the team comparison and nothing else.
    // A row on another team and a row that does not exist are the same answer, because the policy
    // filters rather than errors and the caller learns nothing either way.
    const target = members.find((m) => m.id === memberId && m.teamId === me.teamId);
    if (!target) return refused("not_permitted", "Không gỡ được thành viên này.");

    // AC-9, the trigger comparing `old.id` to `auth.uid()`.
    if (target.id === me.id) {
      return refused("not_permitted", "Bạn không thể tự gỡ mình khỏi nhóm.");
    }

    // The trigger's one-way clause. Removal is not undone and not re-dated - restoring a member is
    // not a decided permission, and re-dating one is ADR-013's revert condition as an ordinary
    // write.
    if (target.removedAt !== null) {
      return refused("not_permitted", "Người này đã rời nhóm rồi.");
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
    if (!me) return refused("not_permitted", "Chỉ quản trị viên mới thăng quyền được.");

    const target = members.find((m) => m.id === memberId && m.teamId === me.teamId);
    if (!target) return refused("not_permitted", "Không thăng quyền cho người này được.");

    if (target.role === "admin") {
      return refused("not_permitted", "Người này đã là quản trị viên rồi.");
    }

    // AC-10, the trigger. `is_admin` filters `removed_at is null`, so a promoted removed member
    // would hold a role that answers false everywhere - a row that says `admin` and behaves as
    // nobody.
    if (target.removedAt !== null) {
      return refused("not_permitted", "Người đã rời nhóm thì không thăng quyền được.");
    }

    target.role = "admin";
    return { ok: true, value: { ...target } };
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
    const account = [...FIXTURE_CREDENTIALS, FIXTURE_APPROVED_MEMBER_CREDENTIAL].find(
      (c) => fold(c.email) === email,
    );

    if (!account || account.password !== input.password) {
      return {
        ok: false,
        error: { code: "invalid_credentials", message: "Email hoặc mật khẩu không đúng." },
      };
    }

    if (!account.emailConfirmed) {
      return {
        ok: false,
        error: {
          code: "email_not_confirmed",
          message: "Bạn cần mở liên kết xác nhận trong email trước khi đăng nhập.",
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
          message: "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.",
        },
      };
    }

    // The insert policy, reproduced: an entry belongs to a member row, and a caller with no session
    // or no member row has none. INV-07 is the not-null reference behind that.
    const me = members.find((m) => m.id === currentMemberId && m.removedAt === null) ?? null;
    if (!me) {
      return {
        ok: false,
        error: { code: "entry_not_permitted", message: "Không thể tạo đăng ký này." },
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
            "Bạn đã có một đăng ký trùng với khoảng ngày và buổi này. " +
            "Hãy sửa đăng ký cũ hoặc chọn khoảng khác.",
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
          message: "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.",
        },
      };
    }

    const me = members.find((m) => m.id === currentMemberId && m.removedAt === null) ?? null;
    if (!me) {
      return {
        ok: false,
        error: { code: "entry_not_permitted", message: "Không sửa được đăng ký này." },
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
        error: { code: "entry_not_permitted", message: "Không sửa được đăng ký này." },
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
            "Bạn đã có một đăng ký trùng với khoảng ngày và buổi này. " +
            "Hãy sửa đăng ký cũ hoặc chọn khoảng khác.",
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
        error: { code: "entry_not_permitted", message: "Không xoá được đăng ký này." },
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
  async listTeamEntriesOverlapping(range: DateRange): Promise<Entry[]> {
    const mine = memberTeamId(currentMemberId);

    const rows = entries
      .filter((e) => sameTeam(memberTeamId(e.memberId), mine))
      .filter((e) => e.startDate <= range.end && e.endDate >= range.start)
      .slice()
      .sort((a, b) =>
        a.startDate === b.startDate
          ? a.id.localeCompare(b.id)
          : a.startDate.localeCompare(b.startDate),
      )
      .slice(0, MONTH_ENTRY_LIMIT);

    // AC-11. The same limit and the same raise as supabase.ts, and the same reason as `listMembers`
    // and `listTeamEntries`: this array is bounded by the fixtures so it never fires, and it is here
    // so the two implementations tell one story rather than because the mock can truncate.
    if (rows.length >= MONTH_ENTRY_LIMIT) {
      throw new Error(
        `listTeamEntriesOverlapping returned ${rows.length} rows at the ${MONTH_ENTRY_LIMIT} ` +
          `limit: the month may be truncated and must not be counted (CAL-04 AC-11)`,
      );
    }

    return rows.map((e) => ({ ...e }));
  },
};
