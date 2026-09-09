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
import { Outlet } from "react-router-dom";
import AdminTabs from "./AdminTabs";

export interface AdminLayoutProps {
  /** Whether the signed-in caller is an admin. Resolved once in `App.tsx`; never re-read here. */
  isAdmin: boolean;
}

export default function AdminLayout({ isAdmin }: AdminLayoutProps) {
  return (
    <>
      {isAdmin ? <AdminTabs /> : null}
      <Outlet />
    </>
  );
}
