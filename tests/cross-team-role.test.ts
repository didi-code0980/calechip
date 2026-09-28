// SOLO, 2026-09-24 — ADR-044. An admin sets any member's rank, on any team.
//
// **THIS WORK CARRIES NO TICKET AND NO ACCEPTANCE CRITERIA**, so nothing here is numbered `AC-n`:
// that prefix is a claim that a plan document states the criterion. `.claude/agents/solo.md` and
// ADR-044 are the authority, and each test names the clause it asserts.
//
// **THE MOCK IS THE SUBJECT AND `public.set_member_role` IS WHAT IT REPRODUCES.** That function
// lives in `supabase/migrations/20260924100000_solo_cross_team_role.sql` and is exercised by NO test
// until a project is provisioned — RULE-09 keeps applying it human, and
// `tests/permission-model.test.ts` still does not exist (`.ai/standards/rbac-and-security.md`
// § Known weaknesses 1). What can be asserted here is that the mock admits where the function admits
// and refuses where it refuses, and that matters because the acceptance suite drives the mock.
//
// **THE DEFECT THIS FILE PINS.** Since `list_all_members()` shipped on 2026-09-11 the Members screen
// has listed every team, while the rank write was a table update admitted by `member_update_admin`,
// whose `using` carries `team_id = member_team_id(auth.uid())`. Pressing *Make manager* on another
// team's row sent a PATCH that matched no row, came back `[]`, and rendered *"That person's role
// could not be changed."* — a true sentence under a button that should not have been there. The
// first test below is that press, and it now succeeds.
//
// EVERY TEST RESTORES WHAT IT WROTE, except the last one, which cannot — see its own note. `members`
// is module state that lives for the whole file and the mock offers no reseed.
import { afterEach, describe, expect, it } from "vitest";
import { seam, __setCurrentMember } from "@/lib/data/mock";
import {
  FIXTURE_ADMIN,
  FIXTURE_MEMBER,
  FIXTURE_OTHER_TEAM_MEMBER,
  FIXTURE_REMOVED_MEMBER,
  FIXTURE_SECOND_ADMIN,
} from "@/lib/fixtures";

const as = (memberId: string | null): void => __setCurrentMember(memberId);

afterEach(() => __setCurrentMember(null));

/** Puts a rank back, as the admin, and fails loudly rather than leaving the roster changed. */
async function restore(memberId: string): Promise<void> {
  as(FIXTURE_ADMIN.id);
  const back = await seam.setMemberRole(memberId, "member");
  if (!back.ok) throw new Error(`could not restore the rank: ${back.error.code}`);
}

describe("ADR-044 — the rank write reaches every team", () => {
  it("an admin makes ANOTHER team's member a manager, and puts them back", async () => {
    // FIXTURE_ADMIN is on FIXTURE_TEAM; this person is not. Before ADR-044 this was the refusal.
    expect(FIXTURE_OTHER_TEAM_MEMBER.teamId).not.toBe(FIXTURE_ADMIN.teamId);

    as(FIXTURE_ADMIN.id);
    const promoted = await seam.setMemberRole(FIXTURE_OTHER_TEAM_MEMBER.id, "manager");

    expect(promoted.ok).toBe(true);
    if (promoted.ok) {
      expect(promoted.value.role).toBe("manager");
      // INV-07: the rank moved and the team did not. `set_member_role` writes one column.
      expect(promoted.value.teamId).toBe(FIXTURE_OTHER_TEAM_MEMBER.teamId);
    }

    // And it is readable back through the cross-team read, which is where a screen would find it.
    const roster = await seam.listMembersForTeam(FIXTURE_OTHER_TEAM_MEMBER.teamId ?? "");
    expect(roster.find((m) => m.id === FIXTURE_OTHER_TEAM_MEMBER.id)?.role).toBe("manager");

    await restore(FIXTURE_OTHER_TEAM_MEMBER.id);
  });

  it("the caller's own team still works, which is the half that was never broken", async () => {
    as(FIXTURE_ADMIN.id);
    const promoted = await seam.setMemberRole(FIXTURE_MEMBER.id, "manager");
    expect(promoted.ok).toBe(true);

    await restore(FIXTURE_MEMBER.id);
  });
});

describe("ADR-044 — who may call it is unchanged", () => {
  it("a member of another team cannot set anybody's rank", async () => {
    as(FIXTURE_OTHER_TEAM_MEMBER.id);

    const across = await seam.setMemberRole(FIXTURE_MEMBER.id, "manager");
    expect(across.ok).toBe(false);

    const own = await seam.setMemberRole(FIXTURE_OTHER_TEAM_MEMBER.id, "manager");
    expect(own.ok).toBe(false);
  });

  it("a manager cannot either — the rank still adds exactly one power and this is not it", async () => {
    as(FIXTURE_ADMIN.id);
    const promoted = await seam.setMemberRole(FIXTURE_MEMBER.id, "manager");
    if (!promoted.ok) throw new Error(`could not make a manager: ${promoted.error.code}`);

    try {
      as(FIXTURE_MEMBER.id);
      const result = await seam.setMemberRole(FIXTURE_OTHER_TEAM_MEMBER.id, "manager");
      expect(result.ok).toBe(false);
    } finally {
      await restore(FIXTURE_MEMBER.id);
    }
  });

  it("nobody at all is refused", async () => {
    as(null);
    const result = await seam.setMemberRole(FIXTURE_OTHER_TEAM_MEMBER.id, "manager");
    expect(result.ok).toBe(false);
  });
});

describe("ADR-044 — the four conditions the function's `where` carries", () => {
  it("an admin's rank cannot be changed, on any team — *Demote an admin to member* is not decided", async () => {
    as(FIXTURE_ADMIN.id);
    const result = await seam.setMemberRole(FIXTURE_SECOND_ADMIN.id, "member");
    expect(result.ok).toBe(false);

    const roster = await seam.listMembers();
    expect(roster.find((m) => m.id === FIXTURE_SECOND_ADMIN.id)?.role).toBe("admin");
  });

  it("somebody who has left the team cannot be given a rank", async () => {
    as(FIXTURE_ADMIN.id);
    const result = await seam.setMemberRole(FIXTURE_REMOVED_MEMBER.id, "manager");
    expect(result.ok).toBe(false);
  });

  it("an id that names nobody is refused, not silently ignored", async () => {
    as(FIXTURE_ADMIN.id);
    const result = await seam.setMemberRole("00000000-0000-4000-8000-000000000000", "manager");
    expect(result.ok).toBe(false);
  });

  // A PENDING SIGN-UP IS NOT ASSERTED HERE, and the omission is deliberate rather than a gap:
  // FIXTURE_PENDING_SIGNUP shares its literal id with FIXTURE_SECOND_ADMIN (fixtures.ts:158,206), a
  // pre-existing collision, and the mock's array puts the admin first — so a lookup by that id
  // returns the WRONG row and the test would pass for the wrong reason. The condition is
  // `status = 'approved'` in the function and `m.status === "approved"` in the mock, and it is read
  // in both places rather than asserted through a colliding fixture.
});

describe("ADR-044 — the boundary it did NOT cross", () => {
  it("removing somebody on another team is still refused: ADR-039 § Decision 1 does not list it", async () => {
    as(FIXTURE_ADMIN.id);
    const result = await seam.removeMember(FIXTURE_OTHER_TEAM_MEMBER.id);

    expect(result.ok).toBe(false);
    // `removeMember` is still `member_update_admin`'s, and `src/routes/MemberList.tsx` hides the
    // control on another team's row for exactly this reason.
    if (!result.ok) expect(result.error.code).toBe("not_permitted");
  });
});

describe("ADR-044 — promotion to admin takes the same road", () => {
  // **LAST IN THE FILE, AND IT HAS TO BE.** Promotion is one-way: there is no `demoteMember`, and
  // `set_member_role` refuses any row that is already `admin`, so this test cannot put back what it
  // writes. Every test above runs against a roster this one has not touched yet. A test added after
  // this line inherits an other-team member who is an admin.
  it("an admin promotes ANOTHER team's member to admin", async () => {
    as(FIXTURE_ADMIN.id);
    const result = await seam.promoteMember(FIXTURE_OTHER_TEAM_MEMBER.id);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.role).toBe("admin");

    // And it is now irreversible, which is the same sentence TEA-04 AC-5 has always carried.
    const back = await seam.setMemberRole(FIXTURE_OTHER_TEAM_MEMBER.id, "member");
    expect(back.ok).toBe(false);
  });
});
