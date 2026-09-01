// The in-memory implementation. Component tests run against this.
// Parity with supabase.ts is asserted by the seam-parity test, not by convention.
//
// It reproduces the TRIGGER's behaviour, not the interface's (02-design.md section 3): an
// allow-listed address gets a member row and consumes the entry, an unlisted or already-consumed one
// succeeds and creates nothing. A mock that always created a member would make every component test
// pass against a broken trigger, which is the one failure a mock seam can cause and not catch.
import type { AddAllowedEmailInput, DataSeam, SignUpInput, SignUpOutcome } from "./index";
import type { AllowedEmail, Member, Result } from "../domain/types";
// TEA-03. A RUNTIME import, not a type one - 02-design.md section 1.1.
import { ROSTER_LIMIT } from "../domain/types";
import {
  FIXTURE_ADMIN,
  FIXTURE_ALLOWED_EMAIL,
  FIXTURE_CONSUMED_EMAIL,
  FIXTURE_MEMBER,
  FIXTURE_OTHER_TEAM_MEMBER,
  FIXTURE_REMOVED_MEMBER,
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
const members: Member[] = [
  FIXTURE_ADMIN,
  FIXTURE_MEMBER,
  FIXTURE_OTHER_TEAM_MEMBER,
  FIXTURE_REMOVED_MEMBER,
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

// TEA-02. Who `getCurrentMember` answers as. The sign-in half of TEA-01 does not exist, so there is
// no session to read this from; in the real seam it comes from `auth.getUser()` and in this one it
// is set by the test hook below.
let currentMemberId: string | null = FIXTURE_ADMIN.id;

/** Test-only. Sets which seeded member `getCurrentMember` answers as. Not part of the seam - it is a
 *  named export beside `seam`, so seam parity, which compares the keys of `seam`, is untouched. */
export function __setCurrentMember(id: string | null): void {
  currentMemberId = id;
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
};
