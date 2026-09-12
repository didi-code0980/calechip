// TEA-03 — Team member list. 02-design.md sections 1.3, 2 and 6.
// TEA-04 — the remove and promote controls. 01-plan.md sections 4.3 and 8.
//
// EVERYTHING in this file is an affordance (ADR-005). The check lives in row-level security and
// nowhere else: `member_select_team` scopes the rows to the caller's own team, `member_select_own`
// returns a removed caller their own row, and `member_update_admin` plus the column grant plus
// `member_enforce_role_and_removal` refuse every write this screen can issue and every write it
// cannot — whoever issues the statement.
//
// The two controls below are hidden exactly where the policy or the trigger would refuse anyway: on
// a member's own view (AC-14), on the caller's own row, and on a row that is already an admin
// (AC-13). Hiding them saves a round trip and says why; it refuses nobody holding a token, which is
// the whole of ADR-005.
import { useCallback, useEffect, useState } from "react";
// The seam, through its one door. 02-design.md section 6.2: nothing above the seam names an
// implementation, and this file must never import `./supabase` or `./mock`.
import Modal from "@/components/Modal";
import { seam } from "@/lib/data";
// SOLO, 2026-09-12. `Team` added: the `ready` phase of `View` below carries `team: Team | null` and
// the type was never imported, so `pnpm typecheck` failed with `Cannot find name 'Team'`. The same
// shape of miss as `TYPE_CODES` in WeekView.tsx and `Link` here in Threshold.tsx — Vite compiles a
// module with an unresolved name and says nothing, so only `pnpm typecheck` sees it.
import type { Failure, Member, MemberRole, Team } from "@/lib/domain/types";
// SOLO, 2026-09-11 — the loading mark that replaced this screen's sentence. The sentence itself is
// still announced: `Loader.tsx` keeps it as `sr-only` text, because the element below carries
// `role="status"` and an emptied one announces nothing.
import Loader from "@/components/Loader";

/** AC-1, AC-3. `role` is DISPLAYED and never acted on: two roles exist and a roster that does not
 *  say which of the two each person is leaves a member with no way to see whom to ask. */
const roleLabel = (role: MemberRole): string => (role === "admin" ? "Admin" : "Member");

/** SOLO, 2026-09-10. The shape every read-only row action shares, so the group reads as a group. */
const ROW_ACTION =
  "rounded-pill border border-line px-3 py-1 text-xs font-semibold text-ink-2 transition-colors " +
  "hover:bg-field hover:text-ink disabled:opacity-40 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

// The four states of design section 1.3. `loading` MUST resolve, which is why every path out of the
// effect below sets one of the other three.
type View =
  | { phase: "loading" }
  | { phase: "notOnATeam" } // AC-7
  | { phase: "unavailable" } // AC-8, and any throw from the read
  | { phase: "ready"; me: Member; roster: Member[]; team: Team | null }; // AC-1, AC-3, AC-4

export default function MemberList() {
  const [view, setView] = useState<View>({ phase: "loading" });

  // TEA-04, 01-plan.md section 4.3. Three pieces of local state, following AllowList.tsx: the row
  // awaiting confirmation, whether a write is in flight, and the typed failure from either write.
  const [pending, setPending] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<Failure | null>(null);

  // SOLO, 2026-09-10. Two panels, two pieces of state, and never both open: each setter clears the
  // other implicitly because only one is ever set by a click.
  const [viewing, setViewing] = useState<Member | null>(null);
  const [editing, setEditing] = useState<Member | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const me = await seam.getCurrentMember();

      // AC-7, and this is the whole of it. The policy scopes to the caller's team by way of the
      // caller's own member row; with no such row there is no team, and the two available answers
      // are "nothing" and "everything". The screen has to say which one it got — an empty list and
      // "you are not on a team" look the same and mean opposite things.
      if (!me) {
        setView({ phase: "notOnATeam" });
        return;
      }

      // SOLO, 2026-09-10. `getTeam()` joins the read for the TEAM column. It is the caller's own team,
      // which is every row's team too — `member_select_team` scoped the roster to it — so one read
      // names them all. A null team leaves the column reading `—` rather than inventing a name.
      const [roster, team] = await Promise.all([seam.listMembers(), seam.getTeam()]);
      setView({ phase: "ready", me, roster, team });
    } catch {
      // AC-8, and a transport failure with it. Design section 1.3.1: folding this into
      // `notOnATeam` the way AllowList.tsx folds a throw into `refused` would be wrong twice — a
      // caller who IS on a team would be told they are not, and a truncated read would be
      // indistinguishable from a small team. The roster is INV-04's denominator, so a roster short
      // by two people raises the ratio on every date. No partial list is ever drawn.
      setView({ phase: "unavailable" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // TEA-04 AC-4. No confirmation, and that is a decision rather than an omission (01-plan.md
  // section 2, Open questions): promotion destroys nothing, and the destructive-action rule in
  // .ai/standards/ui-design-system.md is about what is lost. Removal, below, is the one that
  // changes a number every calendar view divides by.
  async function onPromote(member: Member) {
    if (busy) return;

    setBusy(true);
    setActionError(null);
    try {
      const result = await seam.promoteMember(member.id);
      if (result.ok) {
        await load();
      } else {
        setActionError(result.error);
      }
    } catch {
      // A THROW IS NOT A REFUSAL. A transport failure, or the Supabase client raising on an unusable
      // configuration before any request leaves, must not be rendered as "you are not allowed" —
      // that sentence would be false and would send an admin to ask for a permission they have.
      setActionError({
        code: "unknown",
        message: "Could not promote. Please try again.",
      });
    } finally {
      setBusy(false);
    }
  }

  // TEA-04 AC-1, AC-15. Reached only from `member-list-remove-confirm-accept`, which is the only
  // thing in this file that performs a removal.
  async function onConfirmRemove() {
    if (!pending || busy) return;

    setBusy(true);
    setActionError(null);
    try {
      const result = await seam.removeMember(pending.id);
      if (result.ok) {
        setPending(null);
        await load();
      } else {
        // THE DIALOG STAYS OPEN on a refusal, the same shape AllowList.tsx uses: the row the
        // sentence is about is named directly above it.
        setActionError(result.error);
      }
    } catch {
      setActionError({ code: "unknown", message: "Could not remove the member. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  // SOLO, 2026-09-10. The one write the edit panel makes. `load()` afterwards and never a splice —
  // the roster is INV-04's denominator and a list the screen edited locally could disagree with it.
  async function onSaveEdit() {
    if (!editing || busy) return;
    const teamId = editing.teamId;
    if (!teamId) return;

    setBusy(true);
    setActionError(null);
    try {
      const result = await seam.setMemberTeam(editing.id, teamId);
      if (result.ok) {
        setEditing(null);
        await load();
      } else {
        setActionError(result.error);
      }
    } catch {
      setActionError({ code: "unknown", message: "Could not save. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  if (view.phase === "loading") {
    return (
      <p
        data-testid="member-list-loading"
        role="status"
        className="mx-auto max-w-2xl rounded-2xl bg-white p-8 text-center text-sm opacity-70 shadow-sm"
      >
        <Loader label="Opening the team list…" />
      </p>
    );
  }

  if (view.phase === "notOnATeam") {
    return (
      <section
        data-testid="member-list-not-on-a-team"
        className="mx-auto max-w-2xl rounded-2xl bg-white p-8 text-center shadow-sm"
      >
        <h1 className="text-xl font-semibold">You are not on a team yet</h1>
        <p className="mt-2 text-sm opacity-70">
          This account has not been added to a team yet, so there is no member list to show. Ask an
          admin to add your address to the list of addresses allowed to join the team.
        </p>
      </section>
    );
  }

  if (view.phase === "unavailable") {
    return (
      <section
        data-testid="member-list-unavailable"
        role="alert"
        className="mx-auto max-w-2xl rounded-2xl bg-white p-8 text-center shadow-sm"
      >
        <h1 className="text-xl font-semibold">Could not read the team list</h1>
        <p className="mt-2 text-sm opacity-70">
          The list may be incomplete, so none of it is shown. Please reload the page.
        </p>
      </section>
    );
  }

  const { me, roster, team } = view;

  // SOLO, 2026-09-10. One name for every row, because every row is on the same team. `—` when the
  // team read failed: a column that invented a name would be the one cell on this screen not backed
  // by a read.
  const teamName = team?.name ?? "—";

  // TEA-04 AC-13, AC-14, and they are the conditions exactly.
  //
  // `m.removedAt === null` is deliberately NOT in either predicate: the screen only ever draws
  // active members — `current` below runs first — and re-testing it here would imply the list might
  // contain one.
  const canRemove = (m: Member): boolean => me.role === "admin" && m.id !== me.id;
  const canPromote = (m: Member): boolean =>
    me.role === "admin" && m.id !== me.id && m.role === "member";

  // AC-4, second half. The READ deliberately returns removed members carrying `removedAt` — ADR-013
  // and the INV-04 note require the counting function to be given the roster with `removedAt` per
  // member — and this line is where they stop being drawn. It is a display decision and NOT an
  // affordance: nothing about it enforces a permission. Do not push it below the seam.
  const current = roster.filter((m) => m.removedAt === null);

  return (
    <section className="flex w-full flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold">Members on the team</h1>
        {/* TEA-04. "This page is view-only" was true until this ticket and is now true for a member
            only — an admin has two controls on it. A standing sentence that stopped being true for
            half the readers is worse than no sentence. */}
        <p className="mt-2 text-sm opacity-70">
          {me.role === "admin"
            ? "Who is on the team, and who is an admin. You can remove a member from the team or promote them to admin."
            : "Who is on the team, and who is an admin. This page is view-only."}
        </p>
      </header>

      {/* AC-13. The failure from a PROMOTION renders here, above the table; the failure from a
          removal renders inside the dialog, where the row it is about is named. One selector, and
          never both at once — `pending` is what decides which of the two is on screen. */}
      {!pending && actionError ? (
        <p
          data-testid="member-list-action-error"
          role="alert"
          className="rounded-2xl bg-white p-4 text-sm text-rose-600 shadow-sm"
        >
          {actionError.message}
        </p>
      ) : null}

      {current.length === 0 ? (
        <p
          data-testid="member-list-empty"
          className="rounded-2xl bg-white p-8 text-center text-sm opacity-70 shadow-sm"
        >
          Nobody is on the team yet.
        </p>
      ) : (
        // SOLO, 2026-09-10. **SIX COLUMNS AND THREE ACTIONS, ON THE OPERATOR'S INSTRUCTION.** Three
        // of the columns are new — team, last sign-in, and the action group — and `Avatar`, `Name`
        // and `Role` keep their cells, their ids and their contents exactly as TEA-04 shipped them.
        //
        // **NO IMAGE WAS ATTACHED WITH THIS REQUEST, so the arrangement below is this agent's own**
        // and is marked as such — `.ai/standards/ui-design-system.md` § *Visual specification*. What
        // the operator specified in words is WHICH columns and WHICH actions; where they sit, and
        // that the two read-only actions open a modal rather than a route, are decisions taken here.
        <table
          data-testid="member-list-table"
          className="w-full overflow-hidden rounded-card bg-card text-sm shadow-soft"
        >
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-ink-3">
              <th className="px-4 py-3 font-bold">Avatar</th>
              <th className="px-4 py-3 font-bold">Name</th>
              <th className="px-4 py-3 font-bold">Role</th>
              <th className="px-4 py-3 font-bold">Team</th>
              <th className="px-4 py-3 font-bold">Last sign-in</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {current.map((member) => (
              // `data-member-id` is how AC-1's "the caller included" is asserted — the caller's own
              // id appears as a row — and how AC-2's "no row belonging to team U" is asserted, by
              // the absence of that team's member id. No "this is you" marker is drawn: the story
              // does not ask for one and the attribute already answers the question.
              <tr
                key={member.id}
                data-testid="member-list-row"
                data-member-id={member.id}
                data-role={member.role}
                className="border-t border-line"
              >
                <td data-testid="member-list-row-avatar" className="px-4 py-3 text-xl">
                  {member.avatar}
                </td>
                <td
                  data-testid="member-list-row-name"
                  className="px-4 py-3 font-semibold text-ink"
                >
                  {member.displayName}
                </td>
                <td className="px-4 py-3">
                  {/* AC-3. The same label for both roles from both roles' point of view: there is
                      one policy, no branch on role anywhere below the seam, and no cell an admin
                      sees that a member does not. */}
                  <span
                    data-testid="member-list-row-role"
                    className={
                      member.role === "admin"
                        ? "rounded-pill bg-holiday px-3 py-1 text-xs font-semibold text-ink"
                        : "rounded-pill bg-field px-3 py-1 text-xs font-semibold text-ink-2"
                    }
                  >
                    {roleLabel(member.role)}
                  </span>
                </td>

                {/* SOLO. THE TEAM, and every row on this list carries the SAME one — `member_select_team`
                    scopes the read to the caller's own team, so a second team can never appear here.
                    The column is drawn anyway because the operator asked for it and because a name is
                    more useful than a uuid the moment there IS a second team. */}
                <td data-testid="member-list-row-team" data-team-id={member.teamId ?? ""} className="px-4 py-3 text-ink-2">
                  {teamName}
                </td>

                {/* SOLO. **NULL MEANS NEVER, AND THE CELL SAYS SO RATHER THAN GOING BLANK.** An empty
                    cell reads as missing data; "Never" is a fact about the person. The value is a
                    copy of `auth.users.last_sign_in_at` kept by a trigger — see the migration. */}
                <td
                  data-testid="member-list-row-last-sign-in"
                  data-at={member.lastSignInAt ?? ""}
                  className="px-4 py-3 font-mono text-xs text-ink-2"
                >
                  {member.lastSignInAt ? member.lastSignInAt.slice(0, 10) : "Never"}
                </td>

                {/* AC-13, AC-14, as affordances ONLY. A member's view draws no write control; an
                    admin's own row draws no promote and no remove. The policy and the trigger refuse
                    each of those independently for anybody who issues the statement anyway (ADR-005).

                    SOLO, 2026-09-10: **`View info` AND `Edit` ARE OFFERED TO EVERYBODY, AND THAT IS
                    NOT A WIDENED PERMISSION.** `View info` shows the same row already rendered in the
                    table, so it discloses nothing new; `Edit` opens a form whose one save is
                    `member_update_admin`, which refuses a member exactly as it always did. */}
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex flex-wrap justify-end gap-2">
                    <button
                      data-testid="member-list-row-view"
                      type="button"
                      onClick={() => setViewing(member)}
                      className={ROW_ACTION}
                    >
                      View info
                    </button>

                    <button
                      data-testid="member-list-row-edit"
                      type="button"
                      onClick={() => {
                        setActionError(null);
                        setEditing(member);
                      }}
                      className={ROW_ACTION}
                    >
                      Edit
                    </button>

                    {canPromote(member) ? (
                      <button
                        data-testid="member-list-row-promote"
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          void onPromote(member);
                        }}
                        className={ROW_ACTION}
                      >
                        Promote
                      </button>
                    ) : null}

                    {/* **THE LABEL SAYS `Delete account` AND THE WRITE IS A SOFT REMOVE**, which is
                        the operator's choice of 2026-09-10 when asked what the words should mean. A
                        hard delete of `auth.users` needs the service-role key and therefore a server
                        ADR-005 refuses, and it would break ADR-013: a removed member counts until
                        the day they were removed, and INV-04 divides by that. The id and the write
                        are TEA-04's, unchanged. */}
                    {canRemove(member) ? (
                      <button
                        data-testid="member-list-row-remove"
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setActionError(null);
                          setPending(member);
                        }}
                        className="rounded-pill border border-line px-3 py-1 text-xs font-semibold text-danger transition-colors hover:bg-field disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                      >
                        Delete account
                      </button>
                    ) : null}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* SOLO, 2026-09-10 — VIEW INFO. It renders the row that is already on screen and reads
          nothing: a panel that fetched would be a second source for facts the table just showed, and
          the two could disagree. It carries no control, so there is nothing here to refuse. */}
      {viewing ? (
        <Modal
          testIdPrefix="member-info"
          label={`About ${viewing.displayName}`}
          onClose={() => setViewing(null)}
        >
          <dl data-testid="member-info" data-member-id={viewing.id} className="flex flex-col gap-2 text-sm">
            {[
              ["Name", viewing.displayName],
              ["Role", roleLabel(viewing.role)],
              ["Team", teamName],
              ["Last sign-in", viewing.lastSignInAt ?? "Never"],
              ["Joined", viewing.createdAt.slice(0, 10)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-ink-3">{label}</dt>
                <dd className="text-right font-semibold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      ) : null}

      {/* SOLO, 2026-09-10 — EDIT, WHICH TODAY CHANGES THE TEAM AND NOTHING ELSE.
          The operator asked for exactly that.

          **⚠️ THE PICKER OFFERS ONE TEAM, AND THAT IS THE POLICY RATHER THAN A PLACEHOLDER.**
          `member_update_admin`'s `with check` is `team_id = member_team_id(auth.uid())`, so the only
          team an admin can write is the one they are already on — and every row on this list is
          already on it, because `member_select_team` scoped the read. So this control is honest and
          currently inert: saving writes the value the row already has.

          **MOVING SOMEBODY BETWEEN TEAMS NEEDS TWO THINGS THIS CHANGE DOES NOT DO**: a second team,
          and a policy that lets an admin write a team id they are not on. The second is a security
          decision — it would let any admin move any member anywhere — and is not one to take in
          passing. Recorded here rather than hidden behind a disabled control with no explanation. */}
      {editing ? (
        <Modal
          testIdPrefix="member-edit"
          label={`Edit ${editing.displayName}`}
          onClose={() => setEditing(null)}
        >
          <div data-testid="member-edit" data-member-id={editing.id} className="flex flex-col gap-3 text-sm">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-ink-3">Team</span>
              <select
                data-testid="member-edit-team"
                data-team-id={editing.teamId ?? ""}
                defaultValue={editing.teamId ?? ""}
                className="rounded-lg border border-line bg-field px-2 py-1 text-ink"
              >
                <option value={editing.teamId ?? ""}>{teamName}</option>
              </select>
            </label>

            <p data-testid="member-edit-note" className="text-xs text-ink-3">
              An admin can only move somebody to their own team, so there is one team to choose
              until this product has more than one.
            </p>

            {actionError ? (
              <p data-testid="member-edit-error" data-code={actionError.code} role="alert" className="text-sm text-danger">
                {actionError.message}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <button
                data-testid="member-edit-cancel"
                type="button"
                onClick={() => setEditing(null)}
                className={ROW_ACTION}
              >
                Cancel
              </button>
              <button
                data-testid="member-edit-save"
                type="button"
                disabled={busy}
                onClick={() => void onSaveEdit()}
                className="rounded-pill bg-wfh px-4 py-1 text-xs font-semibold text-ink transition-colors hover:brightness-95 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {/* AC-15, and .ai/standards/ui-design-system.md, Destructive actions: the confirmation NAMES      {/* AC-15, and .ai/standards/ui-design-system.md, Destructive actions: the confirmation NAMES
          what is about to be lost, and "Are you sure?" names nothing. What is lost here is a
          person's presence on the roster and their contribution to the team size every overload
          warning divides by; what is NOT lost is their entries, and an admin who assumes otherwise
          will not remove anybody. So the dialog says both.

          This is not an affordance over a permission. It protects against a mis-click by somebody
          who is fully entitled to the action. */}
      {pending ? (
        <div
          data-testid="member-list-remove-confirm"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm removing the member"
          className="rounded-2xl bg-white p-6 shadow-sm"
        >
          <p className="text-sm">
            Remove <strong>{pending.displayName}</strong> from the team? Their leave and WFH entries
            are kept and still show on the calendar.
          </p>

          {actionError ? (
            <p data-testid="member-list-action-error" role="alert" className="mt-2 text-sm text-rose-600">
              {actionError.message}
            </p>
          ) : null}

          <div className="mt-4 flex gap-2">
            <button
              data-testid="member-list-remove-confirm-accept"
              type="button"
              disabled={busy}
              onClick={() => {
                void onConfirmRemove();
              }}
              className="rounded-xl bg-rose-600 px-4 py-2 text-white disabled:opacity-40"
            >
              {busy ? "Removing…" : "Remove from team"}
            </button>
            <button
              data-testid="member-list-remove-confirm-cancel"
              type="button"
              disabled={busy}
              onClick={() => {
                setActionError(null);
                setPending(null);
              }}
              className="rounded-xl border border-slate-200 px-4 py-2 disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
