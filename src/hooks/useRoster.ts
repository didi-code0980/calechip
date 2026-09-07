// UIE-02 — the sidebar's roster. 01-plan.md § 4.4 is the contract this file implements.
//
// **ONE SEAM CALL AND NO WRITE.** `seam.listMembers()`, once, on mount. It is a read the member
// list screen already makes (`src/routes/MemberList.tsx:53`) and all three period screens make,
// under `member_select_team`, which admits both roles and scopes rows to the caller's own team
// inside the policy body. This ticket adds no capability to either role (01-plan.md § 3).
//
// The seam, through its one door. This file must never import `../lib/data/supabase` or
// `../lib/data/mock` (RULE-02).
import { useEffect, useState } from "react";
import { seam } from "@/lib/data";
import type { Member } from "@/lib/domain/types";

/**
 * Three phases, and they are three for the reason `MemberList.tsx`, `WeekView.tsx` and
 * `MonthView.tsx` all record: "still loading" and "the read failed" are different facts from "the
 * team is empty", and folding any two of them tells somebody something untrue.
 *
 * There is deliberately no `not-on-a-team` phase here, unlike `MemberList.tsx`. The sidebar renders
 * only inside the shell, and the shell renders only when `App.tsx` has already resolved the
 * membership to `member` — so the caller HAS a member row by the time this hook runs, and a fourth
 * phase would be a state no render can reach.
 */
export type RosterState =
  | { phase: "loading" }
  | { phase: "unavailable" }
  | { phase: "ready"; members: Member[] };

/**
 * The sidebar's roster. Exactly one seam call, `seam.listMembers()`, on mount.
 *
 * `members` holds ONLY rows whose `removedAt` is null. The seam deliberately returns removed
 * members carrying `removedAt` (ADR-013) because the counting functions need them; which rows a
 * screen draws is a display decision above the seam, and this is that decision — the same one
 * `src/routes/MemberList.tsx:179` already makes, and it must not be pushed below the seam.
 *
 * `listMembers()` THROWS on a transport failure and on a possibly-truncated answer, and returns
 * `[]` to a caller with no member row. `unavailable` is the throw; `[]` is a normal answer. AC-10
 * is why the distinction is kept: a roster that failed must not read as a team of nobody, and the
 * count is INV-04's denominator everywhere else in the product.
 */
export function useRoster(): RosterState {
  const [state, setState] = useState<RosterState>({ phase: "loading" });

  useEffect(() => {
    // The mounted flag, not an AbortController: `listMembers()` returns a promise and takes no
    // signal, so the only thing to cancel is the setState after an unmount.
    let live = true;

    async function load(): Promise<void> {
      try {
        const members = await seam.listMembers();
        if (live)
          setState({
            phase: "ready",
            members: members.filter((m) => m.removedAt === null),
          });
      } catch {
        if (live) setState({ phase: "unavailable" });
      }
    }

    void load();
    return () => {
      live = false;
    };
  }, []);

  return state;
}
