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
//
// UIE-04 — **the seven days are a GRID above 1280px and the shipped stack below it, and nothing else
// on this screen changed.** 01-plan.md § 4.2, § 4.3 and § 4.4. Two properties below are decisions
// rather than defaults, and both are worth knowing before editing the layout.
//
// **THE COLUMNS DO NOT FILL THE VIEWPORT AND NO COLUMN SCROLLS ON ITS OWN** (AC-4, AC-5).
// **UIE-05 REVERSED THE FIRST HALF OF THAT SENTENCE AND NOT THE SECOND — see the UIE-05 block
// below.** The
// transcription shows seven columns with a crisp bottom edge — on an EMPTY week, which is the one
// case in which that property costs nothing. At ~161px a column a chip is 90-110px tall, and one
// member may hold an `am` AND a `pm` entry on one date, so sixteen chips on one day is ~1520px of
// content in ~910px of body. Seven independent scrollers would put the days out of horizontal
// register, and a day whose entries all sat below its own fold would read as a quiet day — the
// opposite of what this screen is for. The pane scrolls once instead, and a column is as tall as
// the busiest day.
//
// **IT STILL COUNTS NOTHING, AND AFTER THIS TICKET THAT IS A DECISION TAKEN THREE TIMES.** The
// transcription draws an absence-count footer strip under every column. 01-plan.md § 4.1 refuses
// it, and refuses triage's cheaper suggestion with it — the day's own CHIP count — because a day
// holding one full-day and two half-day entries has three chips and an absence count of two, so
// the number would contradict the month grid for the same date. That is INV-04's forbidden second
// definition, reached without ever opening `absence.ts`. Without a count the strip holds nothing
// the transcription put there, so there is no footer strip either: a column ends where its content
// ends.
//
// UIE-05 — **the column FILLS the viewport, and the header strip and the entry chip are restacked.**
// 01-plan.md § 4.2 to § 4.5. A second image was drawn hours after UIE-04 merged; three of its four
// asks are built here and four are refused. Nothing outside this file is opened.
//
// **THE FILL IS `min-height` AND NEVER `height`, AND THAT IS THE WHOLE OF WHY UIE-04's TWO
// ACCEPTANCE CRITERIA SURVIVE IT.** UIE-04's PROSE, four paragraphs up, said the columns do not fill
// the viewport; this ticket reverses that prose deliberately and says so rather than quietly doing
// the opposite of a shipped decision. It reverses NEITHER AC-4 (every entry reachable by scrolling
// the PAGE, no column scrollbar, nothing clipped) NOR AC-5 (the seven stay in horizontal register):
// a column at LEAST the pane tall and free to grow past it renders the image on a quiet week and
// behaves exactly as those two require on a busy one. A fixed `height` would clip a busy column or
// introduce a second scroller, which is why it is not used. **UIE-04's three rejected alternatives
// are untouched** — seven independently scrolling columns are still refused, for the reason above.
//
// **THE COST, ACCEPTED: on a busy week anything pinned to the bottom of a column goes below the fold
// with that column.** Nothing is pinned there today, and pinning to the VIEWPORT is a different
// feature that is not proposed anywhere.
//
// **THE CHIP KEEPS ALL FIVE OF THE FACTS THE IMAGE DROPS, AND THAT IS THE TICKET'S ONE REAL
// DECISION.** The image's chip is a ~44px two-line stack carrying an avatar, a name, a star and a
// type code, and nothing else. Each of the five it drops is load-bearing: the portion pill is
// INV-06's only visible surface in the product; the note is CAL-05 AC-6; the word `Tentative` is
// AC-9's ACCESSIBLE half, said in words for somebody who cannot see the dashed border;
// `Approved by <name>` is what CAL-05's registry row is actually about, since a bare star says only
// that SOMEBODY approved and `approved_by` is v1's only audit trail; and `Leave` / `Working from
// home` is OPS-002 AC-7, which requires every screen naming a type to state that the member is
// WORKING — a bare `WFH` states nothing. **UIE-04 refused this same deletion as its Option 2, even
// behind an expand where the information still existed; the image deletes it outright.** So the
// SILHOUETTE is reproduced — a three-row stack with a circular avatar bubble and the star beside the
// name — and the five facts are DEMOTED to a third line at reduced size rather than removed. Every
// one of them renders AT REST: no hover, no click, no expansion.
//
// **IT IS THEREFORE TWO OR THREE LINES TALL AND NOT THE IMAGE'S ~44px.** Those two are not
// simultaneously satisfiable and 01-plan.md Open question 2 records the choice as made rather than
// missed.
//
// **AND IT STILL COUNTS NOTHING — a decision now taken FOUR times.** The second image draws
// `n/8 vắng` under every column. That is behaviour rather than arrangement, ADR-029 is PROPOSED and
// awaiting the operator, and this ticket neither builds it nor approximates it with the day's chip
// count. `week-day-empty` therefore keeps its element, its selector and its SENTENCE: the sentence
// and the count are coupled, since a footer reading `0/4` is what would make deleting the sentence
// defensible, so the two are decided together in ADR-029's ticket or not at all.
//
// **THE RADIUS IS `rounded-2xl` AND NOT A CHANGE TO `--radius-card`.** `rounded-card` (26px) is
// SHARED with AuthCard.tsx and Sidebar.tsx, both out of scope, so moving the token would repaint two
// screens this ticket may not touch — the same collision src/index.css:117-123 already records one
// token over. A `--radius-day` token was rejected for having exactly one consumer. The consequence,
// accepted: the day column and the sign-in card now have different corner radii.
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
import { PORTION_LABELS, TYPE_LABELS } from "@/lib/labels";
// UIE-02 § 4.5. `mondayIndex` and `isRealDay` were declared BELOW, in this file; the shell's top bar
// needs both, and `mondayIndex` was DUPLICATED here and in MonthView.tsx character for character.
// Moving each definition into one pure module deletes a copy rather than making a third. This import
// and the two deletions under it are the whole of UIE-02's edit to this screen — no rendered output
// changes here, which is what keeps `Out of scope` item 1 true and zero spec files in scope.
import { currentDay, isRealDay, mondayIndex } from "@/lib/period";

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

/* `mondayIndex` and `isRealDay` STOOD HERE and are now in @/lib/period, imported above (UIE-02
   § 4.5). The duplication CAL-05 recorded in this comment — the same three lines in MonthView.tsx,
   left as a copy because that ticket had one link's worth of scope in that file — is paid here: the
   shell's top bar needed the helper, so moving it deletes a copy instead of adding a third.

   `isRealDay` MOVED WITH IT because the two are used together, and its one implementation detail
   moved too: it checked the calendar roll-over with a round trip through `addDays`, and the new
   module may not import @/lib/data (UIE-02 01-plan.md § 5), so it does the same arithmetic
   directly. The rejected dates are the same ones — `2026-02-30` still fails. */

/* `today()` STOOD HERE and is now `currentDay()` in @/lib/period, imported above (UIE-02 § 4.5,
   added at PLAN rework 1). It is still the one place a LOCAL date read is correct and it still
   carries that argument, at its new home: `/` now resolves the current week in place (AC-5), so the
   shell needed the same answer this screen has always computed, and a second copy of it would be
   two clocks that can disagree on the same screen. MonthView.tsx's `currentMonth` and
   YearView.tsx's `currentYear` deliberately did NOT move — nothing outside those files needs them. */

/* OPS-002 folded the two label maps that stood here into src/lib/labels.ts (AC-8). They were named
   in the singular and had already diverged: `full` read "All day" here and "Full day" on the two
   screens that declared it next, a divergence nobody introduced deliberately and no test caught.
   AC-13 settles it to "Full day", so THIS SCREEN'S WORDING FOR `full` CHANGES and the other two do
   not. */

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

interface WeekViewProps {
  /**
   * UIE-02 § 4.10, added at PLAN rework 1. **At `/` only.** Resolve the current week IN PLACE
   * instead of redirecting to `/week/<today>`.
   *
   * Defaults to false, so `/week` and `/week/:day` behave exactly as CAL-05 shipped them — CAL-05
   * AC-1 and AC-14 are untouched and `tests/e2e/cal-05-week-view.spec.ts` passes unedited.
   *
   * It exists because `/` must be an address the application COMES TO REST ON (UIE-02 AC-23): five
   * shipped spec files walk browser history back to `/` in helpers, and a redirect makes `/` an
   * address that is never in history. Rendering the week here rather than bouncing to `/week` is
   * what makes Back work without making it a trap.
   */
  landing?: boolean;
}

export default function WeekView({ landing = false }: WeekViewProps) {
  const { day } = useParams<{ day: string }>();

  // AC-1 and AC-14. The anchor is the URL and nothing else, so `/week/2026-10-07` typed directly
  // produces the same screen as pressing "next" from the week before. An absent or malformed anchor
  // redirects to this week rather than rendering an error: there is no criterion about a mistyped
  // address, and the current week is the useful answer to somebody who mistyped one.
  //
  // AT `/` THERE IS NOTHING TO REDIRECT TO, so `landing` supplies the anchor instead.
  // **Memoised on mount and not read per render**, so the anchor cannot change under a re-render —
  // the same stability `/week/:day` gets for free from the URL. A bare `currentDay()` in the render
  // body would re-resolve at midnight mid-session and move the week under the caller silently.
  const landingDay = useMemo(() => currentDay(), []);
  const anchorDay = day !== undefined && isRealDay(day) ? day : landing ? landingDay : null;

  // Any day of a week produces the SAME screen, so a link from any date works and `/week/2026-10-07`
  // is not redirected to `/week/2026-10-05` — the URL keeps the date the caller arrived with, and
  // `week-anchor` carries the Monday it resolved to.
  const weekStart = useMemo(
    () => (anchorDay ? addDays(anchorDay, -mondayIndex(anchorDay)) : null),
    [anchorDay],
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

  // Only reachable off `/`: at `/` the anchor is always resolved above, so this never fires there
  // and `/` never moves on its own (AC-23).
  if (anchorDay === null) return <Navigate to={`/week/${currentDay()}`} replace />;

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

  const start = weekStart as string;
  const end = addDays(start, 6);
  const dates = eachDateInRange({ start, end });

  // AC-11. A week nobody has booked, which is the only week the mascot card is drawn over — and the
  // only one with room to draw it over. It reads the SAME `absent` map the columns render from, so
  // the card cannot disagree with the seven `week-day-empty` states beneath it.
  const weekIsEmpty = dates.every((date) => (absent.get(date) ?? []).length === 0);

  return (
    // § 4.4. `mx-auto max-w-3xl` STOOD HERE and is gone: seven columns need the pane's full width,
    // which AppShell.tsx already grants with `min-w-0 flex-1`. Nothing was added to the shell.
    // `xl:h-full` is UIE-05 AC-1's, not CAL-05's or UIE-04's: it is what carries a definite height
    // from AppShell.tsx:42's flex item down to the grid, so that `xl:min-h-full` below has something
    // to be a percentage OF. It is a height and not a min-height on purpose — this element is the
    // measuring stick, and the grid inside it is the thing allowed to outgrow the pane.
    <section className="flex flex-col gap-6 xl:h-full">
      {/* UIE-03 AC-1. **The week screen's own header is gone, and nothing replaces it here.** It
          carried a link to the landing route, then `week-prev`, `week-anchor`, `week-next`,
          `week-month` and `week-year`. The landing link is dead — UIE-02 deleted the home screen and
          made `/` show the current week — and the other five are now the top bar's, rendered once
          for every period screen (01-plan.md § 4.3). AC-5 is why the dead id is not named here.
          `week-anchor` still carries `data-week-start` set to the same Monday this screen computed,
          which is why the 43 references that read it need no edit.

          The day list below is untouched, CAL-08's cell selectors included (AC-10). */}

      {/* CAL-05 AC-13. Seven sections, always. A week that hid its quiet days would make "nobody is
          away on Sunday" and "Sunday is missing" the same screen. UIE-04 AC-3 restates it for the
          grid: seven at EVERY width, and the same seven. */}
      {/* AC-1, AC-2, AC-3 and AC-15. ONE list of seven, laid out two ways by ONE container, so
          the DOM order is Monday-to-Sunday at every width and no day exists at one width and not
          the other. `xl` is Tailwind's 1280px and is the breakpoint 01-plan.md § 4.2 originates —
          nothing in the repository stated one before (`.ai/standards/ui-design-system.md:165` is a
          bare `TODO(project)` for exactly this), which 01-plan.md Open question 1 records.

          `grid-cols-7` is `repeat(7, minmax(0, 1fr))`, so the seven tracks are EQUAL and each may
          shrink below its content — that `minmax(0, ...)`, with `min-w-0` on the day itself, is
          what keeps a long note inside its column instead of widening the pane (AC-15). `gap-2` is
          the transcription's ~8px gutter. Nothing here sets `overflow`: a column is as tall as the
          busiest day and the PANE scrolls, once, for all seven (UIE-04 AC-4, AC-5). */}
      {/* UIE-05 AC-1 and AC-3. **`xl:min-h-full`, and it is a MINIMUM.** The sentence above used to
          read "nothing here sets a height"; a minimum is what lets a quiet week reach the bottom of
          the pane without taking the busy week's freedom to grow past it, which is why UIE-04's AC-4
          and AC-5 survive the reversal of its prose (see the UIE-05 block at the top of this file).

          **01-plan.md OPEN QUESTION 1 ASKED WHETHER A PERCENTAGE RESOLVES THROUGH THIS CHAIN OR
          NEEDS AN EXPLICIT `calc(...)`, AND LEFT IT TO THIS STAGE BECAUSE IT NEEDS A RENDERED
          VIEWPORT. IT WAS RENDERED AND MEASURED, AND THE ANSWER IS THAT THE PERCENTAGE RESOLVES.**
          The chain is App.tsx:82 `<main class="flex min-h-screen flex-col">` -> AppShell.tsx:33
          `flex min-h-0 flex-1` -> :40 the pane, `flex min-w-0 flex-1 flex-col overflow-y-auto` ->
          :42 `min-w-0 flex-1 px-6 pb-6` -> this screen. That last div is a flex ITEM whose height
          the flex algorithm resolves, which is what a percentage below it resolves against — so
          `xl:h-full` on the section and on the positioning wrapper carries a definite height down to
          this grid, and `min-h-full` here is the pane minus the top bar and the pane's own `pb-6`.

          **THE `calc(100vh - 70px - 1.5rem)` THE PLAN NAMED AS THE FALLBACK WAS WRITTEN FIRST, AND
          MEASURING IT IS WHAT REJECTED IT.** It is right only when this grid's top edge is exactly
          the top bar's height, and it is not: App.tsx:88 renders `seam-banner` ABOVE the shell on
          every build resolving to the mock seam, which is every build the acceptance suite drives.
          Measured at 1280x800 the calc put the columns' bottom edge at 856px against an 800px
          viewport — 56px BELOW the fold, with the document scrolling 80px on a week where nobody is
          away, which is the opposite of AC-1. **A percentage is offset-independent and absorbs that
          banner without knowing it exists**: the same measurement gives a bottom edge of 776px, plus
          the pane's 24px of `pb-6`, which is exactly 800.

          Measured with the same probe, and these are AC-2 and AC-3: at a viewport short enough to
          overflow, the seven columns are 533px inside a 270px pane — they grow past it, the PAGE
          scrolls, no column scrolls itself, and all seven keep one top and one height.

          **`xl:` AND NOT BARE**, because below 1280px there are no columns to fill — the stacked
          layout UIE-04 originated is untouched, and a min-height there would push a two-entry week
          onto a page that scrolls for nothing. Measured at 1024px: the seven stack at their content
          height and nothing fills. */}
      {/* `xl:h-full` for the reason on the section above — the second link in the chain. On a busy
          week this wrapper is SHORTER than the grid it holds, which is intended and costs nothing:
          nothing here sets `overflow`, and the only thing positioned against it is the mascot, which
          is drawn on empty weeks only, where the two heights are the same. */}
      <div className="relative xl:h-full">
        <div className="flex flex-col gap-3 xl:grid xl:min-h-full xl:grid-cols-7 xl:gap-2">
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
                // § 4.3. The tokens UIE-01 and UIE-02 shipped, in place of the three Tailwind
                // defaults CAL-05 had to use before they existed — `bg-white` -> `bg-card`,
                // `shadow-sm` -> `shadow-soft`. **UIE-05 § 4.4 TOOK THE THIRD ONE BACK**: the day
                // column is `rounded-2xl` (16px) again, because the image's corner is smaller and
                // `rounded-card` (26px) is SHARED with AuthCard.tsx and Sidebar.tsx — moving
                // `--radius-card` would repaint the sign-in card and the sidebar, which AC-16
                // forbids and which src/index.css:117-123 already records as a collision one token
                // over. A Tailwind built-in on the one element that wants it means src/index.css is
                // never opened. No token is
                // added and src/index.css is not opened. `flex flex-col` makes the header strip sit
                // above the entries in a grid track that stretches to the tallest day, and `min-w-0`
                // is the other half of AC-15 — without it the day refuses to shrink below its
                // content and a long note widens the pane rather than wrapping.
              className="flex min-w-0 flex-col rounded-2xl bg-card p-4 shadow-soft"
              >
                <h2
                  data-testid="week-day-label"
                  className={[
                    // UIE-05 AC-4. A CENTRED STACK, not a wrapping baseline row: at ~161px a
                    // centred two-part label only reads as one label when the parts are stacked.
                    // `border-b border-line` is the hairline — `--color-line` is the token UIE-01
                    // shipped for exactly this and TopBar.tsx:38 already uses it, so no token is
                    // added. `rounded-t-2xl` matches the column's own corner (§ 4.4).
                    "-mx-4 -mt-4 mb-2 flex flex-col items-center gap-0.5 rounded-t-2xl border-b border-line px-4 py-2 text-center text-sm font-semibold",
                    // CAL-08 AC-6. Lavender (CLAUDE.md § Visual direction) tints the HEADING and only
                    // for a NON-WORKING holiday. The rows below are untouched, a mandated `working`
                    // Saturday is named but not tinted, and a bridge day gets no lavender at all.
                    status?.nonWorkingReason === "holiday" ? "bg-violet-100" : "",
                  ].join(" ")}
                >
                  {/* UIE-05 AC-5. **THE FULL WEEKDAY NAME, IN ENGLISH**, and both halves of that are
                      decisions rather than defaults. `T2`/`CN` is Vietnamese and is refused —
                      .ai/standards/ui-design-system.md § Language, the operator's own instruction of
                      2026-09-03, lint-enforced, and `ui-language.json` has `copyDebt: []`, a list
                      that only ever shrinks. `Mon` IS layout and IS available, but
                      tests/e2e/cal-05-week-view.spec.ts:145-146 assert `toContainText("Monday")`,
                      which a substring test fails against `Mon`; keeping the full name is free and
                      is what keeps every spec file out of `allowed_paths`. */}
                  <span>{WEEKDAY_NAMES[mondayIndex(date)]}</span>

                  {/* UIE-05 AC-6. `dd/MM` — `14/09` — sliced out of the `yyyy-MM-dd` this component
                      already holds. No date library, no locale and no new import: § Language governs
                      STRINGS, and a numeric format is outside it. It stays inside `week-day-label`,
                      which is where AC-6 puts it and what keeps the selector contract intact. */}
                  <span className="font-normal opacity-60">
                    {`${date.slice(8, 10)}/${date.slice(5, 7)}`}
                  </span>

                  {/* CAL-08 AC-6. Named whenever a row exists, of EITHER kind, and the badge is
                      outlined rather than filled — lavender means not working. **UIE-05 § 4.3 KEEPS
                      BOTH, on their own line beneath the date.** The image draws no room for either
                      because it shows neither a holiday nor a bridge day, and silence is not
                      removal: dropping the bridge badge because a 161px column has no room for it
                      would reverse CAL-08's own decision that a bridge day is a WORKING day, which
                      is a feature-row amendment and not a layout call. */}
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

                      // UIE-05 AC-9. Row 3 renders only when it would hold something, so the same
                      // question the note element already asked is asked once and named — an empty
                      // third row is a line of padding that claims a fact exists.
                      const hasNote = entry.note !== null && entry.note !== "";

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
                            // UIE-05 AC-7. **A DELIBERATE THREE-ROW STACK, not a wrapping row.**
                            // Same element, same seven children, same selectors — what changes is
                            // that the name and the type no longer share a line and the three
                            // secondary facts are demoted rather than wrapped.
                            "flex flex-col gap-1 rounded-xl px-3 py-2 text-sm",
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
                          {/* UIE-05 AC-7 and AC-8. **ROW 1 — the avatar bubble, the name, the star.**

                              **THE STAR IS INLINE WITH THE NAME AND IS NOT A THIRD FLEX CHILD, AND
                              THAT IS A MEASURED CORRECTION RATHER THAN A PREFERENCE.** Written as
                              three flex children with a `shrink-0` star, the rendered column at
                              1280px left the name about 24px and `Đã duyệt` broke MID-WORD, as
                              `Đã / du / yệt` — a Vietnamese name pulled apart across three lines on
                              the screen CLAUDE.md § Visual direction asks to set the diacritics
                              correctly on. Inline, the star flows after the last word instead of
                              reserving a column of its own, and the name wraps between words. */}
                          <div className="flex min-w-0 items-start gap-2">
                            {/* UIE-05 AC-7. A CIRCULAR BUBBLE rather than a bare glyph, which is the
                                one thing the image's chip does that this file did not. `shrink-0`
                                keeps it round when the name beside it wraps; `h-6 w-6` rather than
                                `h-7 w-7` for the same reason the star moved — at ~137px of column
                                every 4px of bubble is 4px the name does not get. */}
                            <span
                              data-testid="week-row-avatar"
                              aria-hidden="true"
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/70 text-sm leading-none"
                            >
                              {member.avatar}
                            </span>

                            <span className="min-w-0 flex-1 leading-snug">
                              {/* `break-words` is a LAST RESORT and not the normal case: it breaks a
                                  word only when the word cannot fit a line of its own, so with the
                                  width above it wraps between words and clips nothing. `truncate`
                                  was rejected outright — a clipped name is a person the screen has
                                  stopped naming. */}
                              <span data-testid="week-row-name" className="break-words font-medium">
                                {member.displayName}
                              </span>

                              {/* UIE-05 AC-8. **THE STAR MOVED HERE; IT WAS NOT ADDED.** It stood
                                  inside `week-row-approver`, which rendered `★ Approved by <name>`.
                                  CLAUDE.md § Visual direction asks that an approved entry carry a
                                  small star, and beside the name is where it is legible at a glance.
                                  **THE NAME OF THE APPROVER STAYS ON ROW 3** — a bare star says only
                                  that somebody approved, and CAL-05's registry row is about WHO,
                                  which is the whole of v1's audit answer. */}
                              {approver ? (
                                <span aria-hidden="true" className="ml-1">
                                  ★
                                </span>
                              ) : null}
                            </span>
                          </div>

                          {/* UIE-05 AC-7 and AC-9. **ROW 2 — the type and the portion.** The image
                              collapses these to a bare uppercase code; `Leave` / `Working from home`
                              is OPS-002 AC-7, which requires every screen naming an entry's type to
                              state that the member is WORKING and forbids a word meaning "away", and
                              src/lib/labels.ts:21-29 records that choice deliberately. A code states
                              neither. */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span data-testid="week-row-type" data-type={entry.type} className="opacity-70">
                              {TYPE_LABELS[entry.type]}
                            </span>

                            {/* AC-3 and AC-4. `data-portion` is the attribute the criteria turn on, and
                                it is read off the entry on EVERY date the entry covers — which is why a
                                five-day `pm` entry renders five afternoons and cannot render a whole day
                                in the middle (INV-06). **UIE-05 MOVED THIS PILL AND DID NOT DROP IT**,
                                which the image does: it is INV-06's only visible surface in the whole
                                product, so dropping it would make that invariant invisible on the one
                                screen that shows it. */}
                            <span
                              data-testid="week-row-portion"
                              data-portion={entry.portion}
                              className="rounded-full bg-white/70 px-2 py-0.5"
                            >
                              {PORTION_LABELS[entry.portion]}
                            </span>
                          </div>

                          {/* UIE-05 AC-9. **ROW 3 — DEMOTION, NOT DISCLOSURE.** Smaller and lighter,
                              and every one of these renders AT REST: no hover, no click, no expansion.
                              UIE-04 refused hiding them even behind an expand, where the information
                              still existed; this reproduces the image's silhouette and much of its
                              density without amending an acceptance criterion. The row itself is
                              absent when it would be empty. */}
                          {entry.tentative || hasNote || approver ? (
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
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
                                  screen takes. Demoting it changes how PROMINENT it is and not who may
                                  read it. */}
                              {hasNote ? (
                                <span data-testid="week-row-note" className="basis-full break-words opacity-80">
                                  {entry.note}
                                </span>
                              ) : null}

                              {/* AC-7 and AC-8. DISPLAYING who approved, and nothing else: this is a name,
                                  not a control. A pending entry renders no approver at all rather than an
                                  empty one. The star that stood at the head of this sentence is now on row
                                  1; the words and `data-approver-id` are unchanged, which is what
                                  cal-05-week-view.spec.ts:216's `toContainText(ADMIN_NAME)` reads. */}
                              {approver ? (
                                <span
                                  data-testid="week-row-approver"
                                  data-approver-id={approver.id}
                                  className="basis-full opacity-70"
                                >
                                  Approved by {approver.displayName}
                                </span>
                              ) : null}
                            </div>
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

        {/* AC-11 and AC-12. The mascot, and it is the whole of what UIE-04 adds to this screen's
            content. It floats OVER the columns rather than inside one — the transcription puts it
            across the fourth — so it is a sibling of the grid, absolutely positioned over it, and
            `pointer-events-none` keeps it from being a target on a screen that has none.

            `hidden xl:flex` is AC-11's "in the seven-column layout": below the breakpoint the seven
            per-day empty states ARE the screen and a card has nothing to float over.

            IT CARRIES NO LINK AND NO BUTTON (AC-12). The transcription's create link is refused in
            01-plan.md § 1 item 10: `home-new-entry-link` already sits in the top bar on every
            route, so a second control to `/entries/new` either duplicates an id or gives the
            product two names for one destination. The sentence is ENGLISH (§ Language, AC-16) —
            the transcription's is Vietnamese and this is the one string on this screen a developer
            would copy from it rather than from the file.

            The seven `week-day-empty` states below are untouched and all seven still render
            (AC-10), which `tests/e2e/cal-05-week-view.spec.ts:266` asserts by count. */}
        {weekIsEmpty ? (
          <div className="pointer-events-none absolute inset-0 hidden items-center justify-center xl:flex">
            <div
              data-testid="week-empty-card"
              className="flex items-center gap-3 rounded-card bg-card px-5 py-4 shadow-soft"
            >
              <span aria-hidden="true" className="text-2xl leading-none">
                🐭
              </span>
              <p className="text-[13px] text-ink">Nobody has booked this week yet.</p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
