import { useState } from "react";
import { AVATAR_CHOICES, type Failure } from "@/lib/domain/types";
// The seam, through its one door. 02-design.md section 6.2: nothing above the seam names an
// implementation — `@/lib/data` resolves it from the environment, and this file must never import
// `./supabase` or `./mock`. The earlier revision imported the real one by hand, which is why the
// end-to-end build raised `supabaseUrl is required.` with nothing on screen.
//
// The hook layer .ai/standards/architecture.md puts between a route and the seam is still skipped:
// a hook would be a thirteenth file, and design section 5 says a thirteenth tips this ticket to L.
// The boundary RULE-02 protects is untouched — no Supabase client is imported here.
import { seam } from "@/lib/data";

// AC-13: `submitted` is terminal. The notice, and nothing after it — no navigation, no session, no
// member read. That is what makes this half of TEA-01 an operation that begins and ends on one screen.
type SignUpFormState =
  | { phase: "editing"; error: Failure | null }
  | { phase: "submitting" }
  | { phase: "submitted" };

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [state, setState] = useState<SignUpFormState>({ phase: "editing", error: null });

  // The affordance behind AC-8, and an affordance ONLY (ADR-005): `display_name` and `avatar` are
  // `not null` with no default in the migration, and that column shape is the control. Disabling the
  // button saves a round trip and says why; it enforces nothing, because the same request can be
  // issued from anywhere that is not this screen.
  const complete = Boolean(email && password && displayName && avatar);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!complete || state.phase !== "editing") return;

    setState({ phase: "submitting" });

    // Design section 6.3: after submit the screen reaches exactly one of two terminal states, always,
    // and `signup-submit` is never left disabled without one of them beside it.
    //
    // The catch is the third row of that table and it is not defensive padding. Section 1 says
    // expected failures are RETURNED rather than thrown, which is true of the seam's own failures and
    // is not true of everything the call can do — the Supabase client raises on an unusable
    // configuration before any request leaves. Without this, that throw escaped as an uncaught page
    // error, the phase stayed `submitting`, and the person was left on a disabled button forever.
    try {
      const result = await seam.signUp({ email, password, displayName, avatar });

      // AC-5: the success branch is identical whether or not the address was allow-listed. The seam
      // cannot tell the difference and neither can this component — nothing here branches on it.
      setState(result.ok ? { phase: "submitted" } : { phase: "editing", error: result.error });
    } catch {
      setState({
        phase: "editing",
        error: { code: "unknown", message: "Sign-up failed. Please try again." },
      });
    }
  }

  if (state.phase === "submitted") {
    return (
      <section
        data-testid="signup-confirm-notice"
        className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-sm"
      >
        <h1 className="text-xl font-semibold">Check your email</h1>
        <p className="mt-2 text-sm opacity-70">
          We have sent a confirmation link to the address you entered. Open it to finish signing up.
        </p>
      </section>
    );
  }

  const submitting = state.phase === "submitting";

  return (
    <form
      data-testid="signup-form"
      onSubmit={onSubmit}
      className="mx-auto flex max-w-md flex-col gap-4 rounded-2xl bg-white p-8 shadow-sm"
    >
      <h1 className="text-xl font-semibold">Sign up</h1>

      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          data-testid="signup-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          data-testid="signup-password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2"
        />
      </label>

      {/* AC-8: the person supplies both. There is no server to fill them in (ADR-005) and no
          correction screen in v1, so sign-up is the only moment they can be collected. */}
      <label className="flex flex-col gap-1 text-sm">
        Display name
        <input
          data-testid="signup-display-name"
          type="text"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2"
        />
      </label>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend>Avatar</legend>
        <div
          data-testid="signup-avatar-picker"
          role="radiogroup"
          aria-label="Avatar"
          className="flex flex-wrap gap-2"
        >
          {AVATAR_CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              data-testid="signup-avatar-option"
              data-avatar={choice}
              role="radio"
              aria-checked={avatar === choice}
              onClick={() => setAvatar(choice)}
              className={
                avatar === choice
                  ? "rounded-full border-2 border-slate-900 px-3 py-2 text-lg"
                  : "rounded-full border border-slate-200 px-3 py-2 text-lg"
              }
            >
              {choice}
            </button>
          ))}
        </div>
      </fieldset>

      {state.phase === "editing" && state.error ? (
        <p data-testid="signup-error" role="alert" className="text-sm text-rose-600">
          {state.error.message}
        </p>
      ) : null}

      <button
        data-testid="signup-submit"
        type="submit"
        disabled={!complete || submitting}
        className="rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-40"
      >
        {submitting ? "Sending…" : "Sign up"}
      </button>
    </form>
  );
}
