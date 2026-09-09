import { expect, test, type Locator, type Page } from "@playwright/test";

// ADM-06 — reject several entries at once, with one reason for the batch.
//
// Written from 01-plan.md sections 2, 2b, 3, 4.4 and 4.5. Every locator is a `data-testid` from the
// selector table in section 4.5; the ones this file uses that are NOT in that table — `sign-in-*`,
// `home-sign-out`, `home-new-entry-link`, `shell-admin-link`, `admin-hub-pending-link`,
// `new-entry-*`,
// `own-entry-row`, `pending-entry-row*`, `pending-entries-*`, `entry-decision*` — belong to TEA-01,
// TEA-05, CAL-01, ADM-04 and ADM-05 and are declared in 03-impl-log.md § Deviations.
//
// **THE DIVISION OF LABOUR WITH tests/bulk-rejection.test.ts IS THE STANDARD'S.**
// `.ai/standards/testing-standards.md` puts seam behaviour at the unit level and "a full acceptance
// criterion through the interface" at this one. So the arithmetic, the filtered-row case, atomicity
// and the two refusal codes are asserted there against `rejectEntries` directly, and this file
// asserts what an ADMIN SEES: the batch composed from rows on screen, the queue shrinking, the count
// falling with it, the refusals that keep the work where it can be corrected, the selection emptying
// when the view changes, and the copy.
//
// **AC-2, AC-6, AC-7, AC-9, AC-10, AC-11 AND AC-18 ARE ASSERTED IN tests/bulk-rejection.test.ts OR
// NOWHERE, AND THAT IS DECLARED IN 03-impl-log.md.** Each is a property of the write and not of a
// screen: one reason per record, de-duplication, atomicity, an approved entry losing its approver,
// an admin's own entry, a row of another team being filtered, and the count's provenance.
//
// **AC-5'S NUMBERS CANNOT BE PRODUCED FROM THIS INTERFACE, AND THAT IS A PROPERTY RATHER THAN A
// GAP.** A partial batch needs ids the caller may not reach, and every id this screen can put in a
// batch is a row it has just displayed to an admin who may reach it (AC-15). The partial case
// therefore arises from the DATASTORE — another admin deciding first, or a caller that is not this
// application — and it is asserted with real numbers in the unit suite. What is asserted here is the
// half that is this screen's: the result carries `data-requested` and `data-rejected` as two
// attributes rather than one string, and it SURVIVES the re-read (01-plan.md section 2b — "a toast
// would take the only record of a partial write off the screen after four seconds").
//
// **AC-8 HAS NO INTERFACE HALF TO ASSERT, AND THE ABSENCE IS ASSERTED INSTEAD.** A member cannot
// reach the bar: `/entries/pending` refuses them outright. So what is checked here is that no batch
// control is offered to a member at all — the affordance half — while the refusal itself is clause
// (a)'s and is demonstrated against the mock in the unit suite. 01-plan.md section 3 states what that
// does and does not prove.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it, tests/e2e/seam.setup.ts refuses the run
// otherwise), so every refusal observed below is src/lib/data/mock.ts reproducing
// `entry_update_admin` and clause (a). The migration this ticket ships is applied by a human
// (RULE-09) and is not exercised here.
//
// EACH TEST GETS FRESH MOCK STATE, because the mock's entry table lives in module memory and a
// `page.goto` reloads the module. ITS SESSION DOES NOT: mock.ts writes the session to
// `localStorage`, so switching people is done by signing out, and navigation within a test is done
// by clicking links and by `page.goBack()` — the constraint every suite from CAL-01 onwards records.
//
// THE ENTRIES BELOW ARE CREATED THROUGH CAL-01'S FORM AND NOT SEEDED — 01-plan.md section 7 adds no
// fixture on purpose, and every criterion here is stronger created by the write it is testing.
//
// Fixtures (src/lib/fixtures.ts, mirrored in supabase/seed.sql):
// - Admin:  quan@example.com  (FIXTURE_ADMIN, role admin, FIXTURE_TEAM, no seeded entries)
// - Member: thanh@example.com (FIXTURE_MEMBER, role member, FIXTURE_TEAM, no seeded entries)

const WORKLIST = "/entries/pending";
const PASSWORD = "password123";

const ADMIN_EMAIL = "quan@example.com";
const MEMBER_EMAIL = "thanh@example.com";

/** Permanently upcoming, and clear of every date the other suites fix. */
const FIRST = { start: "2033-04-04", end: "2033-04-05" };
const SECOND = { start: "2033-04-11", end: "2033-04-12" };
const THIRD_WFH = { start: "2033-04-18", end: "2033-04-19" };

const REASON = "Two people are already out that week — could either of you take the Monday after?";

const rows = (page: Page): Locator => page.getByTestId("pending-entry-row");

const rowFor = (page: Page, startDate: string): Locator =>
  page.locator(`[data-testid="pending-entry-row"][data-start-date="${startDate}"]`);

const bar = (page: Page): Locator => page.getByTestId("bulk-rejection");
const reasonField = (page: Page): Locator => page.getByTestId("bulk-rejection-reason");
const submit = (page: Page): Locator => page.getByTestId("bulk-rejection-submit");
const result = (page: Page): Locator => page.getByTestId("bulk-rejection-result");
const barError = (page: Page): Locator => page.getByTestId("bulk-rejection-error");
const count = (page: Page): Locator => page.getByTestId("pending-entries-count");

async function signIn(page: Page, email: string): Promise<void> {
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
}

/** Lands on the worklist address while signed out, which redirects to sign-in. ADM-04's route. */
async function signInAt(page: Page, email: string): Promise<void> {
  await page.goto(WORKLIST);
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  await signIn(page, email);
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

/** Ends the session and starts another, all client-side, so the mock's tables survive. */
async function switchTo(page: Page, email: string): Promise<void> {
  await page.getByTestId("home-sign-out").click();
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  await signIn(page, email);
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

/** Declares one entry through CAL-01's form, from Home, and returns to Home. */
async function declare(
  page: Page,
  fields: { start: string; end: string; type?: "pto" | "wfh" },
  owned: number,
): Promise<void> {
  await page.getByTestId("home-new-entry-link").click();

  await page.getByTestId("new-entry-start").fill(fields.start);
  await page.getByTestId("new-entry-end").fill(fields.end);
  if (fields.type) await page.getByTestId("new-entry-type").selectOption(fields.type);

  await page.getByTestId("new-entry-submit").click();
  await expect(page.getByTestId("own-entry-row")).toHaveCount(owned);

  await page.goBack();
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

/** **TWO CLICKS SINCE UIE-10**, which removed the sidebar's four admin links: the top-bar control,
 *  then the hub row UIE-09 shipped. The destination and everything asserted about it are unchanged. */
async function openWorklist(page: Page): Promise<void> {
  await page.getByTestId("shell-admin-link").click();
  await page.getByTestId("admin-hub-pending-link").click();
  await expect(count(page)).toBeVisible();
}

/** Two leave entries and one working-from-home entry, all pending, all in the admin's queue. */
async function threeWaiting(page: Page): Promise<void> {
  await signInAt(page, MEMBER_EMAIL);
  await declare(page, FIRST, 1);
  await declare(page, SECOND, 2);
  await declare(page, { ...THIRD_WFH, type: "wfh" }, 3);
  await switchTo(page, ADMIN_EMAIL);
  await openWorklist(page);
  await expect(rows(page)).toHaveCount(3);
  await expect(count(page)).toHaveAttribute("data-total", "3");
}

/** Ticks the selection checkbox on the row starting `startDate`. */
async function select(page: Page, startDate: string): Promise<void> {
  await rowFor(page, startDate).getByTestId("pending-entry-row-select").check();
}

test.describe("ADM-06 — reject several entries at once, with one reason for the batch", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(WORKLIST);
    const loading = page.getByTestId("app-session-loading");
    if (await loading.isVisible()) await expect(loading).toBeHidden();
  });

  test("AC-1, AC-12, AC-13 and AC-17: three selected, three rejected, and the queue empties", async ({
    page,
  }) => {
    await threeWaiting(page);

    // AC-17. Selecting writes NOTHING. The batch is composed and then sent, and there is no
    // interaction on this screen that writes as a side effect of being used — so after three ticks
    // and one clear the queue is exactly the size it was.
    await select(page, FIRST.start);
    await select(page, SECOND.start);
    await expect(bar(page)).toHaveAttribute("data-selected", "2");
    await page.getByTestId("bulk-rejection-clear").click();
    await expect(bar(page)).toHaveAttribute("data-selected", "0");
    await expect(count(page)).toHaveAttribute("data-total", "3");
    await expect(rows(page)).toHaveCount(3);
    await expect(result(page)).toHaveCount(0);

    await select(page, FIRST.start);
    await select(page, SECOND.start);
    await select(page, THIRD_WFH.start);
    await expect(bar(page)).toHaveAttribute("data-selected", "3");

    // Typing is not writing either.
    await reasonField(page).fill(REASON);
    await expect(count(page)).toHaveAttribute("data-total", "3");

    await submit(page).click();

    // AC-1. THREE REJECTED OF THREE SELECTED, as two attributes rather than one parsed sentence —
    // ADM-04's reason for `data-total` beside `data-shown`.
    await expect(result(page)).toBeVisible();
    await expect(result(page)).toHaveAttribute("data-requested", "3");
    await expect(result(page)).toHaveAttribute("data-rejected", "3");
    // Never *done*: a result that named no number is the fail-quiet answer this ticket exists to
    // remove.
    await expect(result(page)).not.toHaveText("Done");

    // AC-12. THE SCREEN RE-READ. The rows are gone and the outstanding figure fell because the
    // datastore returned a smaller set — never because rows were spliced out of a list in the
    // browser, which is what would let the count and the list disagree.
    await expect(rows(page)).toHaveCount(0);
    await expect(count(page)).toHaveAttribute("data-total", "0");
    await expect(page.getByTestId("pending-entries-empty")).toBeVisible();

    // AC-13's second half. The selection and the reason are cleared on a batch that landed, so the
    // next batch cannot inherit this one's contents. AC-5's other half: the RESULT survives the
    // re-read that removed the rows it is about, which is the only reason it is legible at all.
    await expect(bar(page)).toHaveAttribute("data-selected", "0");
    await expect(reasonField(page)).toHaveValue("");
    await expect(result(page)).toBeVisible();
  });

  test("AC-3, AC-4 and AC-13: both refusals keep the work where it can be corrected", async ({
    page,
  }) => {
    await threeWaiting(page);

    await select(page, FIRST.start);
    await select(page, SECOND.start);

    // AC-3. WHITESPACE ONLY, which is the case a `required` attribute alone would let through. The
    // field carries `data-required` and the button submits — the refusal is the seam's, so that it
    // is observable at all.
    await expect(reasonField(page)).toHaveAttribute("data-required", "true");
    await reasonField(page).fill("   ");
    await submit(page).click();

    await expect(barError(page)).toBeVisible();
    // WHICH refusal, not "some" refusal. And no SQLSTATE reaches the screen: the seam refuses before
    // the request, so neither INV-03's 23514 nor `public.reject_entries`'s own 22023 is ever met.
    await expect(barError(page)).toHaveAttribute("data-code", "rejection_reason_required");
    await expect(barError(page)).not.toContainText("23514");
    await expect(barError(page)).not.toContainText("22023");

    // AC-13. Nothing was written, and nothing the admin did was thrown away: the selection and the
    // typed text are both still there.
    await expect(bar(page)).toHaveAttribute("data-selected", "2");
    await expect(reasonField(page)).toHaveValue("   ");
    await expect(rows(page)).toHaveCount(3);
    await expect(count(page)).toHaveAttribute("data-total", "3");
    await expect(result(page)).toHaveCount(0);

    // AC-4. A reason typed and nothing selected. It is a REFUSAL and not a no-op, because a batch of
    // nothing would otherwise report success on a write that never happened.
    await page.getByTestId("bulk-rejection-clear").click();
    await reasonField(page).fill(REASON);
    await submit(page).click();

    await expect(barError(page)).toBeVisible();
    await expect(barError(page)).toHaveAttribute("data-code", "no_entries_selected");
    await expect(result(page)).toHaveCount(0);
    await expect(count(page)).toHaveAttribute("data-total", "3");
    // The typed reason survives this refusal too — the admin's next act is to tick a row, not to
    // type the sentence again.
    await expect(reasonField(page)).toHaveValue(REASON);
  });

  test("AC-14 and AC-15: the selection is this view's, and changing the view empties it", async ({
    page,
  }) => {
    await threeWaiting(page);

    // AC-15. SELECT ALL MEANS WHAT IS ON SCREEN. Narrowing to one kind is the reachable form of "a
    // matching set larger than what is displayed": three entries match the query, one is displayed,
    // and select-all must reach exactly that one. No id the screen has not displayed is ever part of
    // a batch — which is the property, and it is the same property a second page would test.
    await page.getByTestId("pending-entries-type").selectOption("wfh");
    await expect(rows(page)).toHaveCount(1);

    await page.getByTestId("bulk-rejection-select-all").click();
    await expect(bar(page)).toHaveAttribute("data-selected", "1");

    // AC-14. A batch may only ever contain rows the admin can see AT THE MOMENT THEY SUBMIT IT, so
    // changing the kind filter empties the selection rather than carrying an invisible row into the
    // next batch.
    await page.getByTestId("pending-entries-type").selectOption("pto");
    await expect(rows(page)).toHaveCount(2);
    await expect(bar(page)).toHaveAttribute("data-selected", "0");

    await page.getByTestId("bulk-rejection-select-all").click();
    await expect(bar(page)).toHaveAttribute("data-selected", "2");

    // The date window is the other half of the same fact, and it is one `query` rather than three
    // places to remember.
    await page.getByTestId("pending-entries-window").selectOption("all");
    await expect(bar(page)).toHaveAttribute("data-selected", "0");

    // And the batch that follows reaches exactly the two rows that were ticked — the working-from-
    // home entry, which was never selected, is untouched and still waiting.
    await page.getByTestId("pending-entries-window").selectOption("upcoming");
    await page.getByTestId("pending-entries-type").selectOption("pto");
    await page.getByTestId("bulk-rejection-select-all").click();
    await reasonField(page).fill(REASON);
    await submit(page).click();

    await expect(result(page)).toHaveAttribute("data-requested", "2");
    await expect(result(page)).toHaveAttribute("data-rejected", "2");

    await page.getByTestId("pending-entries-type").selectOption("");
    await expect(rows(page)).toHaveCount(1);
    await expect(rowFor(page, THIRD_WFH.start)).toHaveCount(1);
  });

  test("AC-16: the batch speaks about entries and dates, never about people's leave", async ({
    page,
  }) => {
    await threeWaiting(page);

    await page.getByTestId("bulk-rejection-select-all").click();
    await reasonField(page).fill(REASON);

    // The batch gains NO VOCABULARY the single rejection does not have: the same field, the same
    // question, and the sentence that says a rejection removes nothing and locks nothing.
    await expect(bar(page)).toContainText("What would work instead for these entries?");
    await expect(bar(page)).toContainText("stay theirs to edit or remove");
    await expect(bar(page)).toContainText("not permission to be away");

    await submit(page).click();
    await expect(result(page)).toBeVisible();

    // Charter refusals 1 and 2, asserted as copy because that is where they would be broken first —
    // and this is the criterion the feature row names as hardest to hold here, because one reason on
    // three records is mechanically one judgement about three people. Read over the WHOLE page,
    // including the result sentence and the standing note, in the state the batch leaves behind.
    const body = (await page.locator("body").textContent()) ?? "";
    for (const forbidden of [
      "request",
      "Request",
      "application",
      "Application",
      "đơn",
      "quota",
      "Quota",
      "balance",
      "Balance",
      "entitlement",
      "remaining",
      "Remaining",
      "days left",
      "HR",
    ]) {
      expect(body, `the batch copy must not contain "${forbidden}"`).not.toContain(forbidden);
    }
  });

  test("AC-8: a member is offered no batch control at all", async ({ page }) => {
    await signInAt(page, MEMBER_EMAIL);
    await declare(page, FIRST, 1);

    // ADM-04's refusal already stands in front of this whole screen, so the bar and its controls are
    // not merely disabled for a member — there is nothing here to disable. What refuses a member who
    // reached `seam.rejectEntries` anyway is clause (a), and nothing in src/ (01-plan.md section 3).
    await page.goto(WORKLIST);
    await expect(page.getByTestId("pending-entries-refused")).toBeVisible();

    for (const control of [
      "bulk-rejection",
      "bulk-rejection-reason",
      "bulk-rejection-submit",
      "bulk-rejection-select-all",
      "bulk-rejection-clear",
      "pending-entry-row-select",
    ]) {
      await expect(page.getByTestId(control)).toHaveCount(0);
    }
  });
});
