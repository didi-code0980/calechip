// ADM-04 — the worklist of entries awaiting a decision. 01-plan.md sections 2, 2b, 3, 4.3 and 4.5.
//
// **ADM-05 PUTS THE DECISION ON THIS SURFACE, which is what ADM-04's own header said it would.**
// That header read "it carries no approve control and no reject control, and that is the ticket
// rather than an omission" — the losing half of a triage argument kept in
// .ai/registry/features.md:103 so nobody re-argued it there. It is spent now: ADM-05 mounts
// `EntryDecision` on each row, consuming `entry_update_admin` and clause (a) of
// `public.entry_enforce_decision()`. ADM-04's other three verbs are UNCHANGED — this screen still
// LISTS, FILTERS and COUNTS exactly as it did, and ADM-04's own suite passes unedited.
//
// **THE ONE WRITE IS THE PANEL'S AND THIS FILE STILL ISSUES NONE.** `EntryDecision` calls the seam;
// this screen hands it an entry and re-reads when it reports back. The link on a row still goes to
// `/entries/:id/edit`, which is CAL-02's and CAL-03's shipped screen.
//
// **AFTER A DECISION THE SCREEN RELOADS THE PAGE IT IS ON (ADM-05 AC-1, AC-2).** `load()`, never a
// local splice: the row leaves the queue and `pending-entries-count` falls because the datastore
// says so. Splicing would make the count and the list disagree, which is the one property this
// screen was built not to have.
//
// **THE REFUSAL IS AN AFFORDANCE AND NOT A CONTROL**, and it has to be said plainly because a screen
// that says "this page is for admins" reads exactly like one — the sentence TeamEntries.tsx already
// carries, and here it is stronger. `entry_select_team` admits the whole team's rows to BOTH roles,
// so a member who deleted this refusal in a debugger would see a list of rows they can already read
// at `/entries/team`, and would gain nothing. There is no capability behind this screen that a
// member lacks, which is why nothing in this file is load-bearing for security (01-plan.md section
// 3).
//
// **THE COUNT AND THE LIST COME FROM ONE READ AND CANNOT DISAGREE.** `seam.listPendingEntries`
// returns the page AND the exact size of the matching set in one response. Two calls could disagree,
// because a write can land between them, and the feature row forbids exactly that. Nothing in this
// file derives the outstanding figure from `rows.length`.
//
// **`today` IS THIS MACHINE'S DATE AND IS PASSED INTO THE READ.** The one place a local date read is
// correct — the exception MonthView.tsx records for `currentMonth()` — because "what day is it for
// the person looking at the screen" is a fact about their clock. A server-side `current_date` would
// be evaluated in UTC and would move the boundary seven hours early for a Vietnamese team.
//
// Colour: `.ai/standards/ui-design-system.md` section Colour is still `TODO(project)`, and every
// criterion here turns on an attribute or on copy rather than on a colour, so none of them changes
// when the standard is written. 01-plan.md section 2b records that no image was attached at any
// stage and that the arrangement below is the Tech Lead's own — borrowed wholesale from
// TeamEntries.tsx, which is the nearest thing the product has to this screen.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
// The seam, through its one door. Nothing above the seam names an implementation, and this file must
// never import `./supabase` or `./mock` (RULE-02).
import EntryDecision from "@/components/EntryDecision";
import { seam } from "@/lib/data";
import type {
  Entry,
  EntryPortion,
  EntryType,
  Member,
  PendingWindow,
} from "@/lib/domain/types";

// `.ai/standards/ui-design-system.md` section Language: every string the interface renders is
// English. These two maps DUPLICATE the ones in src/routes/TeamEntries.tsx rather than importing
// them, and the duplication is declared in 03-impl-log.md for the reason that file already records:
// the shared home for them is a component neither ticket owns, and OPS-001 is the ticket that folds
// the copy of the product into one place.
const TYPE_LABELS: Record<EntryType, string> = {
  pto: "Leave",
  // A WFH member IS working — glossary.md calls this the single most costly confusion in the domain,
  // which is why the label says so rather than reading as a kind of absence.
  wfh: "Working from home",
};

const PORTION_LABELS: Record<EntryPortion, string> = {
  full: "Full day",
  am: "Morning",
  pm: "Afternoon",
};

// AC-6 and AC-7. Three windows, always visible, never collapsed behind a control — a filter that
// hides rows while itself being hidden is how an admin concludes the queue is empty (01-plan.md
// section 2b, and Open questions item 3).
//
// `upcoming` is the default. 01-plan.md section 2, Open questions item 2 takes `features.md:103`'s
// recommendation: past-dated pending entries stay `pending`, which is truthful — nobody ever decided
// — and there is no fourth `entry_status` and none is proposed.
const WINDOW_LABELS: Record<PendingWindow, string> = {
  upcoming: "Still to come",
  past: "Already past",
  all: "Every date",
};

const WINDOWS: readonly PendingWindow[] = ["upcoming", "past", "all"];

/** AC-8. The type filter Open questions item 1's recommendation asks for. `""` is both types. */
const TYPE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "", label: "Leave and working from home" },
  { value: "pto", label: TYPE_LABELS.pto },
  { value: "wfh", label: TYPE_LABELS.wfh },
];

/**
 * This machine's date as `yyyy-MM-dd`.
 *
 * The LOCAL accessors are correct here and only here, which is worth naming because every other date
 * in this product is compared as a timezone-free string and never read off a clock. MonthView.tsx's
 * `currentMonth`, WeekView.tsx's `today` and YearView.tsx's `currentYear` all record the same
 * exception for the same reason: this answers "what day is it for the person looking at the screen".
 */
function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// Four phases, the shape TeamEntries.tsx and MemberList.tsx use. AC-12: "still loading", "this is not
// for you" and "the read failed" are three different facts, and folding any two of them tells
// somebody something untrue — here worst of all, because a worklist that renders short reads as a
// queue that is finished.
type View =
  | { phase: "loading" }
  | { phase: "refused" } // AC-10, and the state a caller with no member row lands on
  | { phase: "unavailable" } // any throw, including AC-5's short-page assertion
  | { phase: "ready"; rows: Entry[]; total: number; page: number; pageSize: number; roster: Member[] };

export default function PendingEntries() {
  const [view, setView] = useState<View>({ phase: "loading" });

  // The query, and it is three pieces of one thing rather than three states: every change to any of
  // them is a new read. `today` is resolved ONCE, on mount, so a screen left open across midnight
  // keeps answering the question it was opened with rather than silently re-filtering.
  const [today] = useState(localToday);
  const [dateWindow, setDateWindow] = useState<PendingWindow>("upcoming");
  const [type, setType] = useState<EntryType | null>(null);
  const [page, setPage] = useState(0);

  const query = useMemo(
    () => ({ type, window: dateWindow, today, page }),
    [type, dateWindow, today, page],
  );

  const load = useCallback(async (): Promise<void> => {
    setView({ phase: "loading" });

    try {
      const me = await seam.getCurrentMember();

      // AC-10 and AC-12. A caller with no member row lands here too. `refused` fails CLOSED, which
      // is what AllowList.tsx and TeamEntries.tsx both chose for the same fork: it is not a true
      // sentence about why, and the alternative is drawing a worklist to somebody the seam has told
      // us nothing about.
      if (!me || me.role !== "admin") {
        setView({ phase: "refused" });
        return;
      }

      // The two reads 01-plan.md section 4.3 permits, and no third. `seam.getTeam()` is deliberately
      // NOT called: it exists to supply `overloadThreshold`, this screen computes no absence count,
      // and calling it would be the first step toward a number that is not this screen's — the
      // refusal CAL-05 and CAL-06 each recorded on their own surfaces.
      //
      // `listMembers()` returns the roster INCLUDING removed members (ADR-013), which is what AC-2
      // needs: an entry whose owner has since been removed still resolves to a name rather than to a
      // bare uuid.
      const [pageResult, roster] = await Promise.all([
        seam.listPendingEntries(query),
        seam.listMembers(),
      ]);

      setView({
        phase: "ready",
        rows: pageResult.rows,
        total: pageResult.total,
        page: pageResult.page,
        pageSize: pageResult.pageSize,
        roster,
      });
    } catch {
      // AC-5 and AC-12. Both reads throw on a transport failure, and `listPendingEntries` throws on a
      // page the datastore shortened. No partial list is ever drawn: a worklist that is short by two
      // entries is two decisions nobody will ever make, and nothing about it looks wrong.
      setView({ phase: "unavailable" });
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  if (view.phase === "loading") {
    return (
      <p
        data-testid="pending-entries-loading"
        role="status"
        className="mx-auto max-w-3xl rounded-2xl bg-white p-8 text-center text-sm opacity-70 shadow-sm"
      >
        Loading…
      </p>
    );
  }

  // AC-10. It names no entry and no member — a refusal that listed what it was withholding would be
  // the read it is refusing.
  if (view.phase === "refused") {
    return (
      <section
        data-testid="pending-entries-refused"
        className="mx-auto max-w-3xl rounded-2xl bg-white p-8 text-center shadow-sm"
      >
        <h1 className="text-xl font-semibold">This page is for admins</h1>
        <p className="mt-2 text-sm opacity-70">
          Only an admin decides on an entry. Everything listed here is readable by the whole team on
          the team&rsquo;s entries page.
        </p>
        <p className="mt-4">
          <Link data-testid="pending-entries-back" to="/" className="text-sm underline">
            Back to home
          </Link>
        </p>
      </section>
    );
  }

  if (view.phase === "unavailable") {
    return (
      <section
        data-testid="pending-entries-unavailable"
        role="alert"
        className="mx-auto max-w-3xl rounded-2xl bg-white p-8 text-center shadow-sm"
      >
        <h1 className="text-xl font-semibold">The worklist could not be loaded</h1>
        {/* AC-5. No partial list is ever drawn, and the sentence says why in the direction that
            matters: a short queue reads as a finished one. */}
        <p className="mt-2 text-sm opacity-70">
          Nothing is listed rather than part of it. A short list here would look like a queue with
          nothing left in it. Please reload the page.
        </p>
        <p className="mt-4">
          <Link data-testid="pending-entries-back" to="/" className="text-sm underline">
            Back to home
          </Link>
        </p>
      </section>
    );
  }

  const { rows, total, pageSize, roster } = view;

  // The owner's display name, from the roster the same load returned. An id is shown when no roster
  // row matches, which under `entry_select_team` and `member_select_team` cannot happen — both are
  // scoped to the same team by the same helper — so it is a fallback for a state the policies
  // exclude rather than a case with a design. TeamEntries.tsx records the same.
  const ownerName = (memberId: string): string =>
    roster.find((m) => m.id === memberId)?.displayName ?? memberId;

  const ownerAvatar = (memberId: string): string =>
    roster.find((m) => m.id === memberId)?.avatar ?? "";

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const onFirst = view.page <= 0;
  const onLast = view.page >= pages - 1;

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold">Waiting for a decision</h1>

        {/* AC-3. THE EXACT SIZE OF THE MATCHING SET, from the same response the rows came in — not
            the number of rows on screen, which `data-shown` carries beside it so a test can assert
            the two are allowed to differ. A sentence in the header rather than a badge on a
            navigation item, because this product has no navigation chrome to hang one on and
            inventing one would be inventing a control (01-plan.md section 2b).

            AC-15. The object is an ENTRY and never a request, an application or an *đơn*, and no
            quota, balance or remaining-days figure appears here or anywhere on this screen. */}
        <p
          data-testid="pending-entries-count"
          data-total={total}
          data-shown={rows.length}
          className="mt-1 text-sm opacity-70"
        >
          {total === 1 ? "1 entry is" : `${total} entries are`} waiting in this view. Deciding is
          coordination, not permission — nothing is blocked while an entry waits.
        </p>
      </header>

      {/* AC-6, AC-7, AC-8. Both filters are ALWAYS VISIBLE and neither is collapsed, because the
          default window HIDES rows: the control is what advertises the existence of the sets it is
          not showing (01-plan.md section 2, Open questions item 3). Changing either resets to the
          first page — a filter change that kept page 3 would show an empty page of a one-page set. */}
      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-white px-4 py-3 text-sm shadow-sm">
        <label className="flex items-center gap-2">
          <span className="opacity-70">Dates</span>
          <select
            data-testid="pending-entries-window"
            data-window={dateWindow}
            value={dateWindow}
            onChange={(event) => {
              setDateWindow(event.target.value as PendingWindow);
              setPage(0);
            }}
            className="rounded-lg border border-slate-200 px-2 py-1"
          >
            {WINDOWS.map((value) => (
              <option key={value} value={value}>
                {WINDOW_LABELS[value]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="opacity-70">Kind</span>
          <select
            data-testid="pending-entries-type"
            data-type={type ?? ""}
            value={type ?? ""}
            onChange={(event) => {
              const next = event.target.value;
              setType(next === "" ? null : (next as EntryType));
              setPage(0);
            }}
            className="rounded-lg border border-slate-200 px-2 py-1"
          >
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* AC-11. An empty worklist SAYS SO. A screen with no rows and no sentence is
          indistinguishable from one that failed to load, and on this screen that mistake is the
          feature's whole failure mode read backwards. */}
      {rows.length === 0 ? (
        <p
          data-testid="pending-entries-empty"
          className="rounded-2xl bg-white p-8 text-center text-sm opacity-70 shadow-sm"
        >
          Nothing is waiting for a decision in this view.
        </p>
      ) : (
        <ul data-testid="pending-entries" className="flex flex-col gap-2">
          {rows.map((entry) => (
            <li
              key={entry.id}
              data-testid="pending-entry-row"
              data-entry-id={entry.id}
              data-member-id={entry.memberId}
              data-type={entry.type}
              data-portion={entry.portion}
              data-start-date={entry.startDate}
              data-end-date={entry.endDate}
              data-tentative={entry.tentative}
              className="flex flex-wrap items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm shadow-sm"
            >
              {/* AC-2. The column that makes this a worklist rather than a list of rows: a queue of
                  unnamed entries is not the feature, and TEA-03's `member_select_team` is the hard
                  dependency that makes the name readable at all. */}
              <span aria-hidden="true" className="text-lg">
                {ownerAvatar(entry.memberId)}
              </span>
              <span data-testid="pending-entry-row-member" className="font-medium">
                {ownerName(entry.memberId)}
              </span>

              {/* BOTH BOUNDS, always, as `d → d` for a single day — the form CAL-01 fixed and
                  TeamEntries.tsx repeats, for its reason: a single date shown once makes the
                  inclusivity of `end_date` unobservable on exactly the case where an off-by-one is
                  easiest to introduce. The strings render as they arrive; no `new Date(...)` on this
                  path. */}
              <span data-testid="pending-entry-row-dates">
                {entry.startDate} → {entry.endDate}
              </span>

              <span className="opacity-70">{TYPE_LABELS[entry.type]}</span>
              <span className="opacity-70">{PORTION_LABELS[entry.portion]}</span>
              {entry.tentative ? <span className="opacity-70">Tentative</span> : null}
              {entry.note ? <span className="opacity-70">{entry.note}</span> : null}

              {/* ADM-04 AC-14. The SAME route the owner and CAL-03's team list already use, and
                  it keeps its name, its destination and its position —
                  tests/e2e/adm-04-worklist.spec.ts clicks it and ADM-05 01-plan.md section 7
                  requires that suite to pass UNEDITED. */}
              <Link
                data-testid="pending-entry-row-link"
                to={`/entries/${entry.id}/edit`}
                className="ml-auto underline"
              >
                Open
              </Link>

              {/* ADM-05 AC-1, AC-2. The decision, on the surface the feature row names. It is the
                  SAME component `/entries/:id/edit` mounts, so "a rejection carries a reason" is
                  decided in one place rather than twice.

                  `load` and not a splice: a decided entry leaves this view because the next read
                  does not return it, and the count above falls for the same reason. */}
              <EntryDecision entry={entry} onDecided={load} />
            </li>
          ))}
        </ul>
      )}

      {/* AC-4. Paging and not truncation, which is the one read on this seam that pages: a ceiling
          turns a long queue into an error, and a queue long enough to trip it is precisely the queue
          an admin most needs to work through (01-plan.md section 8, rejected alternative 4).

          The count above does not move between pages, because it is the size of the matching set and
          not of the page. */}
      <div
        data-testid="pending-entries-page"
        data-page={view.page}
        data-page-size={pageSize}
        className="flex items-center gap-4 text-sm"
      >
        <button
          data-testid="pending-entries-prev"
          type="button"
          disabled={onFirst}
          onClick={() => setPage((at) => Math.max(0, at - 1))}
          className="underline disabled:opacity-40"
        >
          Previous
        </button>
        <span className="opacity-70">
          Page {view.page + 1} of {pages}
        </span>
        <button
          data-testid="pending-entries-next"
          type="button"
          disabled={onLast}
          onClick={() => setPage((at) => at + 1)}
          className="underline disabled:opacity-40"
        >
          Next
        </button>
      </div>

      <p>
        <Link data-testid="pending-entries-back" to="/" className="text-sm underline">
          Back to home
        </Link>
      </p>
    </section>
  );
}
