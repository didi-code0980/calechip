// CAL-04 — the month grid: who is away on each day, and which days are crowded.
// 01-plan.md sections 2, 2b, 3 and 4.
//
// EVERYTHING here is an affordance (ADR-005). This screen holds no control at all, and that is
// unusually literal: it issues three reads and one create, and every one of them is decided in the
// datastore. `entry_select_team` and `member_select_team` are AC-12, `team_select_own` — shipped by
// this ticket's migration — is AC-14's read half, and `entry_insert_own` is what decides the write
// the drag-select form issues. This component refuses nobody holding a token.
//
// **IT COMPUTES NO COUNT OF ITS OWN.** Every number on screen comes from `absenceCountsFor` in
// @/lib/data/absence, which is INV-04's single implementation. A `.filter(e => e.status !== ...)`
// written anywhere in this file would be a second copy of that rule, which is the exact failure
// INV-04 exists to prevent. The same goes for `isOverloaded`: the comparison is strictly greater and
// it is written once, there.
//
// **AND IT SETS NO THRESHOLD (AC-14).** `Set the overload threshold` is ADM-01's and
// rbac-and-security.md:47-48 grants the read to both roles and the write to `admin` alone. There is
// no control on this screen for either role, and the migration grants no `update` to anyone.
//
// **THE TWO ROLES ARE IDENTICAL HERE**, which is a first in this product. A reviewer scanning for a
// missing `is_admin` check should find that absence deliberate: 01-plan.md section 3 is ✅✅ or ❌❌ on
// every row.
//
// Colour, and where it comes from. `.ai/standards/ui-design-system.md` § Colour is still
// `TODO(project)`, so the palette below is cited to `CLAUDE.md` § Visual direction, which is the only
// place in the repository that carries it: PTO peach, WFH mint, an overloaded day a soft pink that is
// deliberately not an alarming red, tentative entries dashed at reduced opacity, approved ones
// carrying a small star. 01-plan.md § 2b records that citation and why it is honest rather than lazy.
// Holidays are lavender and are NOT drawn here — that is CAL-08 and the registry row forbids this one
// inheriting it. There is no density toggle: it is named in CLAUDE.md, specified nowhere, and
// originating one would be inventing a control rather than a layout (§ 2b).
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import EntryForm from "@/components/EntryForm";
import type { EntryFormValues } from "@/components/EntryForm";
// The seam, through its one door. Nothing above the seam names an implementation, and this file must
// never import `./supabase` or `./mock` (RULE-02).
import { seam } from "@/lib/data";
// INV-04's single implementation, imported DIRECTLY rather than through the seam. 01-plan.md
// section 5: neither seam implementation counts anything, so there is no second arithmetic for
// tests/seam-parity.test.ts to miss.
import {
  absenceCountsFor,
  absentMembersFor,
  addDays,
  currentMemberCount,
  eachDateInRange,
  isOverloaded,
} from "@/lib/data/absence";
import type { DateRange, Entry, Failure, Member, Team } from "@/lib/domain/types";

// ---------------------------------------------------------------------------
// The month vocabulary. `yyyy-MM` in the URL, `yyyy-MM-dd` everywhere below it.
// ---------------------------------------------------------------------------

const MONTH_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])$/;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Monday first. `.ai/standards/ui-design-system.md` § Components is `TODO(project)` and specifies no
// week start, so this is 01-plan.md § 2b's layout decision, marked there as the Tech Lead's own.
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * The weekday of a `yyyy-MM-dd` date, 0 for Monday.
 *
 * Read in UTC and never locally. `new Date('2026-04-30')` parses as UTC midnight and a local
 * weekday read west of UTC yields the previous day — CAL-01 01-plan.md section 4.5 records the trap,
 * and @/lib/data/absence does its arithmetic the same way for the same reason.
 */
const mondayIndex = (date: string): number =>
  (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;

/** The last date of a `yyyy-MM`, without a calendar table: day 1 of the next month, minus one. */
function lastDateOf(month: string): string {
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7));
  const next = index === 12 ? `${year + 1}-01-01` : `${month.slice(0, 5)}${String(index + 1).padStart(2, "0")}-01`;
  return addDays(next, -1);
}

const shiftMonth = (month: string, by: number): string => {
  const total = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + by;
  const year = Math.floor(total / 12);
  return `${String(year).padStart(4, "0")}-${String((total % 12) + 1).padStart(2, "0")}`;
};

const monthLabel = (month: string): string =>
  `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

/**
 * The month `/month` with no anchor redirects to.
 *
 * This is the ONE place a LOCAL date read is correct, and the exception is worth naming because
 * every other date in this feature is deliberately UTC. It answers "which month is it for the person
 * looking at the screen", which is a fact about their clock — not a stored `yyyy-MM-dd`, where a
 * local read is the off-by-one CAL-01 recorded.
 */
function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// The screen.
// ---------------------------------------------------------------------------

// Four states, and they are four for the reason TeamEntries.tsx and MemberList.tsx record. "Still
// loading", "you are on no team" and "the read failed" are three different facts, and folding any
// two of them tells somebody something untrue — here worst of all, because a grid drawn from a
// partial read is a believable wrong answer about who is away.
type View =
  | { phase: "loading" }
  | { phase: "not-on-a-team" } // the caller has no member row, or has been removed
  | { phase: "unavailable" } // a throw from any read, including AC-11's truncation assertion
  | { phase: "ready"; team: Team; roster: Member[]; entries: Entry[] };

/** The drag in progress: where it started and where the pointer is now. Order-free — a drag upwards
 *  through the grid is the same range as the same drag downwards. */
interface Drag {
  anchor: string;
  over: string;
}

const ordered = (a: string, b: string): DateRange => (a <= b ? { start: a, end: b } : { start: b, end: a });

export default function MonthView() {
  const { month } = useParams<{ month: string }>();

  // AC-10. The anchor is the URL and nothing else, so `/month/2026-05` typed directly produces the
  // same screen as pressing "next" from April. An invalid or absent anchor redirects to the current
  // month rather than rendering an error: there is no criterion about a malformed address, and a
  // grid for "this month" is the useful answer to somebody who mistyped one.
  const valid = month !== undefined && MONTH_PATTERN.test(month);

  const [view, setView] = useState<View>({ phase: "loading" });

  // The drag in progress, and the range it produced. Two pieces of state rather than one because
  // they answer different questions: `drag` is live and redraws on every cell entered, `draft` is
  // settled and is what the form was opened with.
  const [drag, setDrag] = useState<Drag | null>(null);
  const [draft, setDraft] = useState<DateRange | null>(null);

  const range = useMemo<DateRange | null>(
    () => (valid && month ? { start: `${month}-01`, end: lastDateOf(month) } : null),
    [valid, month],
  );

  const load = useCallback(async (): Promise<void> => {
    if (!range) return;
    setView({ phase: "loading" });

    try {
      const me = await seam.getCurrentMember();

      // A caller with no member row, and a removed one, land here. Both read no team and no entries
      // at all — `member_team_id` filters `removed_at is null` inside its own body, so every policy
      // built on it inherits that. This state is the honest one for both.
      if (!me) {
        setView({ phase: "not-on-a-team" });
        return;
      }

      const [team, roster, entries] = await Promise.all([
        seam.getTeam(),
        seam.listMembers(),
        seam.listTeamEntriesOverlapping(range),
      ]);

      // AC-7 and AC-14 need the threshold, and a grid drawn without it is exactly the failure AC-11
      // is written about one read over: the counts would be right, no overloaded day would be
      // marked, and nothing on screen would say the comparison had not been made. `unavailable` is
      // the state that refuses to show a believable partial answer.
      //
      // In practice this fires on one thing: a build where this ticket's migration has not been
      // applied, since `public.team` carries no grant and no policy until then (db.sql 9.1) and
      // PostgREST answers zero rows. Applying a migration is human — RULE-09.
      if (!team) {
        setView({ phase: "unavailable" });
        return;
      }

      setView({ phase: "ready", team, roster, entries });
    } catch {
      // All three reads throw on a transport failure and on a possibly-truncated answer. AC-11 is
      // this branch: a capped read SUMS what it was given, so a day that was overloaded renders
      // normal and nothing anywhere says so. No count is displayed.
      setView({ phase: "unavailable" });
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  // A drag that ends anywhere — on a cell, off the grid, outside the window — settles the range.
  // Listening on `window` rather than on the cell is what makes releasing outside the grid produce a
  // range instead of a drag that never ends.
  useEffect(() => {
    if (!drag) return;
    const finish = (): void => {
      setDraft(ordered(drag.anchor, drag.over));
      setDrag(null);
    };
    window.addEventListener("mouseup", finish);
    return () => window.removeEventListener("mouseup", finish);
  }, [drag]);

  const counts = useMemo(
    () =>
      view.phase === "ready" && range
        ? absenceCountsFor(view.entries, range, view.roster)
        : new Map<string, number>(),
    [view, range],
  );

  const absent = useMemo(
    () =>
      view.phase === "ready" && range
        ? absentMembersFor(view.entries, range, view.roster)
        : new Map<string, readonly Member[]>(),
    [view, range],
  );

  // AC-13. The dates go to CAL-01's form, unedited — `EntryForm` is imported and rendered, not
  // copied, so there is one place the six fields and their validation live. This screen adds no save
  // path of its own: `seam.createEntry` is CAL-01's, `entry_insert_own` decides it, and nothing is
  // written until the member presses the button.
  async function onCreate(values: EntryFormValues): Promise<Failure | null> {
    const result = await seam.createEntry(values);
    if (!result.ok) return result.error;
    await load();
    setDraft(null);
    return null;
  }

  if (!valid) return <Navigate to={`/month/${currentMonth()}`} replace />;

  const anchorMonth = month as string;

  if (view.phase === "loading") {
    return (
      <p data-testid="month-loading" role="status" className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center text-sm opacity-70 shadow-sm">
        Loading the month…
      </p>
    );
  }

  if (view.phase === "not-on-a-team") {
    return (
      <section data-testid="month-not-on-a-team" className="mx-auto flex max-w-md flex-col gap-3 rounded-2xl bg-white p-8 text-center text-sm shadow-sm">
        <p>This calendar belongs to a team, and you are not on one yet.</p>
        <Link data-testid="month-sign-in" to="/signin" className="underline">
          Sign in
        </Link>
      </section>
    );
  }

  if (view.phase === "unavailable") {
    return (
      <p data-testid="month-unavailable" role="alert" className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center text-sm shadow-sm">
        The month could not be read completely, so no counts are shown. A partial count would look
        like a real one.
      </p>
    );
  }

  const { team, roster } = view;
  const active = currentMemberCount(roster);

  const first = `${anchorMonth}-01`;
  const last = lastDateOf(anchorMonth);
  // The grid is whole weeks. The leading and trailing cells complete the first and last week and are
  // drawn as out-of-month: no avatars, no count and no overload state (AC-1).
  const gridStart = addDays(first, -mondayIndex(first));
  const gridEnd = addDays(last, 6 - mondayIndex(last));
  const cells = eachDateInRange({ start: gridStart, end: gridEnd });

  const selection = drag ? ordered(drag.anchor, drag.over) : null;

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex items-center gap-4">
        <Link data-testid="month-home" to="/" className="underline">
          Home
        </Link>

        {/* AC-10. Links and not buttons: the month IS the address, so moving between months is
            navigation, and a member can bookmark or share the month they are looking at. */}
        <Link data-testid="month-prev" to={`/month/${shiftMonth(anchorMonth, -1)}`} className="underline">
          Previous
        </Link>
        <h1 data-testid="month-anchor" data-month={anchorMonth} className="text-xl font-semibold">
          {monthLabel(anchorMonth)}
        </h1>
        <Link data-testid="month-next" to={`/month/${shiftMonth(anchorMonth, 1)}`} className="underline">
          Next
        </Link>

        {/* AC-14. The threshold is READ and shown, and there is no control that changes it — for
            either role. It is displayed rather than hidden because an overloaded day is otherwise a
            colour with no explanation, and the two numbers behind it are the whole of INV-04. */}
        <p data-testid="month-threshold" data-threshold={team.overloadThreshold} data-current-members={active} className="ml-auto text-sm opacity-70">
          Crowded above {Math.round(team.overloadThreshold * 100)}% of {active} people
        </p>
      </header>

      <div data-testid="month-grid" className="grid grid-cols-7 gap-1 select-none">
        {WEEKDAYS.map((day) => (
          <div key={day} data-testid="month-weekday" className="px-2 py-1 text-xs font-medium opacity-60">
            {day}
          </div>
        ))}

        {cells.map((date) => {
          const inMonth = date >= first && date <= last;
          const count = inMonth ? (counts.get(date) ?? 0) : 0;
          const people = inMonth ? (absent.get(date) ?? []) : [];
          // AC-7. Strictly greater, decided in one place. Out-of-month cells are never evaluated.
          const overloaded = inMonth && isOverloaded(count, active, team.overloadThreshold);
          const selected = Boolean(selection && inMonth && date >= selection.start && date <= selection.end);

          return (
            <div
              key={date}
              data-testid="month-cell"
              data-date={date}
              data-in-month={inMonth}
              data-count={inMonth ? count : ""}
              data-overloaded={overloaded}
              // AC-13. `onMouseDown` starts the drag and `onMouseEnter` extends it; the release is
              // handled on `window` above, so letting go outside the grid still produces a range.
              // A press and a release on one cell is a one-day range, which is the same gesture a
              // person uses to declare a single day.
              onMouseDown={inMonth ? () => { setDraft(null); setDrag({ anchor: date, over: date }); } : undefined}
              onMouseEnter={inMonth && drag ? () => setDrag({ anchor: drag.anchor, over: date }) : undefined}
              className={[
                "flex min-h-24 flex-col gap-1 rounded-xl p-2 text-xs",
                inMonth ? "" : "bg-slate-100/60 text-slate-400",
                // The soft pink CLAUDE.md § Visual direction reserves for an overloaded day, and
                // describes as deliberately not an alarming red. It is the cell's BACKGROUND rather
                // than a badge, because a crowded day has to be findable by scanning (§ 2b).
                inMonth && overloaded ? "bg-rose-100" : "",
                inMonth && !overloaded ? "bg-white" : "",
                selected ? "ring-2 ring-slate-400" : "",
              ].join(" ")}
            >
              <div className="flex items-baseline justify-between">
                <span className="font-medium">{date.slice(8)}</span>
                {inMonth && count > 0 ? (
                  <span data-testid="month-cell-count" className="opacity-70">
                    {count}
                  </span>
                ) : null}
              </div>

              {/* INV-04: a view shows a member's avatar exactly when that member's entry is counted.
                  These come from `absentMembersFor`, which walks the same pass as the counts — a
                  second filter here would be a second chance to disagree (AC-2, AC-4, AC-6).

                  A member holding an `am` and a `pm` entry on one date appears ONCE and the count is
                  1, which is the same fact told two ways. */}
              <div className="flex flex-wrap gap-1">
                {people.map((person) => {
                  const entry = entryFor(view.entries, person.id, date);
                  return (
                    <span
                      key={person.id}
                      data-testid="month-avatar"
                      data-member-id={person.id}
                      data-type={entry?.type ?? ""}
                      data-tentative={entry?.tentative ?? false}
                      data-status={entry?.status ?? ""}
                      title={person.displayName}
                      className={[
                        "inline-flex items-center rounded-full px-1.5 py-0.5",
                        // PTO peach, WFH mint (CLAUDE.md § Visual direction). A WFH member IS
                        // working — glossary.md calls that the single most costly confusion in the
                        // domain — so the two are different colours even though they weigh the same
                        // in the count.
                        entry?.type === "wfh" ? "bg-emerald-100" : "bg-orange-100",
                        // AC-5. Tentative is a dashed border at reduced opacity, so that "counts"
                        // and "is settled" stay visually separate: it is counted like any other
                        // entry (INV-05) and drawn so nobody reads the count as certainty.
                        entry?.tentative ? "border border-dashed border-current opacity-60" : "",
                      ].join(" ")}
                    >
                      {person.avatar}
                      {entry?.status === "approved" ? <span aria-hidden="true">★</span> : null}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* AC-9. An empty month is empty, not an error and not a loading state that never ends. The
          grid above already renders every date at zero; this says so in words, because a screen of
          blank cells and no sentence reads like a failure. Its appearance is not asserted by any
          criterion — `.ai/standards/ui-design-system.md` § Components specifies no empty state, and
          01-plan.md § 2b records that gap rather than inventing one. */}
      {view.entries.length === 0 ? (
        <p data-testid="month-empty" className="rounded-2xl bg-white p-6 text-center text-sm opacity-70 shadow-sm">
          Nobody on the team is away this month.
        </p>
      ) : null}

      {/* AC-13. CAL-01's form, with the dragged dates already in it and nothing written yet.
          `key` remounts it for each new range: `EntryForm` reads `initial` into `useState`, so a
          re-render with new dates would leave the old ones on screen. */}
      {draft ? (
        <div data-testid="month-entry-panel" className="flex flex-col gap-2">
          <EntryForm
            key={`${draft.start}:${draft.end}`}
            testIdPrefix="month-entry"
            title={`Declare ${draft.start} to ${draft.end}`}
            submitLabel="Save"
            submittingLabel="Saving…"
            initial={{
              type: "pto",
              portion: "full",
              startDate: draft.start,
              endDate: draft.end,
              tentative: false,
              note: null,
            }}
            afterSubmit="keep"
            onSubmit={onCreate}
          />
          <button data-testid="month-entry-cancel" type="button" onClick={() => setDraft(null)} className="self-start underline">
            Cancel
          </button>
        </div>
      ) : null}
    </section>
  );
}

/**
 * The entry a member's avatar is drawn FROM on a date, for the three attributes the chip carries.
 *
 * It decides nothing about whether the avatar appears — `absentMembersFor` has already answered
 * that, and this only ever runs for a member it returned. Rejected rows are skipped here so the chip
 * cannot pick one up for its colour while the count excludes it (AC-4); the first remaining row wins
 * when a member holds both an `am` and a `pm` entry, which is a display choice and not a count.
 */
function entryFor(entries: readonly Entry[], memberId: string, date: string): Entry | undefined {
  return entries.find(
    (entry) =>
      entry.memberId === memberId &&
      entry.status !== "rejected" &&
      entry.startDate <= date &&
      entry.endDate >= date,
  );
}
