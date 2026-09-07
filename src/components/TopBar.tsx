// UIE-02 — the top bar. 01-plan.md § 4.3, § 4.8 and § 4.9.
//
// **IT TAKES NO PROPS.** The anchor, the previous and next targets and the active segment are all
// derived from the pathname. No context, no upward prop path, no `useOutletContext` — 01-plan.md
// § 4.3 in as many words.
//
// **IT READS `useLocation().pathname` AND NOT `useParams()`, AND THAT IS LOAD-BEARING.** This
// component is rendered by the LAYOUT route, which sits ABOVE the matched child route, so its own
// `useParams()` sees no `:day`, `:month` or `:year` — it would return `{}` on every period screen
// and the cluster would silently never render. 01-plan.md § 4.5 names this as the single most
// likely way to build this bar and have it draw nothing.
//
// **IT HOLDS NO CLOCK.** `shell-period-today` points at the ANCHORLESS address — `/week`, `/month`,
// `/year` — so the screen resolves what day it is from the caller's own clock, which is where the
// three existing local date reads live and where they stay (01-plan.md § 8, rejected alternative 4).
// An absent or malformed anchor draws no cluster at all (AC-15, AC-16): the screen's own redirect
// arrives one render later, and guessing would make the shell disagree with the screen for a frame.
//
// **NONE OF THESE IDS IS A SCREEN'S.** `week-prev`, `month-anchor`, `year-month` and their siblings
// still exist on the four period screens through this ticket — the doubling 01-plan.md § 1 Out of
// scope item 1 declares — so reusing one here would resolve its locator to TWO nodes and Playwright
// fails a strict locator rather than picking the first. Fifteen spec files. New `shell-*` names are
// the only shape that survives the doubling; UIE-03 deletes the screens' headers and may then decide
// whether the old names move here (§ 4.8).
import { Link, useLocation } from "react-router-dom";
import { periodNavFor, type PeriodKind } from "@/lib/period";

const ICON_BUTTON =
  "flex h-8 w-8 items-center justify-center rounded-pill text-lg leading-none text-ink-2 " +
  "transition-colors hover:bg-card hover:text-ink " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

const PILL_OUTLINE =
  "rounded-pill border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 " +
  "transition-colors hover:border-ink-3 hover:text-ink " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

// AC-14, and § 4.9's "never by colour alone": the active segment is distinguished by FILL, by
// WEIGHT and by `aria-current="page"` — which is the one of the three a screen reader gets.
const SEGMENT_BASE =
  "rounded-pill px-3 py-1 text-xs transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
const SEGMENT_ON = "bg-card font-bold text-ink shadow-soft";
const SEGMENT_OFF = "font-semibold text-ink-3 hover:text-ink-2";

const segmentClass = (on: boolean): string =>
  `${SEGMENT_BASE} ${on ? SEGMENT_ON : SEGMENT_OFF}`;

export default function TopBar() {
  const { pathname } = useLocation();
  const nav = periodNavFor(pathname);

  const segments: readonly {
    kind: PeriodKind;
    testId: string;
    label: string;
    to: string;
  }[] =
    nav === null
      ? []
      : [
          {
            kind: "week",
            testId: "shell-view-week",
            label: "Week",
            to: nav.weekTo,
          },
          {
            kind: "month",
            testId: "shell-view-month",
            label: "Month",
            to: nav.monthTo,
          },
          {
            kind: "year",
            testId: "shell-view-year",
            label: "Year",
            to: nav.yearTo,
          },
        ];

  return (
    // § 4.9. Spans the CONTENT PANE only and not the sidebar — it is rendered inside that pane —
    // ~70px tall, on `--color-bg` with no card behind it. `shrink-0` so it keeps its height when the
    // pane below it scrolls.
    <header
      data-testid="shell-topbar"
      className="flex h-[70px] shrink-0 flex-wrap items-center gap-3 px-6"
    >
      {/* AC-15. The whole left cluster and the whole switcher are ABSENT on a route that has no
          period — `/allow-list`, `/entries/new`, `/threshold` and the rest. Absent, not disabled:
          a disabled previous-period control on a screen with no period asserts that a period exists
          and is merely unavailable. `shell-topbar` and `home-new-entry-link` still render. */}
      {nav !== null ? (
        <>
          {/* AC-12. Links and not buttons, the choice the period screens already made: the period
              IS the address, so moving between them is navigation and a member can bookmark or
              share the week they are looking at. */}
          <Link
            data-testid="shell-period-prev"
            to={nav.prevTo}
            aria-label="Previous"
            className={ICON_BUTTON}
          >
            &lsaquo;
          </Link>
          <p
            data-testid="shell-period-anchor"
            data-period-kind={nav.kind}
            className="text-[17px] font-semibold text-ink"
          >
            {nav.label}
          </p>
          <Link
            data-testid="shell-period-next"
            to={nav.nextTo}
            aria-label="Next"
            className={ICON_BUTTON}
          >
            &rsaquo;
          </Link>

          {/* AC-13. The anchorless address of the view being looked at, so `Today` on `/month/2019-03`
              lands on `/month` and the month screen resolves the current month. */}
          <Link
            data-testid="shell-period-today"
            to={nav.todayTo}
            className={PILL_OUTLINE}
          >
            Today
          </Link>
        </>
      ) : null}

      <div className="ml-auto flex items-center gap-3">
        {/* AC-14. Three segments, and each target KEEPS THE DATE — `shell-view-year` from
            `/month/2027-04` reaches `/year/2027` and not the current year. The targets are the ones
            the screens' own cross-view links already compute (§ 4.5). */}
        {segments.length > 0 ? (
          <div className="flex items-center gap-0.5 rounded-pill bg-track p-0.5">
            {segments.map((segment) => {
              const on = nav !== null && segment.kind === nav.kind;
              return (
                <Link
                  key={segment.kind}
                  data-testid={segment.testId}
                  to={segment.to}
                  aria-current={on ? "page" : undefined}
                  className={segmentClass(on)}
                >
                  {segment.label}
                </Link>
              );
            })}
          </div>
        ) : null}

        {/* AC-19. The twelfth relocated id, and the one that does NOT go to the sidebar. It is the
            screen's primary action and the transcription puts it in this cluster; the binding
            constraint from `ticket.yaml` § 5 is *unrenamed and exactly once*, which holds either
            way. It renders on EVERY route inside the shell, which is what keeps the fifteen spec
            files that click it immediately after signing in working.

            No `Duyệt phép` button beside it (AC-20): the approval worklist shipped with its own
            link, `home-pending-entries-link`, and that link is in the sidebar. A second control to
            one address would either duplicate an id — the strict-mode failure AC-6 exists to
            prevent — or give the product two names for one screen. */}
        <Link
          data-testid="home-new-entry-link"
          to="/entries/new"
          className="rounded-pill bg-primary px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          + Book
        </Link>
      </div>
    </header>
  );
}
