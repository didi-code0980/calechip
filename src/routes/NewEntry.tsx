// CAL-01 — declare an absence or a work-from-home day. 01-plan.md sections 4.4 and 2.
//
// EVERYTHING here is an affordance (ADR-005). The controls are in the database and nowhere else:
// `entry_insert_own`'s `with check (member_id = auth.uid())` is AC-10, the insert grant's column
// list is AC-11, and `entry_no_overlapping_portion` is INV-01 and AC-7. This screen refuses nobody
// holding a token; it saves a round trip and says why.
//
// **THERE IS NO MEMBER PICKER, and its absence is the affordance for AC-10** — not the control,
// which is the policy. This is the point in the file where adding one would be tempting the day an
// admin asks to file somebody else's leave, and it must not be added here: the policy would refuse
// the write anyway, so the picker would be a control that looks like one and is not, offering a
// journey that always ends in a refusal.
//
// It also renders no status control and never conflates `tentative` with `approved`. The two are
// different axes — glossary.md keeps them apart deliberately — and `status` is not writable by
// anybody on an insert.
//
// AC-12, dates in the past, is DELIBERATELY UNIMPLEMENTED in either direction. It is a
// `TODO(project)` on .ai/registry/features.md:87 and 01-plan.md Open questions item 1: whether a
// member may declare a past date is the operator's decision, both answers are defensible, and it
// changes this screen. So the date inputs carry no `min` and the seam carries no past-date check —
// a rule invented here would be indistinguishable from a decided one to everybody downstream.
import { useCallback, useEffect, useState } from "react";
// The seam, through its one door. Nothing above the seam names an implementation, and this file must
// never import `./supabase` or `./mock` (RULE-02).
import { seam } from "@/lib/data";
import type { Entry, EntryPortion, EntryType, Failure } from "@/lib/domain/types";

// AC-4. WFH is a TYPE and not a second feature: one control, two values, and everything downstream
// of it is identical. A WFH member IS working — the glossary calls this the single most costly
// confusion in the domain, which is why the label says so rather than saying "vắng".
const TYPE_LABELS: Record<EntryType, string> = {
  pto: "Nghỉ phép",
  wfh: "Làm ở nhà",
};

// AC-5. One portion for the WHOLE range (INV-06). There is deliberately no per-date control: a trip
// leaving Wednesday afternoon and returning Monday morning is up to three entries, and this form
// does not pretend otherwise.
const PORTION_LABELS: Record<EntryPortion, string> = {
  full: "Cả ngày",
  am: "Buổi sáng",
  pm: "Buổi chiều",
};

// The same three-state shape SignIn.tsx uses, and `submitting` is never terminal: every path out of
// the handler lands back on `editing`, with or without an error. A disabled button with neither
// beside it is the failure QA found on TEA-01.
type FormState = { phase: "editing"; error: Failure | null } | { phase: "submitting" };

export default function NewEntry() {
  const [type, setType] = useState<EntryType>("pto");
  const [portion, setPortion] = useState<EntryPortion>("full");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [tentative, setTentative] = useState(false);
  const [note, setNote] = useState("");

  const [state, setState] = useState<FormState>({ phase: "editing", error: null });
  const [own, setOwn] = useState<Entry[]>([]);

  // The read is what makes every criterion observable from outside the system. A confirmation
  // message proves only that the form ran; the list proves what was stored — one row for a range and
  // not five (AC-2), the end date coming back inclusive (AC-3), the portion that was chosen (AC-5).
  //
  // A throw is folded into an empty list rather than given a screen of its own. `listOwnEntries`
  // throws on a transport failure and on a possibly-truncated read, and neither has an acceptance
  // criterion here; the honest consequence is that a member sees the empty state, which the seam's
  // own limit assertion exists to make loud in the console rather than silent on screen.
  const load = useCallback(async (): Promise<void> => {
    try {
      setOwn(await seam.listOwnEntries());
    } catch {
      setOwn([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const complete = Boolean(startDate && endDate);
  const submitting = state.phase === "submitting";

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!complete || state.phase !== "editing") return;

    setState({ phase: "submitting" });

    try {
      // AC-6. An empty note is stored as null and not as an empty string — two representations of
      // "no note" is one more than the column needs, and `btrim` is what the datastore's own INV-03
      // check uses on the sibling column.
      const result = await seam.createEntry({
        type,
        portion,
        startDate,
        endDate,
        tentative,
        note: note.trim() === "" ? null : note.trim(),
      });

      // AC-7 and AC-9. The message is produced in the seam and rendered verbatim — this screen never
      // composes a sentence of its own about why a write was refused, so a SQLSTATE or a PostgREST
      // message text can never reach it.
      setState({ phase: "editing", error: result.ok ? null : result.error });

      if (result.ok) {
        // Type and portion are KEPT, because declaring a run of days usually means declaring
        // several in a row with the same shape. The dates, the note and `tentative` are CLEARED,
        // because all three describe the entry that was just saved and none of them describes the
        // next one.
        //
        // `tentative` is the one that had to be decided rather than copied, and the acceptance
        // suite is what forced it: left sticky it silently marks the following entry uncertain, and
        // a record that says "chưa chắc chắn" about a trip somebody has already booked is a wrong
        // record that nobody typed. Type and portion carry no such claim. 01-plan.md is silent on
        // the reset, and this is declared in 03-impl-log.md as a decision rather than a reading.
        setStartDate("");
        setEndDate("");
        setNote("");
        setTentative(false);
        await load();
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
    <section className="mx-auto flex max-w-xl flex-col gap-8">
      <form
        data-testid="new-entry-form"
        onSubmit={onSubmit}
        className="flex flex-col gap-4 rounded-2xl bg-white p-8 shadow-sm"
      >
        <h1 className="text-xl font-semibold">Đăng ký nghỉ hoặc làm ở nhà</h1>

        <label className="flex flex-col gap-1 text-sm">
          Loại
          <select
            data-testid="new-entry-type"
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
            data-testid="new-entry-portion"
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
              data-testid="new-entry-start"
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>

          {/* AC-2 and AC-3. The end date is INCLUSIVE and the same date on both sides is one day —
              which is why there is one pair of fields and not a "number of days", and why a range is
              one entry rather than one per date. No `min={startDate}`: an inverted range has its own
              criterion (AC-9) and its own sentence, and a browser control that silently prevented it
              would leave that criterion unobservable through the interface. */}
          <label className="flex flex-1 flex-col gap-1 text-sm">
            Đến ngày
            <input
              data-testid="new-entry-end"
              type="date"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2"
            />
          </label>
        </div>

        {/* AC-6. Tentative is INDEPENDENT of status: it changes how the entry is drawn and nothing
            else, it is counted in every calculation (INV-05), and it never makes an entry approved
            or pending. Nothing on this form writes `status`. */}
        <label className="flex items-center gap-2 text-sm">
          <input
            data-testid="new-entry-tentative"
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
            data-testid="new-entry-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2"
          />
        </label>

        {state.phase === "editing" && state.error ? (
          <p data-testid="new-entry-error" role="alert" className="text-sm text-rose-600">
            {state.error.message}
          </p>
        ) : null}

        <button
          data-testid="new-entry-submit"
          type="submit"
          disabled={!complete || submitting}
          className="rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-40"
        >
          {submitting ? "Đang lưu…" : "Lưu đăng ký"}
        </button>
      </form>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium opacity-70">Đăng ký của bạn</h2>

        {own.length === 0 ? (
          <p
            data-testid="own-entries-empty"
            className="rounded-2xl bg-white p-8 text-center text-sm opacity-70 shadow-sm"
          >
            Bạn chưa có đăng ký nào.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {own.map((entry) => (
              <li
                key={entry.id}
                data-testid="own-entry-row"
                data-type={entry.type}
                data-portion={entry.portion}
                data-status={entry.status}
                className="flex flex-wrap items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm shadow-sm"
              >
                {/* BOTH BOUNDS ARE RENDERED, even for a single-day entry, as `d → d`. A single date
                    shown once would make AC-3's inclusivity unobservable on exactly the case where an
                    off-by-one is easiest to introduce. The strings are rendered as they arrive: no
                    `new Date(...)` anywhere, because `new Date('2026-04-30')` parses as UTC midnight
                    and a day-of-month read west of UTC yields the previous day (plan section 4.5). */}
                <span data-testid="own-entry-row-dates" className="font-medium">
                  {entry.startDate} → {entry.endDate}
                </span>
                <span data-testid="own-entry-row-type" className="opacity-70">
                  {TYPE_LABELS[entry.type]}
                </span>
                <span data-testid="own-entry-row-portion" className="opacity-70">
                  {PORTION_LABELS[entry.portion]}
                </span>
                {entry.tentative ? (
                  <span data-testid="own-entry-row-tentative" className="opacity-70">
                    Chưa chắc chắn
                  </span>
                ) : null}
                {entry.note ? <span className="opacity-70">{entry.note}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
