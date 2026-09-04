import { expect, test, type Page } from "@playwright/test";

// ADM-01 — set the overload threshold.
//
// Written from 01-plan.md sections 2, 4.3 and 5. Every locator is a `data-testid` named in the
// selector table of section 4.3, plus `home-threshold-link` (also section 4.3), `sign-in-*`,
// `home-*` and `month-threshold` — the last belonging to CAL-04 and read, never written, which is
// what AC-13 is.
//
// **THE DIVISION OF LABOUR WITH tests/threshold.test.ts IS DELIBERATE.** AC-5, AC-9 and AC-14 are
// refusals BELOW the interface: they call the seam with a chosen caller, which this suite cannot do
// because it drives a browser. They are asserted there. What is asserted here is what a person
// SEES — the value, the save, the refusal, the two validation messages, the link, and the month
// view changing underneath.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it, tests/e2e/seam.setup.ts refuses the run
// otherwise), so every refusal below is the mock's reproduction of `team_update_admin` and of
// `grant update (overload_threshold) on public.team`. The real mechanisms are in
// supabase/migrations/20260905000000_adm01_team_threshold.sql and are exercised by no test until a
// project is provisioned — RULE-09 keeps applying it human.
//
// EACH TEST GETS FRESH MOCK STATE, because the mock's `team` table lives in module memory and a
// `page.goto` reloads the module. Navigation WITHIN a test is therefore done by clicking links,
// which react-router handles client-side without a document load — the constraint CAL-01's,
// CAL-02's, CAL-03's and CAL-04's suites all record. It is also why AC-3 is asserted as *leaving
// the screen and returning* rather than as a reload: 01-plan.md's Changelog amended the criterion
// for exactly this reason.
//
// Fixtures (src/lib/fixtures.ts, mirrored in supabase/seed.sql):
// - Admin:  quan@example.com  (FIXTURE_ADMIN, role admin, FIXTURE_TEAM)
// - Member: thanh@example.com (FIXTURE_MEMBER, role member, FIXTURE_TEAM)
//
// FIXTURE_TEAM's seeded `overload_threshold` is 0.5, which the screen speaks as 50%.

const SIGNIN = "/signin";
const THRESHOLD = "/threshold";
const PASSWORD = "password123";

const ADMIN_EMAIL = "quan@example.com";
const MEMBER_EMAIL = "thanh@example.com";

async function signIn(page: Page, email: string): Promise<void> {
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

/** Signs in and reaches the screen through its LINK, which keeps one page lifetime — a
 *  `page.goto(THRESHOLD)` would discard anything an earlier step in the same test saved. */
async function openThreshold(page: Page, email: string): Promise<void> {
  await signIn(page, email);
  await expect(page.getByTestId("home-threshold-link")).toBeVisible();
  await page.getByTestId("home-threshold-link").click();
  await expect(page.getByTestId("threshold-current")).toBeVisible();
}

/** Types a value and presses save. The input is cleared first, so a helper that describes the value
 *  it saves cannot inherit whatever the field was left holding. */
async function save(page: Page, value: string): Promise<void> {
  await page.getByTestId("threshold-input").fill(value);
  await page.getByTestId("threshold-save").click();
}

test.describe("ADM-01 set the overload threshold", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(SIGNIN);
    const loading = page.getByTestId("app-session-loading");
    if (await loading.isVisible()) await expect(loading).toBeHidden();
  });

  test("AC-1: an admin sees the current value, and the input is pre-filled with it", async ({
    page,
  }) => {
    await openThreshold(page, ADMIN_EMAIL);

    await expect(page.getByTestId("threshold-current")).toContainText("50%");
    // The FRACTION, so this assertion is about the stored share and not about rendered copy.
    await expect(page.getByTestId("threshold-current")).toHaveAttribute("data-threshold", "0.5");
    await expect(page.getByTestId("threshold-input")).toHaveValue("50");
  });

  test("AC-2: an admin changes the threshold and the screen reports it saved", async ({ page }) => {
    await openThreshold(page, ADMIN_EMAIL);
    await save(page, "60");

    await expect(page.getByTestId("threshold-saved")).toBeVisible();
    await expect(page.getByTestId("threshold-current")).toContainText("60%");
    await expect(page.getByTestId("threshold-current")).toHaveAttribute("data-threshold", "0.6");
    await expect(page.getByTestId("threshold-error")).toHaveCount(0);
  });

  test("AC-3: the value is read back from the datastore when the screen is opened again", async ({
    page,
  }) => {
    await openThreshold(page, ADMIN_EMAIL);
    await save(page, "60");
    await expect(page.getByTestId("threshold-saved")).toBeVisible();

    // Leave and come back. Nothing the previous screen held survives — the component unmounts and
    // the value on the second visit came from `getTeam()`, which is the whole of this criterion.
    await page.getByTestId("threshold-back").click();
    await expect(page.getByTestId("home-threshold-link")).toBeVisible();
    await page.getByTestId("home-threshold-link").click();

    await expect(page.getByTestId("threshold-current")).toContainText("60%");
    await expect(page.getByTestId("threshold-current")).toHaveAttribute("data-threshold", "0.6");
    await expect(page.getByTestId("threshold-input")).toHaveValue("60");
  });

  test("AC-12: saving the same value again is not an error", async ({ page }) => {
    await openThreshold(page, ADMIN_EMAIL);
    await save(page, "60");
    await expect(page.getByTestId("threshold-saved")).toBeVisible();

    await save(page, "60");
    await expect(page.getByTestId("threshold-saved")).toBeVisible();
    await expect(page.getByTestId("threshold-error")).toHaveCount(0);
    await expect(page.getByTestId("threshold-input-error")).toHaveCount(0);
    await expect(page.getByTestId("threshold-current")).toHaveAttribute("data-threshold", "0.6");
  });

  test("AC-4: a member who types the address is refused, with no input and no save", async ({
    page,
  }) => {
    await signIn(page, MEMBER_EMAIL);
    // Typed rather than followed: AC-10 is that there IS no link for this caller, so the address bar
    // is the only way in and the refusal has to come from the screen itself.
    await page.goto(THRESHOLD);

    await expect(page.getByTestId("threshold-refused")).toBeVisible();
    await expect(page.getByTestId("threshold-input")).toHaveCount(0);
    await expect(page.getByTestId("threshold-save")).toHaveCount(0);
    await expect(page.getByTestId("threshold-current")).toHaveCount(0);
  });

  test("AC-6: a caller with no session reaches no threshold and learns nothing", async ({
    page,
  }) => {
    await page.goto(THRESHOLD);

    // The route sends a caller with no member row to `/`, which resolves by membership to the
    // sign-in screen. What matters for the criterion is the second half: no value and no team.
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
    await expect(page.getByTestId("threshold-current")).toHaveCount(0);
    await expect(page.getByTestId("threshold-input")).toHaveCount(0);
  });

  test("AC-7: a value outside 0 to 100 is refused before any write", async ({ page }) => {
    await openThreshold(page, ADMIN_EMAIL);

    await save(page, "101");
    await expect(page.getByTestId("threshold-input-error")).toContainText("0%");
    await expect(page.getByTestId("threshold-input-error")).toContainText("100%");
    await expect(page.getByTestId("threshold-saved")).toHaveCount(0);
    await expect(page.getByTestId("threshold-current")).toHaveAttribute("data-threshold", "0.5");

    await save(page, "-1");
    await expect(page.getByTestId("threshold-input-error")).toBeVisible();
    await expect(page.getByTestId("threshold-saved")).toHaveCount(0);
    await expect(page.getByTestId("threshold-current")).toHaveAttribute("data-threshold", "0.5");
  });

  test("AC-7: 0 and 100 are both admitted", async ({ page }) => {
    // Both ends are meaningful against the glossary's strictly-greater comparison — at 0% any day
    // with one absence is crowded and an empty day is not, at 100% no day ever is — so neither is a
    // degenerate state the product refuses (01-plan.md Open question 2).
    await openThreshold(page, ADMIN_EMAIL);

    await save(page, "0");
    await expect(page.getByTestId("threshold-saved")).toBeVisible();
    await expect(page.getByTestId("threshold-current")).toHaveAttribute("data-threshold", "0");

    await save(page, "100");
    await expect(page.getByTestId("threshold-saved")).toBeVisible();
    await expect(page.getByTestId("threshold-current")).toHaveAttribute("data-threshold", "1");
  });

  test("AC-8: an empty or fractional value is refused before any write", async ({ page }) => {
    await openThreshold(page, ADMIN_EMAIL);

    await save(page, "");
    await expect(page.getByTestId("threshold-input-error")).toContainText("whole percentage");
    await expect(page.getByTestId("threshold-saved")).toHaveCount(0);
    await expect(page.getByTestId("threshold-current")).toHaveAttribute("data-threshold", "0.5");

    await save(page, "60.5");
    await expect(page.getByTestId("threshold-input-error")).toContainText("whole percentage");
    await expect(page.getByTestId("threshold-saved")).toHaveCount(0);
    await expect(page.getByTestId("threshold-current")).toHaveAttribute("data-threshold", "0.5");

    // Text that is not a number cannot be TYPED into a `type="number"` input — the browser holds an
    // empty value for it — so the third case of AC-8 arrives at the same branch as the first, which
    // is what the assertion above covers. 03-impl-log.md records this.
  });

  test("AC-10: the link is shown to an admin and to nobody else", async ({ page }) => {
    await signIn(page, ADMIN_EMAIL);
    await expect(page.getByTestId("home-threshold-link")).toBeVisible();

    // Sign out WITHOUT a document load, so the second half runs against the same page lifetime.
    await page.getByTestId("home-sign-out").click();
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();

    await signIn(page, MEMBER_EMAIL);
    await expect(page.getByTestId("home-threshold-link")).toHaveCount(0);
  });

  test("AC-13: the new threshold reclassifies the days already on screen", async ({ page }) => {
    await openThreshold(page, ADMIN_EMAIL);
    await save(page, "60");
    await expect(page.getByTestId("threshold-saved")).toBeVisible();

    // To the month grid by links only, so the save above survives. CAL-04's screen reads
    // `team.overloadThreshold` and needs no change for this to hold — if it did, this criterion
    // would be describing a CAL-04 defect (01-plan.md section 7).
    await page.getByTestId("threshold-back").click();
    await page.getByTestId("home-week-link").click();
    await expect(page.getByTestId("week-month")).toBeVisible();
    await page.getByTestId("week-month").click();

    const shown = page.getByTestId("month-threshold");
    await expect(shown).toHaveAttribute("data-threshold", "0.6");
    await expect(shown).toContainText("60%");
  });

  test("AC-11: nothing anywhere is blocked by the threshold, even at 0%", async ({ page }) => {
    // Charter refusal 6, asserted at the setting that makes EVERY non-empty day crowded. If a
    // warning were ever going to become a block, this is the value at which it would.
    await openThreshold(page, ADMIN_EMAIL);
    await save(page, "0");
    await expect(page.getByTestId("threshold-saved")).toBeVisible();

    await page.getByTestId("threshold-back").click();
    await page.getByTestId("home-new-entry-link").click();
    await expect(page.getByTestId("new-entry-form")).toBeVisible();

    await page.getByTestId("new-entry-type").selectOption("pto");
    await page.getByTestId("new-entry-portion").selectOption("full");
    await page.getByTestId("new-entry-start").fill("2026-10-12");
    await page.getByTestId("new-entry-end").fill("2026-10-12");
    await page.getByTestId("new-entry-tentative").setChecked(false);
    await page.getByTestId("new-entry-submit").click();

    await expect(page.getByTestId("own-entry-row")).toHaveCount(1);
    await expect(page.getByTestId("new-entry-error")).toHaveCount(0);
  });
});
