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
