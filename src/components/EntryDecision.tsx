// ADM-05 — the approve control, the reject control and the mandatory reason, in ONE component
// mounted TWICE. 01-plan.md sections 2b, 4.4 and 4.5.
//
// The extraction is the point, and it is ADM-03's reason applied to a decision rather than to a
// form: two copies of these controls would be two places where "a rejection carries a reason" is
// decided, and the two would agree until somebody changed one. It is mounted on each row of
// `/entries/pending`, which is the surface the feature row names, and on `/entries/:id/edit` for an
// admin, which is the only place an entry that is no longer pending is reachable at all — the
// worklist shows pending entries by construction, so AC-4 and AC-5 have nowhere else to happen.
//
// EVERYTHING HERE IS AN AFFORDANCE (ADR-005). The control is clause (a) of
// `public.entry_enforce_decision()` plus `entry_update_admin`, both in the database. This panel
// refuses nobody holding a token: a member who reached it in a debugger, or issued the PATCH by
// hand, is refused by the trigger and by nothing in `src/` (01-plan.md section 3).
//
// IT IMPORTS NO READ AND ISSUES NO QUERY. Which entries it is rendered for is the caller's decision,
// and which writes succeed is the datastore's. It calls `seam.approveEntry` and `seam.rejectEntry`
// and nothing else.
//
// IT DOES NOT CHECK THE REASON ITSELF, and that absence is deliberate. INV-03's biconditional check
// is the control and the seam already refuses a blank reason before the round trip with
// `rejection_reason_required` (AC-3); a third check here would be a third place the same rule is
// written, and it would make AC-3 unobservable through the interface by never letting the refusal
// happen. The field carries `data-required="true"` and the button submits.
//
// NO CONFIRMATION DIALOG ON APPROVE. Approving is reversible by rejecting, and a dialog on the
// commonest action in a queue is how a queue stops being worked (01-plan.md section 2b).
//
// NOTHING HERE RETURNS AN ENTRY TO `pending` (AC-11). That transition is named in no permission row
// and is not built; the only route back is INV-02's trigger on a substantive edit.
import { useState } from "react";
import { seam } from "@/lib/data";
import type { Entry, Failure } from "@/lib/domain/types";

export interface EntryDecisionProps {
  /** The entry as the datastore last returned it. The panel reads `id` and `status` and nothing else. */
  entry: Entry;
  /**
   * The decision landed. The CALLER re-reads — this component holds no list and no count, and a
   * panel that handed back a row would invite a caller to splice it into one, which is how the
   * worklist's count and its rows come to disagree (ADM-04's whole shape).
   */
  onDecided: () => void | Promise<void>;
}

export default function EntryDecision({ entry, onDecided }: EntryDecisionProps) {
  // Three pieces of one thing. `open` is the reason field's disclosure — reject OPENS it and writes
  // nothing, so the field is where the rejection is composed rather than a prompt that has already
  // begun one.
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Failure | null>(null);

  async function run(write: () => Promise<{ ok: true } | { ok: false; error: Failure }>) {
    setBusy(true);
    setError(null);

    const result = await write();
    setBusy(false);

    // The refusal STAYS ON SCREEN and the panel stays open: a rejection refused for a blank reason
    // must leave the wording the admin typed where they can fix it (AC-3).
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setOpen(false);
    setReason("");
    await onDecided();
  }

  return (
    <div
      data-testid="entry-decision"
      data-entry-id={entry.id}
      data-status={entry.status}
      className="flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        {/* AC-11. Absent when the entry is already approved — `approved` to `approved` is not a
            decision, and a control that re-approved would rewrite `approved_at` for nothing. Every
            other transition this product offers is reachable from here. */}
        {entry.status === "approved" ? null : (
          <button
            data-testid="entry-decision-approve"
            type="button"
            disabled={busy}
            onClick={() => void run(() => seam.approveEntry(entry.id))}
            className="rounded-full bg-emerald-100 px-3 py-1 text-sm disabled:opacity-40"
          >
            Approve
          </button>
        )}

        {/* AC-2 and AC-5. It OPENS THE FIELD and writes nothing. On an already-rejected entry it is
            how the reason is re-worded, which is the same field on the same form. */}
        <button
          data-testid="entry-decision-reject"
          type="button"
          disabled={busy || open}
          onClick={() => {
            setOpen(true);
            setError(null);
            setReason(entry.rejectionReason ?? "");
          }}
          className="rounded-full bg-rose-100 px-3 py-1 text-sm disabled:opacity-40"
        >
          {entry.status === "rejected" ? "Change the reason" : "Reject"}
        </button>
      </div>

      {open ? (
        <div className="flex flex-col gap-2">
          {/* AC-18. The label asks WHAT WOULD WORK INSTEAD rather than demanding a justification —
              the object is an entry, the question is about the team's schedule, and nothing here
              asks the member to account for their absence. */}
          <label className="flex flex-col gap-1 text-sm">
            <span className="opacity-70">What would work instead?</span>
            <textarea
              data-testid="entry-decision-reason"
              data-required="true"
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1"
            />
          </label>

          {/* AC-20. A rejection removes nothing and locks nothing, and the copy has to say so: the
              entry stays on the board, stays theirs, and stays editable and deletable by them. */}
          <p className="text-sm opacity-70">
            The entry stays on the board and stays theirs to edit or remove. This is the team&rsquo;s
            schedule, not permission to be away.
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              data-testid="entry-decision-submit"
              type="button"
              disabled={busy}
              onClick={() => void run(() => seam.rejectEntry(entry.id, reason))}
              className="rounded-full bg-rose-100 px-3 py-1 text-sm disabled:opacity-40"
            >
              {busy ? "Saving…" : "Reject with this reason"}
            </button>

            {/* Writes nothing, and says so by doing nothing: the field closes and the entry is
                exactly as it was. */}
            <button
              data-testid="entry-decision-cancel"
              type="button"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setReason("");
                setError(null);
              }}
              className="text-sm underline disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {/* AC-3, AC-8 and AC-16. `data-code` carries WHICH refusal, so a test asserts the refusal it
          means rather than "some error" — and a member's forged approval, a blank reason and a row
          the policy filtered are three different sentences with three different codes.

          The message is the seam's and is rendered as it arrives: no SQLSTATE reaches this element,
          because the seam is where 42501 and 23514 become sentences. */}
      {error ? (
        <p
          data-testid="entry-decision-error"
          data-code={error.code}
          role="alert"
          className="text-sm text-rose-600"
        >
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
