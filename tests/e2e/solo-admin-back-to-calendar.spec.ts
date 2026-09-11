import { expect, test, type Page } from "@playwright/test";

// SOLO, 2026-09-11 — the top-bar control is the way BOTH ways.
//
// **THIS WORK CARRIES NO TICKET AND NO ACCEPTANCE CRITERIA**, so the numbering below is local to this
// file and is deliberately NOT `AC-n` — an `AC-` prefix is a claim that a plan document states the
// criterion. What authorises the work is `.claude/agents/solo.md`.
//
// **WHAT THIS CHANGE IS, IN ONE SENTENCE.** The pill to the left of `+ Book` still opens the admin
// area from anywhere inside the shell; standing on any of the six admin addresses it now reads
// `Calendar` and goes back to `/`.
//
// **ONE ELEMENT AND ONE ID, NOT TWO.** It is the same control — the way between the calendar and the
// admin area — so it keeps `shell-admin-link`. The alternative was a second id for the second face,
// which would have left the twelve `toHaveCount(0)` member denials across this suite split between a
// name that renders for an admin and a name that renders for nobody; an assertion against a name
// nothing renders passes for ever and states nothing, which is the defect UIE-10 AC-4 was written to
// undo. `data-state` carries which face is showing — `admin` or `calendar` — because the id no
// longer names the destination.
//
// **WHAT IT COSTS, STATED RATHER THAN DISCOVERED LATER.** Reaching the hub FROM one of the five
// destination screens used to be one press of this control and is now two: `Calendar`, then `Admin`.
// The strip carries no hub tab, so there is no third way. The operator was shown that cost — with
// the alternative of confining the toggle to `/admin` alone — and chose all six addresses.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it, `tests/e2e/seam.setup.ts` refuses the run
// otherwise). Fixtures (`src/lib/fixtures.ts`): FIXTURE_TEAM carries two admins and two members.

const PASSWORD = "password123";
const ADMIN_EMAIL = "quan@example.com";
const MEMBER_EMAIL = "thanh@example.com";

/** § Language's own pattern, from `ui-language.json`. */
const DIACRITIC = /[À-ɏḀ-ỿ]/;

/** The six admin addresses, with the hub first and then the five the strip names in UIE-09 § 2b's
 *  order. Its own copy rather than an import of `ADMIN_ADDRESSES`, for the reason
 *  `solo-admin-tabs.spec.ts` keeps its own copy of the tabs: a test that imports the list under test
 *  asserts only that the component was handed something, and the MEMBERSHIP of this list is the
 *  thing being pinned. */
const ADMIN_ADDRESSES = [
  "/admin",
  "/entries/pending",
  "/entries/team",
  "/members",
  "/signups",
  "/threshold",
];

/** Addresses inside the shell that are NOT administrative — one with a period cluster and two
 *  without, so the control's other face is asserted on both kinds. `/` is the landing week. */
const CALENDAR_ADDRESSES = ["/", "/week/2026-04-06", "/month/2026-04", "/year/2026", "/entries/new"];

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/signin");
  const loading = page.getByTestId("app-session-loading");
  if (await loading.isVisible()) await expect(loading).toBeHidden();
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

const control = (page: Page) => page.getByTestId("shell-admin-link");

test.describe("SOLO — the Admin control goes back to the calendar", () => {
  test("1: on every admin address it reads Calendar and points at the calendar", async ({
    page,
  }) => {
    await signIn(page, ADMIN_EMAIL);

    for (const address of ADMIN_ADDRESSES) {
      await page.goto(address);

      // ONE NODE, and it is still `shell-admin-link`. The count is asserted because a second face
      // built as a second element — rather than as two states of one — would put two controls in
      // this cluster on exactly these six screens and nowhere else.
      await expect(control(page)).toHaveCount(1);
      await expect(control(page)).toHaveAttribute("data-state", "calendar");
      await expect(control(page)).toHaveAttribute("href", "/");
      await expect(control(page)).toHaveText("Calendar");
    }
  });

  test("2: everywhere else inside the shell it is unchanged — Admin, pointing at the hub", async ({
    page,
  }) => {
    await signIn(page, ADMIN_EMAIL);

    for (const address of CALENDAR_ADDRESSES) {
      await page.goto(address);
      await expect(control(page)).toHaveCount(1);
      await expect(control(page)).toHaveAttribute("data-state", "admin");
      await expect(control(page)).toHaveAttribute("href", "/admin");
      await expect(control(page)).toHaveText("Admin");
    }
  });

  test("3: the round trip is two presses of the same control, with no address typed", async ({
    page,
  }) => {
    await signIn(page, ADMIN_EMAIL);

    // In. The landing screen is the current week, which is a calendar address.
    await expect(control(page)).toHaveAttribute("data-state", "admin");
    await control(page).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByTestId("admin-hub")).toBeVisible();

    // Out, from the hub.
    await expect(control(page)).toHaveAttribute("data-state", "calendar");
    await control(page).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId("admin-hub")).toHaveCount(0);

    // **AND OUT FROM A DESTINATION AND NOT ONLY FROM THE HUB**, which is the half that makes this a
    // change to the ADMIN AREA rather than to one screen. In through the control and the strip, out
    // through the control alone.
    await control(page).click();
    await page.getByTestId("admin-hub-threshold-link").click();
    await expect(page).toHaveURL(/\/threshold$/);

    await expect(control(page)).toHaveAttribute("data-state", "calendar");
    await control(page).click();
    await expect(page).toHaveURL(/\/$/);

    // No `page.goto` anywhere above: the whole trip is one document and one session, so the mock
    // seam's module state is the same at the end as at the start.
  });

  test("4: the hub is still reachable from a destination — two presses, not one", async ({
    page,
  }) => {
    await signIn(page, ADMIN_EMAIL);
    await control(page).click();
    await page.getByTestId("admin-hub-members-link").click();
    await expect(page).toHaveURL(/\/members$/);

    // THE COST, ASSERTED RATHER THAN LEFT AS A COMMENT. There is no hub tab in the strip, so this
    // is the route back to it: out to the calendar, then in again.
    await control(page).click();
    await expect(page).toHaveURL(/\/$/);
    await control(page).click();
    await expect(page.getByTestId("admin-hub")).toBeVisible();

    // And the strip is not on the calendar — the screen the first press lands on is the week grid,
    // not an admin screen wearing a calendar label.
    await page.goto("/");
    await expect(page.getByTestId("admin-tabs")).toHaveCount(0);
  });

  test("5: a member is offered neither face", async ({ page }) => {
    await signIn(page, MEMBER_EMAIL);

    // **ABSENT ON BOTH KINDS OF ADDRESS, AND THIS IS THE ASSERTION THE ONE-ID DECISION PROTECTS.**
    // A member who types an admin address is refused by the screen at the far end; what they must
    // not be handed anywhere is a control into the area. `shell-admin-link` renders for an admin and
    // not for a member, so these lines can still fail — which is the only reason they are worth
    // running.
    for (const address of [...CALENDAR_ADDRESSES, ...ADMIN_ADDRESSES]) {
      await page.goto(address);
      await expect(page.getByTestId("shell-topbar")).toBeVisible();
      await expect(control(page)).toHaveCount(0);
    }
  });

  test("6: both labels are English", async ({ page }) => {
    await signIn(page, ADMIN_EMAIL);

    // The control as PAINTED, in both states — the half the lint rule cannot check, since eslint
    // reads the source and a diacritic could still arrive through a fixture or a seam message. It is
    // the same criterion UIE-09 AC-12 states, extended to the face that did not exist then.
    expect(await control(page).innerText()).not.toMatch(DIACRITIC);
    await control(page).click();
    await expect(page).toHaveURL(/\/admin$/);
    expect(await control(page).innerText()).not.toMatch(DIACRITIC);
  });
});
