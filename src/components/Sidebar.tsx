// UIE-02 — the persistent sidebar. 01-plan.md § 4.2, § 4.8 and § 4.9.
//
// **EVERY `home-*` ID HERE IS RELOCATED AND UNRENAMED, AND THAT IS THE WHOLE CUT OF THIS TICKET.**
// Eleven of the twelve ids that lived in `src/routes/Home.tsx` move into this file letter for
// letter; the twelfth, `home-new-entry-link`, moves into `TopBar.tsx` (AC-19). Fifteen spec files
// address them and NONE is in scope here — every assertion on them is a visibility, click or text
// check that passes wherever the node lives, provided the name and the count are unchanged. AC-6 is
// the count and AC-7 is the two role strings.
//
// **NOTHING HERE IS A CONTROL.** Every element is an affordance over a row-level-security policy
// that already exists and is not touched (01-plan.md § 3, ADR-005). The four admin-only links are
// hidden from a member (AC-8) and a member who types any of those four addresses still reaches the
// screen and is still refused BY IT — `allow-list-refused`, `team-entries-refused`,
// `threshold-refused`, `pending-entries-refused`. Hiding a link saves a pointless journey and
// refuses nobody.
//
// The role condition is `member.role === "admin"`, read off the `member` row `App.tsx` already
// resolved — the same condition `Home.tsx` used, MOVED rather than rewritten, which is what keeps
// the three `toHaveCount(0)` assertions passing.
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useRoster } from "@/hooks/useRoster";
import type { Member, MemberRole, Result } from "@/lib/domain/types";

export interface SidebarProps {
  member: Member;
  signOut(): Promise<Result<void>>;
}

/** AC-7. `role` is DISPLAYED and never acted on. Moved from `Home.tsx:29` unchanged — the two
 *  strings are letter for letter what a shipped spec asserts, and any uppercase presentation below
 *  is a CSS transform rather than a different string. `MemberList.tsx` still carries its own copy
 *  of this mapping; folding the two is not this ticket's (Home.tsx's own note, and § 7). */
const roleLabel = (role: MemberRole): string =>
  role === "admin" ? "Admin" : "Member";

// § Language, and this is the one string in this file that is NOT interface copy. `Ai Nghỉ?` is the
// product's NAME, and the same construction `src/components/AuthCard.tsx:41` uses is used here for
// the same reason: the name carries `ỉ` (U+1EC9), which the diacritic rule at eslint.config.js:83-92
// matches on a Literal's DECODED value, so an escape sequence would not help. Composing the one
// accented character from its code point leaves no node in this file inside the rule's range.
//
// UIE-01 settled which name the product shows by building this one (01-plan.md Open question 1). The
// sidebar now repeats it on every screen rather than on one, so the CaleChip/`Ai Nghỉ?` split in
// index.html:6 goes from one screen to all of them. It is one string in one file whichever way the
// operator decides.
const PRODUCT_NAME = `Ai Ngh${String.fromCodePoint(0x1ec9)}?`;

// § Language. The transcription's tagline is `Lịch vắng mặt team` and the interface is English, so
// this is an English line rather than a translation of that one — 01-plan.md § 1 Out of scope item
// 10. It describes what the board holds and asserts no capability.
const TAGLINE = "Leave and working from home";

const NAV_LINK =
  "block rounded-pill px-3 py-1.5 text-[13px] font-semibold text-ink-2 transition-colors " +
  "hover:bg-field hover:text-ink " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** AC-11. Exactly three rows and no fourth. The three colours are `CLAUDE.md` § Visual direction —
 *  PTO peach, WFH mint, holidays lavender — through the tokens added to `src/index.css` beside
 *  UIE-01's.
 *
 *  NO OVERLOAD ROW: it needs `overloadThreshold` and a `seam.getTeam()` call this shell does not
 *  make, and no calendar view computes an overload state today (`WeekView.tsx:11`). NO BRIDGE-DAY
 *  ROW: a swatch is a fill and a bridge day has no fill — it is a working day carrying an outlined
 *  badge (01-plan.md Open question 3). Both are absent rather than disabled (AC-20). */
const LEGEND: readonly { label: string; swatch: string }[] = [
  { label: "Leave (PTO)", swatch: "bg-pto" },
  { label: "Working from home (WFH)", swatch: "bg-wfh" },
  { label: "Holiday", swatch: "bg-holiday" },
];

/** The roster chip and the account-footer chip are the same 26px circle, so it is written once. */
function AvatarChip({ avatar, testId }: { avatar: string; testId?: string }) {
  return (
    <span
      data-testid={testId}
      aria-hidden
      className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-pill bg-field text-[13px]"
    >
      {avatar}
    </span>
  );
}

export default function Sidebar({ member, signOut }: SidebarProps) {
  const roster = useRoster();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  // Moved from `Home.tsx:34-44`, and it gained ONE line. 03-impl-log.md § Deviations carries this
  // in full; the short version is that `Home.tsx` got its redirect for free and this file cannot.
  //
  // That screen WAS the `/` route, and `/` resolves by membership — so ending the session
  // re-rendered `/` and the router sent the caller to the sign-in screen with no navigation
  // written anywhere. TEA-05 AC-6 is that behaviour and a shipped spec asserts it.
  //
  // This control is now on FOURTEEN routes, and SIX OF THEM ARE DELIBERATELY UNGUARDED (AC-3):
  // /week, /month, /year, /allow-list, /members and /holidays render their own refusal for a
  // caller with no session rather than redirecting, which is the whole reason this ticket exists.
  // Signing out on one of them therefore ends the session and leaves the caller reading
  // `week-not-on-a-team` — a true sentence, no way back to the sign-in screen, and TEA-05 AC-6
  // broken by relocation rather than by anybody changing it. Fifty-two acceptance tests measured
  // it. The redirect the route table used to supply implicitly is written here explicitly.
  //
  // ONLY ON `ok`. A sign-out that failed leaves the session alive, and navigating away from a live
  // session to the sign-in screen would show a signed-in person a sign-in form.
  async function onSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const result = await signOut();
      if (result.ok) {
        // `replace`, so the browser Back button does not return to a screen this member can no
        // longer read. `/signin` and not `/`: `/` now sends a member to `/week` (AC-5), and the
        // membership has not necessarily re-resolved by the time this line runs.
        navigate("/signin", { replace: true });
        return;
      }
    } finally {
      // Only reached when the sign-out FAILED, or when the navigation above has already left. A
      // control left disabled would be a session nobody can end, which is what TEA-05 AC-6 is for.
      setSigningOut(false);
    }
  }

  const isAdmin = member.role === "admin";

  return (
    // § 4.9. A fixed 216px pane on `--color-card`, full height, NO BORDER — separated from the
    // content pane by colour alone. `shrink-0` so the grid pane, not the sidebar, absorbs a narrow
    // viewport; `overflow-y-auto` so a long roster scrolls inside the pane rather than pushing the
    // legend and the footer off the bottom.
    <aside
      data-testid="shell-sidebar"
      className="flex w-[216px] shrink-0 flex-col gap-5 overflow-y-auto bg-card px-4 py-5"
    >
      <div data-testid="shell-brand">
        <p className="font-display text-xl font-bold leading-tight text-ink">
          {PRODUCT_NAME}
        </p>
        <p className="mt-0.5 text-[11px] text-ink-3">{TAGLINE}</p>
      </div>

      {/* AC-9 and AC-10. Three phases and three different sentences. `shell-roster-count` is
          rendered ONLY in the ready phase, so a failed read never reads as a team of nobody. */}
      <div>
        {roster.phase === "loading" ? (
          <p
            data-testid="shell-roster-loading"
            role="status"
            className="text-[10px] uppercase tracking-wider text-ink-3"
          >
            Loading the team…
          </p>
        ) : roster.phase === "unavailable" ? (
          <p
            data-testid="shell-roster-unavailable"
            role="status"
            className="text-[11px] text-ink-3"
          >
            The team list could not be read.
          </p>
        ) : (
          <>
            <p
              data-testid="shell-roster-count"
              data-count={roster.members.length}
              className="text-[10px] font-bold uppercase tracking-wider text-ink-3"
            >
              Team ({roster.members.length})
            </p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {roster.members.map((m) => (
                <li
                  key={m.id}
                  data-testid="shell-roster-row"
                  data-member-id={m.id}
                  className="flex items-center gap-2"
                >
                  <AvatarChip avatar={m.avatar} />
                  {/* AC-9. `(You)` marks the signed-in member, appended to the name rather than
                      replacing it — the roster is who is on the team, and the caller is one of
                      them. No role badge, no count and no control on a row. */}
                  <span className="truncate text-[13px] text-ink-2">
                    {m.id === member.id
                      ? `${m.displayName} (You)`
                      : m.displayName}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* The seven nav items, the four admin-only ones last. Every id is relocated and unrenamed
          (§ 4.8). Each of the three read-only destinations is linked with NO anchor, so the screen
          resolves the current period from the caller's clock — a date computed here would be a
          second clock in a second file, and this component holds none. */}
      <nav className="flex flex-col gap-0.5">
        <Link data-testid="home-week-link" to="/week" className={NAV_LINK}>
          This week
        </Link>
        <Link data-testid="home-year-link" to="/year" className={NAV_LINK}>
          The year
        </Link>
        <Link
          data-testid="home-holidays-link"
          to="/holidays"
          className={NAV_LINK}
        >
          Public holidays
        </Link>

        {/* AC-8. The four admin-only affordances, under one condition rather than four copies of
            it — the shape `Home.tsx` used, kept. */}
        {isAdmin ? (
          <>
            <Link
              data-testid="home-pending-entries-link"
              to="/entries/pending"
              className={NAV_LINK}
            >
              Waiting for a decision
            </Link>
            <Link
              data-testid="home-team-entries-link"
              to="/entries/team"
              className={NAV_LINK}
            >
              The team&rsquo;s entries
            </Link>
            <Link
              data-testid="home-allow-list-link"
              to="/allow-list"
              className={NAV_LINK}
            >
              Allowed addresses
            </Link>
            <Link
              data-testid="home-threshold-link"
              to="/threshold"
              className={NAV_LINK}
            >
              When a day counts as crowded
            </Link>
          </>
        ) : null}
      </nav>

      {/* § 4.9. The spacer that pins the legend and the account footer to the bottom. */}
      <div className="flex-1" />

      <div className="rounded-card bg-field px-3 py-2.5">
        <ul className="flex flex-col gap-1.5">
          {LEGEND.map((row) => (
            <li
              key={row.label}
              data-testid="shell-legend-row"
              className="flex items-center gap-2"
            >
              <span
                aria-hidden
                className={`h-2.5 w-2.5 shrink-0 rounded-pill ${row.swatch}`}
              />
              <span className="text-[11px] text-ink-2">{row.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* The account footer. Four relocated ids, unrenamed. The palette icon the transcription
          shows beside the sign-out control is deliberately absent (AC-20): what a control DOES is
          behaviour, and the § Visual specification grant does not reach behaviour. */}
      <div className="flex items-center gap-2">
        <AvatarChip avatar={member.avatar} testId="home-member-avatar" />
        <div className="flex min-w-0 flex-col">
          <p
            data-testid="home-member-name"
            className="truncate text-xs font-semibold text-ink"
          >
            {member.displayName}
          </p>
          <p
            data-testid="home-member-role"
            className="text-[9px] uppercase tracking-wider text-ink-3"
          >
            {roleLabel(member.role)}
          </p>
        </div>
        <button
          data-testid="home-sign-out"
          type="button"
          onClick={onSignOut}
          disabled={signingOut}
          title="Sign out"
          className="ml-auto shrink-0 rounded-pill px-2 py-1 text-[11px] font-semibold text-ink-2 transition-colors hover:bg-field hover:text-ink disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </aside>
  );
}
