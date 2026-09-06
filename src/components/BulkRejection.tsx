// ADM-06 — the batch bar: one reason, typed once, written onto every entry selected. 01-plan.md
// sections 2b, 4.4 and 4.5.
//
// A SECOND COMPONENT RATHER THAN AN EXTENSION OF `EntryDecision`, and 01-plan.md section 8 rejected
// alternative 1 is the argument. They are different controls over different things — one entry
// against a set — and `EntryDecision`'s whole contract is one `Entry`: it reads `entry.status` to
// decide whether the approve control exists at all, and `entry.rejectionReason` to pre-fill the
// field when re-wording. A set of entries has neither a single status nor a single existing reason.
// THE DUPLICATION THAT ALTERNATIVE EXISTS TO PREVENT DOES NOT ARISE: `EntryDecision`'s own header
// records that it does NOT hold the rule — INV-03's biconditional is the control — so these are two
// affordances over one rule and not two copies of it.
//
// EVERYTHING HERE IS AN AFFORDANCE (ADR-005). The controls are `entry_update_admin` and clause (a)
// of `public.entry_enforce_decision()`, both in the database and both still running AS THE CALLER
// because `public.reject_entries` is `security invoker`. This bar refuses nobody holding a token: a
// member who reached it in a debugger, or called the function with their own token from anywhere
// else, is refused by clause (a) and by nothing in this file (01-plan.md section 3).
//
// IT IMPORTS NO READ AND ISSUES NO QUERY. Which rows exist is the caller's, which writes succeed is
// the datastore's. It calls `seam.rejectEntries` and nothing else.
//
// IT DOES NOT CHECK THE REASON AND DOES NOT CHECK THE SELECTION, and both absences are deliberate —
// `EntryDecision`'s reasoning, applied twice. The seam refuses a blank reason with
// `rejection_reason_required` and an empty selection with `no_entries_selected`, each before a
// request is issued; a third check here would be a third place the same rule is written, and it
// would make AC-3 and AC-4 unobservable through the interface by never letting the refusal happen.
// SO THE SUBMIT IS DISABLED ONLY WHILE A BATCH IS IN FLIGHT — a submit disabled on an empty
// selection would delete AC-4 from the product.
//
// IT IS NOT A DIALOG AND IT DOES NOT COVER THE LIST (01-plan.md section 2b). The one thing an admin
// must be able to do while typing a reason for twelve entries is LOOK AT THE TWELVE ENTRIES. A modal
// would hide the batch's contents at the moment they are being justified, and a confirmation step
// would dress a rejection as destructive — which it is not: the entry stays on the board, stays its
// member's, and stays editable and deletable by them (section 8, rejected alternative 5).
//
// NO BULK APPROVAL AND NO BULK ANYTHING ELSE. A rejection carries a reason, which is what makes a
// batch of them one act with one justification; an approval carries none.
import { useState } from "react";
import { seam } from "@/lib/data";
import type { BulkRejectionOutcome, Failure } from "@/lib/domain/types";

export interface BulkRejectionProps {
  /** The selected entry ids, in the order the rows are displayed. The bar never chooses them. */
  selectedIds: string[];
  /** Every id on the current page, for the select-all control (AC-15). Never the matching set. */
  pageIds: string[];
  /** Select-all and clear both go through the caller, which owns the selection state (AC-14). */
  onSelectionChange: (ids: string[]) => void;
  /**
   * The last batch's outcome, or `null` when none has landed in this view.
   *
   * DEVIATION from 01-plan.md section 4.4, declared in 03-impl-log.md, and it is forced by the
   * screen this bar is mounted on: `PendingEntries.load()` sets the `loading` phase, which returns
   * before the bar is rendered, so the bar UNMOUNTS during the re-read AC-12 requires. State held
   * here would not survive it, and section 2b requires the opposite — "the result of a batch is a
   * sentence in the bar and STAYS THERE ... a toast would take the only record of a partial write off
   * the screen". So the caller holds it, exactly as it already holds the selection and for the same
   * reason: anything that must outlive a re-read cannot live in the thing the re-read unmounts.
   */
  outcome: BulkRejectionOutcome | null;
  /**
   * The batch landed, wholly or partly. The CALLER re-reads — this bar splices nothing (AC-12) — and
   * the caller records the outcome, which is what `outcome` above is handed back on the next render.
   */
  onRejected: (outcome: BulkRejectionOutcome) => void | Promise<void>;
}

/** AC-5's sentence, and it NAMES BOTH NUMBERS on a partial batch and never says *done*. */
function resultText(outcome: BulkRejectionOutcome): string {
  const { requested, rejected } = outcome;
  if (rejected === requested) {
    return rejected === 1
      ? "1 entry rejected, with this reason."
      : `${rejected} entries rejected, each with this reason.`;
  }
  const missed = requested - rejected;
  return (
    `${rejected} of ${requested} entries rejected. ` +
    `The other ${missed} ${missed === 1 ? "was" : "were"} not yours to decide and ` +
    `${missed === 1 ? "is" : "are"} unchanged.`
  );
}

export default function BulkRejection({
  selectedIds,
  pageIds,
  onSelectionChange,
  outcome,
  onRejected,
}: BulkRejectionProps) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Failure | null>(null);

  const selected = selectedIds.length;

  async function submit(): Promise<void> {
    setBusy(true);
    setError(null);

    const result = await seam.rejectEntries(selectedIds, reason);
    setBusy(false);

    // AC-13. The refusal STAYS ON SCREEN with the selection and the typed wording where they can be
    // corrected — a blank reason, an empty selection and a permission refusal are all this branch.
    // Nothing is cleared, because nothing was written.
    if (!result.ok) {
      setError(result.error);
      return;
    }

    // AC-13's other half. The batch landed wholly or partly, so the selection and the reason go —
    // the next batch must not inherit this one's contents. The RESULT is the caller's to keep
    // (`outcome` above), because the re-read below unmounts this component.
    setReason("");
    onSelectionChange([]);
    await onRejected(result.value);
  }

  return (
    <div
      data-testid="bulk-rejection"
      data-selected={selected}
      className="flex flex-col gap-2 rounded-2xl bg-white px-4 py-3 text-sm shadow-sm"
    >
      {/* A SINGLE LINE AT REST. The worklist is the nearest thing this product has to the calendar
          grid, and CLAUDE.md § Visual direction spends no row of it on charm. */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="opacity-70">
          {selected === 0
            ? "Select entries to reject them together."
            : selected === 1
              ? "1 entry selected"
              : `${selected} entries selected`}
        </span>

        {/* AC-15. THIS PAGE, and the ids come from the caller — a control offering the whole
            matching set would send ids the screen has never displayed, which is the one property a
            bulk rejection must not have. */}
        <button
          data-testid="bulk-rejection-select-all"
          type="button"
          disabled={busy}
          onClick={() => onSelectionChange([...pageIds])}
          className="underline disabled:opacity-40"
        >
          Select every entry on this page
        </button>

        <button
          data-testid="bulk-rejection-clear"
          type="button"
          disabled={busy}
          onClick={() => {
            onSelectionChange([]);
            setError(null);
          }}
          className="underline disabled:opacity-40"
        >
          Clear the selection
        </button>
      </div>

      {/* THE FIELD IS ALWAYS VISIBLE AND IS NOT A DISCLOSURE (01-plan.md section 2b).
          `EntryDecision` opens its field on Reject because there the control and the field are the
          same act begun; here the field is the whole content of the bar, and a bar that opened a
          field that opened a submit would be three clicks to do what the row-level control does in
          two.

          The label asks WHAT WOULD WORK INSTEAD — the same question the per-row panel asks, and the
          batch gains no vocabulary the single rejection does not have (AC-16).

          IT NAMES THE ENTRIES, and 01-plan.md section 4.4's table gives the label as the panel's
          exact string. DEVIATION, declared in 03-impl-log.md, and it is forced twice over. Both
          controls are on this screen at once, so an identical label leaves an admin with two reason
          fields asking one question and no way to tell which one they are typing into — and
          tests/e2e/adm-05-approve-reject.spec.ts:306 addresses that label by text, which under
          Playwright's strict mode is a hard failure the moment a second element carries the same
          string. That file is a shipped suite section 7 requires to pass UNEDITED and it is not in
          `allowed_paths`, so the wording is the half of this that may move. The QUESTION is
          unchanged, which is what AC-16 is written about. */}
      <label className="flex flex-col gap-1">
        <span className="opacity-70">What would work instead for these entries?</span>
        <textarea
          data-testid="bulk-rejection-reason"
          data-required="true"
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="rounded-lg border border-slate-200 px-2 py-1"
        />
      </label>

      {/* AC-16, and it is the sentence the feature row names as hardest to hold here: one reason on
          twelve records is mechanically one judgement about twelve people, which is exactly the
          reading charter refusal 2 refuses. ADM-05's wording, repeated deliberately — a batch is
          where it is most needed and most likely to be dropped. Shown while a batch is being
          composed, which is when it is read. */}
      {selected > 0 ? (
        <p className="opacity-70">
          The entries stay on the board and stay theirs to edit or remove. This is the team&rsquo;s
          schedule, not permission to be away.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          data-testid="bulk-rejection-submit"
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="rounded-full bg-rose-100 px-3 py-1 disabled:opacity-40"
        >
          {busy ? "Saving…" : "Reject the selected entries"}
        </button>
      </div>

      {/* AC-5 and AC-18. TWO ATTRIBUTES RATHER THAN ONE STRING, for ADM-04's reason for `data-total`
          beside `data-shown`: a test that parses "5 of 8" out of a sentence breaks when the sentence
          is reworded, and the numbers are the criterion while the wording is not.

          `data-rejected` is the DATASTORE's count and has no path from the selection size — the seam
          reads it from `get diagnostics row_count` and this element renders what it was handed. */}
      {outcome ? (
        <p
          data-testid="bulk-rejection-result"
          data-requested={outcome.requested}
          data-rejected={outcome.rejected}
          role="status"
          className="opacity-70"
        >
          {resultText(outcome)}
        </p>
      ) : null}

      {/* AC-3, AC-4 and AC-8. `data-code` carries WHICH refusal: a blank reason, an empty selection
          and a member's forged batch are three different sentences with three different codes.

          The message is the seam's and is rendered as it arrives — no SQLSTATE reaches this element,
          because the seam is where 22023, 23514 and 42501 become sentences. */}
      {error ? (
        <p
          data-testid="bulk-rejection-error"
          data-code={error.code}
          role="alert"
          className="text-rose-600"
        >
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
