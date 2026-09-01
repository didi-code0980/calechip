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
import { seam } from "@/lib/data";
import type { Failure, Member, MemberRole } from "@/lib/domain/types";

/** AC-1, AC-3. `role` is DISPLAYED and never acted on: two roles exist and a roster that does not
 *  say which of the two each person is leaves a member with no way to see whom to ask. */
const roleLabel = (role: MemberRole): string =>
  role === "admin" ? "Quản trị viên" : "Thành viên";

// The four states of design section 1.3. `loading` MUST resolve, which is why every path out of the
// effect below sets one of the other three.
type View =
  | { phase: "loading" }
  | { phase: "notOnATeam" } // AC-7
  | { phase: "unavailable" } // AC-8, and any throw from the read
  | { phase: "ready"; me: Member; roster: Member[] }; // AC-1, AC-3, AC-4

export default function MemberList() {
  const [view, setView] = useState<View>({ phase: "loading" });

  // TEA-04, 01-plan.md section 4.3. Three pieces of local state, following AllowList.tsx: the row
  // awaiting confirmation, whether a write is in flight, and the typed failure from either write.
  const [pending, setPending] = useState<Member | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<Failure | null>(null);

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

      setView({ phase: "ready", me, roster: await seam.listMembers() });
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
        message: "Chưa thăng quyền được. Thử lại giúp mình nhé.",
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
      setActionError({ code: "unknown", message: "Chưa gỡ được thành viên. Thử lại giúp mình nhé." });
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
        Đang mở danh sách nhóm…
      </p>
    );
  }

  if (view.phase === "notOnATeam") {
    return (
      <section
        data-testid="member-list-not-on-a-team"
        className="mx-auto max-w-2xl rounded-2xl bg-white p-8 text-center shadow-sm"
      >
        <h1 className="text-xl font-semibold">Bạn chưa ở trong nhóm nào</h1>
        <p className="mt-2 text-sm opacity-70">
          Tài khoản này chưa được thêm vào nhóm nào, nên chưa có danh sách thành viên để xem. Nhờ
          quản trị viên thêm địa chỉ của bạn vào danh sách được phép vào nhóm nhé.
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
        <h1 className="text-xl font-semibold">Chưa đọc được danh sách nhóm</h1>
        <p className="mt-2 text-sm opacity-70">
          Danh sách có thể chưa đầy đủ nên mình không hiển thị một phần. Thử tải lại trang giúp mình
          nhé.
        </p>
      </section>
    );
  }

  const { me, roster } = view;

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
    <section className="mx-auto flex max-w-2xl flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold">Thành viên trong nhóm</h1>
        {/* TEA-04. "Trang này chỉ để xem" was true until this ticket and is now true for a member
            only — an admin has two controls on it. A standing sentence that stopped being true for
            half the readers is worse than no sentence. */}
        <p className="mt-2 text-sm opacity-70">
          {me.role === "admin"
            ? "Ai đang ở trong nhóm, và ai là quản trị viên. Bạn có thể gỡ thành viên khỏi nhóm hoặc thăng quyền quản trị viên."
            : "Ai đang ở trong nhóm, và ai là quản trị viên. Trang này chỉ để xem."}
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
          Chưa có thành viên nào đang ở trong nhóm.
        </p>
      ) : (
        <table data-testid="member-list-table" className="w-full rounded-2xl bg-white shadow-sm">
          <thead>
            <tr className="text-left text-xs uppercase opacity-60">
              <th className="px-4 py-3 font-medium">Ảnh đại diện</th>
              <th className="px-4 py-3 font-medium">Tên</th>
              <th className="px-4 py-3 font-medium">Vai trò</th>
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
                className="border-t border-slate-100 text-sm"
              >
                <td data-testid="member-list-row-avatar" className="px-4 py-3 text-xl">
                  {member.avatar}
                </td>
                <td data-testid="member-list-row-name" className="px-4 py-3">
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
                        ? "rounded-full bg-violet-100 px-3 py-1 text-violet-900"
                        : "rounded-full bg-slate-100 px-3 py-1 text-slate-600"
                    }
                  >
                    {roleLabel(member.role)}
                  </span>
                </td>
                {/* AC-13, AC-14, as affordances ONLY. A member's view draws neither control; an
                    admin's own row draws neither; an admin row draws remove and not promote. The
                    policy and the trigger refuse each of those independently for anybody who
                    issues the statement anyway (ADR-005). */}
                <td className="px-4 py-3 text-right">
                  <span className="inline-flex gap-2">
                    {canPromote(member) ? (
                      <button
                        data-testid="member-list-row-promote"
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          void onPromote(member);
                        }}
                        className="rounded-xl border border-violet-200 px-3 py-1 text-violet-800 disabled:opacity-40"
                      >
                        Thăng quyền
                      </button>
                    ) : null}
                    {canRemove(member) ? (
                      <button
                        data-testid="member-list-row-remove"
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setActionError(null);
                          setPending(member);
                        }}
                        className="rounded-xl border border-rose-200 px-3 py-1 text-rose-700 disabled:opacity-40"
                      >
                        Gỡ khỏi nhóm
                      </button>
                    ) : null}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* AC-15, and .ai/standards/ui-design-system.md, Destructive actions: the confirmation NAMES
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
          aria-label="Xác nhận gỡ thành viên"
          className="rounded-2xl bg-white p-6 shadow-sm"
        >
          <p className="text-sm">
            Gỡ <strong>{pending.displayName}</strong> khỏi nhóm? Các đăng ký nghỉ/WFH của người này
            vẫn được giữ lại và vẫn hiển thị trên lịch.
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
              {busy ? "Đang gỡ…" : "Gỡ khỏi nhóm"}
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
              Thôi
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
