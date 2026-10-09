// EVT-06 — the guest page, `/guest/:token`. 01-plan.md § 2 AC-9..AC-17; § 2b; § 4.4. ADR-052.
//
// **NO SESSION IS READ, AND NONE IS NEEDED.** The token is the whole address: a signed-out caller
// and a signed-in member of any team, role or membership state see exactly the same page (AC-16).
// It renders inside `BareLayout`, so there is no sidebar, no top bar and no sign-in screen (AC-9).
//
// **"NEVER EXISTED", "MALFORMED", "CLOSED" AND "DELETED" ARE ONE SCREEN** — `guest-event-not-found`,
// one sentence, nothing onward (AC-13). A failed read is the same screen too: a second sentence for
// it would be an oracle for which tokens were once good.
//
// **WHAT IS DRAWN IS WHAT `GuestEvent` CARRIES, AND IT CARRIES ONLY AC-12'S FIELDS.** No creator,
// scope, deadline or avatar is on this page because none reaches it.
//
// EVT-07 — 01-plan.md § 2 AC-1..AC-14, AC-20, AC-22; § 2b; § 4.4. ADR-052.
//
// **THE REGISTER BLOCK LEARNS TWO FACTS FROM ITS OWN READ**, `getGuestRegistrationTerms` (AC-22), so
// `GuestEvent` keeps exactly EVT-06's fields. A null or failed terms read leaves the page as EVT-06
// draws it, with no form. Every check here is an AFFORDANCE: `register_guest` and
// `event_guest_guard` refuse what this page lets through (ADR-005).
//
// **THE MANAGE TOKEN IS ON SCREEN ONCE**, in the block that replaces the form after registering, and
// is held in that component's state and nowhere else — no storage, no URL of this page (AC-3).
//
// **THE MANAGE PAGE, `/guest/registration/:token`, IS THE NAMED EXPORT `GuestRegistration`**, sharing
// `useGuestMeta` and the card. "Never existed", "malformed" and a failed read are one screen (AC-13).
import { useCallback, useEffect, useState, type FormEvent, type JSX } from "react";
import { useParams } from "react-router-dom";
import { seam } from "@/lib/data";
import type {
  GuestEvent as GuestEventData,
  GuestRegistrationReceipt,
  GuestRegistrationTerms,
  GuestRegistrationView,
  GuestStatus,
} from "@/lib/domain/types";
import { GUEST_EMAIL_MAX, GUEST_EMAIL_PATTERN, GUEST_NAME_MAX } from "@/lib/domain/types";
import Loader from "@/components/Loader";
import Modal from "@/components/Modal";
import { eventDateLabel } from "./Events";

type LoadState =
  | { phase: "loading" }
  | { phase: "missing" }
  | { phase: "ready"; event: GuestEventData; terms: GuestRegistrationTerms | null };

/** EVT-07 AC-3. The manage link — `<origin>/guest/registration/<manage-token>`. */
export function guestManageUrl(origin: string, token: string): string {
  return `${origin}/guest/registration/${token}`;
}

/** EVT-07 AC-4. § 4.1's checks on the trimmed values, as the table's checks state them — lengths in
 *  code points, as `char_length` counts. An affordance; the seam and the database check again. */
export function guestRegistrationProblem(
  name: string,
  email: string,
): "invalid_guest_name" | "invalid_guest_email" | null {
  const n = name.trim();
  const e = email.trim();
  if (n === "" || [...n].length > GUEST_NAME_MAX) return "invalid_guest_name";
  if ([...e].length > GUEST_EMAIL_MAX || !GUEST_EMAIL_PATTERN.test(e)) return "invalid_guest_email";
  return null;
}

// The sentences the form shows for its own two checks — the seam's, word for word.
const PROBLEM_TEXT: Record<"invalid_guest_name" | "invalid_guest_email", string> = {
  invalid_guest_name: "Please give your name, in 100 characters or fewer.",
  invalid_guest_email: "Please give a valid email address, in 254 characters or fewer.",
};

/** AC-9. The seats line's three strings. */
export function guestSeatsLabel(capacity: number | null, seatsTaken: number): string {
  if (capacity === null) return "No seat limit";
  if (seatsTaken >= capacity) return "Full";
  return `${capacity - seatsTaken} of ${capacity} seats left`;
}

/** AC-15. The two `<meta>` tags, on this page only — added on mount and removed on unmount, so no
 *  other address carries them once the reader leaves. */
function useGuestMeta(): void {
  useEffect(() => {
    const tags = [
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ].map(({ name, content }) => {
      const meta = document.createElement("meta");
      meta.setAttribute("name", name);
      meta.setAttribute("content", content);
      document.head.appendChild(meta);
      return meta;
    });
    return () => {
      for (const meta of tags) meta.remove();
    };
  }, []);
}

const CARD = "flex flex-col gap-4 rounded-card bg-card p-6 shadow-soft md:p-8";

const PRIMARY_BUTTON =
  "rounded-pill bg-primary px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90 " +
  "disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const QUIET_BUTTON =
  "rounded-pill border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 transition-colors " +
  "hover:border-ink-3 hover:text-ink disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const FIELD =
  "w-full rounded-pill bg-field px-3 py-2 text-sm text-ink focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-ink";

export default function GuestEvent(): JSX.Element {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  useGuestMeta();

  useEffect(() => {
    let live = true;
    setState({ phase: "loading" });
    // EVT-07 AC-22. The terms read failing never costs the guest the page EVT-06 draws.
    const terms = seam.getGuestRegistrationTerms(token ?? "").catch(() => null);
    Promise.all([seam.getGuestEvent(token ?? ""), terms])
      .then(([event, termsRead]) => {
        if (live) {
          setState(event ? { phase: "ready", event, terms: termsRead } : { phase: "missing" });
        }
      })
      .catch(() => {
        if (live) setState({ phase: "missing" });
      });
    return () => {
      live = false;
    };
  }, [token]);

  // EVT-07 AC-1. After a registration, the seats and the names are read again in place — no loading
  // phase, so the block holding the manage link is not unmounted.
  const refresh = useCallback(async (): Promise<void> => {
    try {
      const event = await seam.getGuestEvent(token ?? "");
      if (event) setState((s) => (s.phase === "ready" ? { ...s, event } : s));
    } catch {
      // The registration stands; a stale count is the cost.
    }
  }, [token]);

  return (
    <section className="mx-auto flex max-w-xl flex-col gap-3">
      {/* § 2b. The product name, not a link: a guest has nowhere in it to go. */}
      <p className="text-center text-xs font-bold uppercase tracking-wide text-ink-3">CaleChip</p>

      {state.phase === "loading" ? (
        <p role="status" className="p-8 text-center text-sm text-ink-2">
          <Loader label="Loading the event…" />
        </p>
      ) : state.phase === "missing" ? (
        <div data-testid="guest-event-not-found" className={`${CARD} text-center text-sm text-ink-2`}>
          <p>This link does not work. It may have been closed, or the address may be incomplete.</p>
        </div>
      ) : (
        <GuestEventCard
          event={state.event}
          register={
            state.terms ? (
              <GuestRegisterPanel
                token={token ?? ""}
                event={state.event}
                terms={state.terms}
                onRegistered={() => void refresh()}
              />
            ) : null
          }
        />
      )}
    </section>
  );
}

function GuestEventCard({
  event,
  register,
}: {
  event: GuestEventData;
  register: JSX.Element | null;
}): JSX.Element {
  const full = event.capacity !== null && event.seatsTaken >= event.capacity;
  const names = event.attendeeNames;

  // AC-9. Top to bottom: name; dates; location; description; seats; who is coming.
  return (
    <article data-testid="guest-event" className={CARD}>
      <h1 data-testid="guest-event-name" className="break-words text-xl font-extrabold text-ink">
        {event.name}
      </h1>

      <p data-testid="guest-event-dates" className="text-sm font-semibold text-ink-2">
        {eventDateLabel(event)}
      </p>

      {event.location !== null ? (
        <p data-testid="guest-event-location" className="text-sm text-ink-2">
          <span className="text-xs font-bold uppercase tracking-wide text-ink-3">Where</span>{" "}
          <span className="text-ink">{event.location}</span>
        </p>
      ) : null}

      {event.description !== null ? (
        <p data-testid="guest-event-description" className="whitespace-pre-wrap text-sm text-ink">
          {event.description}
        </p>
      ) : null}

      <div>
        {/* § 2b. *Full* is the overloaded-day pink, never red. */}
        <span
          data-testid="guest-event-seats"
          className={`rounded-pill px-2.5 py-0.5 text-xs font-bold ${full ? "bg-overload text-ink" : "bg-field text-ink-2"}`}
        >
          {guestSeatsLabel(event.capacity, event.seatsTaken)}
        </span>
      </div>

      {register}

      {/* AC-10. Names only, in join order; no avatar, because AC-12 sends none. EVT-07 AC-14:
          attending guests' names are among them, unmarked. */}
      <div data-testid="guest-event-attendees" className="flex flex-col gap-2 border-t border-line pt-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-ink-3">Going ({names.length})</h2>
        {names.length === 0 ? (
          <p data-testid="guest-event-attendees-empty" className="text-sm text-ink-3">
            Nobody has joined yet.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {names.map((name, index) => (
              <li
                // Names are not unique and there is no id to key on (AC-12); join order is stable.
                key={index}
                data-testid="guest-event-attendee"
                className="rounded-pill bg-field px-2.5 py-0.5 text-xs font-semibold text-ink"
              >
                {name ?? "Former member"}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}

/** EVT-07 § 2b. The register block: the form, or closed, or full, or — after submitting — the status
 *  and the manage link, once. */
function GuestRegisterPanel({
  token,
  event,
  terms,
  onRegistered,
}: {
  token: string;
  event: GuestEventData;
  terms: GuestRegistrationTerms;
  onRegistered: () => void;
}): JSX.Element {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<GuestRegistrationReceipt | null>(null);
  const [copy, setCopy] = useState<"idle" | "copied" | "refused">("idle");

  const heading = terms.requiresApproval ? "Request to join" : "Register";
  const full = event.capacity !== null && event.seatsTaken >= event.capacity;
  const address = receipt ? guestManageUrl(window.location.origin, receipt.manageToken) : "";

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const problem = guestRegistrationProblem(name, email);
    if (problem) {
      setError(PROBLEM_TEXT[problem]);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await seam.registerGuest(token, name, email);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setReceipt(result.value);
    onRegistered();
  }

  // EVT-06 AC-8's copy: where the browser refuses the clipboard, the address stays on screen.
  async function onCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(address);
      setCopy("copied");
    } catch {
      setCopy("refused");
    }
  }

  const label = <h2 className="text-xs font-bold uppercase tracking-wide text-ink-3">{heading}</h2>;

  if (receipt) {
    return (
      <div data-testid="guest-registered" className="flex flex-col gap-3 border-t border-line pt-4">
        {label}
        <p
          data-testid="guest-registered-status"
          data-status={receipt.status}
          className="text-sm font-semibold text-ink"
        >
          {receipt.status === "pending"
            ? "Your request is waiting for the organiser's decision."
            : "You're going."}
        </p>
        {/* § 2b. The soft lavender callout. */}
        <div className="flex flex-col gap-2 rounded-card bg-holiday/30 p-4">
          <p className="text-sm text-ink">
            Save this link. It is shown only once, and it is the only way to check your registration or
            cancel it.
          </p>
          <div className="flex gap-2">
            <input
              data-testid="guest-manage-link"
              type="text"
              readOnly
              value={address}
              aria-label="Your registration link"
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-pill bg-card px-3 py-1.5 text-xs text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            />
            <button
              data-testid="guest-manage-copy-button"
              type="button"
              onClick={() => void onCopy()}
              className={QUIET_BUTTON}
            >
              Copy
            </button>
          </div>
          <p data-testid="guest-manage-copied" role="status" aria-live="polite" className="text-xs text-ink-2">
            {copy === "copied"
              ? "Copied"
              : copy === "refused"
                ? "Copying is blocked here. Select the address and copy it yourself."
                : ""}
          </p>
        </div>
      </div>
    );
  }

  if (!terms.registrationOpen) {
    return (
      <div data-testid="guest-register" className="flex flex-col gap-2 border-t border-line pt-4">
        {label}
        <p data-testid="guest-register-closed" className="text-sm text-ink-2">
          Registration closed
        </p>
      </div>
    );
  }

  // AC-6. A request holds no seat, so a full event still takes one (AC-2).
  if (full && !terms.requiresApproval) {
    return (
      <div data-testid="guest-register" className="flex flex-col gap-2 border-t border-line pt-4">
        {label}
        <p data-testid="guest-register-full" className="text-sm text-ink-2">
          <span className="rounded-pill bg-overload px-2.5 py-0.5 text-xs font-bold text-ink">Full</span>{" "}
          This event is full.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="guest-register" className="flex flex-col gap-3 border-t border-line pt-4">
      {label}
      {terms.requiresApproval ? (
        <p className="text-xs text-ink-3">The organiser approves each request.</p>
      ) : null}
      <form className="flex flex-col gap-3" noValidate onSubmit={(e) => void onSubmit(e)}>
        <label className="flex flex-col gap-1 text-xs font-bold text-ink-3">
          Your name
          <input
            data-testid="guest-register-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={FIELD}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-ink-3">
          Your email
          <input
            data-testid="guest-register-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={FIELD}
          />
        </label>
        {error !== null ? (
          <p data-testid="guest-register-error" role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div>
          <button data-testid="guest-register-submit" type="submit" disabled={busy} className={PRIMARY_BUTTON}>
            {heading}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EVT-07 — the manage page, `/guest/registration/:token`. AC-11, AC-12, AC-13, AC-20.
// ---------------------------------------------------------------------------

type RegistrationState =
  | { phase: "loading" }
  | { phase: "missing" }
  | { phase: "ready"; view: GuestRegistrationView };

/** AC-11. One sentence per state. */
const GUEST_STATUS_TEXT: Record<GuestStatus, string> = {
  pending: "Your request is waiting for a decision.",
  attending: "You're going.",
  rejected: "Your request was declined.",
  removed: "You were taken off the list for this event.",
  cancelled: "You cancelled your registration.",
};

/** § 2b. Peach for waiting, mint for going, the field grey for the other three. */
const GUEST_STATUS_PILL: Record<GuestStatus, string> = {
  pending: "bg-pto text-ink",
  attending: "bg-wfh text-ink",
  rejected: "bg-field text-ink-2",
  removed: "bg-field text-ink-2",
  cancelled: "bg-field text-ink-2",
};

export function GuestRegistration(): JSX.Element {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<RegistrationState>({ phase: "loading" });
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useGuestMeta();

  const load = useCallback(async (): Promise<void> => {
    try {
      const view = await seam.getGuestRegistration(token ?? "");
      setState(view ? { phase: "ready", view } : { phase: "missing" });
    } catch {
      setState({ phase: "missing" });
    }
  }, [token]);

  useEffect(() => {
    setState({ phase: "loading" });
    void load();
  }, [load]);

  async function onCancel(): Promise<void> {
    setConfirming(false);
    setBusy(true);
    setError(null);
    const result = await seam.cancelGuestRegistration(token ?? "");
    setBusy(false);
    if (!result.ok) setError(result.error.message);
    await load();
  }

  return (
    <section className="mx-auto flex max-w-xl flex-col gap-3">
      <p className="text-center text-xs font-bold uppercase tracking-wide text-ink-3">CaleChip</p>

      {state.phase === "loading" ? (
        <p role="status" className="p-8 text-center text-sm text-ink-2">
          <Loader label="Loading your registration…" />
        </p>
      ) : state.phase === "missing" ? (
        <div data-testid="guest-registration-not-found" className={`${CARD} text-center text-sm text-ink-2`}>
          <p>This link does not work. Check that you copied the whole address.</p>
        </div>
      ) : (
        <GuestRegistrationCard
          view={state.view}
          busy={busy}
          error={error}
          onCancel={() => {
            setError(null);
            setConfirming(true);
          }}
        />
      )}

      {confirming ? (
        <Modal testIdPrefix="guest-cancel" label="Cancel your registration" onClose={() => setConfirming(false)}>
          <div className="flex flex-col gap-4 pr-8">
            <h2 className="text-lg font-extrabold text-ink">Cancel your registration?</h2>
            <p className="text-sm text-ink-2">
              Your seat or request will be given up. You cannot register again with this email.
            </p>
            <div className="flex justify-end gap-2">
              <button
                data-testid="guest-cancel-cancel"
                type="button"
                onClick={() => setConfirming(false)}
                className={QUIET_BUTTON}
              >
                Keep it
              </button>
              <button
                data-testid="guest-cancel-confirm"
                type="button"
                disabled={busy}
                onClick={() => void onCancel()}
                className="rounded-pill bg-danger px-4 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                Cancel registration
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

function GuestRegistrationCard({
  view,
  busy,
  error,
  onCancel,
}: {
  view: GuestRegistrationView;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
}): JSX.Element {
  const canCancel =
    !view.eventDeleted &&
    view.registrationOpen &&
    (view.status === "pending" || view.status === "attending");

  // AC-11. Top to bottom: event name; dates; location; the guest's name; the status. No email, no
  // other person, no seat count.
  return (
    <article data-testid="guest-registration" className={CARD}>
      <h1 data-testid="guest-registration-event" className="break-words text-xl font-extrabold text-ink">
        {view.eventName}
      </h1>

      {view.eventDeleted ? (
        // AC-20.
        <p className="text-sm font-semibold text-ink-2">This event was cancelled.</p>
      ) : view.startDate !== null && view.endDate !== null ? (
        <p data-testid="guest-registration-dates" className="text-sm font-semibold text-ink-2">
          {eventDateLabel({ startDate: view.startDate, endDate: view.endDate })}
        </p>
      ) : null}

      {view.location !== null ? (
        <p data-testid="guest-registration-location" className="text-sm text-ink-2">
          <span className="text-xs font-bold uppercase tracking-wide text-ink-3">Where</span>{" "}
          <span className="text-ink">{view.location}</span>
        </p>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-line pt-4">
        <p className="text-sm text-ink-2">
          <span className="text-xs font-bold uppercase tracking-wide text-ink-3">Registered as</span>{" "}
          <span data-testid="guest-registration-name" className="font-semibold text-ink">
            {view.guestName}
          </span>
        </p>
        <p
          data-testid="guest-registration-status"
          data-status={view.status}
          className="flex flex-wrap items-center gap-2 text-sm text-ink"
        >
          <span className={`rounded-pill px-2.5 py-0.5 text-xs font-bold ${GUEST_STATUS_PILL[view.status]}`}>
            {view.status === "pending" ? "Waiting" : view.status === "attending" ? "Going" : "Not going"}
          </span>
          {GUEST_STATUS_TEXT[view.status]}
        </p>

        {error !== null ? (
          <p data-testid="guest-registration-error" role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}

        {canCancel ? (
          <div>
            <button
              data-testid="guest-registration-cancel-button"
              type="button"
              disabled={busy}
              onClick={onCancel}
              className="text-xs font-semibold text-danger underline disabled:opacity-50"
            >
              Cancel my registration
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
