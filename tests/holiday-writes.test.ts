// ADM-03 — the refusals below the interface, and the constraint a person meets. 01-plan.md
// section 7.
//
// AC-15 and AC-16 are refusals the acceptance suite CANNOT reach: it drives the browser and cannot
// call a seam function with a chosen caller. This file does, through `__setCurrentMember` — the
// test-only hook mock.ts exports beside `seam`, which `tests/threshold.test.ts` and
// `tests/seam-parity.test.ts` already use. It moves the member and not the session, so it reaches a
// state the application itself cannot; that is exactly what is wanted here, because the subject is
// the seam's answer and not a journey.
//
// AC-6 and AC-7 are here for a different reason: they are `unique (date)`, which lives in the
// datastore, and no test can meet a constraint in a project nobody has provisioned. What is asserted
// is that the MOCK refuses where the constraint refuses — because the acceptance suite drives the
// mock (BUG-001, tests/e2e/seam.setup.ts), a permissive mock would let every duplicate-date test in
// that suite pass against nothing.
//
// THE MOCK IS THE SUBJECT AND THE POLICIES ARE WHAT IT REPRODUCES. `holiday_insert_admin`,
// `holiday_update_admin`, `holiday_delete_admin` and the write grant are in
// supabase/migrations/20260905140000_adm03_holiday_writes.sql and are exercised by no test until a
// project is provisioned (RULE-09 keeps applying it human).
//
// EVERY TEST CREATES THE ROWS IT ACTS ON, and none of them edits or deletes one of the four seeded
// by `FIXTURE_HOLIDAYS`. That is not fastidiousness: the mock offers no reseed and `restore` below
// can only remove what a test added, so a test that deleted a fixture row would silently change what
// every test after it asserts against. The seeded rows are read — never written.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { seam as mock, __setCurrentMember } from "@/lib/data/mock";
import type { Holiday } from "@/lib/domain/types";
import {
  FIXTURE_ADMIN,
  FIXTURE_HOLIDAYS,
  FIXTURE_MEMBER,
  FIXTURE_REMOVED_MEMBER,
  FIXTURE_SECOND_ADMIN,
} from "@/lib/fixtures";

/** Wide enough to hold every fixture row and everything these tests add, so a read is never the
 *  thing that made an assertion pass. No Date is constructed anywhere in this file — ADR-015
 *  Consequences, and the same reason the product compares `yyyy-MM-dd` strings. */
const EVERYTHING = { start: "2000-01-01", end: "2099-12-31" };

/** The whole table, read back THROUGH the seam rather than out of the mock's internals — so an
 *  assertion about "unchanged" is an assertion about what a reader sees. */
const stored = () => mock.listHolidays(EVERYTHING);

/** Dates in 2028, which the fixtures leave completely empty — so an add that should succeed is never
 *  refused by a constraint the test did not mean to meet. */
const FREE_DATE = "2028-04-30";
const OTHER_FREE_DATE = "2028-09-02";
const THIRD_FREE_DATE = "2028-12-25";

/** The four seeded ids, so `restore` can tell a fixture row from one a test made. */
const seededIds = new Set(FIXTURE_HOLIDAYS.map((h) => h.id));

/** Adds a row as the admin and returns it, failing the test loudly rather than returning something
 *  unusable — a setup step that failed silently would make the assertion after it meaningless. */
async function given(date: string, name: string, kind: Holiday["kind"]): Promise<Holiday> {
  __setCurrentMember(FIXTURE_ADMIN.id);
  const result = await mock.addHoliday({ date, name, kind });
  expect(result.ok, "the fixture setup for this test failed").toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

/** The mock's `holiday` table is module state and these tests write it, so every one of them starts
 *  and ends at the four seeded rows. */
async function restore(): Promise<void> {
  __setCurrentMember(FIXTURE_ADMIN.id);
  for (const row of await stored()) {
    if (!seededIds.has(row.id)) await mock.deleteHoliday(row.id);
  }
  __setCurrentMember(null);
}

describe("ADM-03 the holiday writes", () => {
  beforeEach(restore);
  afterEach(restore);

  // -------------------------------------------------------------------------
  // Adding, editing and deleting as the person the policies admit.
  // -------------------------------------------------------------------------

  it("AC-1: an admin adds a holiday and it is stored", async () => {
    __setCurrentMember(FIXTURE_ADMIN.id);
    const result = await mock.addHoliday({
      date: FREE_DATE,
      name: "Reunification Day",
      kind: "non_working",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.date).toBe(FREE_DATE);
    expect(result.value.kind).toBe("non_working");
    // Read back rather than trusted: the returned value and the stored row are two different claims,
    // and a mock that returned one without keeping the other would pass the assertion above.
    expect((await stored()).map((h) => h.date)).toContain(FREE_DATE);
  });

  it("AC-2: a mandated working Saturday is stored with the kind that says so", async () => {
    const row = await given(FREE_DATE, "Mandated working Saturday", "working");

    // The value names the EFFECT on the working calendar and not the Vietnamese label (ADR-015
    // section 2). A row stored as `non_working` here would be the exact inverse of what was asked
    // for, and CAL-08 is where it would surface.
    expect(row.kind).toBe("working");
    expect((await stored()).find((h) => h.id === row.id)?.kind).toBe("working");
  });

  it("AC-8 and AC-10: an edit replaces the row's three fields and touches no other row", async () => {
    const row = await given(FREE_DATE, "A day", "non_working");
    const before = await stored();

    const result = await mock.updateHoliday(row.id, {
      date: OTHER_FREE_DATE,
      name: "Corrected name",
      kind: "working",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.date).toBe(OTHER_FREE_DATE);
    expect(result.value.name).toBe("Corrected name");
    expect(result.value.kind).toBe("working");

    // NO SECOND ROW WAS CREATED: an update that inserted would leave the count one higher with the
    // old date still present, which is the failure a happy-path assertion on the returned value
    // alone would miss.
    const after = await stored();
    expect(after).toHaveLength(before.length);
    expect(after.map((h) => h.date)).not.toContain(FREE_DATE);

    // AC-10, field by field on every OTHER row — the four seeded ones included — so a future column
    // added to `Holiday` cannot slip through an assertion that only names the five that exist today.
    for (const other of before) {
      if (other.id === row.id) continue;
      expect(after.find((h) => h.id === other.id)).toEqual(other);
    }
  });

  it("AC-9's stored half: an edit that changes one field leaves the other two as they were", async () => {
    const row = await given(FREE_DATE, "Original name", "working");

    const result = await mock.updateHoliday(row.id, {
      date: row.date,
      name: "Corrected label only",
      kind: row.kind,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Saving a row onto its OWN date is an ordinary edit and not a duplicate — a row does not
    // collide with itself, which is what `unique (date)` does in the datastore and what a duplicate
    // check written without `id !== holidayId` would get wrong, making every name-only correction
    // impossible.
    expect(result.value.date).toBe(FREE_DATE);
    expect(result.value.kind).toBe("working");
    expect(result.value.name).toBe("Corrected label only");
  });

  it("AC-13: deleting removes exactly the named row and leaves the others", async () => {
    const going = await given(FREE_DATE, "Going", "non_working");
    await given(OTHER_FREE_DATE, "Staying", "working");
    const before = await stored();

    __setCurrentMember(FIXTURE_ADMIN.id);
    expect((await mock.deleteHoliday(going.id)).ok).toBe(true);

    const after = await stored();
    expect(after).toHaveLength(before.length - 1);
    expect(after.find((h) => h.id === going.id)).toBeUndefined();
    for (const other of before) {
      if (other.id === going.id) continue;
      expect(after.find((h) => h.id === other.id)).toEqual(other);
    }
  });

  // -------------------------------------------------------------------------
  // The constraint a person meets. AC-6 and AC-7.
  // -------------------------------------------------------------------------

  it("AC-6: a second row for a date already in the calendar is refused", async () => {
    await given(FREE_DATE, "The first observance", "non_working");
    const before = await stored();

    __setCurrentMember(FIXTURE_ADMIN.id);
    const result = await mock.addHoliday({
      date: FREE_DATE,
      name: "A second observance on the same day",
      kind: "non_working",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // A DEDICATED CODE and not `already_allow_listed`, which is the other `23505` this seam maps and
    // whose sentence names an email address (01-plan.md section 4.1).
    expect(result.error.code).toBe("holiday_date_taken");
    expect(result.error.message).not.toBe("");
    expect(await stored()).toEqual(before);
  });

  it("AC-6: a date already carrying a SEEDED row is refused the same way", async () => {
    // The four fixture rows are read here and not written: an admin meeting the constraint against
    // a date the seed migration inserted is the ordinary case, and it must answer the same way as a
    // date another admin added this morning.
    const seeded = FIXTURE_HOLIDAYS[0];
    if (!seeded) throw new Error("the fixture module carries no holiday rows");

    __setCurrentMember(FIXTURE_ADMIN.id);
    const result = await mock.addHoliday({
      date: seeded.date,
      name: "On top of a seeded date",
      kind: "non_working",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("holiday_date_taken");
  });

  it("AC-7: moving a row onto an occupied date is refused, and both rows are unchanged", async () => {
    const moving = await given(FREE_DATE, "The one being edited", "non_working");
    const occupant = await given(OTHER_FREE_DATE, "The one already there", "working");
    const before = await stored();

    __setCurrentMember(FIXTURE_ADMIN.id);
    const result = await mock.updateHoliday(moving.id, {
      date: occupant.date,
      name: moving.name,
      kind: moving.kind,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // THE SAME CODE AS THE ADD. It is the same constraint, and a second code would be a second thing
    // for a screen to branch on for no difference in what happened.
    expect(result.error.code).toBe("holiday_date_taken");
    // BOTH rows unchanged — the whole table read back, so this also says the refused update wrote
    // nothing partial.
    expect(await stored()).toEqual(before);
  });

  it("AC-6: the refusal is against the WHOLE table and not one year", async () => {
    // The case 01-plan.md section 8 rejected a form-side duplicate check over: a screen holds one
    // year, and a date in a year nobody is looking at is exactly as taken as one in view.
    await given(THIRD_FREE_DATE, "A year nobody is looking at", "non_working");

    __setCurrentMember(FIXTURE_ADMIN.id);
    const again = await mock.addHoliday({
      date: THIRD_FREE_DATE,
      name: "Again",
      kind: "non_working",
    });

    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.error.code).toBe("holiday_date_taken");
  });

  // -------------------------------------------------------------------------
  // The refusals. AC-15 and AC-16 — past every control the screen holds.
  // -------------------------------------------------------------------------

  it("AC-15: a member is refused all three writes and the calendar is unchanged", async () => {
    const row = await given(FREE_DATE, "An admin's row", "non_working");
    const before = await stored();

    // The criterion past every control the screen holds: this is the seam being called with a member
    // as the caller, which is what makes the hidden add form an affordance rather than the check.
    __setCurrentMember(FIXTURE_MEMBER.id);
    const added = await mock.addHoliday({
      date: OTHER_FREE_DATE,
      name: "Not mine to add",
      kind: "non_working",
    });
    const edited = await mock.updateHoliday(row.id, {
      date: OTHER_FREE_DATE,
      name: "Not mine to edit",
      kind: "working",
    });
    const deleted = await mock.deleteHoliday(row.id);

    for (const result of [added, edited, deleted]) {
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error.code).toBe("not_permitted");
      expect(result.error.message).not.toBe("");
    }
    expect(await stored()).toEqual(before);
  });

  it("AC-15: a caller with no member row is refused all three", async () => {
    const row = await given(FREE_DATE, "An admin's row", "non_working");
    const before = await stored();

    __setCurrentMember(null);
    expect(
      (await mock.addHoliday({ date: OTHER_FREE_DATE, name: "X", kind: "non_working" })).ok,
    ).toBe(false);
    expect(
      (await mock.updateHoliday(row.id, { date: OTHER_FREE_DATE, name: "X", kind: "working" })).ok,
    ).toBe(false);
    expect((await mock.deleteHoliday(row.id)).ok).toBe(false);
    expect(await stored()).toEqual(before);
  });

  it("AC-16: a removed member is refused all three", async () => {
    const row = await given(FREE_DATE, "An admin's row", "non_working");
    const before = await stored();

    __setCurrentMember(FIXTURE_REMOVED_MEMBER.id);
    expect(
      (await mock.addHoliday({ date: OTHER_FREE_DATE, name: "X", kind: "non_working" })).ok,
    ).toBe(false);
    expect(
      (await mock.updateHoliday(row.id, { date: OTHER_FREE_DATE, name: "X", kind: "working" })).ok,
    ).toBe(false);
    expect((await mock.deleteHoliday(row.id)).ok).toBe(false);
    expect(await stored()).toEqual(before);
  });

  it("hands back a copy, so a caller cannot write the mock's table through the value", async () => {
    const row = await given(FREE_DATE, "A day", "non_working");

    row.date = "1999-01-01";
    row.name = "Rewritten through the returned object";

    const readBack = (await stored()).find((h) => h.id === row.id);
    expect(readBack?.date).toBe(FREE_DATE);
    expect(readBack?.name).toBe("A day");
  });

  // LAST IN THE FILE, DELIBERATELY, and the ordering is load-bearing — the shape
  // tests/threshold.test.ts records for the same criterion. `removeMember` is the only way to reach
  // a caller whose row is removed AND whose role is `admin`: no such fixture exists,
  // src/lib/fixtures.ts is not in this ticket's `allowed_paths`, and the mock offers no way to undo
  // a removal, so this test leaves FIXTURE_SECOND_ADMIN removed for whatever runs after it. Nothing
  // does, in this file, and the mock's module state is per test file.
  //
  // It is the criterion `is_admin` answers rather than the three policies: the function filters
  // `removed_at is null` in its own body, so a caller whose `role` column still says `admin` is
  // refused by all three without any of them repeating the predicate.
  it("AC-16: a removed caller is refused WHATEVER role their row records", async () => {
    const row = await given(FREE_DATE, "An admin's row", "non_working");

    __setCurrentMember(FIXTURE_ADMIN.id);
    const removal = await mock.removeMember(FIXTURE_SECOND_ADMIN.id);
    expect(removal.ok, "the fixture setup for this test failed").toBe(true);
    if (!removal.ok) return;
    expect(removal.value.role).toBe("admin");
    expect(removal.value.removedAt).not.toBeNull();

    const before = await stored();
    __setCurrentMember(FIXTURE_SECOND_ADMIN.id);

    const added = await mock.addHoliday({
      date: OTHER_FREE_DATE,
      name: "X",
      kind: "non_working",
    });
    expect(added.ok).toBe(false);
    if (!added.ok) expect(added.error.code).toBe("not_permitted");

    expect(
      (await mock.updateHoliday(row.id, { date: OTHER_FREE_DATE, name: "X", kind: "working" })).ok,
    ).toBe(false);
    expect((await mock.deleteHoliday(row.id)).ok).toBe(false);
    expect(await stored()).toEqual(before);
  });
});
