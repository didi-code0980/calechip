import { expect, test, type Locator, type Page } from "@playwright/test";

// ADM-04 — the worklist of entries awaiting a decision.
//
// Written from 01-plan.md sections 2, 2b, 3, 4.3 and 4.5. Every locator is a `data-testid` from the
// selector table in section 4.5; the ones this file uses that are NOT in that table —
// `sign-in-*`, `home-sign-out`, `home-new-entry-link`, `home-team-entries-link`, `new-entry-*`,
// `own-entry-row`, `edit-entry-form`, `not-on-a-team-*` — belong to TEA-01, TEA-05, CAL-01, CAL-02
// and CAL-03 and are declared in 03-impl-log.md § Deviations.
//
// **THE DIVISION OF LABOUR WITH tests/pending-entries.test.ts IS THE STANDARD'S.**
// `.ai/standards/testing-standards.md` puts pure logic and seam behaviour at the unit level and "a
// full acceptance criterion through the interface" at this one. So the predicate, the order, the
// paging arithmetic and the exact count are asserted there against `listPendingEntries` directly,
// and this file asserts what an ADMIN SEES: the rows, the names on them, the two filters changing
// what is listed, the sentence an empty queue says, the link off each row, and — AC-9 — the controls
// that are not there.
//
// **AC-3, AC-4, AC-5 AND AC-16 ARE ASSERTED IN tests/pending-entries.test.ts OR NOWHERE, AND THAT IS
// DECLARED IN 03-impl-log.md.** It is the same shape CAL-05, CAL-06 and CAL-08 each recorded:
// - AC-3 and AC-4 need a matching set larger than `PENDING_PAGE_SIZE`, which is 50. Creating
//   fifty-one entries through this form would spend minutes of wall clock proving arithmetic. What
//   IS asserted here is that the paging control exists, states the page it is on, and is correctly
//   inert on a set that fits in one page.
// - AC-5 is a throw inside the seam on a page the datastore shortened. The mock's slice and its
//   count come from one array so the two cannot disagree, and no test can make PostgREST cap a read
//   without a provisioned project. The BRANCH is `pending-entries-unavailable`, which is rendered by
//   the same `catch` every other read on this screen falls into.
// - AC-16 needs the process timezone changed under the read, which a browser test cannot do.
//
// **THE PENDING ENTRIES BELOW ARE CREATED THROUGH THE PRODUCT AND NOT SEEDED, which is a declared
// deviation from 01-plan.md section 4.4.** Every active member of FIXTURE_TEAM has an own-entry list
// whose exact row count is asserted by a shipped suite — `own-entries-empty` for
// `thanh@example.com` at cal-01-create-entry.spec.ts:72, two rows for `linh@example.com` at
// cal-03-admin-edit-entry.spec.ts:183, one row for `quan@example.com` at
// cal-07-overload-warning.spec.ts:418, one row for `dung@example.com` at
// cal-07-overload-warning.spec.ts:302 — so a seeded pending entry breaks one of them whoever owns
// it, and 01-plan.md section 7 requires all of those suites to pass UNEDITED. Creating the rows is
// also the truthful route: `status` is the column default, a pending entry is exactly what CAL-01's
// form produces, and nothing here needs a state the product cannot reach.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it, tests/e2e/seam.setup.ts refuses the run
// otherwise), so the team scoping asserted below is the mock's reproduction of `entry_select_team`
// and `member_select_team`. This ticket ships no policy and no migration — every read it makes was
// already permitted (01-plan.md sections 3, 5 and 6).
//
// EACH TEST GETS FRESH MOCK STATE, because the mock's tables live in module memory and a `page.goto`
// reloads the module. ITS SESSION DOES NOT RESET: mock.ts writes the session to `localStorage`
// exactly as `@supabase/auth-js` does, so switching people is done by signing out, and navigation
// within a test is done by clicking links — the constraint every suite from CAL-01 onwards records.
//
// Fixtures (src/lib/fixtures.ts, mirrored in supabase/seed.sql). Two entries exist before any test
// runs, and BOTH must stay off this list:
// - FIXTURE_APPROVED_ENTRY — 14 to 16 September 2026, owned by `linh@example.com`, `approved`. The
//   row that appears if the status predicate is dropped (AC-1).
// - FIXTURE_OTHER_TEAM_ENTRY — 21 to 22 September 2026, owned by the OTHER team's member, and
//   already `pending`. The only thing keeping it out is the team scope, which is what makes AC-13
//   assertable at all rather than vacuous.

const PASSWORD = "password123";
const ADMIN_EMAIL = "quan@example.com";
const MEMBER_EMAIL = "thanh@example.com";
const APPROVED_EMAIL = "linh@example.com";
const MEMBER_LESS_EMAIL = "hoa@example.com";

const WORKLIST = "/entries/pending";

// Transcribed rather than imported: the acceptance suite addresses the application through the
// browser and does not import from src/.
const MEMBER_ID = "55555555-5555-4555-8555-555555555555";
const APPROVED_MEMBER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MEMBER_NAME = "Thành viên";
const APPROVED_NAME = "Đã duyệt";
const APPROVED_ENTRY_ID = "dd000000-0000-4000-8000-000000000001";
const OTHER_TEAM_ENTRY_ID = "dd000000-0000-4000-8000-000000000002";

/** Permanently upcoming, and far outside every window the calendar screens are used for. */
const UPCOMING = { start: "2030-03-04", end: "2030-03-06" };
const UPCOMING_WFH = { start: "2030-03-11", end: "2030-03-11" };
/** Permanently past: before the day this ticket was planned. */
const PAST = { start: "2025-03-04", end: "2025-03-06" };

const rows = (page: Page): Locator => page.getByTestId("pending-entry-row");

const rowFor = (page: Page, startDate: string): Locator =>
  page.locator(`[data-testid="pending-entry-row"][data-start-date="${startDate}"]`);

const count = (page: Page): Locator => page.getByTestId("pending-entries-count");

async function signIn(page: Page, email: string): Promise<void> {
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
}

/**
 * Signed out at the worklist address, then signed in — WITHOUT a document load after the sign-in.
 *
 * The route is guarded on membership the way `/threshold` is, so a signed-out caller never reaches
 * the component: `/entries/pending` sends them to `/`, which resolves to the sign-in screen. There
 * is therefore no `pending-entries-sign-in` to click, unlike the calendar views.
 */
async function signInAt(page: Page, email: string): Promise<void> {
  await page.goto(WORKLIST);
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  await signIn(page, email);
}

/** Ends the session and starts another, all client-side, so the mock's tables survive. */
async function switchTo(page: Page, email: string): Promise<void> {
  await page.getByTestId("home-sign-out").click();
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  await signIn(page, email);
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

/** Declares one entry through CAL-01's form, from Home, and returns to Home. `owned` is how many
 *  entries the signed-in member holds afterwards — the wait that proves the write landed. */
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

/** Opens the worklist from Home, by the admin link this ticket adds. */
async function openWorklist(page: Page): Promise<void> {
  await page.getByTestId("home-pending-entries-link").click();
  await expect(page.getByTestId("pending-entries-count")).toBeVisible();
}

test.describe("ADM-04 — the worklist of entries awaiting a decision", () => {
  test("AC-1, AC-2 and AC-13: the pending entries of this team, named, and nothing else", async ({
    page,
  }) => {
    await signInAt(page, MEMBER_EMAIL);
    await declare(page, UPCOMING, 1);
    await switchTo(page, ADMIN_EMAIL);
    await openWorklist(page);

    // AC-1. One row, and it is the pending one that was just created.
    await expect(rows(page)).toHaveCount(1);
    await expect(rowFor(page, UPCOMING.start)).toHaveAttribute("data-end-date", UPCOMING.end);
    await expect(rowFor(page, UPCOMING.start)).toHaveAttribute("data-member-id", MEMBER_ID);

    // AC-2. The column that makes this a worklist rather than a list of anonymous rows.
    await expect(rowFor(page, UPCOMING.start).getByTestId("pending-entry-row-member")).toHaveText(
      MEMBER_NAME,
    );

    // AC-1's other half. FIXTURE_APPROVED_ENTRY belongs to this team and is `approved`, so it is the
    // row that appears the moment the status predicate is dropped.
    await expect(
      page.locator(`[data-testid="pending-entry-row"][data-entry-id="${APPROVED_ENTRY_ID}"]`),
    ).toHaveCount(0);

    // AC-13 and INV-07. FIXTURE_OTHER_TEAM_ENTRY is PENDING, so the status predicate does not hide
    // it — the only thing keeping it off this screen is the team scope, which is what makes this
    // assertion mean something rather than pass for the wrong reason.
    await expect(
      page.locator(`[data-testid="pending-entry-row"][data-entry-id="${OTHER_TEAM_ENTRY_ID}"]`),
    ).toHaveCount(0);

    // AC-3's rendered half: the exact figure, beside the number of rows on screen.
    await expect(count(page)).toHaveAttribute("data-total", "1");
    await expect(count(page)).toHaveAttribute("data-shown", "1");
  });

  test("AC-6 and AC-7: the default window hides past-dated entries, and a filter reaches them", async ({
    page,
  }) => {
    await signInAt(page, MEMBER_EMAIL);
    await declare(page, UPCOMING, 1);
    await declare(page, PAST, 2);
    await switchTo(page, ADMIN_EMAIL);
    await openWorklist(page);

    // AC-6. The default window, chosen by nobody, shows the one still to come and counts only it.
    await expect(page.getByTestId("pending-entries-window")).toHaveAttribute(
      "data-window",
      "upcoming",
    );
    await expect(rows(page)).toHaveCount(1);
    await expect(rowFor(page, UPCOMING.start)).toHaveCount(1);
    await expect(rowFor(page, PAST.start)).toHaveCount(0);
    await expect(count(page)).toHaveAttribute("data-total", "1");

    // AC-7. The past-dated entry is REACHABLE and is still `pending` — nobody ever decided it, and
    // there is no fourth `entry_status` (01-plan.md section 1, Out of scope).
    await page.getByTestId("pending-entries-window").selectOption("past");
    await expect(page.getByTestId("pending-entries-window")).toHaveAttribute("data-window", "past");
    await expect(rows(page)).toHaveCount(1);
    await expect(rowFor(page, PAST.start)).toHaveCount(1);
    await expect(count(page)).toHaveAttribute("data-total", "1");

    // And `all` is the union, so the control advertises the sets it is not showing.
    await page.getByTestId("pending-entries-window").selectOption("all");
    await expect(rows(page)).toHaveCount(2);
    await expect(count(page)).toHaveAttribute("data-total", "2");
  });

  test("AC-8: work-from-home entries are listed, and the type filter narrows the list and the count", async ({
    page,
  }) => {
    await signInAt(page, MEMBER_EMAIL);
    await declare(page, UPCOMING, 1);
    await switchTo(page, APPROVED_EMAIL);
    // Two, because FIXTURE_APPROVED_ENTRY already belongs to this account.
    await declare(page, { ...UPCOMING_WFH, type: "wfh" }, 2);
    await switchTo(page, ADMIN_EMAIL);
    await openWorklist(page);

    // 01-plan.md section 2, Open questions item 1's assumption, observed: a WFH entry goes through
    // approval exactly as a PTO entry does. Both are on the list with no type chosen.
    await expect(page.getByTestId("pending-entries-type")).toHaveAttribute("data-type", "");
    await expect(rows(page)).toHaveCount(2);
    await expect(count(page)).toHaveAttribute("data-total", "2");
    await expect(rowFor(page, UPCOMING_WFH.start)).toHaveAttribute("data-type", "wfh");
    await expect(rowFor(page, UPCOMING_WFH.start)).toHaveAttribute(
      "data-member-id",
      APPROVED_MEMBER_ID,
    );
    // AC-2 again, on a SECOND owner: the queue is the team's and not one person's, and the name
    // comes from the roster read rather than from the entry.
    await expect(rowFor(page, UPCOMING_WFH.start).getByTestId("pending-entry-row-member")).toHaveText(
      APPROVED_NAME,
    );

    await page.getByTestId("pending-entries-type").selectOption("pto");
    await expect(rows(page)).toHaveCount(1);
    await expect(rowFor(page, UPCOMING.start)).toHaveCount(1);
    await expect(count(page)).toHaveAttribute("data-total", "1");

    await page.getByTestId("pending-entries-type").selectOption("wfh");
    await expect(rows(page)).toHaveCount(1);
    await expect(rowFor(page, UPCOMING_WFH.start)).toHaveCount(1);
    await expect(count(page)).toHaveAttribute("data-total", "1");
  });

  test("AC-9 and AC-15: no approve control, no reject control, and no employment vocabulary", async ({
    page,
  }) => {
    await signInAt(page, MEMBER_EMAIL);
    await declare(page, UPCOMING, 1);
    await switchTo(page, ADMIN_EMAIL);
    await openWorklist(page);

    await expect(rows(page)).toHaveCount(1);

    // AC-9. The denial is held by ABSENCE — 01-plan.md section 3 says so — and this is the assertion
    // from outside. `product` argued at triage that a read-only worklist is not separable from the
    // action and lost; the losing argument is what this test protects.
    for (const control of [
      "pending-entry-row-approve",
      "pending-entry-row-reject",
      "pending-entries-approve",
      "pending-entries-reject",
    ]) {
      await expect(page.getByTestId(control)).toHaveCount(0);
    }

    // Nothing that writes A FORM. ADM-05 superseded the rest of this assertion: it mounts
    // `entry-decision` on each row — two buttons and, once reject is pressed, one textarea — which
    // is what .ai/registry/features.md's ADM-05 row requires ("the decision surface is ADM-04's
    // list; this row adds the two controls and the mandatory reason to it"). What survives is
    // ADM-04's own property and is still worth holding: this screen has no form of its own and no
    // field that edits an entry, so the row link is still the only way to CHANGE one.
    const list = page.getByTestId("pending-entries");
    await expect(list.locator("form")).toHaveCount(0);
    await expect(list.locator("input")).toHaveCount(0);

    // AC-15. The object is an ENTRY and never a request, an application or an *đơn*; no quota,
    // balance, entitlement or remaining-days figure appears; and nothing reaches HR. The charter's
    // refusals 1 and 2, asserted as copy because that is where they would be broken first.
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
      expect(body, `the worklist copy must not contain "${forbidden}"`).not.toContain(forbidden);
    }
  });

  test("AC-10 and AC-12: a member is refused, and the refusal is not what protects anything", async ({
    page,
  }) => {
    await signInAt(page, MEMBER_EMAIL);
    await expect(page.getByTestId("home-sign-out")).toBeVisible();

    // AC-10's affordance half: no link is offered to a member.
    await expect(page.getByTestId("home-pending-entries-link")).toHaveCount(0);

    // Typing the address anyway. A reload here resets the mock's tables and keeps the session, which
    // costs nothing: this criterion reads no row.
    await page.goto(WORKLIST);
    await expect(page.getByTestId("pending-entries-refused")).toBeVisible();
    await expect(page.getByTestId("pending-entries")).toHaveCount(0);
    await expect(page.getByTestId("pending-entries-loading")).toHaveCount(0);
    await expect(page.getByTestId("pending-entries-count")).toHaveCount(0);

    // AND THE REFUSAL PROTECTS NOTHING, which is 01-plan.md section 3's point and the reason this
    // criterion is written the way it is: `entry_select_team` admits the whole team's rows to both
    // roles, so the same member reads the same entries at /entries/team. A refusal that were load
    // bearing would make this next assertion fail.
    await page.getByTestId("pending-entries-back").click();
    await expect(page.getByTestId("home-sign-out")).toBeVisible();
    await expect(page.getByTestId("home-team-entries-link")).toHaveCount(0);
  });

  test("AC-12: a caller with no member row reaches no worklist either", async ({ page }) => {
    // The route is guarded on membership the way `/threshold` is, so this caller never reaches the
    // component — they land on the member-less screen. DECLARED in 03-impl-log.md as a deviation
    // from AC-12's letter, which expects the component's own refusal: the guard answers first, and
    // ADM-01's `/threshold` behaves identically. What the criterion is about — no list, and not a
    // loading state that never ends — holds either way.
    await signInAt(page, MEMBER_LESS_EMAIL);

    await page.goto(WORKLIST);
    await expect(page.getByTestId("pending-entries")).toHaveCount(0);
    await expect(page.getByTestId("pending-entries-count")).toHaveCount(0);
    await expect(page.getByTestId("pending-entries-loading")).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
  });

  test("AC-11: an empty worklist says so, rather than looking like a screen that failed", async ({
    page,
  }) => {
    await signInAt(page, ADMIN_EMAIL);
    await openWorklist(page);

    // Nothing on this team is pending in the default window: the two seeded entries are an APPROVED
    // one and one belonging to the other team.
    await expect(rows(page)).toHaveCount(0);
    await expect(page.getByTestId("pending-entries-empty")).toBeVisible();
    await expect(count(page)).toHaveAttribute("data-total", "0");
    await expect(page.getByTestId("pending-entries-unavailable")).toHaveCount(0);
    await expect(page.getByTestId("pending-entries-loading")).toHaveCount(0);
  });

  test("AC-14: each row links to that entry's own edit screen, and the worklist adds no editing", async ({
    page,
  }) => {
    await signInAt(page, MEMBER_EMAIL);
    await declare(page, UPCOMING, 1);
    await switchTo(page, ADMIN_EMAIL);
    await openWorklist(page);

    const entryId = await rowFor(page, UPCOMING.start).getAttribute("data-entry-id");
    expect(entryId).toBeTruthy();

    await rowFor(page, UPCOMING.start).getByTestId("pending-entry-row-link").click();

    // The SAME route the owner and CAL-03's team list already use. There is one edit screen and not
    // an admin copy of one, which is what keeps the six editable fields decided in one place.
    await expect(page).toHaveURL(new RegExp(`/entries/${entryId}/edit$`));
    await expect(page.getByTestId("edit-entry-form")).toBeVisible();
  });

  test("AC-4: the paging control states where it is and is inert on a set that fits one page", async ({
    page,
  }) => {
    await signInAt(page, MEMBER_EMAIL);
    await declare(page, UPCOMING, 1);
    await switchTo(page, ADMIN_EMAIL);
    await openWorklist(page);

    // The arithmetic is asserted in tests/pending-entries.test.ts, against a set of fifty-four.
    // What is checkable here is that the control exists, names the page and the page size, and does
    // not offer a journey to a page that does not exist.
    const paging = page.getByTestId("pending-entries-page");
    await expect(paging).toHaveAttribute("data-page", "0");
    await expect(paging).toHaveAttribute("data-page-size", "50");
    await expect(page.getByTestId("pending-entries-prev")).toBeDisabled();
    await expect(page.getByTestId("pending-entries-next")).toBeDisabled();
  });

  test("AC-9: the admin link is on Home for an admin, and it carries no count of its own", async ({
    page,
  }) => {
    await signInAt(page, ADMIN_EMAIL);

    const link = page.getByTestId("home-pending-entries-link");
    await expect(link).toBeVisible();

    // No badge. A number here would need a second read, and two reads can disagree — the one
    // property .ai/registry/features.md:103 forbids this feature from having.
    await expect(link).toHaveText("Waiting for a decision");
  });
});
