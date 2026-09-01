// TEA-03 — Team member list. 02-design.md sections 1.3, 2 and 6.
//
// EVERYTHING in this file is an affordance (ADR-005). The check lives in row-level security and
// nowhere else: `member_select_team` scopes the rows to the caller's own team and `member_select_own`
// returns a removed caller their own row, whoever issues the statement. There is no add, edit, remove
// or promote control here — not because they are hidden, but because they do not exist on this
// screen. TEA-04 owns the two that will, and it adds the policies for them (AC-5).
import { useCallback, useEffect, useState } from "react";
// The seam, through its one door. 02-design.md section 6.2: nothing above the seam names an
// implementation, and this file must never import `./supabase` or `./mock`.
import { seam } from "@/lib/data";
import type { Member, MemberRole } from "@/lib/domain/types";

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

  const { roster } = view;

  // AC-4, second half. The READ deliberately returns removed members carrying `removedAt` — ADR-013
  // and the INV-04 note require the counting function to be given the roster with `removedAt` per
  // member — and this line is where they stop being drawn. It is a display decision and NOT an
  // affordance: nothing about it enforces a permission. Do not push it below the seam.
  const current = roster.filter((m) => m.removedAt === null);

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold">Thành viên trong nhóm</h1>
        <p className="mt-2 text-sm opacity-70">
          Ai đang ở trong nhóm, và ai là quản trị viên. Trang này chỉ để xem.
        </p>
      </header>

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
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
