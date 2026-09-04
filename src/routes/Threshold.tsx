// ADM-01 — set the overload threshold. 01-plan.md sections 3, 4.1 and 4.3.
//
// EVERYTHING in this file is an affordance (ADR-005). The check lives in row-level security and
// nowhere else: `team_update_admin` plus `grant update (overload_threshold) on public.team` refuse a
// member, a removed member, another team and every column other than the one, whoever issues the
// statement. What is below hides a control the policy would refuse anyway, which saves a round trip
// and says why — it enforces nothing. AC-5 is the criterion that proves it: it calls the seam
// function past every control this file draws.
//
// THE SCREEN IS THE ONE EDGE THAT SPEAKS PERCENT. `Team.overloadThreshold` is a SHARE and the seam
// declares the fraction form on `SetOverloadThresholdInput`; `src/lib/data/absence.ts` compares a
// share on both sides. The two conversions below are the only ones in the product, and putting them
// in `src/lib/` would create a second place that knows the representation (01-plan.md section 5).
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
// The seam, through its one door: nothing above the seam names an implementation, so this file must
// never import `@/lib/data/supabase` or `@/lib/data/mock`.
import { seam } from "@/lib/data";
import type { Failure, Member, Team } from "@/lib/domain/types";

/** The stored share as the whole percent the screen speaks in. AC-1. */
const toPercent = (share: number): number => Math.round(share * 100);

/** The whole percent back to the share the column holds. AC-2. */
const toShare = (percent: number): number => percent / 100;

/** AC-8. A WHOLE percentage, so a fractional, an empty and a non-numeric value are all refused by
 *  the same test. Written as a pattern rather than as `Number.isInteger(Number(v))` because
 *  `Number("")` is `0` and `Number(" ")` is `0` — both would pass a numeric check and save a
 *  threshold nobody typed. */
const WHOLE_NUMBER = /^-?\d+$/;

const NOT_WHOLE = "Enter a whole percentage, with no decimal point.";
const OUT_OF_RANGE = "The threshold must be between 0% and 100%, inclusive.";

// The four states of design section 4.3, mirroring the `View` union AllowList.tsx and
// TeamEntries.tsx already carry. `loading` MUST resolve, which is why every path out of the effect
// below sets one of the other three.
//
// `ready` IS ADMIN-ONLY. Design section 4.3 shows `threshold-refused` for a member as well as for a
// caller with no member row (AC-4, AC-6), so a member never reaches this phase — which makes the
// "ready, admin" qualifier on the input and the save control in that table hold trivially rather
// than describing a second shape of `ready`.
type View =
  | { phase: "loading" }
  | { phase: "refused" }
  | { phase: "unavailable" }
  | { phase: "ready"; me: Member; team: Team };

export default function Threshold() {
  const [view, setView] = useState<View>({ phase: "loading" });

  const [percent, setPercent] = useState("");
  const [saving, setSaving] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<Failure | null>(null);
  const [saved, setSaved] = useState(false);

  // AC-1, AC-3. The value is READ on mount and never carried in from anywhere — a screen opened a
  // second time asks the seam again, which is the whole of AC-3.
  const load = useCallback(async (): Promise<void> => {
    try {
      const me = await seam.getCurrentMember();

      // AC-4 and AC-6 in one branch, and deliberately so: a member, a caller with no member row and
      // a caller with no session all land here and are told the same thing. Distinguishing them
      // would tell somebody outside the team that a team exists and has a threshold, which is the
      // half of AC-6 that is about disclosure rather than about display.
      if (!me || me.role !== "admin") {
        setView({ phase: "refused" });
        return;
      }

      const team = await seam.getTeam();
      if (!team) {
        // An admin whose own team row does not come back. `team_select_own` returns it for every
        // caller with a member row, so this is a build where CAL-04's migration has not been
        // applied — not a refusal, and folding it into `refused` would tell an admin they are not
        // one. TeamEntries.tsx records the same choice for the same reason.
        setView({ phase: "unavailable" });
        return;
      }

      setPercent(String(toPercent(team.overloadThreshold)));
      setView({ phase: "ready", me, team });
    } catch {
      // A transport failure, or the Supabase client raising on an unusable configuration before any
      // request leaves. Design section 4.3 gives this screen an `unavailable` phase precisely so a
      // broken connection does not have to be reported as a permission refusal.
      setView({ phase: "unavailable" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (saving || view.phase !== "ready") return;

    setSaved(false);
    setSaveError(null);

    // AC-7 and AC-8. VALIDATION HAPPENS BEFORE THE CALL, not after it: a refused value issues
    // nothing at all, so there is no write to undo and the stored value cannot change. There is no
    // `check` constraint behind this column (01-plan.md section 6), so this is where the range is
    // decided — and it is a product decision (Open question 2), not a datastore truth.
    const raw = percent.trim();
    if (!WHOLE_NUMBER.test(raw)) {
      setInputError(NOT_WHOLE);
      return;
    }
    const value = Number(raw);
    if (value < 0 || value > 100) {
      setInputError(OUT_OF_RANGE);
      return;
    }
    setInputError(null);

    setSaving(true);
    try {
      // AC-9. ONE FIELD, and no team is passed and none can be: the seam reads the row from the
      // caller and the policy re-derives it.
      const result = await seam.setOverloadThreshold({ overloadThreshold: toShare(value) });
      if (result.ok) {
        // AC-2, AC-12. The row the DATASTORE returned, not the number that was typed — the
        // `.select()` on the update is what makes the two distinguishable, and a refusal comes back
        // as `not_permitted` rather than as a value.
        setView({ phase: "ready", me: view.me, team: result.value });
        setPercent(String(toPercent(result.value.overloadThreshold)));
        setSaved(true);
      } else {
        // AC-5 arriving at a screen. It is reachable here only for an admin whose write the policy
        // refused anyway — a removed one, or a build with no `team_update_admin`.
        setSaveError(result.error);
      }
    } catch {
      setSaveError({ code: "unknown", message: "Could not save the threshold. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  if (view.phase === "loading") {
    return (
      <p
        data-testid="threshold-loading"
        role="status"
        className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center text-sm opacity-70 shadow-sm"
      >
        Opening the setting…
      </p>
    );
  }

  if (view.phase === "refused") {
    return (
      <section
        data-testid="threshold-refused"
        className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-sm"
      >
        <h1 className="text-xl font-semibold">This setting is for admins</h1>
        {/* AC-6. It names no team and no number: somebody outside the team learns nothing here
            beyond the fact that admins exist, which the sign-up screen already says. */}
        <p className="mt-2 text-sm opacity-70">
          Only an admin can change the share of the team above which a day is called crowded.
        </p>
        <p className="mt-4">
          <Link data-testid="threshold-back" to="/" className="text-sm underline">
            Back to the start
          </Link>
        </p>
      </section>
    );
  }

  if (view.phase === "unavailable") {
    return (
      <section
        data-testid="threshold-unavailable"
        role="alert"
        className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center shadow-sm"
      >
        <h1 className="text-xl font-semibold">The threshold could not be loaded</h1>
        {/* No input is drawn on this path. An admin typing into a field whose current value never
            arrived would be replacing a number they never saw, which is the mistake AC-1 exists to
            prevent. */}
        <p className="mt-2 text-sm opacity-70">
          The setting could not be read just now. Try again in a moment.
        </p>
        <p className="mt-4">
          <Link data-testid="threshold-back" to="/" className="text-sm underline">
            Back to the start
          </Link>
        </p>
      </section>
    );
  }

  const { team } = view;

  return (
    <section className="mx-auto flex max-w-md flex-col gap-6 rounded-2xl bg-white p-8 shadow-sm">
      <header>
        <h1 className="text-xl font-semibold">When is a day crowded?</h1>
        {/* AC-11, and it is permanent rather than a hint on the input. Charter refusal 6: a warning
            here never blocks anything, and an admin moving this number needs to know that before
            they move it rather than after somebody asks them why nothing happened. */}
        <p className="mt-2 text-sm opacity-70">
          A day is crowded when more than this share of the team is away. Nothing is ever blocked or
          refused because of it — the board says a day is crowded and everyone decides what to do.
        </p>
      </header>

      {/* AC-1. `data-threshold` carries the stored FRACTION, the way `month-threshold` already does
          in src/routes/MonthView.tsx — so a test asserts the share rather than parsing copy. */}
      <p data-testid="threshold-current" data-threshold={team.overloadThreshold} className="text-sm">
        Currently crowded above <strong>{toPercent(team.overloadThreshold)}%</strong> of the team.
      </p>

      <form onSubmit={onSave} className="flex flex-col gap-3" aria-label="Set the threshold">
        <label className="flex flex-col gap-1 text-sm">
          Crowded above this percentage of the team
          {/* NO `min`, `max`, `step` OR `required`, and that is the opposite of the reflex.
              A native constraint does not merely add a second check — it SUPPRESSES the submit
              handler, so `onSave` never runs, `threshold-input-error` is never rendered, and AC-7
              and AC-8's "the screen says…" is satisfied by a browser tooltip that names no
              percentage and that no selector in design section 4.3 can reach. Measured: with
              `min`/`max`/`step` present, both criteria failed on that selector being absent.
              It would also be a second copy of the range, in a second language, able to disagree
              with the one above. The range lives in `onSave` and nowhere else. */}
          <input
            data-testid="threshold-input"
            type="number"
            inputMode="numeric"
            value={percent}
            onChange={(e) => {
              setPercent(e.target.value);
              setInputError(null);
              setSaved(false);
            }}
            className="rounded-xl border border-slate-200 px-3 py-2"
          />
        </label>

        {inputError ? (
          <p data-testid="threshold-input-error" role="alert" className="text-sm text-rose-600">
            {inputError}
          </p>
        ) : null}

        {saveError ? (
          <p data-testid="threshold-error" role="alert" className="text-sm text-rose-600">
            {saveError.message}
          </p>
        ) : null}

        {saved ? (
          <p data-testid="threshold-saved" role="status" className="text-sm text-emerald-700">
            Saved. Every day on the board is now measured against this share.
          </p>
        ) : null}

        <button
          data-testid="threshold-save"
          type="submit"
          disabled={saving}
          className="self-start rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save threshold"}
        </button>
      </form>

      <p>
        <Link data-testid="threshold-back" to="/" className="text-sm underline">
          Back to the start
        </Link>
      </p>
    </section>
  );
}
