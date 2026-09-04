// The routed shell. 02-design.md section 1.3 and section 6.2; TEA-05 01-plan.md section 4.4.
//
// `data-testid="app-root"` KEEPS its name and its position on the element wrapping <Routes>, so the
// scaffold smoke test in tests/e2e/smoke.spec.ts keeps passing without being edited — which is why
// that file is deliberately absent from allowed_paths. `seam-banner` keeps its name and position for
// the same reason.
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { seamName } from "./lib/data";
import { useSession } from "./hooks/useSession";
import AllowList from "./routes/AllowList";
import Home from "./routes/Home";
import MemberList from "./routes/MemberList";
import MonthView from "./routes/MonthView";
import EditEntry from "./routes/EditEntry";
import NewEntry from "./routes/NewEntry";
import TeamEntries from "./routes/TeamEntries";
import NotOnATeam from "./routes/NotOnATeam";
import SignIn from "./routes/SignIn";
import SignUp from "./routes/SignUp";

export default function App() {
  // TEA-05 01-plan.md section 4.3: `useSession()` is called EXACTLY ONCE, here, and the result is
  // passed to the screens that need it as props. Section 9 records why this is a hook and not the
  // context provider TEA-02's design predicted — there is one consumer, and a provider would add a
  // file, a wrapper and an indirection to serve a single call site. The first component that needs
  // the session without a prop path should add the provider, backed by this same hook.
  const { membership, resolving, signIn, signOut } = useSession();

  return (
    <BrowserRouter>
      <main data-testid="app-root" className="min-h-screen bg-slate-50 p-8 font-sans">
        {/* Design section 6.2 rule 2. A build with no VITE_SUPABASE_URL resolves to the in-memory
            seam rather than to a screen that throws — but a SILENT fallback to a fake datastore is
            worse than the crash it replaces: a deployment that forgets one environment variable
            would accept sign-ups into memory and look entirely normal. This banner is permanent and
            not dismissible, and it is also how a test asserts which implementation it drove. */}
        {seamName === "mock" ? (
          <p
            data-testid="seam-banner"
            data-seam="mock"
            role="status"
            className="mx-auto mb-6 max-w-md rounded-xl bg-amber-100 px-4 py-2 text-center text-sm text-amber-900"
          >
            Demo build — data lives only in this browser and is lost when you reload the page.
          </p>
        ) : null}

        {/* AC-9, and the reason it is a state rather than a fallthrough: `signed-out` and `not yet
            known` are indistinguishable without it, so routing on the membership alone would flash
            the sign-in screen at somebody who IS signed in, on every reload. Shown on every path. */}
        {resolving ? (
          <p
            data-testid="app-session-loading"
            role="status"
            className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center text-sm opacity-70 shadow-sm"
          >
            Loading…
          </p>
        ) : (
          <Routes>
            {/* TEA-01. Reachable in EVERY membership state: it is the only route a person who has
                not signed up can use, and it ends on its own notice (AC-13) rather than routing. */}
            <Route path="/signup" element={<SignUp />} />

            {/* AC-1, AC-2, AC-3, AC-5, AC-9. A caller with a session is sent to the landing address
                instead — a sign-in screen offered to somebody already signed in is a second way to
                reach a state they are already in. */}
            <Route
              path="/signin"
              element={
                membership.state === "signed-out" ? (
                  <SignIn signIn={signIn} />
                ) : (
                  <Navigate to="/" replace />
                )
              }
            />

            {/* The landing address, and the three memberships land in three different places.
                AC-1 and AC-10 for a member, AC-4 for somebody with no member row, and AC-5 and AC-9
                for a caller with no session: the sign-in screen, and nothing that says whether any
                address has an account or is on the allow-list. */}
            <Route
              path="/"
              element={
                membership.state === "member" ? (
                  <Home member={membership.member} signOut={signOut} />
                ) : membership.state === "member-less" ? (
                  <NotOnATeam user={membership.user} signOut={signOut} />
                ) : (
                  <Navigate to="/signin" replace />
                )
              }
            />

            {/* TEA-02. Reachable by address only: 02-design.md section 2 satisfies AC-9 with the
                absence of a link plus the screen's own refusal. TEA-05 adds the one link the feature
                row permits, on the landing screen and only for an admin — not here.

                NOT GUARDED, deliberately (TEA-05 01-plan.md section 9). This screen already fails
                safe with no session: it calls getCurrentMember(), gets null, and renders
                `allow-list-refused`. A guard here would add no protection and would put this
                ticket's routing decisions on top of another ticket's acceptance criteria. */}
            <Route path="/allow-list" element={<AllowList />} />
            {/* TEA-03. Reachable by address only, and not guarded, for the same two reasons: it
                renders `member-list-not-on-a-team` when getCurrentMember() returns null. */}
            <Route path="/members" element={<MemberList />} />

            {/* CAL-01. GUARDED, unlike the two above, and the difference is not a change of mind:
                an entry needs a member row to belong to (INV-07, `member_id` not-null against
                `member(id)`), so a caller with no member row has nothing this screen could create.
                /allow-list and /members each render a refusal of their own for that case; this one
                would render a form whose every submission is refused by the policy.

                A caller who is signed out or member-less lands on `/`, which then resolves by
                membership — the sign-in screen or the member-less screen. The guard is an affordance
                either way: `entry_insert_own` is the control and it refuses the write whoever
                reaches it. */}
            <Route
              path="/entries/new"
              element={membership.state === "member" ? <NewEntry /> : <Navigate to="/" replace />}
            />

            {/* CAL-02. Guarded exactly as /entries/new is, and for the same reason: an entry belongs
                to a member row (INV-07), so a caller with no member row has nothing this screen
                could edit. The guard is an affordance either way — `entry_update_own` is the control
                and it refuses the write whoever reaches it, and the screen itself answers
                `edit-entry-not-found` for an entry that is not the caller's.

                No route for a DELETE. There is no screen to delete from: the control lives on the
                own-entry list beside the row it removes, where the row's dates are on screen at the
                moment the confirmation is pressed. */}
            <Route
              path="/entries/:id/edit"
              element={membership.state === "member" ? <EditEntry /> : <Navigate to="/" replace />}
            />

            {/* CAL-03. Guarded exactly as /entries/new and /entries/:id/edit are, and for the same
                reason: this screen lists and writes ENTRIES, and an entry belongs to a member row
                (INV-07), so a caller with no member row has nothing here to reach.

                THE GUARD IS `member` AND NOT `admin`, deliberately. A member who types this address
                must reach the component and be refused BY IT (`team-entries-refused`, AC-10) rather
                than be bounced to `/` — the refusal is what says why, and a redirect would leave
                somebody who mistyped nothing to read. The guard is an affordance either way:
                `entry_update_admin` and `entry_delete_admin` are the controls and they refuse the
                write whoever reaches them. */}
            <Route
              path="/entries/team"
              element={membership.state === "member" ? <TeamEntries /> : <Navigate to="/" replace />}
            />

            {/* CAL-04. The month grid, and the anchor is the URL — `/month/2026-04` typed directly
                produces the same screen as pressing "next" from March (AC-10). `/month` with no
                anchor redirects to the current month, and so does a malformed one; the component
                does that itself rather than a second route doing it here, because "which month is
                it" is a fact about the caller's clock and this file holds no clock.

                NOT GUARDED, unlike /entries/new and /entries/team, and the difference is the same
                one /allow-list and /members already record: this screen READS, it renders
                `month-not-on-a-team` for a caller with no member row, and that refusal is what says
                why. A redirect would leave somebody who followed a shared month link with nothing to
                read. The guard would be an affordance either way — `entry_select_team`,
                `member_select_team` and `team_select_own` are the controls. */}
            <Route path="/month" element={<MonthView />} />
            <Route path="/month/:month" element={<MonthView />} />

            {/* AC-9. Every address the application does not route lands on `/`, which then resolves
                by membership — so a caller with no session reaches the sign-in screen. This replaced
                TEA-01's temporary `→ /signup`, which existed only because that half of the feature
                had one screen and no landing address to send anybody to. */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>
    </BrowserRouter>
  );
}
