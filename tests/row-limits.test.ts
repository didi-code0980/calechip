// BUG-002 — every row ceiling must be REACHABLE.
//
// A read that asks the datastore for more rows than it will ever return cannot observe itself
// hitting its own ceiling: the server truncates first, the response is a SUCCESS, and the
// `rows.length >= LIMIT` assertion at every call site is unreachable code. The short list is then
// summed as if it were complete — INV-04's single definition fed a truncated set, printing a
// believable wrong number with no error anywhere. That is the defect this file exists to catch.
//
// **This is the only evidence available without a provisioned Supabase project** (01-plan.md § 4.3).
// No test can make PostgREST cap a read from here, so the property is asserted statically, against
// the named cap rather than against the server. 01-plan.md § 2 Open questions item 3 records the
// honest limit of that: it removes the drift that exists and cannot make a second one impossible.
//
// **The relation is `<=` and not `<`, and that is a decision rather than a looser test.** The true
// property is reachability, not margin: a ceiling EQUAL to the cap is hit exactly when the cap is
// hit, and the `>=` comparison at every assertion site fires on it. `HOLIDAY_LIMIT` has been correct
// at exactly 1000 since ADM-02 for that reason, and a strictly-below test would force it down —
// which 01-plan.md § 1 item 9 puts out of scope, because it is not broken and changing a working
// threshold inside a bug fix is the shape ADM-04 refused.
//
// **It fails on the tree as it stands before this change**, at `TEAM_ENTRY_LIMIT` and
// `MONTH_ENTRY_LIMIT` and at those two only, naming each — which is the first half of AC-3.
import { describe, expect, it } from "vitest";
import {
  DATASTORE_MAX_ROWS,
  HOLIDAY_LIMIT,
  MONTH_ENTRY_LIMIT,
  OWN_ENTRY_LIMIT,
  PENDING_PAGE_SIZE,
  ROSTER_LIMIT,
  TEAM_ENTRY_LIMIT,
} from "@/lib/domain/types";

// Every ceiling the product defines for a SINGLE read, in the order they are declared in
// `src/lib/domain/types.ts`. The name is carried beside the value so a failure names the ceiling
// that exceeds the cap rather than reporting an anonymous integer — AC-3.
const CEILINGS: ReadonlyArray<readonly [string, number]> = [
  ["ROSTER_LIMIT", ROSTER_LIMIT],
  ["OWN_ENTRY_LIMIT", OWN_ENTRY_LIMIT],
  ["TEAM_ENTRY_LIMIT", TEAM_ENTRY_LIMIT],
  ["MONTH_ENTRY_LIMIT", MONTH_ENTRY_LIMIT],
  ["HOLIDAY_LIMIT", HOLIDAY_LIMIT],
];

describe("BUG-002 — row ceilings against the datastore cap", () => {
  it.each(CEILINGS)(
    "AC-1: %s is reachable — at most DATASTORE_MAX_ROWS",
    (_name, limit) => {
      expect(limit).toBeLessThanOrEqual(DATASTORE_MAX_ROWS);
    },
  );

  // AC-2. The cap is a named value in the tree, defined once and beside the ceilings that depend on
  // it. Asserting the figure pins what the ceilings were checked against: if someone changes the
  // constant without reading the client's own types, this fails beside the reason.
  it("AC-2: the datastore's maximum is named once, and is the documented 1000", () => {
    expect(DATASTORE_MAX_ROWS).toBe(1000);
  });

  // PENDING_PAGE_SIZE is deliberately NOT in CEILINGS: it is a window and the read pages rather than
  // truncating (`types.ts`, ADM-04). It must still sit below the cap, and it is asserted separately
  // so that a future change to paging cannot quietly borrow the ceiling rule.
  it("AC-1: PENDING_PAGE_SIZE is a window below the cap, not a ceiling", () => {
    expect(PENDING_PAGE_SIZE).toBeLessThan(DATASTORE_MAX_ROWS);
  });
});
