// SOLO, 2026-09-10 — the personal profile screen. No ticket, no plan, no § 2b; `.claude/agents/
// solo.md` and ADR-033 are the whole authority.
//
// **THE LAYOUT IS TRANSCRIBED FROM AN IMAGE THAT IS NOT ON DISK, so no later reader can check a
// sentence of this file against it.** `.ai/standards/ui-design-system.md` § *Visual specification*
// is explicit that a transcription is evidence of intent and not a reference. What the picture
// showed, in its order: an identity card (large avatar tile, a role pill and a team pill, the name,
// an identifier beneath it), then `Icon đại diện` — a grid of circular emoji buttons, ten to a row —
// then `Tên hiển thị`, one filled borderless input, then `Đổi mật khẩu` with a full-width current-
// password box above a two-column new/confirm pair, every box carrying a reveal eye.
//
// **THREE THINGS THE PICTURE DID NOT SHOW, DECIDED HERE AND MARKED AS THIS AGENT'S OWN:**
//
//  1. *Where the save control is.* A fifth card was cut off at the bottom edge. **ONE FORM, ONE SAVE
//     BUTTON, at the bottom** — and the picture's own sentence is what decides it: *"Bỏ trống cả ba ô
//     nếu bạn không muốn thay đổi mật khẩu"* (leave all three boxes empty if you do not want to
//     change your password) only means anything if pressing save is what submits the rest of the page
//     too. Per-card save buttons would make that sentence unnecessary.
//  2. *Whether picking an emoji saves immediately.* It does not. It is a form control like the name
//     box, and it is saved by the same button — which is the only reading consistent with (1).
//  3. *The failure and success states.* Errors sit beside the field that produced them, never all
//     together under the button; the outcome line is beside the save control.
//
// **THE COPY IS ENGLISH, and the picture's is not.** `ui-language.json` § copyDebt is empty and the
// lint rule in `eslint.config.js` fails a Vietnamese diacritic anywhere in `src/**` bar
// `fixtures.ts`. The language split is by audience and is not this screen's to revisit.
//
// **THE IDENTIFIER UNDER THE NAME IS THE EMAIL ADDRESS.** The picture shows `@min`, a handle. There
// is no handle in this product — `member` holds `display_name` and `avatar`, and nothing else that
// names a person (`.ai/standards/data-model.md`) — so rendering one would mean inventing a field and
// deriving it from the display name, which is neither unique nor stable. The address is the real
// identifier the account already has, and it comes from the auth user rather than from the member row.
//
// **EVERY WRITE GOES THROUGH THE SEAM (RULE-02) AND NEITHER TAKES A MEMBER ID.** `updateOwnProfile`
// and `changePassword` resolve the caller from the session inside the implementation, so there is no
// argument on this screen that could aim either write at somebody else.
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { seam } from "@/lib/data";
import { useShellContext } from "@/components/AppShell";
import { AVATAR_CHOICES, type Member, type Team } from "@/lib/domain/types";

/**
 * **THE MEMBER ROW IS NOT IN HERE, AND ITS ABSENCE IS THE POINT.**
 *
 * This started as `{ loading } | { unavailable } | { ready, me, email, team }`, filled by a
 * `getCurrentMember()` of its own. In the real seam that call is TWO network round trips —
 * `auth.getUser()` and then the `member` select — and the shell had already made both before this
 * screen rendered. The duplicate was visible in the network panel and is what prompted this change.
 *
 * The row now arrives through `useShellContext()`, so what is left to fetch is what the shell does
 * NOT hold: the account's email address, which lives on the auth user, and the team's name.
 *
 * **THERE IS NO LOADING PHASE AND NO UNAVAILABLE PHASE ANY MORE.** Everything the form needs is
 * present on the first render, so a spinner would cover a screen that is ready; and both remaining
 * reads already fail to `null` rather than throwing, so there is no failure that could take the
 * screen away. The email line and the team pill are absent until they arrive, which is what they
 * already did when a read failed.
 */
interface Extras {
  email: string | null;
  team: Team | null;
}

/** Which box a refusal belongs beside. `null` means the outcome line under the button — used only
 *  for a failure that belongs to no single field, such as a transport error. */
type FieldErrors = {
  displayName: string | null;
  avatar: string | null;
  currentPassword: string | null;
  newPassword: string | null;
  confirmPassword: string | null;
};

const NO_ERRORS: FieldErrors = {
  displayName: null,
  avatar: null,
  currentPassword: null,
  newPassword: null,
  confirmPassword: null,
};

/** GoTrue's own default minimum, and the number the transcription prints in the new-password
 *  placeholder. `signUp` in both seam implementations refuses below it with `weak_password`; this is
 *  the same threshold said once more, in the place that must not send a request it knows is refused. */
const PASSWORD_MIN = 6;

/** The shape `AllowList.tsx:20` already uses, so two screens do not date the same fact differently. */
const day = (iso: string): string => format(new Date(iso), "dd/MM/yyyy");

const roleLabel = (role: Member["role"]): string =>
  role === "admin" ? "Admin" : "Member";

const CARD = "rounded-card bg-card p-6 shadow-soft";
const FIELD_LABEL =
  "block text-[10px] font-bold uppercase tracking-wider text-ink-3";
const FIELD =
  "w-full rounded-pill bg-field px-4 py-2.5 text-sm text-ink placeholder:text-ink-3 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** The reveal eye. Inline SVG rather than `lucide-react`, following the decision recorded on
 *  `Sidebar.tsx`'s chevron: the package is a dependency that no file under `src/` imports, and a
 *  password box is not the change that should decide whether this product carries an icon set.
 *
 *  Open and closed are DIFFERENT PATHS and not one path with a strike-through added, because the
 *  difference has to survive at 16px. */
function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1.8 10S4.8 4.5 10 4.5 18.2 10 18.2 10 15.2 15.5 10 15.5 1.8 10 1.8 10Z" />
      <circle cx="10" cy="10" r="2.6" />
      {open ? null : <path d="m3.5 3.5 13 13" />}
    </svg>
  );
}

/** A password box and its reveal control. Written once because the screen has three of them, and
 *  three hand-written copies of an input with a button positioned inside it is three chances to get
 *  the padding that keeps the text clear of the icon wrong.
 *
 *  **THE REVEAL IS A `<button type="button">`.** Inside a form, a button with no explicit type is a
 *  SUBMIT button — so an unset type here would mean that showing your password saves the page. */
function PasswordField({
  id,
  label,
  placeholder,
  value,
  onChange,
  error,
  autoComplete,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (next: string) => void;
  error: string | null;
  autoComplete: string;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="min-w-0">
      <label className={FIELD_LABEL} htmlFor={id}>
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          id={id}
          data-testid={id}
          type={revealed ? "text" : "password"}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${FIELD} pr-11`}
        />
        <button
          type="button"
          data-testid={`${id}-reveal`}
          data-revealed={revealed}
          onClick={() => setRevealed((on) => !on)}
          // The label states what pressing it DOES, which is what a screen reader announces, and it
          // changes with the state — "Show password" on a hidden box, "Hide password" on a shown one.
          aria-label={revealed ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-pill text-ink-3 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <EyeIcon open={revealed} />
        </button>
      </div>
      {error ? (
        <p
          id={`${id}-error`}
          data-testid={`${id}-error`}
          role="alert"
          className="mt-1.5 text-xs text-danger"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default function Profile() {
  // The member row the shell already resolved. NOT read again here — see `Extras` above.
  const { member: me, refreshMembership } = useShellContext();
  const [extras, setExtras] = useState<Extras>({ email: null, team: null });

  // The form, seeded ONCE from the row that was present on the first render. A lazy initialiser and
  // not an effect: there is nothing to wait for, so there is no moment at which these are empty.
  //
  // **IT IS NOT RE-SEEDED WHEN THE CONTEXT CHANGES, DELIBERATELY.** `refreshMembership` replaces the
  // row after a save, and a re-seed on that would be harmless — the values are equal — but the same
  // effect would fire for any other refresh and discard whatever the member was in the middle of
  // typing. The save path sets these explicitly from the seam's answer instead, which is narrower
  // and says when it happens.
  const [avatar, setAvatar] = useState(me.avatar);
  const [displayName, setDisplayName] = useState(me.displayName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [errors, setErrors] = useState<FieldErrors>(NO_ERRORS);
  const [outcome, setOutcome] = useState<
    { kind: "ok" | "error"; message: string } | null
  >(null);
  const [saving, setSaving] = useState(false);

  // The two facts the shell does not hold. IN PARALLEL, because neither depends on the other and
  // running them in sequence made the team pill wait on an address it has nothing to do with.
  // `catch` per call, so one failing still yields the other.
  const load = useCallback(async (): Promise<void> => {
    const [session, team] = await Promise.all([
      seam.getSession().catch(() => null),
      seam.getTeam().catch(() => null),
    ]);
    setExtras({ email: session ? session.user.email : null, team });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (saving) return;

    const trimmed = displayName.trim();
    // **ANY of the three password boxes touched means the caller is changing their password**, and
    // the other two are then required. Reading it as "all three filled" would let a half-filled form
    // save the name and silently ignore the password — the failure mode the picture's own sentence
    // is written against.
    const wantsPassword =
      currentPassword !== "" || newPassword !== "" || confirmPassword !== "";

    const next: FieldErrors = { ...NO_ERRORS };
    if (trimmed === "") next.displayName = "Enter a display name.";
    if (wantsPassword) {
      if (currentPassword === "") {
        next.currentPassword = "Enter your current password.";
      }
      if (newPassword === "") {
        next.newPassword = "Enter a new password.";
      } else if (newPassword.length < PASSWORD_MIN) {
        next.newPassword = `Use at least ${PASSWORD_MIN} characters.`;
      }
      // Checked HERE and nowhere below the seam: two boxes that must match is a typing-mistake check
      // with no meaning to the datastore, and sending the confirmation would create a second copy of
      // this comparison that is free to disagree with this one.
      if (confirmPassword !== newPassword) {
        next.confirmPassword = "The two passwords do not match.";
      }
    }

    if (Object.values(next).some((message) => message !== null)) {
      setErrors(next);
      setOutcome(null);
      return;
    }

    const profileChanged = trimmed !== me.displayName || avatar !== me.avatar;
    if (!profileChanged && !wantsPassword) {
      setErrors(NO_ERRORS);
      setOutcome({ kind: "ok", message: "Nothing to save." });
      return;
    }

    setErrors(NO_ERRORS);
    setOutcome(null);
    setSaving(true);

    try {
      // **THE PROFILE FIRST, AND THE PASSWORD ONLY IF IT SUCCEEDED.** Two writes, two failures
      // possible, and the order decides what a half-failure means. This way round the partial state
      // is "name saved, password not", which the outcome line says in words. The other way round
      // leaves somebody holding a new password and an unsaved name, which is worse: they have to
      // notice the name themselves, and their next sign-in uses a password nothing on screen
      // confirmed.
      if (profileChanged) {
        const saved = await seam.updateOwnProfile({
          displayName: trimmed,
          avatar,
        });
        if (!saved.ok) {
          const code = saved.error.code;
          if (code === "invalid_display_name") {
            setErrors({ ...NO_ERRORS, displayName: saved.error.message });
          } else if (code === "invalid_avatar") {
            setErrors({ ...NO_ERRORS, avatar: saved.error.message });
          } else {
            setOutcome({ kind: "error", message: saved.error.message });
          }
          return;
        }

        // The seam's answer and not the local values: it returns the row as it was WRITTEN, trimmed
        // by the datastore's own rule, so the boxes show what was stored rather than what was typed.
        setAvatar(saved.value.avatar);
        setDisplayName(saved.value.displayName);
        // **AND THE IDENTITY CARD ABOVE THE FORM UPDATES THROUGH THIS AND NOTHING ELSE.** It reads
        // `me`, which is the shell's row, so this one call moves the card, the sidebar's account
        // footer and the roster together — there is no second copy here to keep in step. Nothing
        // about a `member` table write reaches `useSession` on its own, which is why it is told.
        refreshMembership();
      }

      if (wantsPassword) {
        const changed = await seam.changePassword({
          currentPassword,
          newPassword,
        });
        if (!changed.ok) {
          const code = changed.error.code;
          if (code === "wrong_password") {
            setErrors({ ...NO_ERRORS, currentPassword: changed.error.message });
          } else if (code === "weak_password") {
            setErrors({ ...NO_ERRORS, newPassword: changed.error.message });
          } else {
            setOutcome({ kind: "error", message: changed.error.message });
          }
          // Said plainly rather than left for the member to work out from the fields. A screen that
          // reported only the failure would leave them believing the name was not saved either.
          if (profileChanged) {
            setOutcome({
              kind: "error",
              message:
                "Your profile was saved, but your password was not changed.",
            });
          }
          return;
        }

        // Emptied on success, and only on success. They are not re-fillable from anywhere, so a
        // failed attempt that cleared them would make the member retype all three.
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }

      setOutcome({
        kind: "ok",
        message: wantsPassword
          ? profileChanged
            ? "Profile and password saved."
            : "Password changed."
          : "Profile saved.",
      });
    } catch {
      setOutcome({
        kind: "error",
        message: "Something went wrong. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  const { email, team } = extras;

  // **THE OFFERED SET, PLUS THE CALLER'S OWN VALUE WHEN IT IS NOT IN IT — AND THAT CASE IS NOT
  // HYPOTHETICAL.** `supabase/seed.sql:170` gives the operator's own admin account an avatar that
  // was never in this picker, and TEA-01's admission trigger writes `'🙂'` for any sign-up that
  // carried none. Rendering `AVATAR_CHOICES` alone would show such a member a radiogroup with
  // NOTHING checked, next to an identity card showing the face they actually have — and the seam
  // accepts that value (it is the *keep what you have* clause), so the control must be able to
  // represent the state the screen is in.
  //
  // It is FIRST, so the checked option is where the eye starts, and it STAYS in the row after they
  // pick an offered one — unchecked, and still clickable, which is how they undo. It is derived from
  // the SAVED row and not from the form, so it stops being offered once a different avatar is saved,
  // at which point the seam would refuse it anyway.
  //
  // The empty-string guard is for a value no code path in this product writes — `avatar` is
  // `text not null` and the trigger's `nullif(btrim(…), '')` cannot produce it — but a blank circle
  // rendered as a choice is a worse answer than one fewer choice.
  const choices =
    me.avatar === "" || AVATAR_CHOICES.includes(me.avatar)
      ? AVATAR_CHOICES
      : [me.avatar, ...AVATAR_CHOICES];

  return (
    <form
      data-testid="profile"
      onSubmit={(event) => {
        void onSubmit(event);
      }}
      className="mx-auto flex max-w-2xl flex-col gap-6"
    >
      {/* 1. The identity card. It shows the SAVED row and never the form's working values — the
          avatar tile and the name here do not move while an unsaved edit sits in the controls below,
          because this card is what the rest of the team currently sees. */}
      <div className={`${CARD} flex flex-col items-center gap-3 text-center`}>
        <span
          data-testid="profile-avatar"
          aria-hidden
          className="flex h-20 w-20 items-center justify-center rounded-card bg-field text-4xl"
        >
          {me.avatar}
        </span>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {/* `data-role` beside the rendered word, the shape `shell-roster-role` uses: an assertion
              reads the fact without depending on the copy. */}
          <span
            data-testid="profile-role"
            data-role={me.role}
            className="rounded-pill bg-field px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-ink-2"
          >
            {roleLabel(me.role)}
          </span>
          {team ? (
            <span
              data-testid="profile-team"
              className="rounded-pill bg-field px-2.5 py-1 text-[10px] font-semibold text-ink-2"
            >
              {team.name}
            </span>
          ) : null}
        </div>

        <div>
          <h1
            data-testid="profile-name"
            className="font-display text-2xl font-bold leading-tight text-ink"
          >
            {me.displayName}
          </h1>
          {/* ABSENT when the session read failed, not rendered empty. An address missing from the
              screen is a read that did not happen; a blank line under the name says the account has
              a blank address. */}
          {email ? (
            <p data-testid="profile-email" className="mt-1 text-sm text-ink-3">
              {email}
            </p>
          ) : null}
        </div>

        <p data-testid="profile-since" className="text-xs text-ink-3">
          On the team since {day(me.createdAt)}
        </p>
      </div>

      {/* 2. The avatar picker. A `radiogroup` and not a list of buttons: exactly one is chosen, which
          is what the role announces, and `aria-checked` is what a screen reader gets instead of the
          fill that carries it visually. `signup-avatar-picker` uses the same shape. */}
      <fieldset className={CARD}>
        <legend className="text-base font-semibold text-ink">Avatar</legend>
        <p className="mt-1 text-sm text-ink-2">
          Pick an emoji. It is how the team finds you on the calendar.
        </p>
        <div
          data-testid="profile-avatar-picker"
          role="radiogroup"
          aria-label="Avatar"
          // TEN TO A ROW, which is what the transcription draws, and `flex-wrap` rather than a fixed
          // ten-column grid so the strip reflows on a narrow pane instead of scrolling sideways —
          // UIE-02 AC-21 puts horizontal scrolling inside a grid, not across a settings form.
          className="mt-4 flex flex-wrap gap-2"
        >
          {choices.map((choice) => {
            const chosen = choice === avatar;
            return (
              <button
                key={choice}
                type="button"
                data-testid="profile-avatar-option"
                data-avatar={choice}
                role="radio"
                aria-checked={chosen}
                onClick={() => setAvatar(choice)}
                className={
                  // The chosen one is distinguished by FILL and by `aria-checked`, never by colour
                  // alone — the transcription draws it as a dark circle among light ones.
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-pill text-lg transition-colors " +
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink " +
                  (chosen ? "bg-primary" : "bg-field hover:bg-track")
                }
              >
                {choice}
              </button>
            );
          })}
        </div>
        {errors.avatar ? (
          <p
            data-testid="profile-avatar-error"
            role="alert"
            className="mt-3 text-xs text-danger"
          >
            {errors.avatar}
          </p>
        ) : null}
      </fieldset>

      {/* 3. The display name. */}
      <div className={CARD}>
        <label
          className="text-base font-semibold text-ink"
          htmlFor="profile-display-name"
        >
          Display name
        </label>
        <p className="mt-1 text-sm text-ink-2">
          This is the name the rest of the team sees.
        </p>
        <input
          id="profile-display-name"
          data-testid="profile-display-name"
          type="text"
          value={displayName}
          autoComplete="nickname"
          onChange={(event) => setDisplayName(event.target.value)}
          aria-invalid={errors.displayName ? true : undefined}
          aria-describedby={
            errors.displayName ? "profile-display-name-error" : undefined
          }
          className={`${FIELD} mt-4`}
        />
        {errors.displayName ? (
          <p
            id="profile-display-name-error"
            data-testid="profile-display-name-error"
            role="alert"
            className="mt-1.5 text-xs text-danger"
          >
            {errors.displayName}
          </p>
        ) : null}
      </div>

      {/* 4. The password. */}
      <div className={CARD}>
        <h2 className="text-base font-semibold text-ink">Change password</h2>
        <p className="mt-1 text-sm text-ink-2">
          Leave all three boxes empty if you are not changing your password.
        </p>

        <div className="mt-4 flex flex-col gap-4">
          <PasswordField
            id="profile-current-password"
            label="Current password"
            placeholder="Your current password"
            value={currentPassword}
            onChange={setCurrentPassword}
            error={errors.currentPassword}
            autoComplete="current-password"
          />
          {/* Two columns on a wide pane, stacked on a narrow one — the transcription's pairing, and
              `min-w-0` on each child so a long validation sentence wraps instead of widening them. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <PasswordField
              id="profile-new-password"
              label="New password"
              placeholder={`At least ${PASSWORD_MIN} characters`}
              value={newPassword}
              onChange={setNewPassword}
              error={errors.newPassword}
              autoComplete="new-password"
            />
            <PasswordField
              id="profile-confirm-password"
              label="Confirm password"
              placeholder="Type the new password again"
              value={confirmPassword}
              onChange={setConfirmPassword}
              error={errors.confirmPassword}
              autoComplete="new-password"
            />
          </div>
        </div>
      </div>

      {/* 5. The save bar — the card the transcription cut off, and this agent's own decision about
          what belongs in it. ONE submit for the whole page. */}
      <div className={`${CARD} flex flex-wrap items-center justify-between gap-4`}>
        <div className="min-w-0">
          {outcome ? (
            <p
              data-testid="profile-outcome"
              data-kind={outcome.kind}
              // A success is announced politely and a failure assertively — `role="alert"` on a
              // "Profile saved." would interrupt a screen reader mid-sentence to report good news.
              role={outcome.kind === "error" ? "alert" : "status"}
              className={
                "text-sm " +
                (outcome.kind === "error" ? "text-danger" : "text-ink-2")
              }
            >
              {outcome.message}
            </p>
          ) : (
            <p className="text-sm text-ink-3">
              Changes are saved only when you press save.
            </p>
          )}
        </div>

        <button
          type="submit"
          data-testid="profile-save"
          disabled={saving}
          className="rounded-pill bg-primary px-5 py-2.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      <p>
        <Link data-testid="profile-back" to="/" className="text-sm underline">
          Back to the start
        </Link>
      </p>
    </form>
  );
}
