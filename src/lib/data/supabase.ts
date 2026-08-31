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
import type { DataSeam, SignUpInput, SignUpOutcome } from "./index";
import type { Failure, Member, MemberRole, Result, Session } from "../domain/types";

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
  async getOwnMember(userId: string): Promise<Member | null> {
    const { data, error } = await client()
      .from("member")
      .select(MEMBER_COLUMNS)
      .eq("id", userId)
      .maybeSingle<MemberRow>();

    // A transport or policy failure is a programmer error at this seam, not an expected outcome:
    // there is no caller-visible failure shape on this function, and returning null would report
    // "you are not a member" for what is actually a broken connection.
    if (error) throw new Error(`getOwnMember failed for ${userId}: ${error.message}`);

    return data ? toMember(data) : null;
  },
};
