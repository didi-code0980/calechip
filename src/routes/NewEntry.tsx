// CAL-01 — declare an absence or a work-from-home day, and CAL-02's own-entry list controls.
// CAL-01 01-plan.md sections 4.4 and 2; CAL-02 01-plan.md section 4.3.
//
// EVERYTHING here is an affordance (ADR-005). The controls are in the database and nowhere else:
// `entry_insert_own`'s `with check (member_id = auth.uid())` is CAL-01 AC-10, the insert grant's
// column list is CAL-01 AC-11, `entry_delete_own` is CAL-02 AC-9's delete half, and
// `entry_no_overlapping_portion` is INV-01. This screen refuses nobody holding a token.
//
// **THE EDIT AND DELETE CONTROLS ARE DRAWN ON EVERY ROW THIS LIST SHOWS, and that is correct
// precisely because the list shows only the caller's own rows.** `listOwnEntries` narrows the query
// to `member_id = auth.uid()`, which is itself an affordance — `entry_select_team` admits the whole
// team's rows. What stops a member deleting somebody else's entry is `entry_delete_own`, not the
// absence of a button (CAL-02 01-plan.md section 3).
//
// The form itself moved to src/components/EntryForm.tsx at CAL-02, unchanged and with its selectors
// intact, so the edit route renders the same six fields rather than a second copy of them.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import EntryForm, { PORTION_LABELS, TYPE_LABELS } from "@/components/EntryForm";
import type { EntryFormValues } from "@/components/EntryForm";
// The seam, through its one door. Nothing above the seam names an implementation, and this file must
// never import `./supabase` or `./mock` (RULE-02).
import { seam } from "@/lib/data";
import type { Entry, Failure } from "@/lib/domain/types";

export default function NewEntry() {
  const [own, setOwn] = useState<Entry[]>([]);

  // CAL-02. Which row is asking to be confirmed, and it is an id rather than a boolean: two rows
  // must never be able to hold the confirmation at once, and a boolean plus a separate id is two
  // pieces of state that can disagree.
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<Failure | null>(null);

  // The read is what makes every criterion observable from outside the system. A confirmation
  // message proves only that the form ran; the list proves what was stored — one row for a range and
  // not five (CAL-01 AC-2), the end date coming back inclusive (AC-3), the portion that was chosen
  // (AC-5), and after CAL-02 that an edit replaced a row rather than creating a second one (AC-1).
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

  async function onCreate(values: EntryFormValues): Promise<Failure | null> {
    const result = await seam.createEntry(values);
    if (!result.ok) return result.error;
    await load();
    return null;
  }

  // CAL-02 AC-3. The confirmation is not decoration: a hard delete has no undo and no trash, so the
  // second press is the only thing between a mis-click and a row that is gone with its approval.
  // `.ai/standards/ui-design-system.md` has a *Destructive actions* section which is still a stub,
  // so this is 01-plan.md section 4.3's decision rather than a citation.
  async function onDelete(entryId: string): Promise<void> {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);

    try {
      const result = await seam.deleteEntry(entryId);
      if (!result.ok) setDeleteError(result.error);
      else setConfirming(null);
      await load();
    } catch {
      setDeleteError({ code: "unknown", message: "Không xoá được đăng ký. Thử lại giúp mình nhé." });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="mx-auto flex max-w-xl flex-col gap-8">
      <EntryForm
        testIdPrefix="new-entry"
        title="Đăng ký nghỉ hoặc làm ở nhà"
        submitLabel="Lưu đăng ký"
        submittingLabel="Đang lưu…"
        initial={{
          type: "pto",
          portion: "full",
          startDate: "",
          endDate: "",
          tentative: false,
          note: null,
        }}
        afterSubmit="clear"
        onSubmit={onCreate}
      />

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium opacity-70">Đăng ký của bạn</h2>

        {deleteError ? (
          <p data-testid="own-entry-delete-error" role="alert" className="text-sm text-rose-600">
            {deleteError.message}
          </p>
        ) : null}

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
                /* CAL-02 AC-12. The two timestamps as the datastore returned them, carried as
                   attributes rather than rendered: an edit must move `updated_at` past `created_at`,
                   and the year view has no room for two timestamps on a row. Declared in
                   03-impl-log.md as an addition beyond 01-plan.md section 4.3's selector table. */
                data-created-at={entry.createdAt}
                data-updated-at={entry.updatedAt}
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

                {/* CAL-02. The row's status, carried as an attribute AND shown, because an edit that
                    returns an approved entry to pending (AC-5) has to be visible to the person who
                    made it rather than only to a test. */}
                <span
                  data-testid="own-entry-row-status"
                  data-status={entry.status}
                  className="opacity-70"
                >
                  {entry.status === "approved"
                    ? "Đã duyệt"
                    : entry.status === "rejected"
                      ? "Bị từ chối"
                      : "Chờ duyệt"}
                </span>

                <span className="ml-auto flex items-center gap-3">
                  <Link
                    data-testid="own-entry-row-edit"
                    to={`/entries/${entry.id}/edit`}
                    className="underline"
                  >
                    Sửa
                  </Link>

                  {confirming === entry.id ? (
                    <>
                      <button
                        data-testid="own-entry-delete-confirm"
                        type="button"
                        disabled={deleting}
                        onClick={() => void onDelete(entry.id)}
                        className="rounded-lg bg-rose-600 px-2 py-1 text-white disabled:opacity-40"
                      >
                        {deleting ? "Đang xoá…" : "Xoá hẳn"}
                      </button>
                      <button
                        data-testid="own-entry-delete-cancel"
                        type="button"
                        disabled={deleting}
                        onClick={() => setConfirming(null)}
                        className="underline disabled:opacity-40"
                      >
                        Thôi
                      </button>
                    </>
                  ) : (
                    <button
                      data-testid="own-entry-row-delete"
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setConfirming(entry.id);
                      }}
                      className="underline"
                    >
                      Xoá
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
