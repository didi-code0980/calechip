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
import type {
  AddAllowedEmailInput,
  CreateEntryInput,
  DataSeam,
  SignInInput,
  SignUpInput,
  SignUpOutcome,
  UpdateEntryInput,
} from "./index";
import type {
  AllowedEmail,
  Entry,
  EntryPortion,
  EntryStatus,
  EntryType,
  Failure,
  Member,
  MemberRole,
  Result,
  Session,
} from "../domain/types";
// TEA-03, and CAL-01 for the second constant. RUNTIME imports, not type ones: both are needed as
// values at the call. They come from ../domain/types and not from ./index, which imports this file
// back - 02-design.md section 1.1.
import { OWN_ENTRY_LIMIT, ROSTER_LIMIT, TEAM_ENTRY_LIMIT } from "../domain/types";

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

// CAL-01. The `entry` row as PostgREST returns it.
//
// `date_range` and `portion_slots` are NOT selected and not declared here. ADR-011 creates them as
// stored generated columns for the exclusion constraint and for CAL-04's `date_range=ov.…` filter;
// this ticket has no read that filters on them, and selecting a column nobody consumes would put a
// PostgreSQL range literal one destructuring away from a component.
interface EntryRow {
  id: string;
  member_id: string;
  type: EntryType;
  portion: EntryPortion;
  start_date: string;
  end_date: string;
  tentative: boolean;
  status: EntryStatus;
  rejection_reason: string | null;
  note: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

const ENTRY_COLUMNS =
  "id, member_id, type, portion, start_date, end_date, tentative, status, rejection_reason, note, " +
  "approved_by, approved_at, created_at, updated_at";

// AC-3 lives here. `end_date` is read from the PLAIN COLUMN and never derived from `date_range`'s
// upper bound: PostgreSQL canonicalises a stored discrete range to `[)`, so an entry ending on the
// 9th is stored as `['2026-10-05','2026-10-10')` and the upper bound is the day AFTER the entry ends
// (ADR-011 section 1). Deriving it would be silently off by one, on every entry, in the direction
// nobody checks.
function toEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    memberId: row.member_id,
    type: row.type,
    portion: row.portion,
    startDate: row.start_date,
    endDate: row.end_date,
    tentative: row.tentative,
    status: row.status,
    rejectionReason: row.rejection_reason,
    note: row.note,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
    // TEA-05 AC-3. Deliberately NOT folded into the line above. GoTrue returns this code whatever
    // this file renders, so the account-existence signal is already at the API and hiding it here
    // would buy nothing while sending somebody to reset a password that is correct. What ADR-009
    // protects — whether an address is on the ALLOW-LIST — stays hidden in both branches.
    case "email_not_confirmed":
      return {
        code: "email_not_confirmed",
        message: "Bạn cần mở liên kết xác nhận trong email trước khi đăng nhập.",
      };
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

// CAL-01. 01-plan.md section 4.3, and it is a SEPARATE mapper from `toPostgrestFailure` above
// rather than three more cases inside it. The two tables answer the same SQLSTATE with different
// sentences - `42501` on `allowed_email` means "you are not an admin", and on `entry` it means "this
// is not your entry or you named a column you may not write" - and one function returning both would
// be the wrong message on one of the two screens.
//
// MATCHED ON THE SQLSTATE, NEVER ON THE CONSTRAINT NAME OR THE MESSAGE TEXT. A name match breaks
// silently the day `entry_no_overlapping_portion` is renamed, and PostgREST's message wording is not
// a contract.
//
// CAL-02 TAKES THE `entry_not_permitted` SENTENCE AS A PARAMETER, and the codes are unchanged. The
// three SQLSTATE mappings are 01-plan.md section 4.2's, identical to CAL-01's; what could not stay
// identical is the one sentence that names a verb. "Không thể tạo đăng ký này." on a screen where a
// member just pressed save on an EDIT is the wrong message, which is the exact failure the paragraph
// above records for `toPostgrestFailure` — one function answering two screens with one sentence.
// Callers branch on the CODE and it is the same code, so nothing downstream changes.
function toEntryFailure(error: PostgrestError, refusal: string): Failure {
  switch (error.code) {
    // INV-01's exclusion constraint. AC-7.
    case "23P01":
      return {
        code: "overlapping_entry",
        message:
          "Bạn đã có một đăng ký trùng với khoảng ngày và buổi này. " +
          "Hãy sửa đăng ký cũ hoặc chọn khoảng khác.",
      };
    // The `entry_end_after_start` check. AC-9's SECOND lock - the seam refuses an inverted range
    // before the request is sent, so reaching this case means a caller that is not this application.
    case "23514":
      return {
        code: "invalid_date_range",
        message: "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.",
      };
    // AC-10 and AC-11. The insert policy filtered the row, or a withheld column privilege refused
    // the statement before any policy ran. The two are deliberately one message: a caller who
    // learned WHICH of the two refused them would be learning the shape of the grant.
    case "42501":
    case "PGRST301": // JWT missing or expired: the request reaches the policy as nobody
      return { code: "entry_not_permitted", message: refusal };
    default:
      return { code: "unknown", message: "Có lỗi không rõ. Thử lại giúp mình nhé." };
  }
}

// The three refusal sentences, one per verb, held here so the two implementations of the seam can
// carry the same words — mock.ts repeats these literals for the same reason src/lib/fixtures.ts and
// supabase/seed.sql repeat theirs.
const CREATE_REFUSED = "Không thể tạo đăng ký này.";
const UPDATE_REFUSED = "Không sửa được đăng ký này.";
const DELETE_REFUSED = "Không xoá được đăng ký này.";

// CAL-01 AC-9 and CAL-02 AC-11, refused BEFORE the request is sent and in both write paths. ADR-011
// Consequences records that an inverted pair fails INSIDE the generated column with "range lower
// bound must be less than or equal to range upper bound" - a database error text where a sentence
// about dates belongs, and it never reaches the check constraint that would have said so legibly.
// String comparison is correct for `yyyy-MM-dd` (CAL-01 plan section 4.5) and no Date is constructed.
const invertedRange = (startDate: string, endDate: string): Failure | null =>
  endDate < startDate
    ? { code: "invalid_date_range", message: "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu." }
    : null;

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

  // -------------------------------------------------------------------------
  // TEA-05. 01-plan.md section 4.2.
  // -------------------------------------------------------------------------

  // TEA-05 AC-7, AC-8, AC-9. Null is a normal answer.
  //
  // An error is folded into the same null, the way `readCurrentMember` folds `auth.getUser()`'s
  // AuthSessionMissingError: every error this call can produce means the stored session is unusable,
  // and an unusable session is one nobody is holding. Reporting it as a session would render a
  // signed-in screen to somebody the datastore will refuse on the next request (AC-8).
  async getSession(): Promise<Session | null> {
    const { data, error } = await client().auth.getSession();
    if (error || !data.session) return null;
    return toSession(data.session);
  },

  // TEA-05 AC-6, AC-7, AC-8.
  //
  // `persistSession` and `autoRefreshToken` are the client's DEFAULTS (verified on disk in
  // @supabase/auth-js@2.112.4 GoTrueClient.js), so AC-7 and AC-8 are behaviour this subscribes to
  // rather than behaviour it builds: the client persists the session across a reload, refreshes the
  // token on its own, and emits with a null session when a refresh finally fails. A timer of our own
  // here would be a SECOND source of truth about whether somebody is signed in.
  //
  // The event is dropped on purpose. It is a Supabase type and would be a datastore vocabulary above
  // the seam; nothing above branches on it, only on whether a session came with it. 01-plan.md
  // section 9 records what to do the day that stops being true.
  onAuthStateChange(listener: (session: Session | null) => void): () => void {
    const { data } = client().auth.onAuthStateChange((_event, session) => {
      listener(session ? toSession(session) : null);
    });
    return () => data.subscription.unsubscribe();
  },

  // TEA-05 AC-1, AC-2, AC-3.
  //
  // ONE message for an unknown address and for a wrong password, and it is one message because
  // GoTrue returns the single code `invalid_credentials` for both — `toFailure` maps it to a
  // sentence that names neither field. Nothing here looks the address up first, so this function
  // cannot become an address-enumeration oracle even by accident (AC-2).
  //
  // No write of any kind, here or anywhere in this ticket: `public.member` has no insert policy and
  // its only writer is the `admit_allow_listed_member` trigger on auth.users, which fires on
  // `email_confirmed_at` and not on sign-in (AC-11).
  async signIn(input: SignInInput): Promise<Result<Session>> {
    const { data, error } = await client().auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error) return { ok: false, error: toFailure(error) };
    return { ok: true, value: toSession(data.session) };
  },

  // TEA-05 AC-6. A failure is RETURNED rather than thrown: on a shared machine a sign-out that
  // silently did nothing is the failure this function exists to prevent, so the caller has to be
  // able to see it.
  async signOut(): Promise<Result<void>> {
    const { error } = await client().auth.signOut();
    if (error) return { ok: false, error: toFailure(error) };
    return { ok: true, value: undefined };
  },

  // -------------------------------------------------------------------------
  // CAL-01. 01-plan.md sections 4.2, 4.3 and 6.
  // -------------------------------------------------------------------------

  // CAL-01 AC-1 ... AC-11.
  //
  // The INSERT names six columns and no more. `status`, `rejection_reason`, `approved_by` and
  // `approved_at` are absent from the insert grant (migration step 10), so naming any of them is
  // refused with `42501 permission denied for column` before a policy runs - AC-11 is held there and
  // not here. `member_id` is absent for the opposite reason: it is REQUIRED by the row and is
  // supplied from the caller's own identity, never from a parameter, so AC-10 has no path through
  // this interface at all and the policy's `with check (member_id = auth.uid())` is the control.
  //
  // AC-9 IS REFUSED BEFORE THE REQUEST IS SENT, and this is the one validation in this file. ADR-011
  // section Consequences records that an inverted pair fails INSIDE the generated column with "range
  // lower bound must be less than or equal to range upper bound" - a database error text where a
  // sentence about dates belongs, and it never reaches the check constraint that would have said so
  // legibly. String comparison is correct for `yyyy-MM-dd` (plan section 4.5) and no Date is
  // constructed anywhere on this path.
  //
  // ZERO ROWS BACK IS A REFUSAL. Under row-level security a refused INSERT that the policy filters
  // returns no representation and PostgREST does not error, so `!error` is not success - the same
  // trap TEA-04's `removeMember` records. `.select()` is what makes the difference visible.
  async createEntry(input: CreateEntryInput): Promise<Result<Entry>> {
    const inverted = invertedRange(input.startDate, input.endDate);
    if (inverted) return { ok: false, error: inverted };

    const me = await readCurrentMember();
    if (!me) {
      return { ok: false, error: { code: "entry_not_permitted", message: CREATE_REFUSED } };
    }

    const { data, error } = await client()
      .from("entry")
      .insert({
        member_id: me.id, // INV-07, and the policy re-derives it from auth.uid() and refuses a mismatch
        type: input.type,
        portion: input.portion,
        start_date: input.startDate,
        end_date: input.endDate,
        tentative: input.tentative,
        note: input.note,
      })
      .select(ENTRY_COLUMNS)
      .returns<EntryRow[]>();

    if (error) return { ok: false, error: toEntryFailure(error, CREATE_REFUSED) };

    const row = (data ?? [])[0];
    if (!row) {
      return { ok: false, error: { code: "entry_not_permitted", message: CREATE_REFUSED } };
    }

    return { ok: true, value: toEntry(row) };
  },

  // CAL-01 AC-1, AC-2, AC-3, AC-5, AC-6, AC-8.
  //
  // The `eq` on `member_id` is an AFFORDANCE and not a control. `entry_select_team` admits the whole
  // team's rows; this narrows to the caller's because that is what the screen shows, and the policy
  // is what stops anybody reading another team's. Deliberately no date filter and no member
  // parameter - the team-wide, range-shaped read is CAL-04's (plan section 4.2).
  //
  // Two `order` calls, not one: two entries can share a `start_date`, so `start_date` alone leaves
  // their order undefined in PostgreSQL and the two implementations would disagree about row order
  // while failing nothing - the flake TEA-03 recorded on the roster read.
  async listOwnEntries(): Promise<Entry[]> {
    const { data: userData, error: userError } = await client().auth.getUser();
    if (userError || !userData.user) return [];

    const { data, error } = await client()
      .from("entry")
      .select(ENTRY_COLUMNS)
      .eq("member_id", userData.user.id)
      .order("start_date", { ascending: false })
      .order("id", { ascending: true })
      .limit(OWN_ENTRY_LIMIT)
      .returns<EntryRow[]>();

    if (error) throw new Error(`listOwnEntries failed: ${error.message}`);

    const rows = data ?? [];

    // The same assertion as `listMembers`, for the same reason: PostgREST caps rows server-side, so
    // a capped read returns a believable short answer with no error anywhere. Here the loss is a
    // member being told an entry they created does not exist, which is worse than an error.
    if (rows.length >= OWN_ENTRY_LIMIT) {
      throw new Error(
        `listOwnEntries returned ${rows.length} rows at the ${OWN_ENTRY_LIMIT} limit: the list may ` +
          `be truncated and must not be consumed`,
      );
    }

    return rows.map(toEntry);
  },

  // -------------------------------------------------------------------------
  // CAL-02. 01-plan.md sections 4.1, 4.2 and 6.
  // -------------------------------------------------------------------------

  // CAL-02 AC-1, AC-2, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11, AC-12.
  //
  // Six columns and no more, exactly the six the update grant carries (migration step 1).
  // `member_id`, `status` and `rejection_reason` are absent from that grant, so a statement naming
  // one is refused with `42501 permission denied for column` BEFORE any policy runs - AC-8 and AC-10
  // are held there, and `UpdateEntryInput` carrying none of the three is the affordance.
  //
  // NO `eq` ON `member_id` AND NO OWNER CHECK. `entry_update_own` IS the owner boundary, and a
  // filter here would be a second, weaker copy of it - the shape `removeMember` already uses. What
  // this file does is issue the statement and read the answer honestly.
  //
  // ZERO ROWS BACK IS A REFUSAL (AC-9). Under row-level security a refused UPDATE is FILTERED rather
  // than errored: it matches no row and PostgREST answers 200 with an empty body (ADR-016 section 4,
  // behaviour 2), so `!error` is not success. The `.select()` is what makes the difference visible,
  // and it is also what returns the row the TRIGGER rewrote - AC-5's reset and AC-12's `updated_at`
  // are read back from the datastore rather than assumed here.
  //
  // NOTHING BELOW IMPLEMENTS INV-02. `entry_enforce_decision()` decides whether an edit is
  // substantive by comparing OLD against NEW, and it is the only judge of that (01-plan.md section
  // 8). A note-only edit sends the same six columns as any other and the trigger is what makes AC-6
  // differ from AC-5.
  async updateEntry(entryId: string, input: UpdateEntryInput): Promise<Result<Entry>> {
    const inverted = invertedRange(input.startDate, input.endDate);
    if (inverted) return { ok: false, error: inverted };

    const { data, error } = await client()
      .from("entry")
      .update({
        type: input.type,
        portion: input.portion,
        start_date: input.startDate,
        end_date: input.endDate,
        tentative: input.tentative,
        note: input.note,
      })
      .eq("id", entryId)
      .select(ENTRY_COLUMNS)
      .returns<EntryRow[]>();

    if (error) return { ok: false, error: toEntryFailure(error, UPDATE_REFUSED) };

    const row = (data ?? [])[0];
    if (!row) {
      return { ok: false, error: { code: "entry_not_permitted", message: UPDATE_REFUSED } };
    }

    return { ok: true, value: toEntry(row) };
  },

  // CAL-02 AC-3, AC-4, AC-9. A HARD delete: `entry` carries no soft-delete column, so the row and
  // its `approved_by` disappear together, and INV-01's constraint releases the slots the row held -
  // which is AC-4 and is the half a test written only from the happy path would miss.
  //
  // THE `.select()` IS THE WHOLE CORRECTNESS OF THIS FUNCTION. A DELETE the policy filters answers
  // 200 with an empty body exactly as an UPDATE does, and a delete has no obvious return value to
  // inspect - so without asking for the deleted representation and counting it, every refusal would
  // be reported as a completed delete. Zero rows is `entry_not_permitted` (AC-9).
  async deleteEntry(entryId: string): Promise<Result<void>> {
    const { data, error } = await client()
      .from("entry")
      .delete()
      .eq("id", entryId)
      .select(ENTRY_COLUMNS)
      .returns<EntryRow[]>();

    if (error) return { ok: false, error: toEntryFailure(error, DELETE_REFUSED) };

    if (!(data ?? [])[0]) {
      return { ok: false, error: { code: "entry_not_permitted", message: DELETE_REFUSED } };
    }

    return { ok: true, value: undefined };
  },

  // -------------------------------------------------------------------------
  // CAL-03. 01-plan.md sections 4.1 and 5.
  //
  // `updateEntry` and `deleteEntry` above are UNCHANGED by this ticket — not one character. They
  // issue the statement and count the rows the datastore let through; `entry_update_admin` and
  // `entry_delete_admin` widen what those same statements reach. That is ADR-005 working as
  // designed, and it is the evidence that CAL-02 put the check in the datastore rather than here.
  // -------------------------------------------------------------------------

  // CAL-03 AC-1, AC-2, AC-3, AC-4, AC-9, AC-10, AC-12.
  //
  // NO FILTER OF ANY KIND, and that is the difference from `listOwnEntries`. That function narrows
  // to `member_id = auth.uid()` as an AFFORDANCE, because the own-entry screen shows only the
  // caller's rows; `entry_select_team` was always what stopped anybody reading another team's. Here
  // the screen shows the whole team, so there is nothing to narrow and the policy is the only scope.
  // A `member_team_id` filter written here would be a second, weaker copy of the policy.
  //
  // NO `is_admin` CHECK. `Read any entry in the team` is checked for BOTH roles in
  // rbac-and-security.md, so this read is not where the admin capability lives — TeamEntries.tsx
  // refuses a non-admin as an affordance, and `entry_update_admin` is the control.
  //
  // Two `order` calls, not one, for the reason `listOwnEntries` and `listMembers` both record: two
  // entries can share a `start_date`, so `start_date` alone leaves their order undefined in
  // PostgreSQL and the two implementations would disagree about row order while failing nothing.
  // Across a whole team, shared start dates are the normal case rather than the edge one.
  async listTeamEntries(): Promise<Entry[]> {
    const { data, error } = await client()
      .from("entry")
      .select(ENTRY_COLUMNS)
      .order("start_date", { ascending: false })
      .order("id", { ascending: true })
      .limit(TEAM_ENTRY_LIMIT)
      .returns<EntryRow[]>();

    if (error) throw new Error(`listTeamEntries failed: ${error.message}`);

    const rows = data ?? [];

    // The same assertion as `listOwnEntries` and `listMembers`, and here the loss is the worst of
    // the three: a truncated read hides an entry from the one person able to correct it, and it
    // hides it silently — PostgREST caps rows server-side and answers a believable short list with
    // no error anywhere.
    if (rows.length >= TEAM_ENTRY_LIMIT) {
      throw new Error(
        `listTeamEntries returned ${rows.length} rows at the ${TEAM_ENTRY_LIMIT} limit: the list ` +
          `may be truncated and must not be consumed`,
      );
    }

    return rows.map(toEntry);
  },
};
