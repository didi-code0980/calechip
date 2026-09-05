// CAL-02 — the six entry fields, their validation and their selectors, EXTRACTED from
// NewEntry.tsx rather than written a second time. 01-plan.md section 4.3.
//
// The extraction is the point: two forms would be two places where "an empty note is null" and "the
// submit button is disabled until both dates are set" are decided, and the two would agree until
// somebody changed one. CAL-01's eleven acceptance tests are the safety net — every `data-testid`
// below is built from a prefix, and `new-entry-*` keeps its names and its positions, so
// tests/e2e/cal-01-create-entry.spec.ts passes UNEDITED against this component.
//
// EVERYTHING here is an affordance (ADR-005). The controls are in the database: the insert and
// update policies' `with check (member_id = auth.uid())`, the two column grants' lists, and
// `entry_no_overlapping_portion`. This form refuses nobody holding a token; it saves a round trip
// and says why.
//
// **THERE IS NO MEMBER PICKER AND NO STATUS CONTROL, and both absences are load-bearing.** The
// first is the affordance for CAL-01 AC-10 and CAL-02 AC-8 (INV-07); the second for CAL-01 AC-11 and
// CAL-02 AC-10 — `status`, `rejection_reason`, `approved_by` and `approved_at` are absent from both
// grants, so no control here could carry one. Adding either would offer a journey that always ends
// in a refusal.
//
// Dates in the past are DELIBERATELY UNCONSTRAINED in either direction, on both routes. It is a
// `TODO(project)` on .ai/registry/features.md:87 and CAL-02 01-plan.md Open questions item 1, and it
// names editing explicitly: whether a member may move an entry onto a past date is the operator's
// decision. So the date inputs carry no `min` and neither seam function carries a past-date check.
import { useState } from "react";
import OverloadWarning from "@/components/OverloadWarning";
import type { EntryPortion, EntryType, Failure } from "@/lib/domain/types";

// CAL-01 AC-4. WFH is a TYPE and not a second feature: one control, two values, and everything
// downstream of it is identical. A WFH member IS working — the glossary calls this the single most
// costly confusion in the domain, which is why the label says so rather than saying "vắng".
//
// Exported because the own-entry list renders the same two labels for the same two columns. Held
// once here rather than twice, which is what the extraction is for.
export const TYPE_LABELS: Record<EntryType, string> = {
  pto: "Nghỉ phép",
  wfh: "Làm ở nhà",
};

// CAL-01 AC-5, and INV-06. One portion for the WHOLE range, and there is deliberately no per-date
// control: a trip leaving Wednesday afternoon and returning Monday morning is up to three entries,
// and this form does not pretend otherwise.
export const PORTION_LABELS: Record<EntryPortion, string> = {
  full: "Cả ngày",
  am: "Buổi sáng",
  pm: "Buổi chiều",
};

/** The six substantive fields, and exactly the six both grants carry. It is deliberately NOT
 *  `CreateEntryInput` or `UpdateEntryInput`: this is what a form holds, and the seam decides what a
 *  write means. `note` is already trimmed to null here, so both routes store "no note" one way. */
export interface EntryFormValues {
  type: EntryType;
  portion: EntryPortion;
  startDate: string;
  endDate: string;
  tentative: boolean;
  note: string | null;
}

export interface EntryFormProps {
  /** `new-entry` or `edit-entry`. Every selector below is this prefix plus a suffix, so the two
   *  routes render the same markup under two selector families and one of them is CAL-01's,
   *  unchanged. */
  testIdPrefix: string;
  title: string;
  submitLabel: string;
  submittingLabel: string;
  initial: EntryFormValues;
  /** What the form holds after a SUCCESSFUL submit.
   *
   *  `clear` is CAL-01's behaviour and is unchanged: type and portion are kept, because declaring a
   *  run of days usually means declaring several with the same shape; the dates, the note and
   *  `tentative` are cleared, because all three describe the entry that was just saved. `tentative`
   *  left sticky silently marks the following entry uncertain.
   *
   *  `keep` is the edit route's: the values on screen ARE the entry now, and clearing them would
   *  show an empty form for a row that still exists. */
  afterSubmit: "clear" | "keep";
  /** Null on success; the failure to render otherwise. The sentence is produced in the seam and
   *  rendered verbatim — this component never composes one of its own about why a write was
   *  refused, so a SQLSTATE or a PostgREST message text can never reach the screen. */
  onSubmit(values: EntryFormValues): Promise<Failure | null>;

  /** CAL-07, 01-plan.md section 4.4. The draft's owner, or null for the caller.
   *
   *  OPTIONAL, and that is the most load-bearing thing about it: `NewEntry.tsx` and `MonthView.tsx`
   *  pass nothing and get the caller, which is correct on both, so neither file is in this ticket's
   *  `allowed_paths` and neither is edited (01-plan.md section 7). `EditEntry.tsx` passes the
   *  entry's `memberId`, which is what makes AC-18 true for an admin editing another member's
   *  entry. */
  ownerId?: string | null;

  /** CAL-07. The saved row this form is editing, so it is not counted BESIDE the draft (AC-17).
   *  Optional for the same reason: on a create there is no row to exclude. */
  excludeEntryId?: string | null;
}

// The same three-state shape SignIn.tsx uses, and `submitting` is never terminal: every path out of
// the handler lands back on `editing`, with or without an error. A disabled button with neither
// beside it is the failure QA found on TEA-01.
type FormState = { phase: "editing"; error: Failure | null } | { phase: "submitting" };

export default function EntryForm({
  testIdPrefix,
  title,
  submitLabel,
  submittingLabel,
  initial,
  afterSubmit,
  onSubmit,
  ownerId = null,
  excludeEntryId = null,
}: EntryFormProps) {
  const [type, setType] = useState<EntryType>(initial.type);
  const [portion, setPortion] = useState<EntryPortion>(initial.portion);
  const [startDate, setStartDate] = useState(initial.startDate);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [tentative, setTentative] = useState(initial.tentative);
  const [note, setNote] = useState(initial.note ?? "");

  const [state, setState] = useState<FormState>({ phase: "editing", error: null });

  const complete = Boolean(startDate && endDate);
  const submitting = state.phase === "submitting";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!complete || state.phase !== "editing") return;

    setState({ phase: "submitting" });

    try {
      // CAL-01 AC-6. An empty note is stored as null and not as an empty string — two
      // representations of "no note" is one more than the column needs, and `btrim` is what the
      // datastore's own INV-03 check uses on the sibling column.
      const failure = await onSubmit({
        type,
        portion,
        startDate,
        endDate,
        tentative,
        note: note.trim() === "" ? null : note.trim(),
      });

      setState({ phase: "editing", error: failure });

      if (!failure && afterSubmit === "clear") {
        setStartDate("");
        setEndDate("");
        setNote("");
        setTentative(false);
      }
    } catch {
      // Not defensive padding: expected failures are RETURNED by the seam, and the Supabase client
      // still raises on an unusable configuration before any request leaves.
      setState({
        phase: "editing",
        error: { code: "unknown", message: "Không lưu được đăng ký. Thử lại giúp mình nhé." },
      });
    }
  }

  return (
    <form
      data-testid={`${testIdPrefix}-form`}
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-2xl bg-white p-8 shadow-sm"
    >
      <h1 className="text-xl font-semibold">{title}</h1>

      <label className="flex flex-col gap-1 text-sm">
        Loại
        <select
          data-testid={`${testIdPrefix}-type`}
          value={type}
          onChange={(e) => setType(e.target.value as EntryType)}
          className="rounded-xl border border-slate-200 px-3 py-2"
        >
          {(Object.keys(TYPE_LABELS) as EntryType[]).map((value) => (
            <option key={value} value={value}>
              {TYPE_LABELS[value]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Buổi
        <select
          data-testid={`${testIdPrefix}-portion`}
          value={portion}
          onChange={(e) => setPortion(e.target.value as EntryPortion)}
          className="rounded-xl border border-slate-200 px-3 py-2"
        >
          {(Object.keys(PORTION_LABELS) as EntryPortion[]).map((value) => (
            <option key={value} value={value}>
              {PORTION_LABELS[value]}
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-4">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Từ ngày
          <input
            data-testid={`${testIdPrefix}-start`}
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2"
          />
        </label>

        {/* CAL-01 AC-2 and AC-3, and CAL-02 AC-11. The end date is INCLUSIVE and the same date on
            both sides is one day — which is why there is one pair of fields and not a "number of
            days". No `min={startDate}`: an inverted range has its own criterion on BOTH routes and
            its own sentence, and a browser control that silently prevented it would leave that
            criterion unobservable through the interface. */}
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Đến ngày
          <input
            data-testid={`${testIdPrefix}-end`}
            type="date"
            required
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2"
          />
        </label>
      </div>

      {/* CAL-01 AC-6. Tentative is INDEPENDENT of status: it changes how the entry is drawn and
          nothing else, it is counted in every calculation (INV-05), and it never makes an entry
          approved or pending. Nothing on this form writes `status`. */}
      <label className="flex items-center gap-2 text-sm">
        <input
          data-testid={`${testIdPrefix}-tentative`}
          type="checkbox"
          checked={tentative}
          onChange={(e) => setTentative(e.target.checked)}
          className="rounded"
        />
        Chưa chắc chắn
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Ghi chú (không bắt buộc)
        <textarea
          data-testid={`${testIdPrefix}-note`}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2"
        />
      </label>

      {/* CAL-07, 01-plan.md sections 4.3 and 4.4. BETWEEN the last field and the save control, and
          inside the form: above the button because a person reads down to it, below the fields
          because it is a consequence of them. Not above the fields, where it would push the form
          down and move the control under the pointer as the dates change.

          It is fed from the state this form already holds and it is given no way to reach the
          submit control below — which is AC-9, AC-10 and AC-12 held by construction. The button
          keeps its `disabled={!complete || submitting}`, its label and its position; there is no
          "Save anyway" and nothing here can add one (charter refusal 6). */}
      <OverloadWarning
        ownerId={ownerId}
        excludeEntryId={excludeEntryId}
        type={type}
        portion={portion}
        startDate={startDate}
        endDate={endDate}
        tentative={tentative}
        testIdPrefix={testIdPrefix}
      />

      {state.phase === "editing" && state.error ? (
        <p data-testid={`${testIdPrefix}-error`} role="alert" className="text-sm text-rose-600">
          {state.error.message}
        </p>
      ) : null}

      <button
        data-testid={`${testIdPrefix}-submit`}
        type="submit"
        disabled={!complete || submitting}
        className="rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-40"
      >
        {submitting ? submittingLabel : submitLabel}
      </button>
    </form>
  );
}
