// CAL-02 — edit one of the caller's own entries. 01-plan.md sections 2 and 4.3.
//
// EVERYTHING here is an affordance (ADR-005). `entry_update_own` is what decides whose entry may be
// edited (AC-9), the update grant's column list is what refuses `member_id`, `status` and
// `rejection_reason` (AC-8, AC-10), `entry_no_overlapping_portion` is INV-01 and AC-7, and
// `entry_enforce_decision()` is INV-02 and AC-5 and AC-6. This screen implements none of them; it
// shows what the datastore answered.
//
// **THE ENTRY IS LOADED FROM `listOwnEntries` AND THERE IS NO SECOND READ.** One function, one
// policy path, and the entry a member may edit is by definition one of their own — a `getEntryById`
// would be a read whose only distinct behaviour is answering about rows the caller may not edit
// (01-plan.md section 4.3). It also makes `edit-entry-not-found` say nothing about whether the id
// exists: not in your list and no such entry are one answer here, as they are in the seam.
//
// **NOTHING ON THIS SCREEN WRITES `status`.** The status is displayed because AC-5 and AC-6 turn on
// it — a substantive edit returns an approved entry to pending and a note-only edit does not — and a
// member who cannot see that would have to be told by an admin. Approving is ADM-05.
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import EntryForm from "@/components/EntryForm";
import type { EntryFormValues } from "@/components/EntryForm";
import { seam } from "@/lib/data";
import type { Entry, EntryStatus, Failure } from "@/lib/domain/types";

const STATUS_LABELS: Record<EntryStatus, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Bị từ chối",
};

// Three states and not two. "Still loading" and "no such entry of yours" are different facts, and
// rendering the refusal while the read is in flight would show `edit-entry-not-found` on every load
// of a perfectly valid entry — the same reason App.tsx separates `resolving` from `signed-out`.
type LoadState =
  | { phase: "loading" }
  | { phase: "missing" }
  | { phase: "ready"; entry: Entry };

export default function EditEntry() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<LoadState>({ phase: "loading" });

  const load = useCallback(async (): Promise<void> => {
    if (!id) {
      setState({ phase: "missing" });
      return;
    }

    try {
      const own = await seam.listOwnEntries();
      const entry = own.find((e) => e.id === id);
      setState(entry ? { phase: "ready", entry } : { phase: "missing" });
    } catch {
      // `listOwnEntries` throws on a transport failure and on a possibly-truncated read. Neither has
      // an acceptance criterion here, and the honest consequence is the same refusal a missing entry
      // gets: this screen has nothing to edit either way.
      setState({ phase: "missing" });
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // AC-1, AC-2, AC-5, AC-6, AC-7, AC-11, AC-12. The updated row is re-read rather than assumed: the
  // TRIGGER may have rewritten `status`, `approved_by`, `approved_at` and `updated_at` on the way
  // through, and a screen that painted the values it sent would show an entry as still approved
  // after the datastore had returned it to pending.
  async function onSave(values: EntryFormValues): Promise<Failure | null> {
    if (!id) return { code: "entry_not_permitted", message: "Không sửa được đăng ký này." };

    const result = await seam.updateEntry(id, values);
    if (!result.ok) return result.error;

    setState({ phase: "ready", entry: result.value });
    return null;
  }

  if (state.phase === "loading") {
    return (
      <p
        data-testid="edit-entry-loading"
        role="status"
        className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center text-sm opacity-70 shadow-sm"
      >
        Đang tải…
      </p>
    );
  }

  // AC-9's read half. It says nothing about whether the id exists — a message distinguishing "not
  // yours" from "no such entry" would be an oracle for which entry ids exist in the team, which is
  // the property `updateEntry`'s single failure code protects one layer down.
  if (state.phase === "missing") {
    return (
      <section
        data-testid="edit-entry-not-found"
        className="mx-auto flex max-w-xl flex-col gap-4 rounded-2xl bg-white p-8 text-center text-sm shadow-sm"
      >
        <p>Không tìm thấy đăng ký này trong danh sách của bạn.</p>
        <p>
          <Link data-testid="edit-entry-back" to="/entries/new" className="underline">
            Về danh sách đăng ký của bạn
          </Link>
        </p>
      </section>
    );
  }

  const { entry } = state;

  return (
    <section className="mx-auto flex max-w-xl flex-col gap-4">
      <EntryForm
        testIdPrefix="edit-entry"
        title="Sửa đăng ký"
        submitLabel="Lưu thay đổi"
        submittingLabel="Đang lưu…"
        initial={{
          type: entry.type,
          portion: entry.portion,
          startDate: entry.startDate,
          endDate: entry.endDate,
          tentative: entry.tentative,
          note: entry.note,
        }}
        afterSubmit="keep"
        onSubmit={onSave}
      />

      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-white px-4 py-3 text-sm shadow-sm">
        {/* AC-5 and AC-6. The status as the datastore returned it after the write, which is how a
            member sees that a substantive edit cost them an approval and a note-only edit did not. */}
        <span data-testid="edit-entry-status" data-status={entry.status} className="opacity-70">
          {STATUS_LABELS[entry.status]}
        </span>

        {/* Present ONLY when the entry names an approver. Its absence after a substantive edit is
            half of AC-5: `entry_enforce_decision()` clears `approved_by` and `approved_at` together
            with the status, and an entry that still named its approver while reading `pending` is
            the false record INV-02 exists to prevent. */}
        {entry.approvedBy ? (
          <span
            data-testid="edit-entry-approved-by"
            data-approved-by={entry.approvedBy}
            data-approved-at={entry.approvedAt ?? ""}
            className="opacity-70"
          >
            Đã duyệt bởi {entry.approvedBy}
          </span>
        ) : null}

        {/* AC-12, carried as attributes for the same reason the own-entry row carries them. */}
        <span
          data-testid="edit-entry-timestamps"
          data-created-at={entry.createdAt}
          data-updated-at={entry.updatedAt}
          className="opacity-70"
        >
          Sửa lần cuối: {entry.updatedAt}
        </span>

        <Link data-testid="edit-entry-back" to="/entries/new" className="ml-auto underline">
          Về danh sách
        </Link>
      </div>
    </section>
  );
}
