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
import { Outlet, useOutletContext } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import type { Member, Result } from "@/lib/domain/types";

export interface AppShellProps {
  /** The signed-in member. `App.tsx` has already resolved it; the shell never re-reads it. */
  member: Member;
  signOut(): Promise<Result<void>>;
  /** SOLO 2026-09-10. Passed straight through to the outlet — see `ShellContext` below. The shell
   *  never calls it itself, and `IT RE-READS NOTHING` above is unchanged by its presence. */
  refreshMembership(): void;
}

/**
 * SOLO 2026-09-10. What a screen inside the shell may ask the shell to do. One entry today.
 *
 * **THIS IS NOT THE `useOutletContext` UIE-02 § 4.3 REFUSED, AND THE DIFFERENCE IS THE WHOLE
 * JUSTIFICATION.** That refusal was about the top bar's period derivation: an anchor, a step target
 * and an active segment are all derivable from the pathname, so a context carrying them would be a
 * second source for a fact the ADDRESS already holds, free to disagree with it. Nothing here is
 * derivable from anything — `refreshMembership` is a handle on state that lives ABOVE the router, in
 * `App.tsx`'s single `useSession()` call, and a routed screen has no other way to reach it.
 *
 * **WHY IT HAS TO EXIST AT ALL.** `updateOwnProfile` writes the `member` row and touches no session,
 * so the auth client emits nothing and `useSession` never re-resolves: after a member renames
 * themselves, the sidebar two hundred pixels to the left keeps drawing the old name until a reload.
 * The alternative was for the profile screen to hold its own copy of the member row — the same fact,
 * read twice, rendered twice, free to disagree on screen at the same moment.
 */
export interface ShellContext {
  /**
   * The signed-in member, as `App.tsx` resolved it.
   *
   * **IT IS HERE SO THAT A SCREEN INSIDE THE SHELL DOES NOT READ IT AGAIN.** `getCurrentMember()` is
   * two network round trips in the real seam — `auth.getUser()` and then the `member` row — and the
   * shell has already paid for both before any screen renders. A screen re-reading it produced
   * visible duplicate requests on `/profile`, which is what put this field here.
   *
   * A screen that needs a member row for somebody ELSE still reads the seam. This is the caller's
   * own row and only that.
   */
  member: Member;
  refreshMembership(): void;
}

/** The typed reader. Screens call this rather than `useOutletContext` directly, so the shape is
 *  declared in one place and grows one entry at a time rather than per caller. */
export function useShellContext(): ShellContext {
  return useOutletContext<ShellContext>();
}

export default function AppShell({ member, signOut, refreshMembership }: AppShellProps) {
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
        {/* UIE-09 § 4.3. The bar has no session and no seam call of its own, and a ROLE is not
            derivable from a pathname — so the one question it needs answering is answered here, in
            the file that already holds the member row `App.tsx` resolved. `AppShellProps` is
            unchanged, and the expression is the one `Sidebar.tsx:127` already uses.

            A BOOLEAN AND NOT THE `Member` ITSELF (§ 8, rejected alternative 4): a member row passed
            down invites the bar to grow a second reason to hold one, which is how a component that
            documents *it re-reads nothing* acquires a read. */}
        <TopBar isAdmin={member.role === "admin"} />
        <div className="min-w-0 flex-1 px-6 pb-6">
          {/* SOLO 2026-09-10. The context object is built INLINE and is therefore a new identity on
              every render of the shell. That is harmless here — `useOutletContext` is a plain
              context read and the screens below re-render with the shell anyway — and memoising it
              would add a dependency array that has to stay true for no behaviour anyone can see.
              NOTE for whoever adds the second entry: this reasoning stops holding the moment a
              consumer puts the context object in a `useEffect` dependency list. */}
          <Outlet context={{ member, refreshMembership } satisfies ShellContext} />
        </div>
      </div>
    </div>
  );
}
