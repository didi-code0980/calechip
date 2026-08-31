// TEA-02 — Manage the allow-list. 02-design.md sections 1.3, 2 and 6.
//
// EVERYTHING in this file is an affordance (ADR-005). The check lives in row-level security and
// nowhere else: `allowed_email_select_admin`, `allowed_email_insert_admin` and
// `allowed_email_delete_admin_unconsumed` refuse a non-admin, another team and a consumed entry
// whoever issues the statement. What is below hides controls the policy would refuse anyway, which
// saves a round trip and says why — it enforces nothing.
import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
// The seam, through its one door. 02-design.md section 6.2: nothing above the seam names an
// implementation, and this file must never import `./supabase` or `./mock`.
import { seam } from "@/lib/data";
import type { AllowedEmail, AllowedEmailState, Failure, Member } from "@/lib/domain/types";

/** AC-1. Derived from `consumedAt` and never stored — .ai/standards/coding-standards.md forbids
 *  caching a value an invariant defines as derived, and this is the same rule one size down. */
const stateOf = (entry: AllowedEmail): AllowedEmailState =>
  entry.consumedAt === null ? "open" : "joined";

const day = (iso: string): string => format(new Date(iso), "dd/MM/yyyy");

// The four states of design section 1.3. `loading` MUST resolve, which is why every path out of the
// effect below sets one of the other three.
type View =
  | { phase: "loading" }
  | { phase: "refused" }
  | { phase: "ready"; me: Member; entries: AllowedEmail[] };

export default function AllowList() {
  const [view, setView] = useState<View>({ phase: "loading" });

  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<Failure | null>(null);

  const [pending, setPending] = useState<AllowedEmail | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<Failure | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const me = await seam.getCurrentMember();

      // AC-9. The affordance over AC-8: a member is shown no list and no form. The policy already
      // returns them zero rows and refuses both writes; this only stops them staring at an empty
      // table wondering what they did wrong.
      if (!me || me.role !== "admin") {
        setView({ phase: "refused" });
        return;
      }

      setView({ phase: "ready", me, entries: await seam.listAllowedEmails() });
    } catch {
      // A transport failure, or the Supabase client raising on an unusable configuration before any
      // request leaves — the throw SignUp.tsx already had to handle. Design section 1.3 gives this
      // screen four states and no error state, so the choice is which of them a broken connection
      // lands on, and `refused` is the one that fails CLOSED. It is not a true sentence about
      // permission and it is the safe one; an error state is the honest fix and belongs to whoever
      // adds the second screen that needs it.
      setView({ phase: "refused" });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (adding || !email.trim()) return;

    setAdding(true);
    setAddError(null);
    try {
      // AC-2, AC-4. No team is passed and none can be: the seam reads it from the caller's own row
      // and the policy re-derives it. AC-5 arrives back as `already_allow_listed` from the primary
      // key rather than from a lookup this screen does first.
      const result = await seam.addAllowedEmail({ email: email.trim() });
      if (result.ok) {
        setEmail("");
        await load();
      } else {
        setAddError(result.error);
      }
    } catch {
      setAddError({ code: "unknown", message: "Không thêm được địa chỉ. Thử lại giúp mình nhé." });
    } finally {
      setAdding(false);
    }
  }

  async function onConfirmRemove() {
    if (!pending || removing) return;

    setRemoving(true);
    setRemoveError(null);
    try {
      const result = await seam.removeAllowedEmail(pending.email);
      if (result.ok) {
        setPending(null);
        await load();
      } else {
        // The dialog STAYS OPEN on a refusal. Design section 6 names no selector for a remove
        // failure, so this sentence is reachable only inside `allow-list-remove-confirm` — which is
        // also the only place it makes sense, since the row it is about is named right above it.
        setRemoveError(result.error);
      }
    } catch {
      setRemoveError({ code: "unknown", message: "Không gỡ được địa chỉ. Thử lại giúp mình nhé." });
    } finally {
      setRemoving(false);
    }
  }

  if (view.phase === "loading") {
    return (
      <p
        data-testid="allow-list-loading"
        role="status"
        className="mx-auto max-w-2xl rounded-2xl bg-white p-8 text-center text-sm opacity-70 shadow-sm"
      >
        Đang mở danh sách…
      </p>
    );
  }

  if (view.phase === "refused") {
    return (
      <section
        data-testid="allow-list-refused"
        className="mx-auto max-w-2xl rounded-2xl bg-white p-8 text-center shadow-sm"
      >
        <h1 className="text-xl font-semibold">Trang này dành cho quản trị viên</h1>
        <p className="mt-2 text-sm opacity-70">
          Danh sách địa chỉ được phép vào nhóm chỉ quản trị viên mới xem và sửa được.
        </p>
      </section>
    );
  }

  const { me, entries } = view;

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold">Danh sách được phép vào nhóm</h1>
        {/* AC-10. Permanent, and it is the whole of that criterion: ADR-009 sends nothing to the
            address, so the screen has to say so where an admin will otherwise wait for an
            invitation that is never coming. */}
        <p
          data-testid="allow-list-no-email-notice"
          className="mt-2 rounded-xl bg-violet-100 px-4 py-2 text-sm text-violet-900"
        >
          Hệ thống không gửi email hay thông báo nào cho địa chỉ này. Bạn nhớ tự báo cho người đó vào
          đăng ký nhé.
        </p>
      </header>

      <form
        onSubmit={onAdd}
        className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm"
        aria-label="Thêm địa chỉ"
      >
        <label className="flex flex-col gap-1 text-sm">
          Địa chỉ email
          <input
            data-testid="allow-list-add-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2"
          />
        </label>

        {addError ? (
          <p data-testid="allow-list-add-error" role="alert" className="text-sm text-rose-600">
            {addError.message}
          </p>
        ) : null}

        <button
          data-testid="allow-list-add-submit"
          type="submit"
          disabled={adding || !email.trim()}
          className="self-start rounded-xl bg-slate-900 px-4 py-2 text-white disabled:opacity-40"
        >
          {adding ? "Đang thêm…" : "Thêm địa chỉ"}
        </button>
      </form>

      {entries.length === 0 ? (
        <p
          data-testid="allow-list-empty"
          className="rounded-2xl bg-white p-8 text-center text-sm opacity-70 shadow-sm"
        >
          Chưa có địa chỉ nào trong danh sách. Thêm một địa chỉ ở trên để mời người đầu tiên.
        </p>
      ) : (
        <table data-testid="allow-list-table" className="w-full rounded-2xl bg-white shadow-sm">
          <thead>
            <tr className="text-left text-xs uppercase opacity-60">
              <th className="px-4 py-3 font-medium">Địa chỉ</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
              <th className="px-4 py-3 font-medium">Ai thêm, khi nào</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const state = stateOf(entry);
              return (
                <tr
                  key={entry.email}
                  data-testid="allow-list-row"
                  data-email={entry.email}
                  data-state={state}
                  className="border-t border-slate-100 text-sm"
                >
                  <td className="px-4 py-3">{entry.email}</td>
                  <td className="px-4 py-3">
                    <span
                      data-testid="allow-list-row-state"
                      className={
                        state === "open"
                          ? "rounded-full bg-emerald-100 px-3 py-1 text-emerald-900"
                          : "rounded-full bg-slate-100 px-3 py-1 text-slate-600"
                      }
                    >
                      {state === "open" ? "Chưa vào" : "Đã vào"}
                    </span>
                  </td>
                  {/* AC-1. `addedBy` is a member id and there is no seam function that turns one
                      into a name — the member list is TEA-03. The caller's own id is the one this
                      screen can resolve honestly, so it does that and shows the id otherwise. */}
                  <td data-testid="allow-list-row-added-by" className="px-4 py-3 opacity-70">
                    {entry.addedBy === me.id ? "Bạn" : entry.addedBy} · {day(entry.addedAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {/* AC-7, as an affordance ONLY: a `joined` row gets no remove control, and the
                        delete policy refuses it independently for anybody who issues one anyway. */}
                    {state === "open" ? (
                      <button
                        data-testid="allow-list-row-remove"
                        type="button"
                        onClick={() => {
                          setRemoveError(null);
                          setPending(entry);
                        }}
                        className="rounded-xl border border-rose-200 px-3 py-1 text-rose-700"
                      >
                        Gỡ
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* .ai/standards/ui-design-system.md, Destructive actions: the confirmation NAMES what is
          about to be lost, and "Are you sure?" names nothing. Removing an unconsumed entry loses the
          invitation and nothing else, so the address is the whole of what there is to name. */}
      {pending ? (
        <div
          data-testid="allow-list-remove-confirm"
          role="dialog"
          aria-modal="true"
          aria-label="Xác nhận gỡ địa chỉ"
          className="rounded-2xl bg-white p-6 shadow-sm"
        >
          <p className="text-sm">
            Gỡ <strong>{pending.email}</strong> khỏi danh sách? Người này sẽ không đăng ký vào nhóm
            được nữa cho tới khi bạn thêm lại địa chỉ.
          </p>

          {removeError ? (
            <p role="alert" className="mt-2 text-sm text-rose-600">
              {removeError.message}
            </p>
          ) : null}

          <div className="mt-4 flex gap-2">
            <button
              data-testid="allow-list-remove-confirm-accept"
              type="button"
              disabled={removing}
              onClick={onConfirmRemove}
              className="rounded-xl bg-rose-600 px-4 py-2 text-white disabled:opacity-40"
            >
              {removing ? "Đang gỡ…" : "Gỡ địa chỉ"}
            </button>
            <button
              data-testid="allow-list-remove-confirm-cancel"
              type="button"
              disabled={removing}
              onClick={() => {
                setRemoveError(null);
                setPending(null);
              }}
              className="rounded-xl border border-slate-200 px-4 py-2 disabled:opacity-40"
            >
              Thôi
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
