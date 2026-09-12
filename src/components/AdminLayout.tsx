// SOLO, 2026-09-09 — the admin area's layout route element.
//
// **IT IS A LAYOUT ROUTE'S `element`, NOT A WRAPPER AND NOT A `useLocation()` CONDITIONAL**, which
// is the same choice `AppShell.tsx` records in its own header and for the same reason: a component
// that decides *am I on an admin screen* by reading the pathname is the route table re-expressed as
// an if-statement, in a file that already uses the router for exactly this distinction. That
// condition then has to be extended by hand every time an admin screen is added, and the failure is
// SILENT — a new admin address simply appears without the strip. Here the router decides, and adding
// the sixth admin screen means putting its `<Route>` inside one of the blocks in `App.tsx`.
//
// **THE STRIP IS DRAWN ONLY FOR AN ADMIN, AND THAT IS NOT A CONTROL.** Drawn for everybody it would
// hand a member a list of the five administrative addresses on every screen that refuses them —
// which is precisely what UIE-10 AC-1 removed from the sidebar, for both roles, four days ago. The
// destinations refuse a member either way (`allow-list-refused`, `team-entries-refused`,
// `threshold-refused`, `pending-entries-refused`, `member-list-not-on-a-team`); hiding the strip
// saves a pointless journey and refuses nobody, which is UIE-02's sentence about the same property.
//
// **`isAdmin` IS A BOOLEAN AND NOT THE `Member`**, the fourth alternative UIE-09 § 8 rejected: the
// one question this component has is *may this person administer*, a boolean answers it, and a
// `Member` prop invites the layout to grow a second reason to hold a member row. `App.tsx` computes
// the expression in the file that already holds the row, exactly as it does for `TopBar`.
//
// **THIS COMPONENT MAKES NO SEAM CALL AND HAS NO STATE.** It re-reads nothing, so it adds no phase
// to any screen below it. Each of the six destinations keeps its own loading, refusal and failure
// states untouched — including `/admin` itself, whose four phases `AdminHub.tsx` still owns.
import { Outlet, useOutletContext } from "react-router-dom";
import AdminTabs from "./AdminTabs";
import type { ShellContext } from "./AppShell";

export interface AdminLayoutProps {
  /** Whether the signed-in caller is an admin. Resolved once in `App.tsx`; never re-read here. */
  isAdmin: boolean;
}

export default function AdminLayout({ isAdmin }: AdminLayoutProps) {
  // **THE SHELL'S CONTEXT IS FORWARDED, AND A BARE `<Outlet />` IS WHAT MADE THAT NECESSARY.**
  // `useOutletContext` reads the context of the NEAREST enclosing outlet, so a nested layout that
  // renders `<Outlet />` with no `context` prop hands its children `null` — and every screen under
  // this layout is a child of THIS outlet, not of `AppShell`'s. Without this line
  // `useShellContext()` returns null on all six admin addresses and only there, which is the worst
  // shape a defect can have: the same hook works on `/profile` and crashes on `/entries/team`.
  //
  // **IT FORWARDS, IT DOES NOT BUILD.** The object is the shell's own, passed through unchanged, so
  // there is still exactly one `ShellContext` in the application and this file adds no fact to it.
  // `THIS COMPONENT MAKES NO SEAM CALL AND HAS NO STATE` above is unchanged — a context read is not
  // a read of the datastore.
  const shell = useOutletContext<ShellContext>();

  return (
    // **THE ADMIN AREA'S MEASURE IS DECIDED HERE, ONCE.** It used to be decided six times: the tab
    // strip capped itself at `max-w-3xl`, three list screens at `max-w-3xl` and two at `max-w-2xl`,
    // so the strip visibly overhung the card beneath it on `/members` and `/admin` and every new
    // admin screen had to guess a number. The screens keep their own narrow caps for the states that
    // WANT to be narrow — a refusal, a spinner, a form — and only the ready list fills this column.
    //
    // `max-w-6xl` and not full bleed: these are tables of six or seven columns, and a row stretched
    // across an ultrawide monitor separates the name from its buttons by half a metre of nothing.
    // `.ai/standards/ui-design-system.md` names no content width, so this is a choice and not a
    // citation — it is one token, in one file, and changing it moves the whole admin area together.
    <div className="mx-auto w-full max-w-6xl">
      {isAdmin ? <AdminTabs /> : null}
      <Outlet context={shell} />
    </div>
  );
}
