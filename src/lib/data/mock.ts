// The in-memory implementation. Component tests run against this.
// Parity with supabase.ts is asserted by the seam-parity test, not by convention.
//
// It reproduces the TRIGGER's behaviour, not the interface's (02-design.md section 3): an
// allow-listed address gets a member row and consumes the entry, an unlisted or already-consumed one
// succeeds and creates nothing. A mock that always created a member would make every component test
// pass against a broken trigger, which is the one failure a mock seam can cause and not catch.
import type {
  AddAllowedEmailInput,
  DataSeam,
  SignInInput,
  SignUpInput,
  SignUpOutcome,
} from "./index";
import type { AllowedEmail, Member, Result, Session } from "../domain/types";
// TEA-03. A RUNTIME import, not a type one - 02-design.md section 1.1.
import { ROSTER_LIMIT } from "../domain/types";
import {
  FIXTURE_ADMIN,
  FIXTURE_ALLOWED_EMAIL,
  FIXTURE_CONSUMED_EMAIL,
  FIXTURE_CREDENTIALS,
  FIXTURE_MEMBER,
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
const members: Member[] = [
  { ...FIXTURE_ADMIN },
  { ...FIXTURE_MEMBER },
  { ...FIXTURE_SECOND_ADMIN },
  { ...FIXTURE_OTHER_TEAM_MEMBER },
  { ...FIXTURE_REMOVED_MEMBER },
];

// TEA-03, 02-design.md section 1.4. `createdAt` ascending, then `id` ascending. The id tiebreaker is
// not decoration: FIXTURE_ADMIN, FIXTURE_MEMBER and FIXTURE_REMOVED_MEMBER share a `createdAt`
// literal, so `createdAt` alone leaves their order dependent on insertion order here and on physical
// row order in PostgreSQL - two implementations that disagree about order fail nothing and produce a
// flaky test.
const byCreatedAtThenId = (a: Member, b: Member): number =>
  a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt);

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
  async signIn(input: SignInInput): Promise<Result<Session>> {
    const email = fold(input.email);
    const account = FIXTURE_CREDENTIALS.find((c) => fold(c.email) === email);

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
};
