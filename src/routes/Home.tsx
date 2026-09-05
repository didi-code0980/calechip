// TEA-05 — the landing screen a signed-in member arrives at. AC-1, AC-6, AC-10.
// 01-plan.md sections 4.4, 6 and 8.
//
// **IT SHOWS NO TEAM NAME AND NO BOARD, and that narrowness is load-bearing.** `public.team` has
// row-level security enabled, everything revoked and NO select policy anywhere; that policy and the
// `grant select on public.team` beside it belong to CAL-04 (ADR-014's Correction of 2026-08-31). The
// feature row's instruction is *narrow the screen rather than take CAL-04's policy early*, and this
// is that instruction being followed — it is what keeps `schema_delta: none` true for this ticket.
// The month view is CAL-04's. Nothing here reads `public.team`, so nothing here asks for a policy.
//
// Everything below is an affordance (ADR-005). The three values come off the caller's OWN `member`
// row, which `member_select_own` already returns; nothing is read that a policy does not already
// serve, and nothing is written on any path.
import { useState } from "react";
import { Link } from "react-router-dom";
import type { Member, MemberRole, Result } from "@/lib/domain/types";

interface HomeProps {
  member: Member;
  signOut(): Promise<Result<void>>;
}

/** AC-1. `role` is DISPLAYED and never acted on. MemberList.tsx carries the same two labels, and
 *  OPS-001 holds both files — so this is the ticket that could have lifted the mapping into one
 *  place and deliberately did not (01-plan.md section 8, rejected alternative 1). A diff in which
 *  every changed line is a string is one a reviewer can scan in a single pass, and the only control
 *  on this ticket's most dangerous edit is whoever reads the diff. The duplication is recorded as
 *  01-plan.md Open questions item 1 so the next reader finds it rather than rediscovers it. */
const roleLabel = (role: MemberRole): string => (role === "admin" ? "Admin" : "Member");

export default function Home({ member, signOut }: HomeProps) {
  const [signingOut, setSigningOut] = useState(false);

  async function onSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      // Only reached when the sign-out failed; otherwise the session change routes this away. A
      // control left disabled would be a session nobody can end, which is what AC-6 exists for.
      setSigningOut(false);
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-2xl bg-white p-8 shadow-sm">
      <div className="flex items-center gap-4">
        <span data-testid="home-member-avatar" aria-hidden className="text-3xl">
          {member.avatar}
        </span>
        <div className="flex flex-col">
          <h1 data-testid="home-member-name" className="text-xl font-semibold">
            {member.displayName}
          </h1>
          <p data-testid="home-member-role" className="text-sm opacity-70">
            {roleLabel(member.role)}
          </p>
        </div>
      </div>

      {/* No team NAME: it is unreadable, and saying "your team" is the honest form of that. */}
      <p className="mt-6 text-sm opacity-70">You are on your team.</p>

      {/* AC-10. An AFFORDANCE over `allowed_email_select_admin` and not a control: a member who types
          /allow-list still reaches AllowList.tsx, which still calls getCurrentMember() and still
          renders `allow-list-refused`, and the policy still returns them zero rows. Hiding the link
          saves a pointless journey and refuses nobody.

          This single link is the real version of TEA-02's AC-9 arriving, in miniature and on
          purpose (01-plan.md section 1). It is the ONE link the feature row permits. Nothing else
          navigates from this screen, and the next item added here inherits that criterion in full. */}
      {member.role === "admin" ? (
        <p className="mt-4">
          <Link data-testid="home-allow-list-link" to="/allow-list" className="text-sm underline">
            Allowed addresses
          </Link>
        </p>
      ) : null}

      {/* CAL-03. The third link, and the SECOND admin-only one — so `home-allow-list-link` above is
          no longer alone and the "one link" framing TEA-05 wrote has been overtaken twice. Both
          admin links are still AFFORDANCES over policies that refuse without them: a member who
          types /entries/team reaches TeamEntries.tsx, which calls getCurrentMember() and renders
          `team-entries-refused`, and `entry_update_admin` refuses every write regardless. Hiding the
          link saves a pointless journey and refuses nobody (CAL-03 AC-10, and 01-plan.md section 3,
          "The affordances").

          Placed BESIDE the allow-list link and under the same condition, which is the shape
          01-plan.md section 4.3 asks for. */}
      {member.role === "admin" ? (
        <p className="mt-2">
          <Link data-testid="home-team-entries-link" to="/entries/team" className="text-sm underline">
            The team&rsquo;s entries
          </Link>
        </p>
      ) : null}

      {/* CAL-01. The second link on this screen, and it is shown to BOTH roles because the
          permission is the same for both: `Create an entry for themselves` is checked for a member
          and for an admin in .ai/standards/rbac-and-security.md, and `entry_insert_own` carries no
          role predicate at all. An admin has no more power here than a member.

          TEA-05's comment above said "the next item added here inherits that criterion in full", and
          this is that item. It is one link, for one capability the caller certainly has, and it is
          still not a navigation menu — TEA-02's AC-9 in its real form is TEA-02's to write. */}
      <p className="mt-2">
        <Link data-testid="home-new-entry-link" to="/entries/new" className="text-sm underline">
          Book leave or working from home
        </Link>
      </p>

      {/* CAL-05. The one link CAL-05 adds to this file, and the whole of its edit here (CAL-05
          01-plan.md section 7). Shown to BOTH roles, because the week view is read-only and the
          permission behind it is the same for both: `Read any entry in the team` is checked for a
          member and for an admin in .ai/standards/rbac-and-security.md, and `entry_select_team`
          carries no role predicate. An admin has no more power there than a member (AC-8).

          It points at `/week` with NO anchor, so the component resolves the current week from the
          caller's clock. A date computed here would be a second clock in a second file, and this
          screen holds none.

          It is also the first navigation on this screen to a READ-ONLY view, so it is not an
          affordance over a policy the way the two admin links above are — there is nothing here it
          could be hiding, because nothing is refused. */}
      <p className="mt-2">
        <Link data-testid="home-week-link" to="/week" className="text-sm underline">
          Who is away this week
        </Link>
      </p>

      {/* CAL-06. The one link CAL-06 adds to this file, and the whole of its edit here (CAL-06
          01-plan.md section 7). Shown to BOTH roles for the same reason the week link above is: the
          year view is read-only and `Read any entry in the team` and `Read the member list` are
          checked for a member and for an admin in .ai/standards/rbac-and-security.md, with no role
          predicate on either policy behind them.

          It points at `/year` with NO anchor, so the component resolves the current year from the
          caller's clock. A year computed here would be a second clock in a second file, and this
          screen holds none. */}
      <p className="mt-2">
        <Link data-testid="home-year-link" to="/year" className="text-sm underline">
          The team across the year
        </Link>
      </p>

      {/* ADM-02. The one link ADM-02 adds to this file, and the whole of its edit here (01-plan.md
          section 7). Shown to BOTH roles under no role condition, for the reason the week and year
          links above are: `Read the holiday calendar` is checked for a member and for an admin in
          .ai/standards/rbac-and-security.md, and `holiday_select_all` is `using (true)` with no role
          predicate and no team predicate at all (AC-15).

          The feature row calls it "a read-only admin screen", and 01-plan.md Open question 3
          resolves that against the permission table rather than choosing between the two: the
          permission table is the source for WHO may do what, so the phrase is read as WHERE the
          surface lives — its own screen, inheriting ADM-01's answer. If the operator meant
          admin-only, the change is one condition here and one on the route.

          It points at `/holidays` with NO anchor, so the component resolves the current year from
          the caller's clock. A year computed here would be a second clock in a second file, and this
          screen holds none.

          Placed with the read-only views rather than with the three admin links, because that is
          what it is: there is nothing here it could be hiding, since nothing is refused. */}
      <p className="mt-2">
        <Link data-testid="home-holidays-link" to="/holidays" className="text-sm underline">
          The public holiday calendar
        </Link>
      </p>

      {/* ADM-01. The one link ADM-01 adds to this file, and the whole of its edit here (01-plan.md
          section 7). The THIRD admin-only link, placed beside the other two rather than beside the
          read-only views, and under the same condition — the shape section 4.3 asks for.

          An AFFORDANCE and not a control, exactly as `home-allow-list-link` and
          `home-team-entries-link` are: a member who types /threshold still reaches Threshold.tsx,
          which still calls getCurrentMember() and still renders `threshold-refused`, and
          `team_update_admin` still refuses the write. Hiding the link saves a pointless journey and
          refuses nobody (AC-10). */}
      {member.role === "admin" ? (
        <p className="mt-2">
          <Link data-testid="home-threshold-link" to="/threshold" className="text-sm underline">
            When a day counts as crowded
          </Link>
        </p>
      ) : null}

      {/* ADM-04. The one link this ticket adds to this file, and the whole of its edit here
          (01-plan.md section 7). The FOURTH admin-only link, placed beside the other three and under
          the same condition — the shape ADM-01 section 4.3 asks for and the shape this file has used
          since TEA-05.

          An AFFORDANCE and not a control, and here that is stronger than on the three above it:
          `entry_select_team` admits the whole team's rows to BOTH roles, so a member who types
          /entries/pending reaches PendingEntries.tsx, is refused by it, and would gain nothing at
          all if the refusal were deleted — the same rows are already readable to them at
          /entries/team. There is no capability behind this link that a member lacks; what is
          admin-only is the WORK, which arrives at ADM-05.

          It carries no count. The outstanding figure is on the worklist itself, from the same read
          that draws the rows, and a badge here would need a second read that could disagree with it
          — the one property .ai/registry/features.md:103 forbids this feature from having. */}
      {member.role === "admin" ? (
        <p className="mt-2">
          <Link
            data-testid="home-pending-entries-link"
            to="/entries/pending"
            className="text-sm underline"
          >
            Waiting for a decision
          </Link>
        </p>
      ) : null}

      <button
        data-testid="home-sign-out"
        type="button"
        onClick={onSignOut}
        disabled={signingOut}
        className="mt-6 rounded-xl border border-slate-200 px-4 py-2 text-sm disabled:opacity-40"
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </section>
  );
}
