// CAL-04 — INV-04, at the level the standard assigns it.
//
// `.ai/standards/testing-standards.md` puts "pure logic" at the unit level and rendering at the
// end-to-end one, and `absenceCountsFor` is the purest thing in this product: it fetches nothing,
// holds no state, and every acceptance criterion about WHAT a day costs is a call to it with rows.
// The criteria about what a day LOOKS like are in tests/e2e/cal-04-month-view.spec.ts.
//
// **The entries below are constructed here rather than imported, and that is a declared deviation
// from § Fixtures** (03-impl-log.md). The standard forbids inventing entities inline because a
// fixture that lives in one test file drifts from `supabase/seed.sql`. These are not entities: they
// are the ARGUMENTS of a pure function, and the six shapes INV-04 distinguishes — rejected,
// tentative, half-day, owned by a removed member, spanning the range boundary — do not exist in the
// seed and cannot be added to it, because `supabase/seed.sql` is not in this ticket's
// `allowed_paths` and a fixture with no seed row behind it is exactly the drift the rule forbids.
// Every MEMBER below is imported from the shared module, because members are entities and the
// removal rule turns on a real `removedAt`.
//
// The one seeded entry that does exist, FIXTURE_APPROVED_ENTRY, is imported and used as the base
// every variation spreads from — so the shape stays the seed's even where the values differ.
import { describe, expect, it } from "vitest";
import {
  absenceCountsFor,
  absentMembersFor,
  addDays,
  currentMemberCount,
  eachDateInRange,
  isOverloaded,
  overlapsRange,
} from "@/lib/data/absence";
import {
  FIXTURE_ADMIN,
  FIXTURE_APPROVED_ENTRY,
  FIXTURE_APPROVED_MEMBER,
  FIXTURE_MEMBER,
  FIXTURE_REMOVED_MEMBER,
  FIXTURE_SECOND_ADMIN,
  FIXTURE_TEAM,
} from "@/lib/fixtures";
import type { DateRange, Entry, Member } from "@/lib/domain/types";

/** April 2026, the month 01-plan.md section 2 writes every criterion against. */
const APRIL: DateRange = { start: "2026-04-01", end: "2026-04-30" };

/** The team as the seam returns it: REMOVED MEMBERS INCLUDED. ADR-013 needs `removedAt` per member
 *  to decide each date, so a pre-filtered roster cannot answer AC-6. */
const ROSTER: readonly Member[] = [
  FIXTURE_ADMIN,
  FIXTURE_MEMBER,
  FIXTURE_SECOND_ADMIN,
  FIXTURE_APPROVED_MEMBER,
  FIXTURE_REMOVED_MEMBER,
];

let serial = 0;
/** One entry, spread from the seeded row so the shape is the seed's. */
const entry = (fields: Partial<Entry>): Entry => ({
  ...FIXTURE_APPROVED_ENTRY,
  id: `ff000000-0000-4000-8000-${String(++serial).padStart(12, "0")}`,
  status: "pending",
  approvedBy: null,
  approvedAt: null,
  ...fields,
});

const on = (counts: ReadonlyMap<string, number>, date: string): number | undefined => counts.get(date);
const avatarsOn = (
  members: ReadonlyMap<string, readonly Member[]>,
  date: string,
): readonly string[] => (members.get(date) ?? []).map((m) => m.id);

describe("the date vocabulary", () => {
  // Not decoration. `new Date('2026-04-30')` parses as UTC midnight and a local day-of-month read
  // west of UTC yields the previous day, which is the trap CAL-01 01-plan.md section 4.5 recorded
  // and the reason every helper in @/lib/data/absence converts through UTC. A machine set to
  // America/Los_Angeles fails this line if any of them ever reads locally.
  it("crosses a month boundary and a leap day without drifting", () => {
    expect(addDays("2026-04-30", 1)).toBe("2026-05-01");
    expect(addDays("2026-05-01", -1)).toBe("2026-04-30");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("walks a range inclusively at both ends, and answers nothing for an inverted one", () => {
    expect(eachDateInRange({ start: "2026-04-06", end: "2026-04-08" })).toEqual([
      "2026-04-06",
      "2026-04-07",
      "2026-04-08",
    ]);
    expect(eachDateInRange({ start: "2026-04-08", end: "2026-04-06" })).toEqual([]);
    expect(eachDateInRange(APRIL)).toHaveLength(30);
  });

  it("overlaps rather than contains", () => {
    // The case AC-2 turns on: an entry that starts in March and ends in April belongs to April.
    const across = entry({ startDate: "2026-03-28", endDate: "2026-04-02" });
    expect(overlapsRange(across, APRIL)).toBe(true);
    expect(overlapsRange(entry({ startDate: "2026-03-01", endDate: "2026-03-31" }), APRIL)).toBe(false);
    expect(overlapsRange(entry({ startDate: "2026-05-01", endDate: "2026-05-02" }), APRIL)).toBe(false);
  });
});

describe("AC-2: an absent member's avatar appears on every date their entry covers", () => {
  it("draws the avatar on each date of the range and on no other", () => {
    const rows = [
      entry({ memberId: FIXTURE_MEMBER.id, startDate: "2026-04-13", endDate: "2026-04-15" }),
    ];
    const members = absentMembersFor(rows, APRIL, ROSTER);

    expect(avatarsOn(members, "2026-04-12")).toEqual([]);
    expect(avatarsOn(members, "2026-04-13")).toEqual([FIXTURE_MEMBER.id]);
    expect(avatarsOn(members, "2026-04-14")).toEqual([FIXTURE_MEMBER.id]);
    expect(avatarsOn(members, "2026-04-15")).toEqual([FIXTURE_MEMBER.id]);
    expect(avatarsOn(members, "2026-04-16")).toEqual([]);
  });

  it("clamps an entry that starts before the range to the dates inside it", () => {
    const rows = [
      entry({ memberId: FIXTURE_MEMBER.id, startDate: "2026-03-28", endDate: "2026-04-02" }),
    ];
    const counts = absenceCountsFor(rows, APRIL, ROSTER);

    // No key outside the requested range, ever — the contract on `AbsenceCounts`.
    expect(counts.size).toBe(30);
    expect(counts.has("2026-03-28")).toBe(false);
    expect(on(counts, "2026-04-01")).toBe(1);
    expect(on(counts, "2026-04-02")).toBe(1);
    expect(on(counts, "2026-04-03")).toBe(0);
  });
});

describe("AC-3: 1 per full day, 0.5 per half day, PTO and WFH alike", () => {
  it("sums a full day and a morning to 1.5", () => {
    const rows = [
      entry({ memberId: FIXTURE_MEMBER.id, portion: "full", startDate: "2026-04-14", endDate: "2026-04-14" }),
      entry({ memberId: FIXTURE_ADMIN.id, portion: "am", startDate: "2026-04-14", endDate: "2026-04-14" }),
    ];
    expect(on(absenceCountsFor(rows, APRIL, ROSTER), "2026-04-14")).toBe(1.5);
  });

  it("weighs WFH exactly as it weighs PTO", () => {
    const pto = [entry({ memberId: FIXTURE_MEMBER.id, type: "pto", startDate: "2026-04-14", endDate: "2026-04-14" })];
    const wfh = [entry({ memberId: FIXTURE_MEMBER.id, type: "wfh", startDate: "2026-04-14", endDate: "2026-04-14" })];

    expect(on(absenceCountsFor(wfh, APRIL, ROSTER), "2026-04-14")).toBe(
      on(absenceCountsFor(pto, APRIL, ROSTER), "2026-04-14"),
    );
  });

  it("counts one member's morning and afternoon as one whole day and draws them once", () => {
    // INV-01 permits this pair — `am` and `pm` do not share a slot — and it is the only way one
    // member reaches 1.0 through two rows. A count of 1.5 here would mean the weights were summed
    // per ROW where the avatar rule is per PERSON, and the two would then disagree.
    const rows = [
      entry({ memberId: FIXTURE_MEMBER.id, portion: "am", startDate: "2026-04-14", endDate: "2026-04-14" }),
      entry({ memberId: FIXTURE_MEMBER.id, portion: "pm", startDate: "2026-04-14", endDate: "2026-04-14" }),
    ];
    expect(on(absenceCountsFor(rows, APRIL, ROSTER), "2026-04-14")).toBe(1);
    expect(avatarsOn(absentMembersFor(rows, APRIL, ROSTER), "2026-04-14")).toEqual([FIXTURE_MEMBER.id]);
  });
});

describe("AC-4: a rejected entry is excluded from the count and from the grid", () => {
  it("contributes nothing and draws no avatar", () => {
    const rows = [
      entry({ memberId: FIXTURE_MEMBER.id, status: "rejected", rejectionReason: "no", startDate: "2026-04-14", endDate: "2026-04-14" }),
    ];
    expect(on(absenceCountsFor(rows, APRIL, ROSTER), "2026-04-14")).toBe(0);
    // INV-04's own clause: a view shows a member's avatar exactly when that member's entry is
    // counted. Asserting both halves is what makes the two derivations one decision.
    expect(avatarsOn(absentMembersFor(rows, APRIL, ROSTER), "2026-04-14")).toEqual([]);
  });
});

describe("AC-5 and INV-05: a tentative entry counts and is drawn", () => {
  it("weighs the same as a settled one", () => {
    const rows = [
      entry({ memberId: FIXTURE_MEMBER.id, tentative: true, status: "pending", startDate: "2026-04-14", endDate: "2026-04-14" }),
    ];
    expect(on(absenceCountsFor(rows, APRIL, ROSTER), "2026-04-14")).toBe(1);
    expect(avatarsOn(absentMembersFor(rows, APRIL, ROSTER), "2026-04-14")).toEqual([FIXTURE_MEMBER.id]);
  });

  it("is independent of status: an approved entry and a tentative one weigh the same", () => {
    // glossary.md keeps `tentative` and `status` apart as two axes, and INV-04 reads exactly one of
    // them. A function that consulted `tentative` would fail this pair without failing the one above.
    const approved = [entry({ memberId: FIXTURE_MEMBER.id, status: "approved", startDate: "2026-04-14", endDate: "2026-04-14" })];
    const tentative = [entry({ memberId: FIXTURE_MEMBER.id, tentative: true, startDate: "2026-04-14", endDate: "2026-04-14" })];

    expect(on(absenceCountsFor(tentative, APRIL, ROSTER), "2026-04-14")).toBe(
      on(absenceCountsFor(approved, APRIL, ROSTER), "2026-04-14"),
    );
  });
});

describe("AC-6 and ADR-013: a removed member counts until the day they were removed", () => {
  // FIXTURE_REMOVED_MEMBER carries `removedAt` 2026-08-31T12:00:00+00:00, which is outside April.
  // The criterion is written about a removal INSIDE the range, so this test moves the removal — it
  // is the same entity with the one field the rule turns on set to the date under test.
  const removedMidMonth: Member = { ...FIXTURE_REMOVED_MEMBER, removedAt: "2026-04-15T00:00:00+00:00" };
  const roster = [...ROSTER.filter((m) => m.id !== FIXTURE_REMOVED_MEMBER.id), removedMidMonth];

  const rows = [
    entry({ memberId: removedMidMonth.id, startDate: "2026-04-10", endDate: "2026-04-20" }),
  ];

  it("counts on the days before the removal", () => {
    const counts = absenceCountsFor(rows, APRIL, roster);
    expect(on(counts, "2026-04-10")).toBe(1);
    expect(on(counts, "2026-04-14")).toBe(1);
  });

  it("counts nothing from the day of the removal onwards", () => {
    // Strictly after, not on or after: somebody removed at midnight on the 15th is gone ON the 15th.
    const counts = absenceCountsFor(rows, APRIL, roster);
    expect(on(counts, "2026-04-15")).toBe(0);
    expect(on(counts, "2026-04-20")).toBe(0);
  });

  it("draws the avatar on exactly the days it counts", () => {
    const members = absentMembersFor(rows, APRIL, roster);
    expect(avatarsOn(members, "2026-04-14")).toEqual([removedMidMonth.id]);
    expect(avatarsOn(members, "2026-04-15")).toEqual([]);
  });

  it("counts nothing for an entry whose member is not on the roster at all", () => {
    // The two reads are scoped to the same team, so this means they disagree — and counting a person
    // the grid cannot draw would break INV-04's avatar clause silently.
    const orphan = [entry({ memberId: "00000000-0000-4000-8000-000000000000", startDate: "2026-04-14", endDate: "2026-04-14" })];
    expect(on(absenceCountsFor(orphan, APRIL, ROSTER), "2026-04-14")).toBe(0);
  });
});

describe("AC-7: overloaded is strictly greater, never equal", () => {
  it("is not overloaded exactly at the threshold", () => {
    // The worked example from the criterion: six members, a threshold of 0.5, three people away.
    expect(isOverloaded(3.0, 6, 0.5)).toBe(false);
  });

  it("is overloaded just above it", () => {
    expect(isOverloaded(3.5, 6, 0.5)).toBe(true);
  });

  it("refuses to divide by an empty roster", () => {
    // `0/0` is NaN, which compares false against everything — so returning false is the same ANSWER
    // either way, and the explicit guard is what makes it a decision rather than an accident.
    expect(isOverloaded(0, 0, 0.5)).toBe(false);
    expect(isOverloaded(3, 0, 0.5)).toBe(false);
  });
});

describe("AC-8: the denominator is the CURRENT member count", () => {
  it("counts only members with removedAt null", () => {
    expect(currentMemberCount(ROSTER)).toBe(4);
    expect(ROSTER).toHaveLength(5);
  });

  it("re-evaluates a past date against today's team", () => {
    // The consequence INV-04 records as accepted: the same count on the same past date flips as the
    // team grows. This is the assertion that would fail if somebody "fixed" it by freezing the
    // denominator, which would put a second definition of the roster in the product.
    const count = 3.5;
    expect(isOverloaded(count, 6, FIXTURE_TEAM.overloadThreshold)).toBe(true);
    expect(isOverloaded(count, 7, FIXTURE_TEAM.overloadThreshold)).toBe(false);
  });
});

describe("AC-9: an empty month is empty, not absent", () => {
  it("carries every date of the range at zero", () => {
    const counts = absenceCountsFor([], APRIL, ROSTER);
    const members = absentMembersFor([], APRIL, ROSTER);

    expect(counts.size).toBe(30);
    expect(members.size).toBe(30);
    // No caller ever has to distinguish an absent key from a zero, which is what stops the
    // arithmetic being re-decided at the call site.
    for (const date of eachDateInRange(APRIL)) {
      expect(counts.get(date)).toBe(0);
      expect(members.get(date)).toEqual([]);
    }
  });
});
