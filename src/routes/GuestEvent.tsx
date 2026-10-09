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
import { useEffect, useState, type JSX } from "react";
import { useParams } from "react-router-dom";
import { seam } from "@/lib/data";
import type { GuestEvent as GuestEventData } from "@/lib/domain/types";
import Loader from "@/components/Loader";
import { eventDateLabel } from "./Events";

type LoadState =
  | { phase: "loading" }
  | { phase: "missing" }
  | { phase: "ready"; event: GuestEventData };

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

export default function GuestEvent(): JSX.Element {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  useGuestMeta();

  useEffect(() => {
    let live = true;
    setState({ phase: "loading" });
    seam
      .getGuestEvent(token ?? "")
      .then((event) => {
        if (live) setState(event ? { phase: "ready", event } : { phase: "missing" });
      })
      .catch(() => {
        if (live) setState({ phase: "missing" });
      });
    return () => {
      live = false;
    };
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
        <GuestEventCard event={state.event} />
      )}
    </section>
  );
}

function GuestEventCard({ event }: { event: GuestEventData }): JSX.Element {
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

      {/* AC-10. Names only, in join order; no avatar, because AC-12 sends none. */}
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
