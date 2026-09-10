// SOLO, 2026-09-10 — the admin's queue of people who have signed up and are waiting to be let in.
// It replaces `AllowList.tsx`, which is deleted, and `/allow-list`, which is gone.
//
// **THIS SCREEN IS WHERE ADR-009'S GATE MOVED TO.** That decision made the allow-list the gate: an
// admin typed an address, and only that address could become a member. The operator reversed the
// order on 2026-09-10 — everybody signs up, and an admin decides afterwards. The gate is the same
// power in a different place, and this is the place.
//
// **NOTHING HERE IS THE CONTROL, AND ON THIS SCREEN THAT SENTENCE IS LOAD-BEARING.** The control is
// `member_decide_admin` plus the column grant `update (status, team_id)`, both in the database. A
// member who reached this screen in a debugger sees no rows — `member_select_pending_admin` requires
// `is_admin` — and any decision they issued by hand would be refused by the policy and by nothing in
// `src/` (ADR-005).
//
// **THE TEAM CONTROL OFFERS EXACTLY ONE OPTION TODAY, AND THAT IS THE POLICY SPEAKING RATHER THAN A
// PLACEHOLDER.** The operator asked for the admin to choose the team at approval.
// `member_decide_admin`'s `with check` compares the team written to `member_team_id(auth.uid())`, so
// the only team an admin can admit somebody to is their own — a picker offering another team would
// be offering a journey the datastore refuses. v1 has one team
// (`.ai/standards/data-model.md`), so the control is honest and will simply grow options the day a
// second team and a cross-team admit policy both exist.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
// The seam, through its one door. Nothing above the seam names an implementation, and this file must
// never import `@/lib/data/supabase` or `@/lib/data/mock` (RULE-02).
import { seam } from "@/lib/data";
import type { Failure, Member, Team } from "@/lib/domain/types";

/**
 * The four phases `AllowList.tsx` established and this screen keeps, so a reader meets no new shape.
 *
 * `refused` AND `unavailable` ARE SEPARATE AND MUST STAY SEPARATE: a denial and a transport failure
 * are different answers, and an admin whose read threw is not being told they are not an admin.
 */
type View =
  | { phase: "loading" }
  | { phase: "refused" }
  | { phase: "unavailable" }
  | { phase: "ready"; rows: Member[]; team: Team };

export default function NewSignups() {
  const [view, setView] = useState<View>({ phase: "loading" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<Failure | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setView({ phase: "loading" });
    setError(null);

    try {
      const me = await seam.getCurrentMember();

      // The refusal fails CLOSED, which is what `AllowList.tsx` and `TeamEntries.tsx` both chose for
      // the same fork: the alternative is drawing a queue of strangers' names to somebody the seam
      // has told us nothing about.
      if (!me || me.role !== "admin") {
        setView({ phase: "refused" });
        return;
      }

      // TWO READS. `getTeam()` is not decoration here — it is the value the approve control sends,
      // and the screen must not invent it from the admin's own `teamId` field because that is the
      // same fact read from a row rather than from the policy's own source.
      const [rows, team] = await Promise.all([
        seam.listPendingMembers(),
        seam.getTeam(),
      ]);

      if (!team) {
        setView({ phase: "unavailable" });
        return;
      }

      setView({ phase: "ready", rows, team });
    } catch {
      setView({ phase: "unavailable" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * One decision. `load()` afterwards and never a local splice: the row leaves this queue because
   * the next read does not return it, which is the property the approval worklist was built on and
   * the reason a count and a list here cannot disagree.
   *
   * A REFUSAL STAYS ON SCREEN and the list is not reloaded — the admin should see which decision was
   * refused, beside the row it was about.
   */
  async function decide(member: Member, approve: boolean): Promise<void> {
    if (busy) return;
    setBusy(member.id);
    setError(null);

    const team = view.phase === "ready" ? view.team : null;
    if (!team) {
      setBusy(null);
      return;
    }

    const result = await seam.decideMember(
      member.id,
      approve ? { approve: true, teamId: team.id } : { approve: false },
    );

    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    await load();
  }

  if (view.phase === "loading") {
    return (
      <p
        data-testid="signups-loading"
        role="status"
        className="mx-auto max-w-3xl rounded-card bg-card p-8 text-center text-sm text-ink-2 shadow-soft"
      >
        Loading…
      </p>
    );
  }

  if (view.phase === "refused") {
    return (
      <section
        data-testid="signups-refused"
        className="mx-auto max-w-3xl rounded-card bg-card p-8 text-center shadow-soft"
      >
        <h1 className="text-xl font-semibold text-ink">This page is for admins</h1>
        <p className="mt-2 text-sm text-ink-2">
          Only an admin decides who joins the team.
        </p>
        <p className="mt-4">
          <Link data-testid="signups-back" to="/" className="text-sm underline">
            Back to home
          </Link>
        </p>
      </section>
    );
  }

  if (view.phase === "unavailable") {
    return (
      <section
        data-testid="signups-unavailable"
        role="alert"
        className="mx-auto max-w-3xl rounded-card bg-card p-8 text-center shadow-soft"
      >
        <h1 className="text-xl font-semibold text-ink">This list could not be read</h1>
        <p className="mt-2 text-sm text-ink-2">Try again in a moment.</p>
        <p className="mt-4">
          <Link data-testid="signups-back" to="/" className="text-sm underline">
            Back to home
          </Link>
        </p>
      </section>
    );
  }

  const { rows, team } = view;

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold text-ink">New sign-ups</h1>
        {/* THE COUNT IS THE ROWS, and here that is honest rather than sloppy: this read is not paged
            and returns the whole set, unlike the approval worklist where `total` and `rows.length`
            are deliberately different numbers. */}
        <p
          data-testid="signups-count"
          data-total={rows.length}
          className="mt-1 text-sm text-ink-2"
        >
          {rows.length === 1 ? "1 person has" : `${rows.length} people have`} signed
          up and cannot see anything until an admin decides.
        </p>
      </header>

      {error ? (
        <p
          data-testid="signups-error"
          data-code={error.code}
          role="alert"
          className="text-sm text-danger"
        >
          {error.message}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p
          data-testid="signups-empty"
          className="rounded-card bg-card p-8 text-center text-sm text-ink-2 shadow-soft"
        >
          Nobody is waiting to join.
        </p>
      ) : (
        <ul
          data-testid="signups"
          className="divide-y divide-line overflow-hidden rounded-card bg-card shadow-soft"
        >
          {rows.map((person) => (
            <li
              key={person.id}
              data-testid="signup-row"
              data-member-id={person.id}
              data-status={person.status}
              className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm"
            >
              <span
                aria-hidden="true"
                className="flex size-9.5 shrink-0 items-center justify-center rounded-pill bg-field text-xl"
              >
                {person.avatar}
              </span>

              <div className="flex min-w-0 flex-1 flex-col">
                <span
                  data-testid="signup-row-name"
                  className="truncate font-semibold text-ink"
                >
                  {person.displayName}
                </span>
                <span className="text-xs text-ink-3">
                  Signed up {person.createdAt.slice(0, 10)}
                </span>
              </div>

              {/* THE TEAM THE APPROVAL WILL WRITE. A `<select>` with the one option the policy can
                  accept — see the header note. It is disabled rather than absent so the screen
                  states which team a person is being admitted to, which is the fact an admin is
                  actually deciding. */}
              <label className="flex items-center gap-2 text-xs text-ink-3">
                <span>Team</span>
                <select
                  data-testid="signup-row-team"
                  data-team-id={team.id}
                  value={team.id}
                  disabled
                  onChange={() => undefined}
                  className="rounded-lg border border-line bg-field px-2 py-1 text-ink-2"
                >
                  <option value={team.id}>{team.name}</option>
                </select>
              </label>

              <button
                data-testid="signup-row-reject"
                type="button"
                disabled={busy !== null}
                onClick={() => void decide(person, false)}
                className="shrink-0 rounded-pill border border-line bg-card px-4 py-1.5 text-sm font-semibold text-ink-2 transition-colors hover:bg-field hover:text-ink disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                Reject
              </button>

              <button
                data-testid="signup-row-approve"
                type="button"
                disabled={busy !== null}
                onClick={() => void decide(person, true)}
                className="shrink-0 rounded-pill bg-wfh px-4 py-1.5 text-sm font-semibold text-ink transition-colors hover:brightness-95 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                {busy === person.id ? "Saving…" : "Approve"}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p>
        <Link data-testid="signups-back" to="/" className="text-sm underline">
          Back to home
        </Link>
      </p>
    </section>
  );
}
