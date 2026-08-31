// The in-memory implementation. Component tests run against this.
// Parity with supabase.ts is asserted by the seam-parity test, not by convention.
//
// It reproduces the TRIGGER's behaviour, not the interface's (02-design.md section 3): an
// allow-listed address gets a member row and consumes the entry, an unlisted or already-consumed one
// succeeds and creates nothing. A mock that always created a member would make every component test
// pass against a broken trigger, which is the one failure a mock seam can cause and not catch.
import type { DataSeam, SignUpInput, SignUpOutcome } from "./index";
import type { Member, Result } from "../domain/types";
import {
  FIXTURE_ADMIN,
  FIXTURE_ALLOWED_EMAIL,
  FIXTURE_CONSUMED_EMAIL,
  FIXTURE_TEAM,
} from "../fixtures";

interface AllowedEmailRow {
  email: string;
  teamId: string;
  addedBy: string;
  addedAt: string;
  consumedAt: string | null;
}

// AC-4: `allowed_email.email` is citext in the migration, so the database compares without regard to
// case. The mock has no citext, so it folds on the way in and on the way out — same behaviour, and
// the fold is in one place so it cannot drift between the two lookups.
const fold = (email: string): string => email.trim().toLowerCase();

const SEEDED_AT = FIXTURE_ADMIN.createdAt;

// Seeded from the shared fixture module, which holds the same rows as supabase/seed.sql
// (.ai/standards/architecture.md: "a mock, in memory, seeded from the shared fixture module").
const members: Member[] = [FIXTURE_ADMIN];

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
};
