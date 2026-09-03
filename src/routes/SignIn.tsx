// TEA-05 — the sign-in screen. 01-plan.md sections 4.4 and 8.
//
// Everything here is an affordance (ADR-005). Authentication is not authorization: this screen
// establishes WHO the caller is, and every policy already written decides what that identity may do.
// It adds no permission and changes no row of the table in .ai/standards/rbac-and-security.md.
//
// On success it renders nothing of its own. The seam notifies, `useSession` re-resolves, and
// `App.tsx` routes away — which is why there is no navigation call anywhere in this file.
import { useState } from "react";
import type { SignInInput } from "@/lib/data";
import type { Failure, Result, Session } from "@/lib/domain/types";

interface SignInProps {
  signIn(input: SignInInput): Promise<Result<Session>>;
}

// The same shape SignUp.tsx uses. `submitting` is never terminal: every path out of the submit
// handler lands back on `editing`, with or without an error, or the screen is routed away by the
// session change. A disabled button with neither beside it is the failure QA found on TEA-01.
type SignInFormState = { phase: "editing"; error: Failure | null } | { phase: "submitting" };

export default function SignIn({ signIn }: SignInProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<SignInFormState>({ phase: "editing", error: null });

  const complete = Boolean(email && password);
  const submitting = state.phase === "submitting";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!complete || state.phase !== "editing") return;

    setState({ phase: "submitting" });

    try {
      const result = await signIn({ email, password });

      // AC-2 and AC-3. The message is produced in the seam and rendered verbatim here — this screen
      // never composes a sentence of its own about why a sign-in failed, so it cannot accidentally
      // tell an unknown address apart from a wrong password. `invalid_credentials` is one message
      // for both; `email_not_confirmed` is its own, because sending somebody to reset a password
      // that is correct is the more expensive help.
      //
      // On success the state is set back to `editing` and stays on screen for the instant before
      // the routing changes. Leaving it `submitting` would strand the button if the resolution ever
      // failed to arrive.
      setState({ phase: "editing", error: result.ok ? null : result.error });
    } catch {
      // Not defensive padding: expected failures are RETURNED by the seam, and the Supabase client
      // still raises on an unusable configuration before any request leaves.
      setState({
        phase: "editing",
        error: { code: "unknown", message: "Sign-in failed. Please try again." },
      });
    }
  }

  // No `data-testid` on the form itself: 01-plan.md section 8 does not name one, and section 8 is
  // the ONLY channel through which a selector reaches QA (RULE-05). `sign-in-submit` is what that
  // table says asserts "the sign-in screen", for AC-5 and AC-9.
  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto flex max-w-md flex-col gap-4 rounded-2xl bg-white p-8 shadow-sm"
    >
      <h1 className="text-xl font-semibold">Sign in</h1>

      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          data-testid="sign-in-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          data-testid="sign-in-password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2"
        />
      </label>

      {state.phase === "editing" && state.error ? (
        <p data-testid="sign-in-error" role="alert" className="text-sm text-rose-600">
          {state.error.message}
        </p>
      ) : null}

      <button
        data-testid="sign-in-submit"
        type="submit"
        disabled={!complete || submitting}
        className="rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-40"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </button>

      {/* NO LINK TO /signup, and its absence is deliberate. 01-plan.md section 1 puts a navigation
          menu out of scope and says "nothing else navigates": the single admin-only /allow-list link
          on the landing screen is the one link the feature row permits, and it is the real version
          of TEA-02's AC-9 arriving for exactly one item. /signup stays reachable by address in every
          membership state, exactly as /allow-list and /members already are. A link here would be a
          second item, added by this ticket, with no criterion behind it. */}
    </form>
  );
}
