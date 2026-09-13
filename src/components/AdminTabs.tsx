// SOLO, 2026-09-09 — the admin area's tab strip.
//
// **THIS FILE IS UIE-09's `DESTINATIONS` ARRAY AND ITS LIST MARKUP, MOVED AND RE-LAID-OUT.** Nothing
// about what it names changed: the same five destinations, in the same order, under the same
// `admin-hub-link` row id with the same `data-to`, and the same five `admin-hub-*-link` ids on the
// anchors. That is deliberate and it is what makes this a LAYOUT change rather than a migration —
// sixty-nine assertions across ten spec files address those ids, and not one of them needed editing.
//
// **WHY THE COPY DID NOT MOVE WITH IT.** `AdminHub.tsx` rendered these as five stacked cards, each
// with a name and a blurb. A tab is one word wide, so the blurb has no line to sit on; it is carried
// as the anchor's `title` rather than deleted, because the sentence explaining what *Allow list*
// means is the only thing in the product that explains it.
//
// **WHAT THIS IS NOT.** It is not a dashboard and it renders no count. The transcription showed a
// pink `5` on the approvals tab and the operator was asked and chose to leave it out: UIE-09
// `01-plan.md` § 1 fences a count as *"a seam read, a loading state and a refusal path on a screen
// that otherwise has none ... a different ticket"*, and that is exactly as true of a tab as it was
// of a link. **THIS COMPONENT MAKES NO SEAM CALL AT ALL** — it holds five addresses and no data, so
// it has no phases, no failure path and nothing to get out of date.
//
// **IT IS AN AFFORDANCE, NOT A CONTROL** (ADR-005). Every destination keeps its own guard, its own
// refusal and its own row-level security; a caller who types one of these addresses is refused by
// the screen at the far end, not by the absence of a tab here.
import { NavLink } from "react-router-dom";
import type { MemberRole } from "@/lib/domain/types";
import { mayAdminister } from "@/lib/roles";

/**
 * The five destinations, declared once as data so the strip and its order are one thing rather than
 * five copies of a row — UIE-09 `01-plan.md` § 4.4, and this array is that one verbatim.
 *
 * **THE ORDER IS BY HOW OFTEN AN ADMIN NEEDS IT** — § 2b — and not alphabetical and not the
 * sidebar's. The approval queue is the daily one and it is first. UIE-09 AC-3 reads these addresses
 * off the rendered rows and compares them to its own copy of this list, so the order is asserted
 * rather than merely intended.
 *
 * `/holidays` IS DELIBERATELY NOT ONE OF THEM (§ 1, Out of scope): it is already linked in the
 * sidebar for BOTH roles, not behind the role condition, so it is not an administrative destination
 * this strip collects.
 */
export const ADMIN_TABS: readonly {
  testId: string;
  to: string;
  name: string;
  blurb: string;
  /**
   * SOLO 2026-09-12, ADR-035. Whether a `manager` sees this tab.
   *
   * **EXACTLY ONE TAB IS TRUE, AND THE FIELD EXISTS RATHER THAN A LIST OF IDS ELSEWHERE** so that a
   * tab added later has to answer the question at the point it is declared. The default a reader
   * should assume is `false`: a manager's one power is deciding an entry, so every other tab is a
   * screen they would be refused by.
   *
   * It is an AFFORDANCE (ADR-005). `/members`, `/setting`, `/teams`, `/signups` and `/holidays` each
   * refuse a manager on their own, and `/entries/team` is an admin power by ADR-035 § Rationale.
   */
  forManager: boolean;
}[] = [
  {
    testId: "admin-hub-pending-link",
    to: "/entries/pending",
    name: "Pending approvals",
    blurb:
      "Entries waiting for a decision. Approve or reject them one at a time or together.",
    // ADR-035. THE ONE TAB A MANAGER SEES, and their only route into the admin area.
    forManager: true,
  },
  {
    testId: "admin-hub-team-entries-link",
    to: "/entries/team",
    name: "Team entries",
    blurb:
      "Every entry the team has declared, with the controls to edit or remove one.",
    // ADR-035: not a manager's. Denied by the screen behind it as well as by its absence here.
    forManager: false,
  },
  {
    testId: "admin-hub-members-link",
    to: "/members",
    name: "Members",
    blurb: "Who is on the team. Remove somebody, or make somebody an admin.",
    // ADR-035: not a manager's. Denied by the screen behind it as well as by its absence here.
    forManager: false,
  },
  {
    testId: "admin-hub-allow-list-link",
    to: "/signups",
    name: "New sign-ups",
    blurb: "People who have signed up and are waiting to be let into the team.",
    // ADR-035: not a manager's. Denied by the screen behind it as well as by its absence here.
    forManager: false,
  },
  {
    testId: "admin-hub-threshold-link",
    // SOLO, 2026-09-11, later the same day — `to` MOVED TO `/setting` AND `name` TO `Settings`, on the
    // operator's instruction, when the approval switches joined this screen. `testId` still does not
    // move, for the reason the paragraph below gives: sixty-nine assertions address it. The sentence
    // below that says `to` is "deliberately untouched" is superseded by that decision.
    to: "/setting",
    // **SOLO, 2026-09-11 — RENAMED FROM `Overload threshold`, AND ONLY THE WORD MOVED.** The screen
    // at `/threshold` now carries the team's name and size as well as the threshold, so the tab is
    // named for the screen rather than for one of its two controls. `testId` and `to` are
    // deliberately untouched: UIE-09 AC-3 reads the five `data-to` values and their order, and
    // sixty-nine assertions across ten spec files address these ids — none of them reads a name.
    //
    // **THE PARAGRAPH BELOW ABOUT LABELS IS WHY THIS IS SAFE AND THE 2026-09-09 SHORTENING WAS NOT.**
    // That one broke `adm-04-worklist.spec.ts:441`, which pins `Pending approvals` — a different
    // tab, whose label a shipped criterion does assert. Checked before renaming: no spec reads this
    // one's.
    name: "Settings",
    blurb:
      "The team's name and size, the share above which a day is called crowded, and which entries need approval.",
    // ADR-035: not a manager's. Denied by the screen behind it as well as by its absence here.
    forManager: false,
  },
  {
    // SOLO, 2026-09-12 — **THE SEVENTH TAB, ON THE OPERATOR'S INSTRUCTION** *"move Public holidays
    // into admin panel"*. It is the only tab whose screen is NOT admin-only, and that asymmetry is
    // deliberate and is carried in one place: `Sidebar.tsx` still renders `home-holidays-link`, now
    // FOR A MEMBER ONLY. Reading the national calendar is a both-roles permission in
    // `.ai/standards/rbac-and-security.md`, `Holidays.tsx:97-98` has no `refused` phase because of
    // it, and `Sidebar.tsx` warned in terms that `/holidays` is linked from exactly one place in the
    // product so that no admin control could adopt it "without taking the national calendar away
    // from every member". Each role now has exactly one route to it and neither has two.
    //
    // BEFORE `Teams`, because § 2b orders by how often an admin needs each: the government announces
    // the swap days once a year, which is rarer than everything above and commoner than creating a
    // team.
    testId: "admin-hub-holidays-link",
    to: "/holidays",
    name: "Public holidays",
    blurb:
      "The national calendar: public holidays, and the swap and compensatory days announced each year.",
    // ADR-035: not a manager's. Denied by the screen behind it as well as by its absence here.
    forManager: false,
  },
  {
    // SOLO, 2026-09-11 — many teams. **THE SIXTH TAB, AND A TAB RATHER THAN A SECTION OF
    // `Settings`**, on the operator's choice: `/setting` is ONE team's settings and this is every
    // team. The cost is UIE-09 AC-3's "exactly five destinations and no sixth", amended in its spec
    // rather than quietly passing. LAST, because § 2b orders by how often an admin needs each and
    // creating a team is the rarest thing here. `ADMIN_ADDRESSES` below derives from this array, so
    // the top bar's Calendar face and the strip both reach `/teams` without a second list.
    testId: "admin-hub-teams-link",
    to: "/teams",
    name: "Teams",
    blurb: "Every team on the system. Create, rename or delete one, and move people between them.",
    // ADR-035: not a manager's. Denied by the screen behind it as well as by its absence here.
    forManager: false,
  },
];

/**
 * The hub's own address, named once so the two readers below agree with each other by construction.
 */
export const ADMIN_HUB = "/admin";

/**
 * SOLO, 2026-09-11 — **THE ADMIN ADDRESSES, DERIVED AND NEVER TYPED OUT A SECOND TIME.** The hub
 * plus every address `ADMIN_TABS` points at, which is what `AdminLayout` wraps in `App.tsx`.
 *
 * **THE COUNT IS DELIBERATELY NOT IN THIS SENTENCE ANY MORE — SOLO 2026-09-12.** It read "the six"
 * and had already been wrong once; `/holidays` made seven. A number written beside a list that is
 * derived FROM that list is a second declaration of its length, and it is the copy that goes stale.
 *
 * **IT EXISTS BECAUSE `TopBar` SITS ABOVE `AdminLayout` IN THE TREE AND CANNOT ASK IT ANYTHING.**
 * The top bar is rendered by `AppShell`, which is the layout route ABOVE the admin layout route, so
 * the router's own answer to *is this an admin screen* — the thing `AdminLayout.tsx`'s header
 * insists on — is not reachable from up there: an outlet context flows down, and `useMatches()`
 * needs a data router, which this application does not use (`App.tsx` mounts `<BrowserRouter>`).
 *
 * **SO THE PATHNAME TEST IS THE ONE HONEST OPTION LEFT, AND THIS ARRAY IS WHAT KEEPS IT CHEAP TO
 * KEEP TRUE.** `AdminLayout.tsx`'s objection to a `useLocation()` conditional is that the list of
 * admin screens then has to be extended by hand and the failure is silent. That objection still
 * stands and this does not answer it — it only narrows it to ONE list, the one the strip already
 * renders from. A further admin address added to `App.tsx` and NOT to `ADMIN_TABS` gets neither the
 * strip nor the toggle, and the two are wrong together rather than separately.
 */
export const ADMIN_ADDRESSES: readonly string[] = [
  ADMIN_HUB,
  ...ADMIN_TABS.map((tab) => tab.to),
];

/**
 * Whether `pathname` is one of them.
 *
 * **AN ADMIN ADDRESS OR A CHILD OF ONE**, widened from an exact match by SOLO 2026-09-12 when
 * `/holidays` joined the list: that screen has a second route, `/holidays/:year`, and under the
 * exact test the top bar's control flipped to its *go in* face the moment an admin pressed *next
 * year* — the one screen where changing the year is the normal thing to do.
 *
 * **THE CHILD TEST IS A `startsWith(a + "/")` AND NOT A BARE PREFIX**, which is what keeps the
 * hazard the exact match was protecting against: the trailing slash is checked against every
 * address on the list, and `/year/2026/members` does not begin with `/members/`, `/entries/new`
 * and `/entries/abc/edit` do not begin with `/entries/team/`, and `/setting` has no sibling it
 * could swallow. A bare `startsWith` would have been wrong for the first of those.
 */
export const isAdminAddress = (pathname: string): boolean =>
  ADMIN_ADDRESSES.some((a) => pathname === a || pathname.startsWith(`${a}/`));

/**
 * The strip. Rendered by `AdminLayout` on the admin addresses and nowhere else.
 *
 * **`NavLink` AND NOT `Link`, WHICH IS THE WHOLE REASON A TAB IS DIFFERENT FROM A LINK.** A tab has
 * to say which one you are on, and `NavLink` derives that from the router's own matched location —
 * so the active tab is a fact about the URL rather than a prop somebody has to remember to pass. It
 * also sets `aria-current="page"` itself, which is the attribute a screen reader announces and the
 * one the spec asserts; a hand-written `data-active` would be a second copy of the same fact.
 *
 * **THE FIVE LABELS ARE UIE-09's, LETTER FOR LETTER, AND WERE NOT SHORTENED FOR THE TAB.** They
 * were, briefly — *Approvals* and *Threshold* — and `tests/e2e/adm-04-worklist.spec.ts:441` pins the
 * first at `Pending approvals`, so the shortening broke a shipped criterion that has nothing to do
 * with this change. Restored. A tab strip that scrolls costs less than renaming copy the suite
 * already asserts, and `overflow-x-auto` on the strip is what pays for the extra width.
 *
 * `end` IS NOT SET ON ANY OF THEM and does not need to be: none of the five addresses is a prefix
 * of another, so a partial match cannot light two tabs. `/entries/team` and `/entries/pending` share
 * `/entries` and diverge at the next segment, which `NavLink` compares whole.
 */
export interface AdminTabsProps {
  /** The signed-in caller's rank. `App.tsx` resolved it; this component re-reads nothing. */
  role: MemberRole;
}

/**
 * SOLO 2026-09-12, ADR-035 — **THE STRIP IS FILTERED BY RANK AND IS NOT HIDDEN WHOLESALE.** A
 * manager needs one admin address and no others, so they get a one-tab strip rather than the
 * sidebar link UIE-10 spent a ticket removing or a second navigation concept nobody else uses.
 *
 * A one-tab strip looks odd and is honest: it says *this is the admin area, and here is your part of
 * it*. The alternative considered and refused was drawing all seven and letting each screen refuse —
 * which is exactly what UIE-10 AC-1 removed from the sidebar, on the ground that handing somebody a
 * list of addresses that will turn them away is worse than not offering them.
 */
export default function AdminTabs({ role }: AdminTabsProps) {
  const tabs = mayAdminister(role) ? ADMIN_TABS : ADMIN_TABS.filter((tab) => tab.forManager);

  return (
    // `overflow-x-auto` and `shrink-0` on the rows: five tabs do not fit a narrow viewport, and the
    // strip scrolling inside itself is what keeps the PAGE from scrolling sideways — the same rule
    // UIE-02 AC-21 states for the grid pane.
    <nav
      data-testid="admin-tabs"
      aria-label="Admin"
      className="mb-6 w-full overflow-x-auto rounded-card bg-card p-1.5 shadow-soft"
    >
      {/* AN ORDERED LIST, because § 2b's order is a claim about how often each is needed and `<ol>`
          is the element that says so. UIE-09 AC-3 reads `data-to` off these rows and compares the
          sequence, so the element and the attribute are both load-bearing.

          The row carries `admin-hub-link` and the anchor carries the destination's own id — one
          `data-testid` per element is the constraint that splits them across the two, exactly as
          `AdminHub.tsx` had it. */}
      <ol className="flex items-center gap-1">
        {tabs.map((tab) => (
          <li key={tab.to} data-testid="admin-hub-link" data-to={tab.to}>
            <NavLink
              data-testid={tab.testId}
              to={tab.to}
              title={tab.blurb}
              className={({ isActive }) =>
                "block shrink-0 whitespace-nowrap rounded-pill px-4 py-2 text-[13px] font-semibold transition-colors " +
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink " +
                (isActive
                  ? "bg-primary text-white"
                  : "text-ink-2 hover:bg-field hover:text-ink")
              }
            >
              {tab.name}
            </NavLink>
          </li>
        ))}
      </ol>
    </nav>
  );
}
