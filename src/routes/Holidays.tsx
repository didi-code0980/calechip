// ADM-02 — the national holiday calendar, one year at a time, read only.
// 01-plan.md sections 2, 2b, 3, 4.2, 4.4 and 4.5.
//
// **IT IS THE ONLY SCREEN IN THE PRODUCT THAT READS A TABLE WITH NO TEAM.** `holiday` carries no
// `team_id` and `holiday_select_all` is `using (true)` (ADR-015 section 1), so there is nothing here
// to scope and nothing here to narrow: a member, an admin and a signed-in caller with no member row
// all see the same rows (AC-2, AC-7, AC-14). Every other read-only screen in this repository calls
// `getCurrentMember()` first and has a `not-on-a-team` phase; this one deliberately does neither,
// because "you are not on a team" is not a true thing to say about a national calendar.
//
// **IT IS READ-ONLY, AND THE DENIAL IS HELD BY THE DATASTORE RATHER THAN BY ABSENCE HERE.** No add,
// no edit, no delete, for either role — and unlike CAL-06's year view there IS a policy to point at:
// nothing has an insert, update or delete policy on this table on this branch, so an admin reaching
// the seam from a console is refused too (AC-13). ADM-03 ships the write half.
//
// **IT COMPUTES NO BRIDGE DAY.** ADR-015 section 4's three-input derivation is CAL-08's, together
// with the shading in the calendar views, and its central definition — what *sandwiched* means for a
// run longer than one day — is an open question with the operator. A bridge-day computation anywhere
// in this file would be an untested derivation whose only consumer does not exist (01-plan.md
// section 5).
//
// Colour, and where it comes from. `.ai/standards/ui-design-system.md` section Colour is still
// `TODO(project)`, so the palette is cited to `CLAUDE.md` section Visual direction, the only place in
// the repository that carries it: holidays are lavender. The `working` rows deliberately do NOT take
// lavender — they are the inverse of a holiday, and giving them the holiday colour is the exact
// confusion ADR-015 section 2 names. 01-plan.md section 2b records that no image was attached at
// either stage and that the arrangement below is the Tech Lead's own.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
// The seam, through its one door. Nothing above the seam names an implementation, and this file must
// never import `./supabase` or `./mock` (RULE-02).
import { seam } from "@/lib/data";
import type { DateRange, Holiday, HolidayKind } from "@/lib/domain/types";

// ---------------------------------------------------------------------------
// The year vocabulary. `yyyy` in the URL, `yyyy-MM-dd` everywhere below it — the shape CAL-06
// shipped for `/year/:year`, borrowed rather than reinvented (01-plan.md section 2b).
// ---------------------------------------------------------------------------

const YEAR_PATTERN = /^\d{4}$/;

/** AC-8. January 1st to December 31st, inclusive, as two strings — no Date is constructed anywhere
 *  in this file, which on this table is the difference between a correct and an incorrect feature
 *  (ADR-015 Consequences, and the note beside `Holiday.date`). */
const yearRange = (year: string): DateRange => ({ start: `${year}-01-01`, end: `${year}-12-31` });

const shiftYear = (year: string, by: number): string => String(Number(year) + by).padStart(4, "0");

/**
 * The year `/holidays` with no anchor resolves to (AC-9).
 *
 * This is the ONE place a LOCAL date read is correct, and the exception is worth naming because
 * every other date in this feature is deliberately a plain string. It answers "which year is it for
 * the person looking at the screen", which is a fact about their clock. `MonthView.tsx`,
 * `WeekView.tsx` and `YearView.tsx` each record the same exception.
 */
const currentYear = (): string => String(new Date().getFullYear()).padStart(4, "0");

/**
 * AC-3. The effect, IN WORDS and not only in colour.
 *
 * `kind` names the effect on the working calendar and never the Vietnamese label — `name` already
 * carries the label (ADR-015 section 2). A `working` row is a mandated Saturday: a weekend day that
 * counts as a working day, the exact inverse of a holiday. Two rows in the same year are therefore
 * distinguishable by something other than their names, which is what AC-3 asks for.
 */
const EFFECT_LABEL: Record<HolidayKind, string> = {
  non_working: "Not a working day",
  working: "A working day",
};

// ---------------------------------------------------------------------------
// The screen.
// ---------------------------------------------------------------------------

// Three phases, and the empty year is a fourth case INSIDE `ready` rather than a phase of its own —
// because it is not a different fact about the read, it is a different fact about the calendar
// (AC-10). "Still loading" and "the read failed" are the two that must never be folded into it: a
// year drawn from a failed or possibly-truncated read looks exactly like an under-seeded one, and
// telling those apart is the whole of AC-11 and AC-12.
type View =
  | { phase: "loading" }
  | { phase: "unavailable" } // a throw from the read, including the truncation refusal
  | { phase: "ready"; holidays: Holiday[] };

export default function Holidays() {
  const { year } = useParams<{ year: string }>();

  // AC-8 and AC-9. The anchor is the URL and nothing else, so `/holidays/2026` typed directly
  // produces the same screen as pressing *next* from 2025. An absent or malformed anchor resolves to
  // the caller's current year rather than rendering an empty calendar — and it resolves HERE rather
  // than in a second route, because which year it is is a fact about the caller's clock and
  // `App.tsx` holds none.
  const valid = year !== undefined && YEAR_PATTERN.test(year);

  const range = useMemo<DateRange | null>(
    () => (valid && year ? yearRange(year) : null),
    [valid, year],
  );

  const [view, setView] = useState<View>({ phase: "loading" });

  const load = useCallback(async (): Promise<void> => {
    if (!range) return;
    setView({ phase: "loading" });

    try {
      // THE ONE READ THIS SCREEN MAKES. No `getCurrentMember()`, no `listMembers()`, no `getTeam()`
      // — a holiday belongs to the calendar and not to any member, so there is no roster to fetch
      // and no threshold to compare against. Either would be the first step toward a derivation this
      // ticket has not designed.
      const holidays = await seam.listHolidays(range);
      setView({ phase: "ready", holidays });
    } catch {
      // AC-11 and AC-12. The read throws on a transport failure AND on a possibly-truncated answer
      // (`HOLIDAY_LIMIT`). This branch is the refusal: no calendar at all, rather than one missing
      // the rows the read dropped — a short calendar renders a holiday as an ordinary working day
      // and a mandated Saturday as an inert weekend, and neither error surfaces on the day whose row
      // went missing.
      setView({ phase: "unavailable" });
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!valid) return <Navigate to={`/holidays/${currentYear()}`} replace />;

  if (view.phase === "loading") {
    return (
      <p
        data-testid="holidays-loading"
        role="status"
        className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center text-sm opacity-70 shadow-sm"
      >
        Loading the calendar…
      </p>
    );
  }

  if (view.phase === "unavailable") {
    return (
      <p
        data-testid="holidays-unavailable"
        role="alert"
        className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center text-sm shadow-sm"
      >
        The holiday calendar could not be read completely, so none of it is shown. A calendar with
        days missing from it would show a holiday as an ordinary working day.
      </p>
    );
  }

  const anchorYear = year as string;
  const { holidays } = view;

  return (
    <section className="mx-auto flex max-w-md flex-col gap-6 rounded-2xl bg-white p-8 shadow-sm">
      <header className="flex flex-wrap items-center gap-4">
        {/* AC-8. Links and not buttons: the year IS the address, so moving between years is
            navigation and anybody can bookmark or share the year they are looking at. The shape
            CAL-06 shipped for `/year/:year`, borrowed rather than reinvented. */}
        <Link
          data-testid="holidays-prev"
          to={`/holidays/${shiftYear(anchorYear, -1)}`}
          className="text-sm underline"
        >
          Previous
        </Link>
        <h1 data-testid="holidays-year" data-year={anchorYear} className="text-xl font-semibold">
          {anchorYear}
        </h1>
        <Link
          data-testid="holidays-next"
          to={`/holidays/${shiftYear(anchorYear, 1)}`}
          className="text-sm underline"
        >
          Next
        </Link>
      </header>

      {holidays.length > 0 ? (
        /* AC-1, AC-2, AC-3, AC-4. Ascending by date, and the order is fixed in BOTH seam
           implementations rather than here — `tests/seam-parity.test.ts` compares names and arity
           and not row order, so a sort in this file would hide a divergence between them rather than
           prevent one. Nothing below re-sorts. */
        <ol data-testid="holidays-list" className="flex flex-col gap-2">
          {holidays.map((holiday) => (
            <li
              key={holiday.id}
              data-testid="holidays-row"
              data-date={holiday.date}
              // AC-3. The ATTRIBUTE is what the criterion turns on, not the colour and not the copy:
              // it keeps AC-3 true when the palette is finally written into
              // .ai/standards/ui-design-system.md, and it lets a test assert the EFFECT rather than
              // parse a sentence.
              data-kind={holiday.kind}
              className={[
                "flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl px-4 py-3 text-sm",
                // Lavender is the holiday colour (CLAUDE.md section Visual direction). The `working`
                // rows deliberately do not take it — they are the inverse of a holiday, and
                // colouring them as one is the exact confusion ADR-015 section 2 names.
                holiday.kind === "non_working" ? "bg-violet-100" : "bg-slate-100",
              ].join(" ")}
            >
              <span data-testid="holidays-row-date" className="font-medium tabular-nums">
                {holiday.date}
              </span>
              <span data-testid="holidays-row-name">{holiday.name}</span>
              {/* AC-3's second half, in WORDS. Colour alone is not readable to somebody who cannot
                  see it, and on this table the two kinds mean opposite things — so the effect is
                  spelled out on every row rather than inferred from a swatch. */}
              <span data-testid="holidays-row-effect" className="ml-auto text-xs opacity-70">
                {EFFECT_LABEL[holiday.kind]}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        /* AC-10. A SENTENCE ABOUT THE CALENDAR, NEVER ABOUT THE YEAR. "No holidays in 2031" is the
           shorter sentence and it is false in a way the product would be stating with confidence: a
           Vietnamese year with no public holidays does not exist, so the only thing an empty year can
           mean is that the calendar has run out. Being under-seeded is silent in every other place it
           could show up, and this notice is what makes it loud in the one place a person looks. */
        <p data-testid="holidays-beyond-calendar" className="text-sm opacity-70">
          The calendar does not go as far as {anchorYear} yet. That is the calendar running out
          rather than a year without holidays — ask an admin to add them.
        </p>
      )}

      <p>
        <Link data-testid="holidays-back" to="/" className="text-sm underline">
          Home
        </Link>
      </p>
    </section>
  );
}
