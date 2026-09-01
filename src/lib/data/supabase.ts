// The real implementation. The ONLY file in the repository that may import the Supabase client —
// RULE-02, enforced by eslint.config.js and declared again as a boundary D12 reads.
import {
  createClient,
  isAuthRetryableFetchError,
  type AuthError,
  type Session as SupabaseSession,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import type { PostgrestError } from "@supabase/supabase-js";
import type { AddAllowedEmailInput, DataSeam, SignUpInput, SignUpOutcome } from "./index";
import type { AllowedEmail, Failure, Member, MemberRole, Result, Session } from "../domain/types";
// TEA-03. A RUNTIME import, not a type one: AC-8 needs the value at the call. It comes from
// ../domain/types and not from ./index, which imports this file back - 02-design.md section 1.1.
import { ROSTER_LIMIT } from "../domain/types";

// Vite exposes only variables prefixed VITE_. The anon key is public by design and ships in the
// bundle; the service role key must never appear here. See "Secrets" in
// .ai/standards/rbac-and-security.md.
const url = () => import.meta.env.VITE_SUPABASE_URL ?? "";
const anonKey = () => import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

// Constructed lazily, and deliberately.
//
// The first version built the client at module load. `createClient` throws on an empty URL, so
// importing this file without environment variables crashed — which meant the seam-parity test
// could not import the very implementation it exists to compare. The test caught it on its first
// run, which is what a mandatory test is for.
let cached: SupabaseClient | null = null;

export function client(): SupabaseClient {
  if (!cached) cached = createClient(url(), anonKey());
  return cached;
}

// The `member` row as PostgREST returns it: snake_case, straight off the column names in
// supabase/migrations. This file is the only place the database casing and the domain casing meet
// (.ai/standards/architecture.md, "Layers" — code above the seam never sees a column name).
interface MemberRow {
  id: string;
  team_id: string;
  display_name: string;
  avatar: string;
  role: MemberRole;
  removed_at: string | null;
  created_at: string;
}

const MEMBER_COLUMNS = "id, team_id, display_name, avatar, role, removed_at, created_at";

function toMember(row: MemberRow): Member {
  return {
    id: row.id,
    teamId: row.team_id,
    displayName: row.display_name,
    avatar: row.avatar,
    role: row.role,
    removedAt: row.removed_at,
    createdAt: row.created_at,
  };
}

// TEA-02. The `allowed_email` row as PostgREST returns it. `email` is citext, so the value arriving
// here is already folded by the datastore and this file does no folding of its own.
interface AllowedEmailRow {
  email: string;
  team_id: string;
  added_by: string;
  added_at: string;
  consumed_at: string | null;
}

const ALLOWED_EMAIL_COLUMNS = "email, team_id, added_by, added_at, consumed_at";

function toAllowedEmail(row: AllowedEmailRow): AllowedEmail {
  return {
    email: row.email,
    teamId: row.team_id,
    addedBy: row.added_by,
    addedAt: row.added_at,
    consumedAt: row.consumed_at,
  };
}

// The read half of `getCurrentMember`, shared with `getOwnMember` so the two cannot answer
// differently about the same row.
async function readMember(userId: string): Promise<Member | null> {
  const { data, error } = await client()
    .from("member")
    .select(MEMBER_COLUMNS)
    .eq("id", userId)
    .maybeSingle<MemberRow>();

  if (error) throw new Error(`getOwnMember failed for ${userId}: ${error.message}`);
  return data ? toMember(data) : null;
}

// TEA-02. Module-level rather than a call through `this`: `addAllowedEmail` needs the caller's own
// row, and a seam method reaching for a sibling through `this` breaks the moment the object is
// destructured — which is exactly what tests/seam-parity.test.ts does to it.
async function readCurrentMember(): Promise<Member | null> {
  const { data, error } = await client().auth.getUser();
  if (error || !data.user) return null;
  return readMember(data.user.id);
}

function toAuthUser(user: User): Session["user"] {
  return {
    id: user.id,
    email: user.email ?? "",
    emailConfirmed: Boolean(user.email_confirmed_at),
  };
}

function toSession(session: SupabaseSession): Session {
  return { user: toAuthUser(session.user), accessToken: session.access_token };
}

// Expected failures are returned, not thrown (.ai/standards/coding-standards.md, Error handling).
// The message is what the sign-up screen renders, so it is in the product's language; the code is
// what a caller branches on.
function toFailure(error: AuthError): Failure {
  if (isAuthRetryableFetchError(error)) {
    return { code: "network", message: "Không kết nối được máy chủ. Thử lại giúp mình nhé." };
  }
  switch (error.code) {
    case "email_exists":
    case "user_already_exists":
      return { code: "email_already_registered", message: "Địa chỉ này đã có tài khoản rồi." };
    case "weak_password":
      return { code: "weak_password", message: "Mật khẩu quá yếu. Đặt dài hơn giúp mình nhé." };
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return { code: "rate_limited", message: "Thử hơi nhiều lần rồi. Chờ một chút rồi thử lại." };
    case "invalid_credentials":
      return { code: "invalid_credentials", message: "Email hoặc mật khẩu không đúng." };
    default:
      return { code: "unknown", message: "Có lỗi không rõ. Thử lại giúp mình nhé." };
  }
}

// TEA-02. The same contract as `toFailure` above, for the PostgREST side of the client: expected
// failures are RETURNED, not thrown (.ai/standards/coding-standards.md, Error handling).
//
// The two codes that carry meaning here are SQLSTATEs the datastore raises, not strings this file
// chooses. `23505` is the unique violation on `allowed_email`'s primary key, which is AC-5 being
// enforced by the key rather than by a lookup. `42501` is "new row violates row-level security
// policy", which is AC-4 and AC-8 arriving from the policy itself.
function toPostgrestFailure(error: PostgrestError): Failure {
  switch (error.code) {
    case "23505":
      return { code: "already_allow_listed", message: "Địa chỉ này đã có trong danh sách rồi." };
    case "42501":
    case "PGRST301": // JWT missing or expired: the request reaches the policy as nobody
      return { code: "not_permitted", message: "Bạn không có quyền thực hiện việc này." };
    default:
      return { code: "unknown", message: "Có lỗi không rõ. Thử lại giúp mình nhé." };
  }
}

export const seam: DataSeam = {
  async ready() {
    return Boolean(url() && anonKey());
  },

  // AC-1, AC-5, AC-8, AC-13. This creates the auth user and NOTHING else. The `member` row is the
  // work of the `admit_allow_listed_member` trigger on auth.users, which is why this function has no
  // branch on whether the address is allow-listed: it cannot see the allow-list, and that is exactly
  // what makes AC-5 hold against anybody signing up rather than only against this screen.
  //
  // `options.data` maps to auth.users.raw_user_meta_data, which is where the trigger reads
  // display_name and avatar from (verified against @supabase/auth-js 2.112.4 lib/types.d.ts).
  async signUp(input: SignUpInput): Promise<Result<SignUpOutcome>> {
    const { data, error } = await client().auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { display_name: input.displayName, avatar: input.avatar } },
    });

    if (error) return { ok: false, error: toFailure(error) };

    // With Confirm email ON, signUp returns a user and a null session; with it OFF, both. AC-13's
    // screen ignores the session either way, so a null one is a normal outcome and not a failure.
    return {
      ok: true,
      value: {
        needsEmailConfirmation: data.session === null,
        session: data.session ? toSession(data.session) : null,
      },
    };
  },

  // AC-1, AC-9. `member_select_own` lets a caller address only their own row, so "no row" and "a row
  // I may not see" collapse into one answer — null — and that is a normal answer, not an error.
  //
  // A transport or policy failure is a programmer error at this seam, not an expected outcome:
  // there is no caller-visible failure shape on this function, and returning null would report
  // "you are not a member" for what is actually a broken connection. `readMember` throws.
  async getOwnMember(userId: string): Promise<Member | null> {
    return readMember(userId);
  },

  // -------------------------------------------------------------------------
  // TEA-02. 02-design.md section 3.
  // -------------------------------------------------------------------------

  // TEA-02 AC-1, AC-9. Null when nobody is signed in and null when the auth user has no member row;
  // both are normal answers. `auth.getUser()` returns an AuthSessionMissingError rather than a null
  // user when there is no session, so the error is folded into the same null.
  //
  // Until the sign-in half of TEA-01 exists nothing ever creates a session, so in a real build this
  // returns null on every call and the screen renders `allow-list-refused` for everybody, admin
  // included. 02-design.md section 5, "Prerequisites this ticket does not own".
  async getCurrentMember(): Promise<Member | null> {
    return readCurrentMember();
  },

  // TEA-02 AC-1, AC-8. No team parameter: `allowed_email_select_admin` scopes the rows to the
  // caller's team, and a member receives zero rows rather than an error — which is why an empty
  // list is the honest return here and a failure shape would be a lie about what the policy did.
  async listAllowedEmails(): Promise<AllowedEmail[]> {
    const { data, error } = await client()
      .from("allowed_email")
      .select(ALLOWED_EMAIL_COLUMNS)
      .order("added_at", { ascending: false })
      .returns<AllowedEmailRow[]>();

    if (error) throw new Error(`listAllowedEmails failed: ${error.message}`);
    return (data ?? []).map(toAllowedEmail);
  },

  // TEA-02 AC-2, AC-4, AC-5.
  //
  // `team_id` and `added_by` are read from the datastore's own answer about who the caller is, never
  // from a parameter. The policy's `with check` then re-derives both and refuses a mismatch, so the
  // two agree by construction and AC-4 is unreachable through this interface.
  async addAllowedEmail(input: AddAllowedEmailInput): Promise<Result<AllowedEmail>> {
    const me = await readCurrentMember();
    if (!me) {
      return {
        ok: false,
        error: { code: "not_permitted", message: "Bạn cần đăng nhập bằng tài khoản quản trị." },
      };
    }

    const { data, error } = await client()
      .from("allowed_email")
      .insert({ email: input.email.trim(), team_id: me.teamId, added_by: me.id })
      .select(ALLOWED_EMAIL_COLUMNS)
      .single<AllowedEmailRow>();

    if (error) return { ok: false, error: toPostgrestFailure(error) };
    return { ok: true, value: toAllowedEmail(data) };
  },

  // TEA-02 AC-6, AC-7, AC-8.
  //
  // A delete that removes ZERO rows is not success (02-design.md section 3). Under row-level
  // security a refused delete is not an error — it simply matches nothing — so this asks for the
  // deleted rows back and treats an empty answer as a refusal.
  //
  // The one follow-up read is what tells the two refusals apart. `allowed_email_select_admin` shows
  // an admin their own team's rows consumed and unconsumed alike, so a row that comes back with
  // `consumed_at` set is AC-7, and no row at all is AC-4 or AC-8. Collapsing them would tell an
  // admin their own entry does not exist.
  async removeAllowedEmail(email: string): Promise<Result<void>> {
    const { data, error } = await client()
      .from("allowed_email")
      .delete()
      .eq("email", email)
      .select("email")
      .returns<Array<{ email: string }>>();

    if (error) return { ok: false, error: toPostgrestFailure(error) };
    if (data && data.length > 0) return { ok: true, value: undefined };

    const { data: existing } = await client()
      .from("allowed_email")
      .select("email, consumed_at")
      .eq("email", email)
      .maybeSingle<{ email: string; consumed_at: string | null }>();

    if (existing && existing.consumed_at !== null) {
      return {
        ok: false,
        error: {
          code: "already_consumed",
          message: "Địa chỉ này đã có người dùng để vào nhóm, không gỡ được.",
        },
      };
    }

    return {
      ok: false,
      error: { code: "not_permitted", message: "Không gỡ được địa chỉ này." },
    };
  },

  // -------------------------------------------------------------------------
  // TEA-03. 02-design.md sections 1.2, 1.4 and 3.
  // -------------------------------------------------------------------------

  // TEA-03 AC-1, AC-2, AC-3, AC-4, AC-6, AC-7, AC-8.
  //
  // No team parameter and no `eq` on team_id: `member_select_team` IS the team boundary (INV-07),
  // and a filter here would be a second, weaker copy of it. The two policies on this table are
  // permissive and OR together, so an active caller receives their whole team and a removed caller
  // receives their own row - ADR-018 Consequences, reproduced in mock.ts.
  //
  // NO `removed_at` FILTER. ADR-013 and the INV-04 note require the counting function to be GIVEN
  // the roster carrying `removedAt` per member; filtering here makes INV-04 uncomputable for every
  // past date. MemberList.tsx does the filtering, above the seam, where it is a display decision.
  //
  // Two `order` calls, not one: `FIXTURE_ADMIN` and `FIXTURE_MEMBER` share a `created_at` literal,
  // so created_at alone leaves their order undefined in PostgreSQL (02-design.md section 1.4).
  async listMembers(): Promise<Member[]> {
    const { data, error } = await client()
      .from("member")
      .select(MEMBER_COLUMNS)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(ROSTER_LIMIT)
      .returns<MemberRow[]>();

    if (error) throw new Error(`listMembers failed: ${error.message}`);

    const rows = data ?? [];

    // AC-8. Under ADR-005 the browser reads PostgREST directly and PostgREST caps rows server-side,
    // so a capped read returns a believable short answer with no error anywhere. The roster is
    // INV-04's denominator, so a roster short by two people raises the ratio on every date and makes
    // days look overloaded that are not. Throwing is what keeps a truncated roster out of every
    // screen and every computation; the caller renders `member-list-unavailable`.
    if (rows.length >= ROSTER_LIMIT) {
      throw new Error(
        `listMembers returned ${rows.length} rows at the ${ROSTER_LIMIT} limit: the roster may be ` +
          `truncated and must not be consumed (TEA-03 AC-8)`,
      );
    }

    return rows.map(toMember);
  },

  // -------------------------------------------------------------------------
  // TEA-04. 01-plan.md sections 4.2 and 6.
  // -------------------------------------------------------------------------

  // TEA-04 AC-1, AC-3, AC-6, AC-9, AC-11, AC-12.
  //
  // No `eq` on team_id and no role check: `member_update_admin` IS the team boundary and the role
  // boundary (INV-07), and a filter here would be a second, weaker copy of it. What this file does
  // is issue the statement and read the answer honestly.
  //
  // ZERO ROWS BACK IS A REFUSAL. Under row-level security a refused UPDATE is FILTERED rather than
  // errored - it matches no row and PostgREST answers 200 with an empty body - so `!error` is not
  // success and treating it as such would report every policy refusal as a completed removal. The
  // `.select()` exists to make the difference visible.
  //
  // The trigger's four refusals arrive the other way, as `42501`, and become `not_permitted`
  // through `toPostgrestFailure`. There is no FailureCode per reason (01-plan.md section 4.1):
  // demotion, promoting a removed member, undoing a removal and self-removal are all unreachable
  // through the controls MemberList.tsx draws, so a code per reason would be a branch no screen
  // can take.
  //
  // The `removed_at` sent here is NEVER the value stored. An UPDATE must name a value for the
  // column, and the trigger overwrites whatever arrives with `now()` (AC-3) - which is the point:
  // this column is INV-04's denominator and ADR-013's per-date condition, so a client clock has no
  // business in it. It is deliberately not read back into anything either; the returned row carries
  // the datastore's own value.
  async removeMember(memberId: string): Promise<Result<Member>> {
    const { data, error } = await client()
      .from("member")
      .update({ removed_at: new Date().toISOString() })
      .eq("id", memberId)
      .select(MEMBER_COLUMNS)
      .returns<MemberRow[]>();

    if (error) return { ok: false, error: toPostgrestFailure(error) };

    const row = (data ?? [])[0];
    if (!row) {
      return {
        ok: false,
        error: { code: "not_permitted", message: "Không gỡ được thành viên này." },
      };
    }

    return { ok: true, value: toMember(row) };
  },

  // TEA-04 AC-4, AC-5, AC-6, AC-10, AC-11, AC-12.
  //
  // One-way, and the one direction is written literally: `role` is set to `admin` and there is no
  // parameter that could carry the other value. That is an affordance and not the check - the
  // trigger refuses a demotion issued by any route, because `role` is granted `update` for exactly
  // this path and the column is therefore writable in the direction that must be refused (AC-5).
  //
  // Zero rows back is a refusal, for the same reason as `removeMember` above.
  async promoteMember(memberId: string): Promise<Result<Member>> {
    const { data, error } = await client()
      .from("member")
      .update({ role: "admin" })
      .eq("id", memberId)
      .select(MEMBER_COLUMNS)
      .returns<MemberRow[]>();

    if (error) return { ok: false, error: toPostgrestFailure(error) };

    const row = (data ?? [])[0];
    if (!row) {
      return {
        ok: false,
        error: { code: "not_permitted", message: "Không thăng quyền cho người này được." },
      };
    }

    return { ok: true, value: toMember(row) };
  },
};
