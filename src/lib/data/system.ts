// MIR-18 — the system panel's seam. 01-plan.md § 4.4, ADR-074 decision 6.
//
// A SECOND SEAM MODULE, NOT MORE FUNCTIONS ON `DataSeam`. The panel must not carry the member seam,
// and the member app must not carry the panel: this file imports neither `./index`, `./mock` nor
// `./supabase`, and nothing in the member app imports it (AC-14). It sits inside the seam directory
// so the `supabase-client-in-seam` lint rule allows its client (RULE-02).
//
// ITS OWN CLIENT, UNDER ITS OWN `storageKey`. Two clients on one origin with the default key share —
// and on sign-out destroy — one stored session, so a panel sign-out would end the member app's.
// `signOut` is `scope: "local"` for the same reason: it never ends a member's other sessions.
//
// THE DATABASE IS THE CONTROL. `gate()` reaching `signed-in` is an affordance; every system-scope
// read is gated on `public.is_system_admin()`, which requires the row AND `aal2` (ADR-074 decision 4).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Result } from "@/lib/domain/types";

/** Where a panel visitor stands. Each state is one screen (01-plan.md § 2b). */
export type SystemGate =
  | { state: "signed-out" }
  | { state: "not-system-admin" }
  | { state: "enrol"; email: string } // aal1, no verified TOTP factor
  | { state: "verify"; email: string } // aal1, a verified TOTP factor exists
  | { state: "signed-in"; email: string }; // aal2 and is_system_admin() returned true

export interface TotpEnrolment {
  factorId: string;
  /** An image URL — Supabase returns an SVG data URI. */
  qrCode: string;
  secret: string;
}

export interface SystemSeam {
  /** The gate for the current panel session. Never throws: a transport failure is `signed-out`. */
  gate(): Promise<SystemGate>;
  /** Password sign-in. A non-system-admin is signed out again (scope local) and gets `not-system-admin`. */
  signIn(email: string, password: string): Promise<Result<SystemGate>>;
  /** THROWS on failure. Removes any unverified TOTP factor first, then enrols a new one. */
  startEnrolment(): Promise<TotpEnrolment>;
  /** Challenge and verify. `factorId` from `startEnrolment`, or omitted to use the verified factor. */
  verifyCode(code: string, factorId?: string): Promise<Result<SystemGate>>;
  /** Signs out of the panel only — `scope: "local"`. */
  signOut(): Promise<void>;
}

// The two refusals share `invalid_credentials`: both are a refused credential, and no other existing
// `FailureCode` means that (01-plan.md § 4.4; `types.ts` is not edited).
const WRONG_PASSWORD = "Email or password is incorrect.";
const WRONG_CODE = "That code did not match. Try again.";

// =============================================================================================
// Supabase implementation
// =============================================================================================

const url = () => import.meta.env.VITE_SUPABASE_URL ?? "";
const anonKey = () => import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

// Lazy, as `supabase.ts` builds the member client: `createClient` throws on an empty URL, and the
// mock build must be able to import this file without one.
let cached: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (!cached) {
    cached = createClient(url(), anonKey(), { auth: { storageKey: "calechip-system-auth" } });
  }
  return cached;
}

async function supabaseGate(): Promise<SystemGate> {
  try {
    const auth = client().auth;
    const { data: sessionData } = await auth.getSession();
    const session = sessionData.session;
    if (!session) return { state: "signed-out" };
    const email = session.user.email ?? "";

    // ADR-074 decision 5: the caller's own row is readable at any assurance level, so a non-admin is
    // turned away before being asked for a code.
    const { data: row, error: rowError } = await client()
      .from("system_admin")
      .select("id")
      .maybeSingle();
    if (rowError) return { state: "signed-out" };
    if (!row) {
      await auth.signOut({ scope: "local" });
      return { state: "not-system-admin" };
    }

    const { data: aal, error: aalError } = await auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalError) return { state: "signed-out" };
    if (aal.currentLevel === "aal2") {
      const { data: isAdmin, error: rpcError } = await client().rpc("is_system_admin");
      if (rpcError) return { state: "signed-out" };
      return isAdmin === true ? { state: "signed-in", email } : { state: "not-system-admin" };
    }
    if (aal.nextLevel === "aal2") return { state: "verify", email };
    return { state: "enrol", email };
  } catch {
    return { state: "signed-out" };
  }
}

const supabaseSystemSeam: SystemSeam = {
  gate: supabaseGate,

  async signIn(email, password) {
    try {
      const { error } = await client().auth.signInWithPassword({ email, password });
      if (error) return { ok: false, error: { code: "invalid_credentials", message: WRONG_PASSWORD } };
    } catch {
      return { ok: false, error: { code: "invalid_credentials", message: WRONG_PASSWORD } };
    }
    return { ok: true, value: await supabaseGate() };
  },

  async startEnrolment() {
    const mfa = client().auth.mfa;
    const { data: factors, error: listError } = await mfa.listFactors();
    if (listError) throw listError;
    for (const factor of factors.all) {
      if (factor.factor_type === "totp" && factor.status === "unverified") {
        const { error } = await mfa.unenroll({ factorId: factor.id });
        if (error) throw error;
      }
    }
    const { data, error } = await mfa.enroll({ factorType: "totp" });
    if (error) throw error;
    return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
  },

  async verifyCode(code, factorId) {
    const refused = { ok: false as const, error: { code: "invalid_credentials" as const, message: WRONG_CODE } };
    try {
      const mfa = client().auth.mfa;
      let id = factorId;
      if (!id) {
        const { data: factors, error } = await mfa.listFactors();
        if (error) return refused;
        id = factors.totp[0]?.id;
      }
      if (!id) return refused;
      const { error } = await mfa.challengeAndVerify({ factorId: id, code });
      if (error) return refused;
    } catch {
      return refused;
    }
    return { ok: true, value: await supabaseGate() };
  },

  async signOut() {
    try {
      await client().auth.signOut({ scope: "local" });
    } catch {
      // A failed sign-out leaves nothing to show; the next `gate()` reads the truth.
    }
  },
};

// =============================================================================================
// Mock implementation — in memory, reset on reload. Fixtures are 01-plan.md § 2's table.
// =============================================================================================

const MOCK_SYSTEM_PASSWORD = "calechip-demo";
const MOCK_SYSTEM_CODE = "246810";
const MOCK_SYSTEM_SECRET = "JBSWY3DPEHPK3PXP";
const MOCK_SYSTEM_QR =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" shape-rendering="crispEdges">' +
      '<rect width="8" height="8" fill="#fff"/>' +
      '<path d="M0 0h3v3H0zM5 0h3v3H5zM0 5h3v3H0zM4 4h1v1H4zM6 5h2v1H6zM5 7h1v1H5z" fill="#000"/>' +
      "</svg>",
  );

interface MockAccount {
  isSystemAdmin: boolean;
  hasVerifiedFactor: boolean;
}

const mockAccounts = new Map<string, MockAccount>([
  ["root@calechip.test", { isSystemAdmin: true, hasVerifiedFactor: false }],
  ["ops@calechip.test", { isSystemAdmin: true, hasVerifiedFactor: true }],
  ["member@calechip.test", { isSystemAdmin: false, hasVerifiedFactor: false }],
]);

let mockSession: { email: string; aal2: boolean } | null = null;
let mockPendingFactorId: string | null = null;
let mockFactorCounter = 0;

function mockGate(): SystemGate {
  if (!mockSession) return { state: "signed-out" };
  const { email, aal2 } = mockSession;
  const account = mockAccounts.get(email);
  if (!account?.isSystemAdmin) {
    mockSession = null;
    return { state: "not-system-admin" };
  }
  if (aal2) return { state: "signed-in", email };
  return account.hasVerifiedFactor ? { state: "verify", email } : { state: "enrol", email };
}

const mockSystemSeam: SystemSeam = {
  async gate() {
    return mockGate();
  },

  async signIn(email, password) {
    const normalised = email.trim().toLowerCase();
    if (!mockAccounts.has(normalised) || password !== MOCK_SYSTEM_PASSWORD) {
      return { ok: false, error: { code: "invalid_credentials", message: WRONG_PASSWORD } };
    }
    mockSession = { email: normalised, aal2: false };
    return { ok: true, value: mockGate() };
  },

  async startEnrolment() {
    if (!mockSession) throw new Error("No panel session.");
    mockFactorCounter += 1;
    mockPendingFactorId = `mock-factor-${mockFactorCounter}`;
    return { factorId: mockPendingFactorId, qrCode: MOCK_SYSTEM_QR, secret: MOCK_SYSTEM_SECRET };
  },

  async verifyCode(code, factorId) {
    const refused = { ok: false as const, error: { code: "invalid_credentials" as const, message: WRONG_CODE } };
    if (!mockSession) return refused;
    const account = mockAccounts.get(mockSession.email);
    if (!account?.isSystemAdmin) return refused;
    if (factorId !== undefined ? factorId !== mockPendingFactorId : !account.hasVerifiedFactor) {
      return refused;
    }
    if (code.trim() !== MOCK_SYSTEM_CODE) return refused;
    account.hasVerifiedFactor = true;
    mockPendingFactorId = null;
    mockSession = { ...mockSession, aal2: true };
    return { ok: true, value: mockGate() };
  },

  async signOut() {
    mockSession = null;
    mockPendingFactorId = null;
  },
};

// The same test `index.ts` uses to choose the member seam.
const usesMock = import.meta.env.VITE_DATA_SEAM === "mock" || !import.meta.env.VITE_SUPABASE_URL;

export const systemSeamName: "mock" | "supabase" = usesMock ? "mock" : "supabase";

export const systemSeam: SystemSeam = usesMock ? mockSystemSeam : supabaseSystemSeam;
