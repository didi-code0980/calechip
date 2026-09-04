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
  absentEntriesFor,
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
import type { AbsenceDetail, DateRange, Entry, Member } from "@/lib/domain/types";

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

// ===========================================================================
// CAL-05 — `absentEntriesFor`, the THIRD derivation from the same `walk`.
//
// **The AC ids below are CAL-05's and the ones above are CAL-04's, so every describe from here down
// is prefixed with the ticket.** `.ai/standards/testing-standards.md` § Test naming requires the AC
// id in the test name; it does not anticipate one file serving two tickets, which this one now does
// because the function under test lives in the module CAL-04 shipped and splitting the file would
// put two halves of INV-04's coverage in two places.
//
// The division of labour with tests/e2e/cal-05-week-view.spec.ts is the standard's: pure logic here,
// "a full acceptance criterion through the interface" there. AC-10 and AC-11 are asserted HERE ONLY
// and that is declared in 03-impl-log.md — nothing in the product can create a rejected entry
// (`entry_update_admin` excludes `status`, and ADM-05 does not exist) and nothing can remove a member
// partway through a displayed week, so neither has an interface to be observed through.
//
// Entries are constructed with the same `entry()` helper and the same declared deviation from
// § Fixtures recorded at the top of this file. Nothing new is invented: every member is imported.
// ===========================================================================

/** The week 01-plan.md section 2 writes AC-1 and AC-14 against: Monday to Sunday, inclusive. */
const WEEK: DateRange = { start: "2026-10-05", end: "2026-10-11" };

const rowsOn = (
  details: ReadonlyMap<string, readonly AbsenceDetail[]>,
  date: string,
): readonly AbsenceDetail[] => details.get(date) ?? [];

const namesOn = (
  details: ReadonlyMap<string, readonly AbsenceDetail[]>,
  date: string,
): readonly string[] => rowsOn(details, date).map((row) => row.member.id);

describe("CAL-05 AC-2 and AC-5: each absent person on each day their entry covers, and no other", () => {
  it("lists the member on every date of the range and on none outside it", () => {
    const rows = [
      entry({ memberId: FIXTURE_MEMBER.id, startDate: "2026-10-06", endDate: "2026-10-08" }),
    ];
    const details = absentEntriesFor(rows, WEEK, ROSTER);

    expect(namesOn(details, "2026-10-05")).toEqual([]);
    expect(namesOn(details, "2026-10-06")).toEqual([FIXTURE_MEMBER.id]);
    expect(namesOn(details, "2026-10-07")).toEqual([FIXTURE_MEMBER.id]);
    expect(namesOn(details, "2026-10-08")).toEqual([FIXTURE_MEMBER.id]);
    expect(namesOn(details, "2026-10-09")).toEqual([]);
  });

  it("clamps an entry that starts before the week to the days inside it", () => {
    // AC-5's exact shape: Saturday before the week to its Tuesday, so the answer is Monday and
    // Tuesday and nothing else. No key outside the requested range ever appears.
    const rows = [
      entry({ memberId: FIXTURE_MEMBER.id, startDate: "2026-10-03", endDate: "2026-10-06" }),
    ];
    const details = absentEntriesFor(rows, WEEK, ROSTER);

    expect(details.size).toBe(7);
    expect(details.has("2026-10-03")).toBe(false);
    expect(namesOn(details, "2026-10-05")).toEqual([FIXTURE_MEMBER.id]);
    expect(namesOn(details, "2026-10-06")).toEqual([FIXTURE_MEMBER.id]);
    expect(namesOn(details, "2026-10-07")).toEqual([]);
  });

  it("carries the entry that puts the person there, not just the person", () => {
    // The whole reason this derivation exists: `absentMembersFor` answers WHO and drops the row, so
    // the note, the portion and the approver have nowhere to come from. AC-6 and AC-7 are rendered
    // from these three fields and the criteria are unobservable without them.
    const row = entry({
      memberId: FIXTURE_APPROVED_MEMBER.id,
      status: "approved",
      approvedBy: FIXTURE_ADMIN.id,
      approvedAt: "2026-10-01T02:00:00+00:00",
      portion: "am",
      startDate: "2026-10-07",
      endDate: "2026-10-07",
    });
    const listed = rowsOn(absentEntriesFor([row], WEEK, ROSTER), "2026-10-07");
    expect(listed).toHaveLength(1);
    const detail = listed[0]!;

    expect(detail.member.id).toBe(FIXTURE_APPROVED_MEMBER.id);
    expect(detail.entry.id).toBe(row.id);
    expect(detail.entry.note).toBe(row.note);
    expect(detail.entry.portion).toBe("am");
    expect(detail.entry.approvedBy).toBe(FIXTURE_ADMIN.id);
  });
});

describe("CAL-05 AC-4 and INV-06: a five-day pm entry is five afternoons", () => {
  it("puts the same portion on every one of the five days", () => {
    // The failure the registry row names as visible on this surface and no other: a half-day at ONE
    // END and whole days in the middle. `portion` is one value for the whole entry, so every row the
    // week draws reads it off the same field — a rendering that produced anything else would be
    // contradicting the column shape CAL-01 shipped.
    const rows = [
      entry({
        memberId: FIXTURE_MEMBER.id,
        portion: "pm",
        startDate: "2026-10-05",
        endDate: "2026-10-09",
      }),
    ];
    const details = absentEntriesFor(rows, WEEK, ROSTER);

    for (const date of ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"]) {
      expect(rowsOn(details, date)).toHaveLength(1);
      expect(rowsOn(details, date)[0]!.entry.portion).toBe("pm");
    }
    // And the weekend, which the entry does not reach, stays empty.
    expect(namesOn(details, "2026-10-10")).toEqual([]);
    expect(namesOn(details, "2026-10-11")).toEqual([]);
  });
});

describe("CAL-05 AC-9 and INV-05: a tentative entry is listed on the same terms as any other", () => {
  it("is listed exactly as a settled entry is, carrying its own tentative flag", () => {
    // `tentative` is never consulted by `walk`, so membership of the list cannot turn on it. The
    // marking is what the view does with the flag it is handed, and that is a rendering decision.
    const tentative = entry({
      memberId: FIXTURE_MEMBER.id,
      tentative: true,
      startDate: "2026-10-07",
      endDate: "2026-10-07",
    });
    const settled = entry({
      memberId: FIXTURE_ADMIN.id,
      tentative: false,
      startDate: "2026-10-07",
      endDate: "2026-10-07",
    });
    const details = absentEntriesFor([tentative, settled], WEEK, ROSTER);

    expect(namesOn(details, "2026-10-07")).toHaveLength(2);
    expect(rowsOn(details, "2026-10-07").map((row) => row.entry.tentative).sort()).toEqual([
      false,
      true,
    ]);
  });
});

describe("CAL-05 AC-10: a rejected entry is not listed", () => {
  it("lists nobody for it, exactly as the count sums nobody for it", () => {
    // Asserted at this level only — nothing in the product can set `status` to `rejected`, so the
    // criterion has no interface to be observed through (03-impl-log.md).
    const rows = [
      entry({
        memberId: FIXTURE_MEMBER.id,
        status: "rejected",
        rejectionReason: "no",
        startDate: "2026-10-07",
        endDate: "2026-10-07",
      }),
    ];
    expect(namesOn(absentEntriesFor(rows, WEEK, ROSTER), "2026-10-07")).toEqual([]);
    // Both halves, because the criterion is about the two AGREEING: a week list showing a rejected
    // entry beside a month cell that excludes it is the divergence INV-04 forbids.
    expect(on(absenceCountsFor(rows, WEEK, ROSTER), "2026-10-07")).toBe(0);
  });
});

describe("CAL-05 AC-11 and ADR-013: a removed member's entries stop on the day they were removed", () => {
  // FIXTURE_REMOVED_MEMBER carries `removedAt` 2026-08-31, outside this week. The criterion is
  // written about a removal INSIDE the displayed week, so this moves the one field the rule turns on
  // — the same shape CAL-04's AC-6 block above already uses on the same fixture.
  const removedMidWeek: Member = {
    ...FIXTURE_REMOVED_MEMBER,
    removedAt: "2026-10-07T00:00:00+00:00",
  };
  const roster = [...ROSTER.filter((m) => m.id !== FIXTURE_REMOVED_MEMBER.id), removedMidWeek];
  const rows = [
    entry({ memberId: removedMidWeek.id, startDate: "2026-10-05", endDate: "2026-10-09" }),
  ];

  it("lists them on the days before the removal", () => {
    const details = absentEntriesFor(rows, WEEK, roster);
    expect(namesOn(details, "2026-10-05")).toEqual([removedMidWeek.id]);
    expect(namesOn(details, "2026-10-06")).toEqual([removedMidWeek.id]);
  });

  it("lists them on no day from the removal onwards", () => {
    // Strictly after, not on or after: somebody removed at midnight on the 7th is gone ON the 7th.
    const details = absentEntriesFor(rows, WEEK, roster);
    expect(namesOn(details, "2026-10-07")).toEqual([]);
    expect(namesOn(details, "2026-10-09")).toEqual([]);
  });
});

describe("CAL-05 AC-12 and INV-04: the week and the month agree about who is away", () => {
  // The criterion that matters, because the failure the feature row names — four names against 3.5 —
  // is invisible on either screen alone. Every shape INV-04 distinguishes is in this one set.
  const rows = [
    entry({ memberId: FIXTURE_MEMBER.id, portion: "am", startDate: "2026-10-07", endDate: "2026-10-07" }),
    entry({ memberId: FIXTURE_MEMBER.id, portion: "pm", startDate: "2026-10-07", endDate: "2026-10-07" }),
    entry({ memberId: FIXTURE_ADMIN.id, portion: "full", startDate: "2026-10-05", endDate: "2026-10-09" }),
    entry({ memberId: FIXTURE_SECOND_ADMIN.id, portion: "am", tentative: true, startDate: "2026-10-07", endDate: "2026-10-08" }),
    entry({ memberId: FIXTURE_APPROVED_MEMBER.id, status: "rejected", rejectionReason: "no", startDate: "2026-10-07", endDate: "2026-10-07" }),
    entry({ memberId: FIXTURE_REMOVED_MEMBER.id, startDate: "2026-10-05", endDate: "2026-10-11" }),
    entry({ memberId: "00000000-0000-4000-8000-000000000000", startDate: "2026-10-06", endDate: "2026-10-06" }),
  ];

  const details = absentEntriesFor(rows, WEEK, ROSTER);
  const members = absentMembersFor(rows, WEEK, ROSTER);
  const counts = absenceCountsFor(rows, WEEK, ROSTER);

  it("names the same set of members the month grid draws, on every date", () => {
    for (const date of eachDateInRange(WEEK)) {
      // DISTINCT, because one member holding an `am` and a `pm` is two rows here and one avatar
      // there — the same fact told two ways, which is what INV-04 requires rather than forbids.
      const distinct = [...new Set(namesOn(details, date))].sort();
      expect(distinct).toEqual([...avatarsOn(members, date)].sort());
    }
  });

  it("re-derives the month's count from the week's rows, on every date", () => {
    // The weights are written out HERE rather than imported, deliberately: importing `WEIGHT` would
    // make this test agree with the implementation by construction, and what it is checking is that
    // the two derivations describe the same day. This is the assertion that fires on "four names
    // against 3.5".
    const weight = { full: 1, am: 0.5, pm: 0.5 } as const;
    for (const date of eachDateInRange(WEEK)) {
      const summed = rowsOn(details, date).reduce((total, row) => total + weight[row.entry.portion], 0);
      expect(summed).toBe(on(counts, date));
    }
  });

  it("is not vacuous: the week under test actually holds people", () => {
    // Two agreeing empty maps agree perfectly, so the pair above would pass against a function that
    // returned nothing. This is the line that stops that.
    //
    // FOUR ROWS, THREE PEOPLE, 2.5 — which is the feature row's own example standing up: a reader
    // counting names on the week gets a number the month cell does not show, and both screens are
    // right. It is the reason this view renders no count of its own.
    expect(rowsOn(details, "2026-10-07")).toHaveLength(4);
    expect(new Set(namesOn(details, "2026-10-07")).size).toBe(3);
    expect(avatarsOn(members, "2026-10-07")).toHaveLength(3);
    expect(on(counts, "2026-10-07")).toBe(2.5);
  });
});

describe("CAL-05 AC-13: every date of the week is present, carrying an empty list", () => {
  it("keeps the same contract the other two derivations keep", () => {
    const details = absentEntriesFor([], WEEK, ROSTER);

    expect(details.size).toBe(7);
    // A caller iterating one map indexes the others without a fallback, which is what stops "nobody
    // is away on Sunday" and "Sunday is missing" being the same answer.
    for (const date of eachDateInRange(WEEK)) expect(details.get(date)).toEqual([]);
  });
});

describe("CAL-05 section 4.1: the order within a date is fixed here, not left to the datastore", () => {
  it("orders by display name, then portion, then entry id", () => {
    // Vietnamese collation: `Đ` sorts after `D`, not after `T`, so the two `Đã…` names come first.
    // The comparison names the locale explicitly — the host default would order these rows one way
    // in CI and another on a laptop, which is the divergence tests/seam-parity.test.ts cannot see.
    const rows = [
      entry({ id: "aa000000-0000-4000-8000-000000000002", memberId: FIXTURE_MEMBER.id, portion: "pm", startDate: "2026-10-07", endDate: "2026-10-07" }),
      entry({ id: "aa000000-0000-4000-8000-000000000001", memberId: FIXTURE_MEMBER.id, portion: "am", startDate: "2026-10-07", endDate: "2026-10-07" }),
      entry({ id: "aa000000-0000-4000-8000-000000000003", memberId: FIXTURE_ADMIN.id, portion: "full", startDate: "2026-10-07", endDate: "2026-10-07" }),
      entry({ id: "aa000000-0000-4000-8000-000000000004", memberId: FIXTURE_APPROVED_MEMBER.id, portion: "full", startDate: "2026-10-07", endDate: "2026-10-07" }),
    ];

    expect(rowsOn(absentEntriesFor(rows, WEEK, ROSTER), "2026-10-07").map((row) => row.member.displayName)).toEqual([
      FIXTURE_APPROVED_MEMBER.displayName,
      FIXTURE_ADMIN.displayName,
      FIXTURE_MEMBER.displayName,
      FIXTURE_MEMBER.displayName,
    ]);
  });

  it("breaks the remaining tie on entry id, so one member's am and pm are deterministic", () => {
    // The only case where the first two comparisons both tie, and the reason the third exists: the
    // input order below is reversed relative to the answer.
    const pm = entry({ id: "ab000000-0000-4000-8000-000000000002", memberId: FIXTURE_MEMBER.id, portion: "pm", startDate: "2026-10-07", endDate: "2026-10-07" });
    const am = entry({ id: "ab000000-0000-4000-8000-000000000001", memberId: FIXTURE_MEMBER.id, portion: "am", startDate: "2026-10-07", endDate: "2026-10-07" });
    const first = entry({ id: "ab000000-0000-4000-8000-000000000003", memberId: FIXTURE_MEMBER.id, portion: "am", startDate: "2026-10-07", endDate: "2026-10-07" });

    const ordered = rowsOn(absentEntriesFor([pm, first, am], WEEK, ROSTER), "2026-10-07");
    expect(ordered.map((row) => row.entry.id)).toEqual([am.id, first.id, pm.id]);
  });
});
