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
// UIE-01. Presentational only, and it is the same card /signin renders — which is what makes the
// segmented control a change of route rather than a change of screen.
import AuthCard, {
  FIELD_INPUT,
  FIELD_LABEL,
  FIELD_STACK,
  FORM_ERROR,
  primaryButtonClass,
} from "@/components/AuthCard";

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

  // UIE-01 AC-14. THE THIRD STATE OF THE SAME CARD, which is the whole point of routing it through
  // AuthCard: same ground, same card, same title and subtitle, so this reads as the end of the
  // operation rather than as a different screen. `showTabs={false}` is what keeps TEA-01 AC-13's
  // terminality true — a segmented control here would let somebody click away from a terminal state.
  if (state.phase === "submitted") {
    return (
      <AuthCard tab="signup" showTabs={false}>
        <section data-testid="signup-confirm-notice" className="text-center">
          <h2 className="text-base font-bold text-ink">Check your email</h2>
          <p className="mt-2 text-[13px] text-ink-2">
            We have sent a confirmation link to the address you entered. Open it to finish signing
            up.
          </p>
        </section>
      </AuthCard>
    );
  }

  const submitting = state.phase === "submitting";

  // UIE-01 AC-10: the nine `signup-*` names on this screen are frozen. New controls may add
  // selectors; not one of these may be renamed, because twelve spec files address them.
  return (
    <AuthCard tab="signup">
      <form data-testid="signup-form" onSubmit={onSubmit} className={FIELD_STACK}>
        {/* AC-8 puts the order here, and it is originated rather than transcribed: the reference
            shows no avatar picker and no email field at all. Display name and avatar are the two
            things the person is CHOOSING about themselves, so they lead; the credentials follow. */}
        <label className="block">
          <span className={FIELD_LABEL}>Display name</span>
          <input
            data-testid="signup-display-name"
            type="text"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={FIELD_INPUT}
          />
        </label>

        {/* TEA-01 AC-8: the person supplies both. There is no server to fill them in (ADR-005) and
            no correction screen in v1, so sign-up is the only moment they can be collected.

            UIE-01 AC-9 — THE PICKER SURVIVES THE RESTYLE AS A PICKER. The reference shows no avatar
            selection at all, and removing it would break TEA-01's AC-8, the `complete` gate above
            and four assertions in tests/e2e/tea-01-signup.spec.ts. A card ~355px wide has no room
            for a wrapping grid of swatches, so it becomes ONE horizontally scrollable row at the
            same 44px rhythm as the inputs — the first swatch is reachable without scrolling, which
            is what the `.first().click()` in that spec depends on.

            `py-1` on the scroller is not spacing: the selected swatch's ring sits OUTSIDE its box,
            and an `overflow-x-auto` container with no vertical padding clips it.

            `min-w-0` ON THE FIELDSET IS LOAD-BEARING AND WAS FOUND BY LOOKING, NOT BY REASONING.
            A fieldset carries `min-inline-size: min-content` in the UA stylesheet, so it refuses to
            shrink below its widest content — twelve 44px swatches. Without this the strip does not
            scroll, it pushes the CARD wider than the viewport and the whole page scrolls sideways,
            which is exactly what AC-16 forbids. */}
        <fieldset className="block min-w-0">
          <legend className={FIELD_LABEL}>Avatar</legend>
          <div
            data-testid="signup-avatar-picker"
            role="radiogroup"
            aria-label="Avatar"
            className="flex gap-2 overflow-x-auto py-1"
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
                  // AC-9: the selected swatch is distinguished by MORE THAN COLOUR — a ring, which
                  // is a shape, and `aria-checked`, which is what a screen reader gets.
                  "h-11 w-11 shrink-0 rounded-full bg-field text-lg " +
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink " +
                  (avatar === choice ? "ring-2 ring-ink ring-offset-2 ring-offset-card" : "")
                }
              >
                {choice}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className={FIELD_LABEL}>Email</span>
          <input
            data-testid="signup-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={FIELD_INPUT}
          />
        </label>

        <label className="block">
          <span className={FIELD_LABEL}>Password</span>
          <input
            data-testid="signup-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={FIELD_INPUT}
          />
        </label>

        {/* AC-11: inside the card, between the last field and the button, still announced. */}
        {state.phase === "editing" && state.error ? (
          <p data-testid="signup-error" role="alert" className={FORM_ERROR}>
            {state.error.message}
          </p>
        ) : null}

        <button
          data-testid="signup-submit"
          type="submit"
          disabled={!complete || submitting}
          className={primaryButtonClass({ submitting, disabled: !complete })}
        >
          {submitting ? "Sending…" : "Sign up"}
        </button>
      </form>
    </AuthCard>
  );
}
