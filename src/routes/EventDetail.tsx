// EVT-01 — one event. 01-plan.md § 2 AC-13, AC-15, AC-16, AC-17, AC-22; § 2b; § 4.4.
//
// **"DOES NOT EXIST" AND "YOU MAY NOT READ IT" ARE ONE SCREEN** — `event-not-found`, and nothing
// else (AC-22). `getEvent` answers null for both because a filtered select cannot tell them apart,
// and this page must not either: a second sentence would be an oracle for which event ids exist.
//
// **THE EDIT AND DELETE CONTROLS AND THE NAMED LIST ARE AFFORDANCES.** They render for the creator
// and for admins (AC-17, AC-13); `event_update_manage`, `event_delete_manage` and
// `event_invitee_select_manage` are the controls, and `listEventInvitees` answers an empty list to
// anybody else whatever this page draws.
//
// EVT-02. Beneath EVT-01's fields, `EventAttendancePanel` — seats, deadline, the join panel, the
// requests and who is coming (01-plan.md § 2 AC-27, § 2b). EVT-01's order above it is unchanged.
//
// EVT-06. Last in the card, `EventGuestPanel` — open, copy and close the guest link (01-plan.md § 2b,
// § 4.4). **AN AFFORDANCE**, drawn for the creator and admins: `event_guest_link_select_manage`,
// `_insert_manage` and `_delete_manage` are the controls, and `getEventGuestLink` answers null to
// anybody else whatever this page draws. A non-manager's load makes no guest-link call (AC-18).
//
// The delete confirmation is a dialog; the picker on the form is deliberately not, so the route
// family never stacks one dialog on another (§ 2b).
import { useCallback, useEffect, useState, type JSX } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { seam } from "@/lib/data";
import type { CalEvent, DirectoryMember, EventGuestLink, Member } from "@/lib/domain/types";
import Avatar from "@/components/Avatar";
import Loader from "@/components/Loader";
import Modal from "@/components/Modal";
import EventAttendancePanel from "@/components/EventAttendancePanel";
import { EventScopeBadge, creatorName, eventDateLabel } from "./Events";

type LoadState =
  | { phase: "loading" }
  | { phase: "missing" }
  | {
      phase: "ready";
      event: CalEvent;
      me: Member | null;
      directory: DirectoryMember[];
      invitees: string[];
      // EVT-06. Null when not open — and always null for a non-manager, who never asks.
      guestLink: EventGuestLink | null;
    };

const ACTION_BUTTON =
  "rounded-pill border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 transition-colors " +
  "hover:border-ink-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** The creator or an admin — the affordance over `event_update_manage` (AC-17). Admin is asked as
 *  `role === "admin"` and never through `mayDecide`: a manager gains nothing here (Q9, Q24). */
export function mayEditEvent(event: CalEvent, me: Member | null): boolean {
  return me !== null && (me.id === event.creatorId || me.role === "admin");
}

/** EVT-06 AC-1. The guest page's full address. */
export function guestLinkUrl(origin: string, token: string): string {
  return `${origin}/guest/${token}`;
}

export default function EventDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    if (!id) {
      setState({ phase: "missing" });
      return;
    }
    try {
      const [event, me, directory, invitees] = await Promise.all([
        seam.getEvent(id),
        seam.getCurrentMember(),
        seam.listMemberDirectory(),
        seam.listEventInvitees(id),
      ]);
      if (!event) {
        setState({ phase: "missing" });
        return;
      }
      // EVT-06, AC-18. Asked only by someone who may manage the event, so nobody else's load
      // changes by a single call.
      const guestLink = mayEditEvent(event, me) ? await seam.getEventGuestLink(id) : null;
      setState({ phase: "ready", event, me, directory, invitees, guestLink });
    } catch {
      setState({ phase: "missing" });
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.phase === "loading") {
    return (
      <p role="status" className="mx-auto max-w-xl p-8 text-center text-sm text-ink-2">
        <Loader label="Loading the event…" />
      </p>
    );
  }

  if (state.phase === "missing") {
    return (
      <section
        data-testid="event-not-found"
        className="mx-auto flex max-w-xl flex-col gap-4 rounded-card bg-card p-8 text-center text-sm text-ink-2 shadow-soft"
      >
        <p>We could not find that event.</p>
        <p>
          <Link to="/events" className="font-semibold text-ink underline">
            Back to events
          </Link>
        </p>
      </section>
    );
  }

  const { event, me, directory, invitees, guestLink } = state;
  const canEdit = mayEditEvent(event, me);

  async function onConfirmDelete(): Promise<void> {
    setDeleting(true);
    setDeleteError(null);
    const result = await seam.deleteEvent(event.id);
    setDeleting(false);
    if (!result.ok) {
      setDeleteError(result.error.message);
      return;
    }
    // AC-15. Gone for every reader; the creator lands on the list.
    navigate("/events");
  }

  // AC-13. Names, never ids; somebody no longer in the directory is a former member.
  const named = invitees.map((memberId) => ({
    memberId,
    person: directory.find((m) => m.id === memberId) ?? null,
  }));

  return (
    <section className="mx-auto flex max-w-xl flex-col gap-4">
      <Link to="/events" className="self-start text-xs font-semibold text-ink-3 hover:text-ink">
        &lsaquo; Events
      </Link>

      {/* AC-22. Top to bottom: name; date range; scope badge; creator; location; description; and,
          for the creator and admins on a named-people event, the named list. */}
      <article data-testid="event-detail" className="flex flex-col gap-4 rounded-card bg-card p-6 shadow-soft md:p-8">
        <div className="flex flex-wrap items-start gap-3">
          <h1 data-testid="event-name" className="min-w-0 flex-1 break-words text-xl font-extrabold text-ink">
            {event.name}
          </h1>
          {canEdit ? (
            <div className="flex gap-2">
              <Link data-testid="event-edit-button" to={`/events/${event.id}/edit`} className={ACTION_BUTTON}>
                Edit
              </Link>
              <button
                data-testid="event-delete-button"
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setConfirming(true);
                }}
                className={`${ACTION_BUTTON} hover:border-danger hover:text-danger`}
              >
                Delete
              </button>
            </div>
          ) : null}
        </div>

        <p data-testid="event-dates" className="text-sm font-semibold text-ink-2">
          {eventDateLabel(event)}
        </p>

        <div>
          <EventScopeBadge scope={event.scope} testId="event-scope" />
        </div>

        <p data-testid="event-creator" data-creator-id={event.creatorId} className="text-sm text-ink-2">
          Announced by{" "}
          <span className="font-semibold text-ink">{creatorName(event.creatorId, directory)}</span>
        </p>

        {/* AC-2. Absent, not an empty label, when the event has none. */}
        {event.location !== null ? (
          <p data-testid="event-location" className="text-sm text-ink-2">
            <span className="text-xs font-bold uppercase tracking-wide text-ink-3">Where</span>{" "}
            <span className="text-ink">{event.location}</span>
          </p>
        ) : null}

        {event.description !== null ? (
          <p data-testid="event-description" className="whitespace-pre-wrap text-sm text-ink">
            {event.description}
          </p>
        ) : null}

        {canEdit && event.scope === "named" ? (
          <div data-testid="event-invitees" className="flex flex-col gap-2 border-t border-line pt-4">
            <h2 className="text-xs font-bold uppercase tracking-wide text-ink-3">
              Invited ({named.length})
            </h2>
            {named.length === 0 ? (
              <p className="text-sm text-ink-3">Nobody is named yet.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {named.map(({ memberId, person }) => (
                  <li
                    key={memberId}
                    data-member-id={memberId}
                    className="flex items-center gap-1.5 rounded-pill bg-field py-0.5 pl-0.5 pr-2.5 text-xs font-semibold text-ink"
                  >
                    <Avatar value={person?.avatar ?? ""} className="h-5 w-5 rounded-full" />
                    {person ? person.displayName : "Former member"}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {/* EVT-02, AC-27. Keyed on `updatedAt` so an edit elsewhere reloads the list with the event. */}
        <EventAttendancePanel
          key={event.updatedAt}
          event={event}
          me={me}
          directory={directory}
          invitees={invitees}
          canManage={canEdit}
        />

        {/* EVT-06, AC-2, AC-3. Managers only, last in the card. */}
        {canEdit ? (
          <EventGuestPanel
            event={event}
            link={guestLink}
            onChange={(next) =>
              setState((current) => (current.phase === "ready" ? { ...current, guestLink: next } : current))
            }
          />
        ) : null}
      </article>

      {confirming ? (
        <Modal testIdPrefix="event-delete" label="Delete this event" onClose={() => setConfirming(false)}>
          <div className="flex flex-col gap-4 pr-8">
            {/* AC-15. The confirmation names the event. */}
            <h2 className="text-lg font-extrabold text-ink">Delete &ldquo;{event.name}&rdquo;?</h2>
            <p className="text-sm text-ink-2">
              It will disappear for everyone it was announced to. This cannot be undone.
            </p>
            {deleteError !== null ? (
              <p role="alert" className="text-sm text-danger">
                {deleteError}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                data-testid="event-delete-cancel"
                type="button"
                onClick={() => setConfirming(false)}
                className={ACTION_BUTTON}
              >
                Cancel
              </button>
              <button
                data-testid="event-delete-confirm"
                type="button"
                disabled={deleting}
                onClick={() => void onConfirmDelete()}
                className="rounded-pill bg-danger px-4 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                {deleting ? "Deleting…" : "Delete event"}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

type CopyState = "idle" | "copied" | "refused";

/** EVT-06 § 2b. Open, copy and close the guest link. `onChange` reports the link the datastore now
 *  holds, so the page never draws one the datastore did not return. */
function EventGuestPanel({
  event,
  link,
  onChange,
}: {
  event: CalEvent;
  link: EventGuestLink | null;
  onChange: (link: EventGuestLink | null) => void;
}): JSX.Element {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copy, setCopy] = useState<CopyState>("idle");
  const [confirming, setConfirming] = useState(false);
  const address = link ? guestLinkUrl(window.location.origin, link.token) : "";

  async function onOpen(): Promise<void> {
    setBusy(true);
    setError(null);
    setCopy("idle");
    const result = await seam.openEventToGuests(event.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    onChange(result.value);
  }

  async function onClose(): Promise<void> {
    setBusy(true);
    setError(null);
    const result = await seam.closeEventToGuests(event.id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setConfirming(false);
    setCopy("idle");
    onChange(null);
  }

  // AC-8. Where the browser refuses the clipboard, the address stays on screen to copy by hand.
  async function onCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(address);
      setCopy("copied");
    } catch {
      setCopy("refused");
    }
  }

  return (
    <div data-testid="event-guest-panel" className="flex flex-col gap-2 border-t border-line pt-4">
      <h2 className="text-xs font-bold uppercase tracking-wide text-ink-3">Guest link</h2>
      <p className="text-sm text-ink-2">
        Anyone with the link can see this event and who is coming, without signing in.
      </p>

      {link ? (
        <>
          <div className="flex gap-2">
            <input
              data-testid="event-guest-link"
              type="text"
              readOnly
              value={address}
              aria-label="Guest link"
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-pill bg-field px-3 py-1.5 text-xs text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            />
            <button
              data-testid="event-guest-copy-button"
              type="button"
              onClick={() => void onCopy()}
              className={ACTION_BUTTON}
            >
              Copy
            </button>
          </div>
          <p data-testid="event-guest-copied" role="status" aria-live="polite" className="text-xs text-ink-2">
            {copy === "copied"
              ? "Copied"
              : copy === "refused"
                ? "Copying is blocked here. Select the address and copy it yourself."
                : ""}
          </p>
        </>
      ) : null}

      {error !== null && !confirming ? (
        <p data-testid="event-guest-error" role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div>
        {link ? (
          <button
            data-testid="event-guest-close-button"
            type="button"
            disabled={busy}
            onClick={() => {
              setError(null);
              setConfirming(true);
            }}
            className="text-xs font-semibold text-danger underline-offset-2 hover:underline disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Close the link
          </button>
        ) : (
          <button
            data-testid="event-guest-open-button"
            type="button"
            disabled={busy}
            onClick={() => void onOpen()}
            className={`${ACTION_BUTTON} disabled:opacity-50`}
          >
            {busy ? "Opening…" : "Open to guests"}
          </button>
        )}
      </div>

      {confirming ? (
        <Modal testIdPrefix="event-guest-close" label="Close the guest link" onClose={() => setConfirming(false)}>
          <div className="flex flex-col gap-4 pr-8">
            <h2 className="text-lg font-extrabold text-ink">Close the guest link?</h2>
            <p className="text-sm text-ink-2">
              The link will stop working for everyone who has it. Opening it again makes a new link.
            </p>
            {error !== null ? (
              <p data-testid="event-guest-error" role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            <div className="flex justify-end gap-2">
              <button
                data-testid="event-guest-close-cancel"
                type="button"
                onClick={() => setConfirming(false)}
                className={ACTION_BUTTON}
              >
                Cancel
              </button>
              <button
                data-testid="event-guest-close-confirm"
                type="button"
                disabled={busy}
                onClick={() => void onClose()}
                className="rounded-pill bg-danger px-4 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                {busy ? "Closing…" : "Close the link"}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
