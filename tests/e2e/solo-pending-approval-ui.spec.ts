import { expect, test, type Locator, type Page } from "@playwright/test";

// SOLO, 2026-09-09 — the approval queue's row, redrawn.
//
// **THIS WORK CARRIES NO TICKET AND NO ACCEPTANCE CRITERIA**, so the numbering below is local to this
// file and is deliberately NOT `AC-n`. What authorises it is `.claude/agents/solo.md`.
//
// **WHAT CHANGED IS THE ROW, AND WHAT DID NOT CHANGE IS EVERYTHING THE ROW CARRIES.** ADM-04's list,
// filters, count and paging, ADM-05's decision panel and ADM-06's selection checkbox are all exactly
// where they were — the operator was asked whether the transcription's omission of them was an
// instruction to remove them and said it was not. Their three suites pass UNEDITED, which is the
// strongest statement available that this is a re-layout; test 4 is the standing version of it.
//
// **TWO THINGS ARE GENUINELY NEW**, and they are the two the transcription is emphatic about:
//   1. The approve control is the COLOUR OF THE ENTRY IT APPROVES — peach for leave, mint for
//      working from home (test 1).
//   2. A row whose dates are already crowded says so (tests 2 and 3).
//
// **THE WARNING REFUSES NOTHING**, which is charter refusal 6 and is the property test 3 exists for.
// A warning beside an approve control is exactly the shape that turns into a block by accident, and
// the only way to know it did not is to approve a crowded day and watch it work.
//
// **THE COUNT IS INV-04's AND NOT THIS SCREEN'S.** `usePageOverload` reads once for the whole page
// and derives every row from `absenceCountsFor`, so a row and a month cell cannot disagree. Test 2
// pins the number rather than merely the presence of a sentence, because a warning that appears with
// the wrong figure is worse than none.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it, `tests/e2e/seam.setup.ts` refuses the run
// otherwise).
//
// Fixtures (`src/lib/fixtures.ts`, and `cal-07-overload-warning.spec.ts` § the arithmetic):
// FIXTURE_TEAM has FOUR active members and an `overload_threshold` of 0.5, so a day is crowded above
// 2.0 — 2.0 raises nothing, 3.0 does. FIXTURE_APPROVED_ENTRY already puts 1.0 on 2026-09-14, so two
// seeded entries take it to 3.0.

const SIGNIN = "/signin";
const PASSWORD = "password123";
const ADMIN_EMAIL = "quan@example.com";
const MEMBER_EMAIL = "thanh@example.com";
const SECOND_ADMIN_EMAIL = "dung@example.com";

/** 1.0 from FIXTURE_APPROVED_ENTRY, plus the two this file seeds onto it: 3.0 of 4, and crowded. */
const CROWDED = "2026-09-14";
/** FIXTURE_APPROVED_ENTRY and nobody else: 1.0 of 4, and never crowded. */
const QUIET = "2026-09-15";

const rows = (page: Page): Locator => page.getByTestId("pending-entry-row");
const rowOn = (page: Page, date: string): Locator =>
  page.locator(`[data-testid="pending-entry-row"][data-start-date="${date}"]`);

async function signInAs(page: Page, email: string): Promise<void> {
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

/** Ends the session without a document load, so entries an earlier step created survive into the
 *  next account's view — the whole reason this file can seed a crowded day across accounts. */
async function signOutFromHome(page: Page): Promise<void> {
  await page.getByTestId("home-sign-out").click();
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
}

/** `page.goBack()` replays a history entry react-router pushed, which is a popstate and not a
 *  reload. `page.goto("/")` would reset the mock's module state and lose the seed. */
async function backToHome(page: Page): Promise<void> {
  for (let step = 0; step < 8; step += 1) {
    if (new URL(page.url()).pathname === "/") break;
    await page.goBack();
  }
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

/** Declares one entry through CAL-01's form, the only path there is. */
async function declare(
  page: Page,
  input: { type: "pto" | "wfh"; date: string },
): Promise<void> {
  await page.getByTestId("home-new-entry-link").click();
  await expect(page.getByTestId("new-entry-form")).toBeVisible();
  await page.getByTestId("new-entry-type").selectOption(input.type);
  await page.getByTestId("new-entry-portion").selectOption("full");
  await page.getByTestId("new-entry-start").fill(input.date);
  await page.getByTestId("new-entry-end").fill(input.date);
  await page.getByTestId("new-entry-tentative").setChecked(false);
  await page.getByTestId("new-entry-submit").click();
  await expect(page.getByTestId("new-entry-error")).toHaveCount(0);
  await backToHome(page);
}

/** **THREE CLICKS SINCE SOLO's TAB STRIP**, and the first two are UIE-09's and UIE-10's: the top-bar
 *  control, then the strip's approvals tab. The destination is unchanged. */
async function openWorklist(page: Page): Promise<void> {
  await page.getByTestId("shell-admin-link").click();
  await page.getByTestId("admin-hub-pending-link").click();
  await expect(page.getByTestId("pending-entries-count")).toBeVisible();
}

/**
 * Two entries on `CROWDED` — one leave, one working from home — plus one on `QUIET`, all waiting in
 * the admin's queue, with the page left on the worklist as `ADMIN_EMAIL`.
 *
 * With both `CROWDED` entries in place the day stands at 3.0 of 4 against a threshold of 2.0. The
 * `QUIET` one stands at 2.0, which is EXACTLY the threshold and therefore not crowded — INV-04 is
 * compared with `>` and never `>=`, and that boundary is what makes test 2's negative half a test.
 */
async function seed(page: Page): Promise<void> {
  await signInAs(page, MEMBER_EMAIL);
  await declare(page, { type: "pto", date: CROWDED });
  await declare(page, { type: "pto", date: QUIET });
  await signOutFromHome(page);

  await signInAs(page, SECOND_ADMIN_EMAIL);
  await declare(page, { type: "wfh", date: CROWDED });
  await signOutFromHome(page);

  await signInAs(page, ADMIN_EMAIL);
  await openWorklist(page);
  await expect(rows(page)).toHaveCount(3);
}

test.describe("SOLO — the approval queue's row", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SIGNIN);
    const loading = page.getByTestId("app-session-loading");
    if (await loading.isVisible()) await expect(loading).toBeHidden();
  });

  test("1: the approve control is the colour of the entry it approves", async ({
    page,
  }) => {
    await seed(page);

    // **THE FILL FOLLOWS `data-type`, ASSERTED AGAINST THE ROW'S OWN TYPE RATHER THAN AGAINST A
    // LIST.** A control coloured from a constant would pass a check that only looked at one row;
    // this reads each row's declared type and demands the matching token.
    const count = await rows(page).count();
    expect(count).toBeGreaterThan(1);

    const seenTypes = new Set<string>();
    for (let i = 0; i < count; i += 1) {
      const row = rows(page).nth(i);
      const type = await row.getAttribute("data-type");
      expect(type, "every row declares its type").toMatch(/^(pto|wfh)$/);
      seenTypes.add(type ?? "");

      const approve = row.getByTestId("entry-decision-approve");
      await expect(approve).toHaveAttribute("data-type", type ?? "");
      await expect(approve).toHaveClass(
        new RegExp(`\\bbg-${type === "pto" ? "pto" : "wfh"}\\b`),
      );
    }

    // BOTH TOKENS ACTUALLY APPEAR, which is what makes the loop a test rather than a tautology: a
    // control stuck on one fill passes every line above until this one.
    expect(seenTypes).toEqual(new Set(["pto", "wfh"]));

    // The accessible name is still the word. The star `CLAUDE.md` § Visual direction gives an
    // approved entry sits on this control as decoration, `aria-hidden`, outside the word — so the
    // control an admin's screen reader announces did not change when its look did.
    await expect(
      rows(page).first().getByTestId("entry-decision-approve"),
    ).toContainText("Approve");
  });

  test("2: a crowded row says so, with the count INV-04 gives, and a quiet row says nothing", async ({
    page,
  }) => {
    await seed(page);

    // THE CROWDED DAY. 3.0 of 4 against a threshold of 2.0 — the two seeded entries plus
    // FIXTURE_APPROVED_ENTRY. Both rows on that date carry the sentence, because it is a fact about
    // the DAY and not about whose row it is.
    const crowded = rowOn(page, CROWDED);
    await expect(crowded).toHaveCount(2);

    for (let i = 0; i < 2; i += 1) {
      const warning = crowded.nth(i).getByTestId("pending-entry-row-overload");
      await expect(warning).toHaveCount(1);
      await expect(warning).toHaveAttribute("data-date", CROWDED);

      // **THE NUMBER, NOT JUST THE SENTENCE.** A warning that appears with the wrong figure is worse
      // than none, and the figure is INV-04's — the same arithmetic the month grid paints, so this
      // row and that cell cannot disagree.
      await expect(warning).toHaveAttribute("data-count", "3");
      await expect(warning).toContainText("3");
      await expect(warning).toContainText(CROWDED);
    }

    // **THE QUIET DAY STANDS AT EXACTLY 2.0, WHICH IS THE THRESHOLD AND NOT ABOVE IT.** INV-04 is
    // compared with `>` and never `>=`; a boundary read as `>=` would light this row, so this is the
    // half of the criterion that catches an off-by-one rather than an absence.
    const quiet = rowOn(page, QUIET);
    await expect(quiet).toHaveCount(1);
    await expect(quiet.getByTestId("pending-entry-row-overload")).toHaveCount(0);
  });

  test("3: the warning refuses nothing — a crowded day is still approvable", async ({
    page,
  }) => {
    await seed(page);

    const crowded = rowOn(page, CROWDED).first();
    await expect(
      crowded.getByTestId("pending-entry-row-overload"),
    ).toBeVisible();

    // **CHARTER REFUSAL 6, AND THE ONLY WAY TO KNOW IT HOLDS IS TO USE THE CONTROL.** A warning
    // beside an approve button is exactly the shape that becomes a block by accident — a `disabled`
    // added in passing, a guard in the click handler — and a test that only asserted the sentence
    // was visible would pass through every one of those.
    const approve = crowded.getByTestId("entry-decision-approve");
    await expect(approve).toBeEnabled();
    await approve.click();

    // It left the queue, and the count fell with it. ADM-05 AC-1's behaviour, unchanged.
    await expect(rows(page)).toHaveCount(2);
    await expect(page.getByTestId("pending-entries-count")).toHaveAttribute(
      "data-total",
      "2",
    );
  });

  test("4: everything the row already carried is still on it", async ({
    page,
  }) => {
    await seed(page);

    const row = rows(page).first();

    // ADM-06's selection checkbox, ADM-04's link to the entry, ADM-05's decision panel. The
    // transcription draws none of the three; the operator was asked and said its omission was not
    // an instruction to remove them. This is the assertion that says nothing was quietly lost while
    // the row was being redrawn.
    await expect(row.getByTestId("pending-entry-row-select")).toHaveCount(1);
    await expect(row.getByTestId("pending-entry-row-link")).toHaveAttribute(
      "href",
      /\/entries\/.+\/edit$/,
    );
    await expect(row.getByTestId("entry-decision")).toHaveCount(1);
    await expect(row.getByTestId("entry-decision-reject")).toHaveCount(1);

    // ADM-04's own three verbs, on the screen rather than the row. Both filters are ONE `<select>`
    // each and neither is collapsed behind a control — ADM-04 01-plan.md § 2: the default window
    // hides rows, so the control is what advertises the sets it is not showing.
    await expect(page.getByTestId("pending-entries-count")).toBeVisible();
    await expect(page.getByTestId("pending-entries-window")).toHaveCount(1);
    await expect(
      page.getByTestId("pending-entries-window").locator("option"),
    ).toHaveCount(3);
    await expect(page.getByTestId("pending-entries-type")).toHaveCount(1);
    await expect(page.getByTestId("pending-entries-page")).toBeVisible();

    // And the row still declares every fact a test elsewhere reads off it. These attributes are the
    // interface eight other criteria in three suites address, and they survived the redraw.
    for (const attribute of [
      "data-entry-id",
      "data-member-id",
      "data-type",
      "data-portion",
      "data-start-date",
      "data-end-date",
      "data-tentative",
    ]) {
      await expect(row).toHaveAttribute(attribute, /.+/);
    }
  });
});
