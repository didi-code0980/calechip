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
}[] = [
  {
    testId: "admin-hub-pending-link",
    to: "/entries/pending",
    name: "Pending approvals",
    blurb:
      "Entries waiting for a decision. Approve or reject them one at a time or together.",
  },
  {
    testId: "admin-hub-team-entries-link",
    to: "/entries/team",
    name: "Team entries",
    blurb:
      "Every entry the team has declared, with the controls to edit or remove one.",
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

/**
 * The strip. Rendered by `AdminLayout` on the six admin addresses and nowhere else.
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
export default function AdminTabs() {
  return (
    // `overflow-x-auto` and `shrink-0` on the rows: five tabs do not fit a narrow viewport, and the
    // strip scrolling inside itself is what keeps the PAGE from scrolling sideways — the same rule
    // UIE-02 AC-21 states for the grid pane.
    <nav
      data-testid="admin-tabs"
      aria-label="Admin"
      className="mx-auto mb-6 max-w-3xl overflow-x-auto rounded-card bg-card p-1.5 shadow-soft"
    >
      {/* AN ORDERED LIST, because § 2b's order is a claim about how often each is needed and `<ol>`
          is the element that says so. UIE-09 AC-3 reads `data-to` off these rows and compares the
          sequence, so the element and the attribute are both load-bearing.

          The row carries `admin-hub-link` and the anchor carries the destination's own id — one
          `data-testid` per element is the constraint that splits them across the two, exactly as
          `AdminHub.tsx` had it. */}
      <ol className="flex items-center gap-1">
        {ADMIN_TABS.map((tab) => (
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
