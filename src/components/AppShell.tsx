// UIE-02 — the layout route's element, and the whole of the two-pane frame. 01-plan.md § 4.1, § 4.6
// and § 4.9.
//
// **IT IS A LAYOUT ROUTE'S `element`, NOT A WRAPPER AROUND `<Routes>`.** 01-plan.md § 8, rejected
// alternative 1: a wrapper paints the sidebar on `/signin` and `/signup` too, and the only escape is
// a `useLocation()` conditional inside the shell — the route table re-expressed as an if-statement,
// in a file that already uses the router for exactly this distinction six times over. That condition
// then has to be extended by hand every time a route is added, and the failure is SILENT: a new
// auth-adjacent route simply appears with a sidebar. `App.tsx` puts the decision where the router
// can enforce it, and this component is what that route renders.
//
// **IT RE-READS NOTHING.** `App.tsx` has already resolved the membership to `member` before this
// component exists — `useSession()` is called exactly once, there (`useSession.ts`, TEA-05
// 01-plan.md § 4.3) — so the member arrives as a prop and this file makes no session read. The one
// seam call the shell makes anywhere is `seam.listMembers()` in `useRoster`, from the sidebar.
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import type { Member, Result } from "@/lib/domain/types";

export interface AppShellProps {
  /** The signed-in member. `App.tsx` has already resolved it; the shell never re-reads it. */
  member: Member;
  signOut(): Promise<Result<void>>;
}

export default function AppShell({ member, signOut }: AppShellProps) {
  return (
    // § 4.9. Two panes, full bleed, no page margin. `min-h-0` on the row is what makes the content
    // pane the ONLY scrolling region: without it a flex child's default `min-height: auto` lets the
    // pane grow to its content and the whole page scrolls instead, which takes the sidebar's legend
    // and footer off the bottom with it.
    <div className="flex min-h-0 flex-1">
      <Sidebar member={member} signOut={signOut} />

      {/* The content pane. `min-w-0` is AC-21: without it a flex child refuses to shrink below its
          content's intrinsic width, so a wide grid inside the pane widens the PAGE and the document
          scrolls sideways. With it the overflow belongs to the grid, inside the pane, which is where
          AC-21 says horizontal scrolling may live. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <TopBar />
        <div className="min-w-0 flex-1 px-6 pb-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
