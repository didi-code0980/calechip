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
};
