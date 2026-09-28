// SOLO, 2026-09-26 — the admin's list of reports people have sent.
//
// **EVERY ADMIN SEES EVERY REPORT**, which is the operator's fourth decision of 2026-09-26 and is
// straight along ADR-039 (*every admin manages every team*) and ADR-044: a report is about the
// product and not about a team, so `issue_report_select_admin` carries no team predicate and neither
// does this screen. It is the second admin screen in the product that is not scoped to a team, after
// `/teams`.
//
// **NOTHING HERE IS THE CONTROL.** The control is `issue_report_select_admin` for the read and
// `issue_report_update_admin` plus `grant update (status)` for the write, all in the database. A
// member who reached this screen in a debugger is answered an EMPTY LIST by the select policy, not a
// refusal — so the `refused` phase below is drawn from the caller's own row and is a courtesy, and
// the emptiness is the actual protection (ADR-005).
//
// **AN ADMIN CANNOT EDIT WHAT SOMEBODY WROTE, AND THAT IS THE COLUMN GRANT AND NOT THIS FILE.**
// `status` is the only column in the update grant, so a statement naming `message` is refused with
// `42501 permission denied for column`. This screen draws no control that could try; that absence is
// an affordance.
import { useCallback, useEffect, useState } from "react";
// The seam, through its one door. Nothing above the seam names an implementation, and this file must
// never import `@/lib/data/supabase` or `@/lib/data/mock` (RULE-02).
import { seam } from "@/lib/data";
import type { Failure, IssueKind, IssueReport, IssueStatus, Member } from "@/lib/domain/types";
import Loader from "@/components/Loader";
import Avatar from "@/components/Avatar";
// SOLO, 2026-09-26 (second run). The badge above this screen is the admin layout's, and marking a
// report done is the only thing that changes it — see `AdminContext`.
import { useAdminContext } from "@/components/AdminLayout";

/**
 * The four phases `NewSignups.tsx` established and this screen keeps, so a reader meets no new
 * shape.
 *
 * `refused` AND `unavailable` ARE SEPARATE AND MUST STAY SEPARATE: a denial and a transport failure
 * are different answers, and an admin whose read threw is not being told they are not an admin.
 *
 * `roster` is every member of every team, so a row can name its author. It is `listAllMembers()` and
 * NOT `listMembers()`: a report may come from somebody on a team the reading admin is not on, which
 * is the whole of decision 4, and the own-team read would render those rows with no name.
 */
type View =
  | { phase: "loading" }
  | { phase: "refused" }
  | { phase: "unavailable" }
  // SOLO, 2026-09-26 (second run) adds `urls`: one signed URL per image path on screen, minted for
  // the whole page in one call. A map and not a field on the report, because the paths are the
  // datastore's and the URLs are minted, short-lived and this screen's alone.
  | { phase: "ready"; rows: IssueReport[]; roster: Member[]; urls: Map<string, string> };

/** The words a person reads for each kind. The same three as the report form, and the two lists are
 *  deliberately NOT shared: the form asks a question (*Something is broken*) and a row states a fact
 *  (*Broken*), and one set of words cannot do both without reading badly in one of the two places. */
const KIND_LABELS: Record<IssueKind, string> = {
  bug: "Broken",
  idea: "Idea",
  other: "Other",
};

/** Operator's palette, by MEANING and not by colour — the rule `src/index.css` states for every
 *  token. A bug is the product's `busy` coral, an idea the mint the product already uses for a good
 *  thing, anything else the neutral field. Nothing here is an alarm red; `CLAUDE.md` § Visual
 *  direction rules that out for the whole product. */
const KIND_BADGE: Record<IssueKind, string> = {
  bug: "bg-busy/40 text-busy-ink",
  idea: "bg-wfh/50 text-wfh-ink",
  other: "bg-field text-ink-2",
};

export default function IssueReports() {
  const [view, setView] = useState<View>({ phase: "loading" });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<Failure | null>(null);
  // SOLO, 2026-09-26. Whether the done ones are on screen. DISPLAY ONLY — it runs over rows the read
  // already returned and changes nothing about what a caller may see. Defaults to hiding them,
  // because the reason this screen has a status at all is that a list which only ever grows stops
  // being read.
  const [showDone, setShowDone] = useState(false);
  // SOLO, 2026-09-26 (second run). The handle on the count behind the `Reports` tab's badge. Without
  // it the badge two hundred pixels above this list keeps the old number until an admin leaves the
  // admin area and comes back — the same defect `refreshMembership` exists for one layer up.
  const { refreshBadges } = useAdminContext();

  const load = useCallback(async (): Promise<void> => {
    setView({ phase: "loading" });
    setError(null);

    try {
      const me = await seam.getCurrentMember();

      // The refusal fails CLOSED, which is what every other admin screen chose for the same fork:
      // the alternative is drawing strangers' reports to somebody the seam has told us nothing
      // about. A manager is refused here too — ADR-035 gives that rank exactly one power and this is
      // not it, and `ADMIN_TABS` draws no tab for it either.
      if (!me || me.role !== "admin") {
        setView({ phase: "refused" });
        return;
      }

      // TWO READS, INDEPENDENT. The roster is what turns a `memberId` into a person; without it
      // every row would name a uuid, which is the one thing a report list must not do — an admin
      // reading a bug report needs to know whom to ask.
      const [rows, roster] = await Promise.all([seam.listIssueReports(), seam.listAllMembers()]);

      // SOLO, 2026-09-26 (second run) — **THE SIGNED URLS, MINTED FOR THE WHOLE PAGE IN ONE CALL.**
      // The bucket is private, so `report.images` holds paths that no `<img>` can load. One request
      // for every path on screen rather than one per report: the seam's `issueImageUrls` takes an
      // array, and a call per row would be one round trip per report on a screen that is a list.
      //
      // FLATTENED AND THEN REDISTRIBUTED BY POSITION, which is safe because that function's contract
      // is same-order, same-length, `null` in place for anything it could not sign.
      const paths = rows.flatMap((r) => r.images);
      const signed = await seam.issueImageUrls(paths);
      const urls = new Map<string, string>();
      paths.forEach((path, index) => {
        const url = signed[index];
        if (url) urls.set(path, url);
      });

      setView({ phase: "ready", rows, roster, urls });
    } catch {
      setView({ phase: "unavailable" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Marks one done, or puts it back.
   *
   * `load()` afterwards and NEVER a local splice: the row's status comes from the next read, which
   * is the property that stops the count in the header and the list beneath it disagreeing. The
   * same choice `NewSignups.tsx` and `MemberList.tsx` both record.
   *
   * A REFUSAL STAYS ON SCREEN and the list is not reloaded — an admin should see which press was
   * refused, beside the row it was about.
   */
  async function onToggle(report: IssueReport): Promise<void> {
    if (busy) return;
    setBusy(report.id);
    setError(null);

    try {
      const next: IssueStatus = report.status === "done" ? "open" : "done";
      const result = await seam.setIssueReportStatus(report.id, next);
      if (result.ok) {
        await load();
        // AFTER `load()`, NOT BEFORE. The badge and the list should agree, and re-reading the count
        // before the list had settled would let the two disagree for as long as the list took.
        refreshBadges();
      } else {
        setError(result.error);
      }
    } catch {
      // A THROW IS NOT A REFUSAL — the sentence every write on every screen in this product carries,
      // and for the same reason: "you are not allowed" would be false and would send an admin to
      // ask for a permission they already have.
      setError({ code: "unknown", message: "Could not update that report. Please try again." });
    } finally {
      setBusy(null);
    }
  }

  if (view.phase === "loading") {
    return (
      <p
        data-testid="reports-loading"
        role="status"
        className="mx-auto max-w-3xl rounded-card bg-card p-8 text-center shadow-soft"
      >
        <Loader label="Loading…" />
      </p>
    );
  }

  if (view.phase === "refused") {
    return (
      <section
        data-testid="reports-refused"
        className="mx-auto max-w-3xl rounded-card bg-card p-8 text-center shadow-soft"
      >
        <h1 className="text-xl font-semibold text-ink">This page is for admins</h1>
        <p className="mt-2 text-sm text-ink-2">Only an admin reads the reports people send.</p>
      </section>
    );
  }

  if (view.phase === "unavailable") {
    return (
      <section
        data-testid="reports-unavailable"
        role="alert"
        className="mx-auto max-w-3xl rounded-card bg-card p-8 text-center shadow-soft"
      >
        <h1 className="text-xl font-semibold text-ink">This list could not be read</h1>
        <p className="mt-2 text-sm text-ink-2">Try again in a moment.</p>
      </section>
    );
  }

  const { rows, roster, urls } = view;

  /** The author's name, or an em dash. **NEVER A NAME INVENTED FROM AN ID** — the same rule
   *  `MemberList.tsx` states for its team column: a value on screen that is backed by no read is the
   *  one value nobody can check. */
  const authorOf = (memberId: string): Member | null =>
    roster.find((m) => m.id === memberId) ?? null;

  const open = rows.filter((r) => r.status === "open");
  const shown = showDone ? rows : open;

  return (
    <section className="flex w-full flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Reports</h1>
          {/* THE COUNT IS THE OPEN ONES, which is the number an admin is deciding about. `data-total`
              carries both, so a spec can pin either without the copy having to say two numbers in
              one sentence. */}
          <p
            data-testid="reports-count"
            data-total={rows.length}
            data-open={open.length}
            className="mt-1 text-sm text-ink-2"
          >
            {open.length === 1 ? "1 report is" : `${open.length} reports are`} waiting to be looked
            at, out of {rows.length} {rows.length === 1 ? "report" : "reports"} in all.
          </p>
        </div>

        <button
          data-testid="reports-show-done"
          data-showing={showDone}
          type="button"
          onClick={() => setShowDone((previous) => !previous)}
          aria-pressed={showDone}
          className="rounded-pill border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 transition-colors hover:bg-field hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {showDone ? "Hide the ones marked done" : "Show the ones marked done"}
        </button>
      </header>

      {error ? (
        <p
          data-testid="reports-error"
          data-code={error.code}
          role="alert"
          className="text-sm text-danger"
        >
          {error.message}
        </p>
      ) : null}

      {shown.length === 0 ? (
        // The empty state is one of the two places `CLAUDE.md` § Visual direction puts charm, and
        // it says which emptiness it is: nothing sent at all, versus everything dealt with. Those
        // are opposite facts and a single sentence for both would be wrong half the time.
        <p
          data-testid="reports-empty"
          className="rounded-card bg-card p-8 text-center text-sm text-ink-2 shadow-soft"
        >
          {rows.length === 0
            ? "Nobody has reported anything yet. 🌤"
            : "Everything has been marked done. 🌤"}
        </p>
      ) : (
        <ul
          data-testid="reports"
          className="divide-y divide-line overflow-hidden rounded-card bg-card shadow-soft"
        >
          {shown.map((report) => {
            const author = authorOf(report.memberId);
            return (
              <li
                key={report.id}
                data-testid="report-row"
                data-report-id={report.id}
                data-kind={report.kind}
                data-status={report.status}
                className={`flex flex-wrap items-start gap-3 px-4 py-3 text-sm ${
                  report.status === "done" ? "opacity-60" : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  className="flex size-9.5 shrink-0 items-center justify-center overflow-hidden rounded-pill bg-field text-xl"
                >
                  {/* `""` and not `null`: `Avatar` takes a `string` and resolves an unknown value
                      to its own fallback glyph, which is exactly the right answer for an author the
                      roster does not hold. */}
                  <Avatar value={author?.avatar ?? ""} />
                </span>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      data-testid="report-row-kind"
                      className={`rounded-pill px-2 py-0.5 text-xs font-semibold ${KIND_BADGE[report.kind]}`}
                    >
                      {KIND_LABELS[report.kind]}
                    </span>
                    <span data-testid="report-row-author" className="font-semibold text-ink">
                      {author?.displayName ?? "—"}
                    </span>
                    {/* The date only. A report is not a log line and a timestamp to the second
                        invites somebody to read a precision the feature does not have. */}
                    <span className="text-xs text-ink-3">{report.createdAt.slice(0, 10)}</span>
                  </div>

                  {/* `whitespace-pre-wrap` so the paragraph breaks somebody typed are the paragraph
                      breaks an admin reads. Without it a multi-line report collapses into one line
                      and its structure is lost between the writing and the reading. */}
                  <p
                    data-testid="report-row-message"
                    className="whitespace-pre-wrap wrap-break-word text-ink-2"
                  >
                    {report.message}
                  </p>

                  {/* SOLO, 2026-09-26 (second run) — the attachments, when there are any. Most
                      reports carry none, so the whole block is absent rather than an empty strip
                      with a caption saying so.

                      **THUMBNAILS THAT OPEN THE FULL IMAGE IN A NEW TAB**, and not a lightbox: a
                      screenshot of a calendar is unreadable at 80 pixels, and the browser's own
                      image viewer zooms, rotates and saves better than anything worth writing here.
                      `rel="noreferrer"` because the signed URL is a credential and a referrer header
                      is the standard way one leaks.

                      A PATH THAT COULD NOT BE SIGNED RENDERS AS A DEAD SLOT rather than vanishing,
                      which is what `issueImageUrls` returning `null` in place is for: an admin sees
                      that the report HAS an image they cannot load, instead of the report quietly
                      looking as though it never had one. */}
                  {report.images.length > 0 ? (
                    <ul
                      data-testid="report-row-images"
                      data-count={report.images.length}
                      className="mt-1 flex flex-wrap gap-2"
                    >
                      {report.images.map((path, index) => {
                        const url = urls.get(path) ?? null;
                        return (
                          <li key={path} data-testid="report-row-image" data-signed={url !== null}>
                            {url ? (
                              <a href={url} target="_blank" rel="noreferrer">
                                <img
                                  src={url}
                                  // The author wrote the message, not a caption, so the alt text
                                  // names the position rather than inventing a description of a
                                  // picture nothing in this product has read.
                                  alt={`Attachment ${index + 1}`}
                                  loading="lazy"
                                  className="size-20 rounded-card border border-line object-cover transition-opacity hover:opacity-80"
                                />
                              </a>
                            ) : (
                              <span className="flex size-20 items-center justify-center rounded-card border border-line bg-field text-center text-[11px] text-ink-3">
                                Image unavailable
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}

                  <span data-testid="report-row-page" data-page={report.page} className="text-xs text-ink-3">
                    Sent from {report.page}
                  </span>
                </div>

                <button
                  data-testid="report-row-toggle"
                  type="button"
                  disabled={busy === report.id}
                  onClick={() => void onToggle(report)}
                  className="rounded-pill border border-line px-3 py-1 text-xs font-semibold text-ink-2 transition-colors hover:bg-field hover:text-ink disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  {report.status === "done" ? "Reopen" : "Mark done"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
