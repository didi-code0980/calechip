// UIE-09 — the admin hub. 01-plan.md § 4.4, § 4.5 and § 4.6.
//
// EVERYTHING IN THIS FILE IS AN AFFORDANCE (ADR-005), AND IT IS A WEAKER ONE THAN USUAL: the screen
// renders five LINKS and nothing else. The five destinations keep their own guards, their own
// refusals and their own row-level security exactly as they had them before this file existed, so
// nothing here is the control for anything — a caller who reached one of those addresses by typing
// it is refused by the screen at the far end, not by the absence of a row in the list below.
//
// **NO WRITE FUNCTION FROM THE SEAM IS IMPORTED, AND THAT IS CHECKABLE BY READING ONE LINE.**
// `seam.getCurrentMember` is the only member of `seam` this file names (01-plan.md § 4.4), which is
// what makes AC-6's denial — a member sees NONE of the five destinations — a property of the file
// rather than a claim about it.
//
// **THE HUB IS A LIST AND NEVER A DASHBOARD.** It renders no count, no status and no summary of
// anything behind its five links, so it has one read, one refusal and no arithmetic. 01-plan.md § 2,
// the one assumption that ships: the moment it summarises something it acquires a seam read per
// destination and a partial failure state, which is `ticket.yaml` § 9's named size risk and is a
// different ticket.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
// The seam, through its one door: nothing above the seam names an implementation, so this file must
// never import `@/lib/data/supabase` or `@/lib/data/mock` (RULE-02).
import { seam } from "@/lib/data";
import type { Member } from "@/lib/domain/types";

/**
 * The four phases `Threshold.tsx:45-48` established, so a reader meets no new shape here. `loading`
 * MUST resolve, which is why every path out of the effect below sets one of the other three.
 *
 * `refused` AND `unavailable` ARE SEPARATE AND MUST STAY SEPARATE — AC-8. A denial and a transport
 * failure are different answers: an admin whose read threw is not being told they are not an admin,
 * and a member is not being told to try again in a moment.
 */
type View =
  | { phase: "loading" }
  | { phase: "refused" }
  | { phase: "unavailable" }
  | { phase: "ready"; me: Member };

/**
 * The five destinations, declared once as data so the list and its order are one thing rather than
 * five copies of a row. AC-3 counts them and AC-4 follows each.
 *
 * **THE ORDER IS BY HOW OFTEN AN ADMIN NEEDS IT** — 01-plan.md § 2b — and not alphabetical and not
 * the sidebar's. The approval queue is the daily one and it is first, which is the only mitigation
 * available inside this ticket for the second click UIE-10 will introduce.
 *
 * `/holidays` IS DELIBERATELY NOT ONE OF THEM (01-plan.md § 1, Out of scope): it is already linked
 * in the sidebar for BOTH roles, not behind the role condition, so it is not an administrative
 * destination this hub collects.
 */
const DESTINATIONS: readonly {
  testId: string;
  to: string;
  name: string;
  blurb: string;
}[] = [
  {
    testId: "admin-hub-pending-link",
    to: "/entries/pending",
    name: "Pending approvals",
    blurb: "Entries waiting for a decision. Approve or reject them one at a time or together.",
  },
  {
    testId: "admin-hub-team-entries-link",
    to: "/entries/team",
    name: "Team entries",
    blurb: "Every entry the team has declared, with the controls to edit or remove one.",
  },
  {
    testId: "admin-hub-members-link",
    to: "/members",
    name: "Members",
    blurb: "Who is on the team. Remove somebody, or make somebody an admin.",
  },
  {
    testId: "admin-hub-allow-list-link",
    to: "/allow-list",
    name: "Allow list",
    blurb: "The addresses allowed to sign up and join this team.",
  },
  {
    testId: "admin-hub-threshold-link",
    to: "/threshold",
    name: "Overload threshold",
    blurb: "The share of the team above which a day is called crowded.",
  },
];

export default function AdminHub() {
  const [view, setView] = useState<View>({ phase: "loading" });

  // ONE SEAM CALL AND NO OTHER. The screen reads the member itself rather than receiving it from the
  // router — 01-plan.md § 8, rejected alternative 5: a screen whose refusal depends on a route line
  // is a screen whose denial moves the moment somebody edits that line. `Threshold.tsx`,
  // `TeamEntries.tsx` and `PendingEntries.tsx` each read the member and each refuse in place, and
  // the three extra phases are the price of the refusal living in the component that renders it.
  const load = useCallback(async (): Promise<void> => {
    try {
      const me = await seam.getCurrentMember();

      // AC-6, and the member-row-less caller that got past the route guard, in one branch. The route
      // sends the second one to `/` before this component exists (AC-7); this is the belt to that
      // brace, and folding the two together tells somebody outside the team nothing they could not
      // already infer from the sign-up screen.
      if (!me || me.role !== "admin") {
        setView({ phase: "refused" });
        return;
      }

      setView({ phase: "ready", me });
    } catch {
      // A transport failure, or the Supabase client raising on an unusable configuration before any
      // request leaves. AC-8: this is why the screen has a fourth phase at all.
      setView({ phase: "unavailable" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (view.phase === "loading") {
    return (
      <p
        data-testid="admin-hub-loading"
        role="status"
        className="mx-auto max-w-2xl rounded-card bg-card p-8 text-center text-sm opacity-70 shadow-soft"
      >
        Opening the admin area…
      </p>
    );
  }

  if (view.phase === "refused") {
    return (
      <section
        data-testid="admin-hub-refused"
        className="mx-auto max-w-2xl rounded-card bg-card p-8 text-center shadow-soft"
      >
        <h1 className="text-xl font-semibold text-ink">This area is for admins</h1>
        {/* AC-6. It names none of the five destinations and no member: somebody who is not an admin
            learns here only that admins exist, which the sign-up screen already says. */}
        <p className="mt-2 text-sm text-ink-2">
          Only an admin can approve entries, manage the team and change the team&rsquo;s settings.
        </p>
        <p className="mt-4">
          <Link data-testid="admin-hub-back" to="/" className="text-sm underline">
            Back to the start
          </Link>
        </p>
      </section>
    );
  }

  if (view.phase === "unavailable") {
    return (
      <section
        data-testid="admin-hub-unavailable"
        role="alert"
        className="mx-auto max-w-2xl rounded-card bg-card p-8 text-center shadow-soft"
      >
        <h1 className="text-xl font-semibold text-ink">The admin area could not be opened</h1>
        {/* AC-8. NO LIST IS DRAWN ON THIS PATH, and it does not say the area is for admins: a
            transport failure reported as a refusal tells an admin they are not one. */}
        <p className="mt-2 text-sm text-ink-2">
          Your account could not be read just now. Try again in a moment.
        </p>
        <p className="mt-4">
          <Link data-testid="admin-hub-back" to="/" className="text-sm underline">
            Back to the start
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section data-testid="admin-hub" className="mx-auto flex max-w-2xl flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold text-ink">Admin</h1>
        <p className="mt-2 text-sm text-ink-2">
          Everything an admin can do, in one place. Each destination keeps its own screen — nothing
          is decided here.
        </p>
      </header>

      {/* AC-3. An ORDERED list, because § 2b's order is a claim about how often each is needed and
          `<ol>` is the element that says so. The row carries `admin-hub-link` so the list can be
          COUNTED and `data-to` so a count can also be checked against the addresses; the anchor
          inside it carries the destination's own id, so AC-4 follows a link rather than a row.
          One `data-testid` per element is the constraint that splits them across the two. */}
      <ol className="flex flex-col gap-3">
        {DESTINATIONS.map((destination) => (
          <li key={destination.to} data-testid="admin-hub-link" data-to={destination.to}>
            <Link
              data-testid={destination.testId}
              to={destination.to}
              className="block rounded-card bg-card p-5 shadow-soft transition-colors hover:bg-field focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <span className="block text-sm font-semibold text-ink">{destination.name}</span>
              <span className="mt-1 block text-xs text-ink-2">{destination.blurb}</span>
            </Link>
          </li>
        ))}
      </ol>

      <p>
        <Link data-testid="admin-hub-back" to="/" className="text-sm underline">
          Back to the start
        </Link>
      </p>
    </section>
  );
}
