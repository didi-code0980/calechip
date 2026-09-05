// CAL-05 — the week view: who is away this week, for how much of each day, why, and who agreed.
// 01-plan.md sections 2, 2b, 3, 4.2 and 4.3.
//
// **IT IS READ-ONLY, AND THAT IS THE FEATURE.** The registry row says *displaying who approved is
// not approving* and *no admin action reaches this surface*. There is no approve, no reject, no edit
// and no delete here, for either role, and there is no draft panel either — CAL-04's month cell
// carries the create path and a second one would be a second thing to keep in step with
// `entry_insert_own`. AC-8 is held by ABSENCE, which 01-plan.md section 3 names as the weakest
// mechanism in the plan: a reviewer checks it by reading the imports below and finding no write.
//
// **IT COUNTS NOTHING.** No absence count, no overload state, no threshold, and `seam.getTeam()` is
// deliberately not called (01-plan.md section 4.2) — it exists to supply `overloadThreshold`, and
// calling it would be the first step toward the number the feature row says this screen does not
// have. Every row drawn comes from `absentEntriesFor`, which is the third derivation from INV-04's
// one pass; a `.filter(e => e.status !== ...)` written anywhere in this file would be the second
// definition INV-04 exists to forbid, and the divergence the row names — four names against 3.5 —
// is invisible on either screen alone.
//
// **INV-06 IS VISIBLE HERE AND NOWHERE ELSE.** A five-day `pm` entry is five afternoons, not a
// half-day at one end, because `portion` is one value applying to every date in the range. This view
// chooses nothing about that: it reads `entry.portion` on every row it draws, which is what makes
// the rendering unable to contradict the column shape CAL-01 shipped (AC-4).
//
// Colour, and where it comes from. `.ai/standards/ui-design-system.md` § Colour is still
// `TODO(project)`, so the palette is cited to `CLAUDE.md` § Visual direction, the only place in the
// repository that carries it: PTO peach, WFH mint, tentative dashed at reduced opacity, approved
// carrying a small star. No overload pink appears here at all, because no overload state is
// computed. Holidays are lavender, and CAL-08 draws them HERE — the sentence this replaces said
// they were not drawn on this screen, and that ticket is the one that spends it. Lavender means NOT
// WORKING and tints the DAY HEADING only; the rows below are untouched. A bridge day is a working
// day, gets no lavender, and carries an outlined badge instead (glossary.md, CAL-08 01-plan.md
// § 2b). 01-plan.md § 2b records that no image was attached at either stage and that the arrangement
// below is the Tech Lead's own.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
// The seam, through its one door. Nothing above the seam names an implementation, and this file must
// never import `./supabase` or `./mock` (RULE-02).
import { seam } from "@/lib/data";
// INV-04's module, imported DIRECTLY rather than through the seam — the same import MonthView.tsx
// makes, for the same reason: neither seam implementation counts or derives anything, so there is no
// second answer for tests/seam-parity.test.ts to miss.
import { absentEntriesFor, addDays, eachDateInRange } from "@/lib/data/absence";
// CAL-08's derivation, imported the same way and for the same reason. The weekend rule lives inside
// that module and is not exported — a `isSaturday(d)` written here would be the second definition
// .ai/registry/features.md:95 forbids, and this file draws no weekend distinction anyway.
import { dayStatusesFor, holidayReadRange } from "@/lib/data/day-status";
import type { AbsenceDetail, DateRange, DayStatus, Entry, Holiday, Member } from "@/lib/domain/types";

// ---------------------------------------------------------------------------
// The week vocabulary. `yyyy-MM-dd` in the URL and everywhere below it.
// ---------------------------------------------------------------------------

/** Monday first, matching the month grid's column order. */
const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/**
 * The weekday of a `yyyy-MM-dd` date, 0 for Monday.
 *
 * Read in UTC and never locally. `new Date('2026-04-30')` parses as UTC midnight and a local weekday
 * read west of UTC yields the previous day — CAL-01 01-plan.md section 4.5 records the trap.
 *
 * **A COPY of the same three lines in MonthView.tsx, and the duplication is deliberate.** CAL-05
 * 01-plan.md section 7 gives that file ONE link and nothing else, so lifting the helper into
 * @/lib/data/absence and rewriting the month's import is scope this ticket does not have. Recorded
 * in 03-impl-log.md § Open questions so the next reader finds it rather than rediscovers it.
 */
const mondayIndex = (date: string): number => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;

/**
 * A `yyyy-MM-dd` that names a real date.
 *
 * The shape test alone is not enough: `Date.parse('2026-02-30T00:00:00Z')` does NOT return NaN, it
 * rolls over to 2 March — verified by running it rather than recalled. So the check is the round
 * trip through `addDays`, which is the same UTC conversion INV-04's module does and which returns a
 * different string for any date that rolled.
 */
const DAY_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

const isRealDay = (day: string): boolean => DAY_PATTERN.test(day) && addDays(day, 0) === day;

/**
 * The day `/week` with no anchor redirects to.
 *
 * This is the ONE place a LOCAL date read is correct, and the exception is worth naming because
 * every other date in this feature is deliberately UTC — MonthView.tsx's `currentMonth` records the
 * same one. It answers "what day is it for the person looking at the screen", which is a fact about
 * their clock and not a stored `yyyy-MM-dd`.
 */
function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** What a row says about how much of the day is gone. INV-06: one value for the whole entry. */
const PORTION_LABEL: Record<Entry["portion"], string> = {
  full: "All day",
  am: "Morning",
  pm: "Afternoon",
};

/** A WFH member IS working — glossary.md calls that the single most costly confusion in the domain,
 *  which is why the two types are worded as well as coloured differently. */
const TYPE_LABEL: Record<Entry["type"], string> = {
  pto: "Leave",
  wfh: "Working from home",
};

// ---------------------------------------------------------------------------
// The screen.
// ---------------------------------------------------------------------------

// Four states, and they are four for the reason MonthView.tsx, TeamEntries.tsx and MemberList.tsx
// all record. "Still loading", "you are on no team" and "the read failed" are three different facts,
// and folding any two of them tells somebody something untrue. AC-15 is the third one: a week drawn
// from a possibly-truncated read is a short list that reads as a quiet week, which is worse than an
// error because nothing about it looks wrong.
type View =
  | { phase: "loading" }
  | { phase: "not-on-a-team" } // the caller has no member row, or has been removed
  | { phase: "unavailable" } // a throw from either read, including the truncation assertion
  | { phase: "ready"; roster: Member[]; entries: Entry[]; holidays: Holiday[] };

export default function WeekView() {
  const { day } = useParams<{ day: string }>();

  // AC-1 and AC-14. The anchor is the URL and nothing else, so `/week/2026-10-07` typed directly
  // produces the same screen as pressing "next" from the week before. An absent or malformed anchor
  // redirects to this week rather than rendering an error: there is no criterion about a mistyped
  // address, and the current week is the useful answer to somebody who mistyped one.
  const valid = day !== undefined && isRealDay(day);

  // Any day of a week produces the SAME screen, so a link from any date works and `/week/2026-10-07`
  // is not redirected to `/week/2026-10-05` — the URL keeps the date the caller arrived with, and
  // `week-anchor` carries the Monday it resolved to.
  const weekStart = useMemo(
    () => (valid && day ? addDays(day, -mondayIndex(day)) : null),
    [valid, day],
  );

  const range = useMemo<DateRange | null>(
    () => (weekStart ? { start: weekStart, end: addDays(weekStart, 6) } : null),
    [weekStart],
  );

  const [view, setView] = useState<View>({ phase: "loading" });

  const load = useCallback(async (): Promise<void> => {
    if (!range) return;
    setView({ phase: "loading" });

    try {
      const me = await seam.getCurrentMember();

      // A caller with no member row, and a removed one, land here. Both read no entries at all —
      // `member_team_id` filters `removed_at is null` inside its own body, so every policy built on
      // it inherits that. This state is the honest one for both.
      if (!me) {
        setView({ phase: "not-on-a-team" });
        return;
      }

      // The two reads 01-plan.md section 4.2 permits, plus the ONE CAL-08 adds, and no fourth.
      // `listMembers()` returns the roster INCLUDING removed members (ADR-013), which is what AC-11
      // needs and what lets an approver who has since been removed resolve to a name rather than to
      // a bare uuid.
      //
      // The holiday range is PADDED: `dayStatusesFor` is not total on its own range, because
      // deciding whether Monday is a bridge day needs the Sunday before it — which for a seven-day
      // range is outside it. The pad is one exported function rather than an expression here, so the
      // three views cannot disagree about it (CAL-08 01-plan.md section 8, rejected alternative 2).
      const [roster, entries, holidays] = await Promise.all([
        seam.listMembers(),
        seam.listTeamEntriesOverlapping(range),
        seam.listHolidays(holidayReadRange(range)),
      ]);

      setView({ phase: "ready", roster, entries, holidays });
    } catch {
      // AC-15. All three reads throw on a transport failure and on a possibly-truncated answer
      // (`MONTH_ENTRY_LIMIT`, reused rather than joined by a second constant — section 4.2). This
      // branch is the refusal: nobody is listed, rather than a short list that reads as a quiet week.
      //
      // CAL-08 AC-12 is the same branch for the holiday read, whose truncation is worse than local:
      // a dropped Thursday row removes FRIDAY's bridge mark (ADR-015 Consequences), so a week drawn
      // without its holidays is a believable wrong answer about a day whose own row arrived intact.
      setView({ phase: "unavailable" });
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  // AC-2, AC-5, AC-9, AC-10, AC-11, AC-12. INV-04's third derivation, from the same pass as the
  // month's counts and avatars. Nothing in this file narrows `entries` itself.
  const absent = useMemo(
    () =>
      view.phase === "ready" && range
        ? absentEntriesFor(view.entries, range, view.roster)
        : new Map<string, readonly AbsenceDetail[]>(),
    [view, range],
  );

  // CAL-08 AC-6 and AC-11. The day status of the seven days, from the same module the month grid
  // reads — which is what makes the two screens unable to disagree about a date (CAL-08 AC-11).
  const dayStatuses = useMemo(
    () =>
      view.phase === "ready" && range
        ? dayStatusesFor(view.holidays, range)
        : new Map<string, DayStatus>(),
    [view, range],
  );

  // AC-7. The approver is resolved against the roster the same read returned, so no name from
  // another team can reach the screen (INV-07) and a removed admin still resolves.
  const byId = useMemo(
    () => new Map((view.phase === "ready" ? view.roster : []).map((member) => [member.id, member])),
    [view],
  );

  if (!valid) return <Navigate to={`/week/${today()}`} replace />;

  if (view.phase === "loading") {
    return (
      <p
        data-testid="week-loading"
        role="status"
        className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center text-sm opacity-70 shadow-sm"
      >
        Loading the week…
      </p>
    );
  }

  if (view.phase === "not-on-a-team") {
    return (
      <section
        data-testid="week-not-on-a-team"
        className="mx-auto flex max-w-md flex-col gap-3 rounded-2xl bg-white p-8 text-center text-sm shadow-sm"
      >
        <p>This calendar belongs to a team, and you are not on one yet.</p>
        <Link data-testid="week-sign-in" to="/signin" className="underline">
          Sign in
        </Link>
      </section>
    );
  }

  if (view.phase === "unavailable") {
    return (
      <p
        data-testid="week-unavailable"
        role="alert"
        className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center text-sm shadow-sm"
      >
        The week could not be read completely, so nobody is listed. A short list would look like a
        quiet week.
      </p>
    );
  }

  const anchorDay = day as string;
  const start = weekStart as string;
  const end = addDays(start, 6);
  const dates = eachDateInRange({ start, end });

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-wrap items-center gap-4">
        <Link data-testid="week-home" to="/" className="underline">
          Home
        </Link>

        {/* AC-14. Links and not buttons: the week IS the address, so moving between weeks is
            navigation and a member can bookmark or share the week they are looking at. Previous is
            the seven days ENDING the day before this Monday; next is the seven BEGINNING the day
            after this Sunday. */}
        <Link data-testid="week-prev" to={`/week/${addDays(start, -7)}`} className="underline">
          Previous
        </Link>
        <h1 data-testid="week-anchor" data-week-start={start} className="text-xl font-semibold">
          Week of {start}
        </h1>
        <Link data-testid="week-next" to={`/week/${addDays(start, 7)}`} className="underline">
          Next
        </Link>

        {/* AC-14's second half, and the reason CAL-04 could not build it: switching views keeps the
            DATE, so this goes to the month containing the day in the URL — not the month containing
            the Monday, which for a week spanning a month boundary is a different month and would
            drop the date the caller was actually looking at. */}
        <Link
          data-testid="week-month"
          to={`/month/${anchorDay.slice(0, 7)}`}
          className="ml-auto underline"
        >
          Month
        </Link>

        {/* CAL-06 AC-12. The one link CAL-06 adds to this file, and the whole of its edit here
            (CAL-06 01-plan.md section 7). It keeps the DATE the same way `week-month` above does:
            the year of the day in the URL, not of the Monday — for a week spanning 31 December those
            are different years, and the anchor is the date the caller actually arrived with. */}
        <Link data-testid="week-year" to={`/year/${anchorDay.slice(0, 4)}`} className="underline">
          Year
        </Link>
      </header>

      {/* AC-13. Seven sections, always. A week that hid its quiet days would make "nobody is away on
          Sunday" and "Sunday is missing" the same screen. */}
      <div className="flex flex-col gap-3">
        {dates.map((date) => {
          const people = absent.get(date) ?? [];
          // CAL-08. Every date of the week is a key — the contract `dayStatusesFor` keeps — so the
          // fallback below is for the loading and failure phases and never for a drawn day.
          const status = dayStatuses.get(date);
          const holiday = status?.holiday ?? null;

          return (
            <section
              key={date}
              data-testid="week-day"
              data-date={date}
              // CAL-08 AC-6 and AC-11. The same two attributes the month cell carries, with the same
              // three values and the same separate `data-bridge` — a bridge day IS a working day.
              data-day-status={status ? (status.nonWorkingReason ?? "working") : ""}
              data-bridge={status?.bridge ?? false}
              className="rounded-2xl bg-white p-4 shadow-sm"
            >
              <h2
                data-testid="week-day-label"
                className={[
                  "-mx-4 -mt-4 mb-2 flex flex-wrap items-baseline gap-2 rounded-t-2xl px-4 py-2 text-sm font-semibold",
                  // CAL-08 AC-6. Lavender (CLAUDE.md § Visual direction) tints the HEADING and only
                  // for a NON-WORKING holiday. The rows below are untouched, a mandated `working`
                  // Saturday is named but not tinted, and a bridge day gets no lavender at all.
                  status?.nonWorkingReason === "holiday" ? "bg-violet-100" : "",
                ].join(" ")}
              >
                {WEEKDAY_NAMES[mondayIndex(date)]}
                <span className="font-normal opacity-60">{date}</span>

                {/* CAL-08 AC-6. Named whenever a row exists, of EITHER kind, and the badge is
                    outlined rather than filled — lavender means not working. */}
                {holiday !== null ? (
                  <span
                    data-testid="week-day-holiday"
                    data-kind={holiday.kind}
                    className="font-normal opacity-80"
                  >
                    {holiday.name}
                  </span>
                ) : null}
                {status?.bridge ? (
                  <span
                    data-testid="week-day-bridge"
                    className="rounded-full border border-current px-2 py-0.5 text-xs font-normal opacity-70"
                  >
                    Bridge
                  </span>
                ) : null}
              </h2>

              {people.length === 0 ? (
                <p data-testid="week-day-empty" className="mt-2 text-sm opacity-60">
                  Everybody is in.
                </p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2">
                  {people.map(({ entry, member }) => {
                    // AC-7. `approvedBy` is resolved, never rendered raw: a uuid on the row would be
                    // the opposite of naming who approved.
                    //
                    // BOTH halves are tested, and the `status` half is not redundant. INV-02's
                    // trigger clears `approved_by` when an approval is revoked, so today the two
                    // agree — but the selector contract says `week-row-approver` is present only
                    // when the entry is APPROVED, and reading the status is what makes that true of
                    // this file rather than true of a trigger one layer down.
                    const approver =
                      entry.status === "approved" && entry.approvedBy !== null
                        ? byId.get(entry.approvedBy)
                        : undefined;

                    return (
                      <li
                        // One member may hold an `am` AND a `pm` entry on one date, so the key is the
                        // entry and not the member — that pair is two rows here and one avatar on
                        // the month grid, which is the same fact told two ways.
                        key={entry.id}
                        data-testid="week-row"
                        data-member-id={member.id}
                        data-entry-id={entry.id}
                        className={[
                          "flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-sm",
                          // PTO peach, WFH mint (CLAUDE.md § Visual direction), matching the month
                          // grid's chips so one person reads the same on both screens.
                          entry.type === "wfh" ? "bg-emerald-100" : "bg-orange-100",
                          // AC-9. Tentative is a dashed border at reduced opacity, so that "is
                          // listed" and "is settled" stay visually separate: a tentative entry is
                          // listed on exactly the same terms as any other (INV-05) and drawn so
                          // nobody reads the list as certainty.
                          entry.tentative
                            ? "border border-dashed border-current opacity-70"
                            : "border border-transparent",
                        ].join(" ")}
                      >
                        <span data-testid="week-row-avatar" aria-hidden="true" className="text-lg">
                          {member.avatar}
                        </span>
                        <span data-testid="week-row-name" className="font-medium">
                          {member.displayName}
                        </span>

                        <span data-testid="week-row-type" data-type={entry.type} className="opacity-70">
                          {TYPE_LABEL[entry.type]}
                        </span>

                        {/* AC-3 and AC-4. `data-portion` is the attribute the criteria turn on, and
                            it is read off the entry on EVERY date the entry covers — which is why a
                            five-day `pm` entry renders five afternoons and cannot render a whole day
                            in the middle (INV-06). */}
                        <span
                          data-testid="week-row-portion"
                          data-portion={entry.portion}
                          className="rounded-full bg-white/70 px-2 py-0.5"
                        >
                          {PORTION_LABEL[entry.portion]}
                        </span>

                        {/* AC-9's marking. The dashed border above says it visually; this says it in
                            words, because a border is not readable to somebody who cannot see it. */}
                        {entry.tentative ? (
                          <span data-testid="week-row-tentative" className="opacity-70">
                            Tentative
                          </span>
                        ) : null}

                        {/* AC-6. Present only when there is a note — an empty note element is a row
                            that claims something was said. The note is readable by the whole team,
                            which follows from `entry_select_team` being a row-level select policy
                            (ADR-005) and is a consequence to be aware of rather than a decision this
                            screen takes. */}
                        {entry.note !== null && entry.note !== "" ? (
                          <span data-testid="week-row-note" className="basis-full opacity-80">
                            {entry.note}
                          </span>
                        ) : null}

                        {/* AC-7 and AC-8. DISPLAYING who approved, and nothing else: this is a name
                            and a star, not a control. A pending entry renders no approver at all
                            rather than an empty one. */}
                        {approver ? (
                          <span
                            data-testid="week-row-approver"
                            data-approver-id={approver.id}
                            className="basis-full text-xs opacity-70"
                          >
                            <span aria-hidden="true">★</span> Approved by {approver.displayName}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </section>
  );
}
