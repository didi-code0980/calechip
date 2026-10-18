import { expect, test, type Locator, type Page } from "@playwright/test";

// TSK-04 — the week view shows, in each day's header, how many of the viewer's own tasks are done out
// of the total. 01-plan.md § 2 and § 5.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it; `tests/e2e/seam.setup.ts` refuses the run
// otherwise). The tally rules are asserted exhaustively in `tests/week-tasks.test.ts`; this file
// asserts what a person SEES.
//
// **A `page.goto` RESETS THE MOCK'S TABLES, AND THE TASK TABLE STARTS EMPTY.** So every journey
// creates its tasks on `/tasks` and then reaches the week by clicking `shell-brand-logo` (`/`,
// which renders the current week in place), and changes user by signing out and in on the same
// document, as TSK-01 to TSK-03 do.
//
// **"TODAY" IS PINNED** with `page.clock.setFixedTime`, at 10:00 in Asia/Ho_Chi_Minh, as TSK-01.
// 2030-03-12 is a Tuesday, so the displayed week is 2030-03-11 .. 2030-03-17, and a task can be
// dated today or later only (`task_date_past`).
//
// **THE TASK READ LANDS AFTER THE GRID** (§ 4.2) and sets no attribute when it does. A negative
// assertion is therefore made only after a positive one on the same load where the AC allows it,
// and otherwise after `PAST_THE_TASK_READ`, as TSK-03 waits out its debounce.
//
// AC-12's failure path is not driven here: the mock has no fault switch and adding one is a seam-file
// change (01-plan.md § 5). It is held by WeekView's separately-caught task layer, and its empty-map
// half by `tests/week-tasks.test.ts`.

const PASSWORD = "password123";
const MEMBER = "thanh@example.com";
const TEAMMATE = "linh@example.com";
const TEAMMATE_NAME = "Đã duyệt";
const ADMIN = "quan@example.com";
const OTHER_TEAM = "44444444-4444-4444-8444-444444444444";

const TODAY = "2030-03-12"; // Tuesday
const DAYS = ["2030-03-12", "2030-03-13", "2030-03-14", "2030-03-15", "2030-03-16", "2030-03-17", "2030-03-18"] as const;
type Day = (typeof DAYS)[number];
const TOMORROW: Day = "2030-03-13"; // Wednesday
const DAY_AFTER: Day = "2030-03-14";
const NEXT_MONDAY: Day = "2030-03-18";

const at = (day: string): Date => new Date(`${day}T10:00:00+07:00`);

/** The mock answers in a tick; a margin for a read that is never going to draw anything. */
const PAST_THE_TASK_READ = 800;

async function fillSignIn(page: Page, email: string): Promise<void> {
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.clock.setFixedTime(at(TODAY));
  await page.goto("/");
  await fillSignIn(page, email);
}

async function switchTo(page: Page, email: string): Promise<void> {
  await page.getByTestId("home-sign-out").click();
  await fillSignIn(page, email);
}

/** Through the sidebar, never `goto` — the tables survive. Today, then one `›` per day. */
async function openTasksOn(page: Page, day: Day): Promise<void> {
  await page.getByTestId("nav-tasks-link").click();
  await expect(page.getByTestId("tasks-page")).toBeVisible();
  const heading = page.getByTestId("tasks-day-heading");
  await expect(heading).toHaveAttribute("data-day", TODAY);
  for (const next of DAYS.slice(1, DAYS.indexOf(day) + 1)) {
    await page.getByTestId("tasks-next-day").click();
    await expect(heading).toHaveAttribute("data-day", next);
  }
}

async function addTask(page: Page, title: string): Promise<void> {
  await page.getByTestId("task-add-title").fill(title);
  await page.getByTestId("task-add-submit").click();
  await expect(page.getByTestId("tasks-list").getByTestId("task-title").filter({ hasText: title })).toBeVisible();
}

const taskRow = (page: Page, title: string): Locator =>
  page.getByTestId("task-row").filter({ has: page.getByTestId("task-title").filter({ hasText: title }) });

async function tick(page: Page, title: string): Promise<void> {
  await taskRow(page, title).getByTestId("task-done").click();
  await expect(taskRow(page, title)).toHaveAttribute("data-done", "true");
}

/** Add `titles` on `day`, ticking the first `done` of them. */
async function seedDay(page: Page, day: Day, titles: string[], done = 0): Promise<void> {
  await openTasksOn(page, day);
  for (const t of titles) await addTask(page, t);
  for (const t of titles.slice(0, done)) await tick(page, t);
}

/** `/` renders the current week in place (UIE-02 § 4.10). Clicked, so the mock's tables survive. */
async function openWeek(page: Page): Promise<void> {
  await page.getByTestId("shell-brand-logo").click();
  await expect(page.getByTestId("week-anchor")).toBeVisible();
  await expect(page.getByTestId("week-loading")).toHaveCount(0);
  await expect(page.getByTestId("week-day")).toHaveCount(7);
}

const weekDay = (page: Page, date: string): Locator => page.locator(`[data-testid="week-day"][data-date="${date}"]`);
const badge = (page: Page, date: string): Locator =>
  weekDay(page, date).getByTestId("week-day-label").getByTestId("week-day-tasks");
const anyBadge = (page: Page): Locator => page.getByTestId("week-day-tasks");

test.describe("TSK-04 — my task tally on the week view", () => {
  test("AC-1, AC-2, AC-3: icon and done/total on days with tasks, nothing on days without", async ({ page }) => {
    await signIn(page, MEMBER);
    // The trailing dot keeps "Item 1." from matching "Item 10." in `hasText`, a substring match.
    await seedDay(page, TODAY, Array.from({ length: 10 }, (_, i) => `Item ${i + 1}.`), 5);
    await seedDay(page, TOMORROW, ["B1", "B2", "B3"], 3);
    await seedDay(page, DAY_AFTER, ["C1", "C2"], 0);

    await openWeek(page);
    await expect(badge(page, TODAY)).toHaveText("5/10");
    await expect(badge(page, TODAY)).toHaveAttribute("aria-label", "5 of 10 tasks done");
    await expect(badge(page, TODAY)).toHaveAttribute("data-done", "5");
    await expect(badge(page, TODAY)).toHaveAttribute("data-total", "10");
    await expect(badge(page, TODAY).locator("svg")).toHaveCount(1);
    await expect(badge(page, TOMORROW)).toHaveText("3/3");
    await expect(badge(page, DAY_AFTER)).toHaveText("0/2");

    for (const empty of ["2030-03-11", "2030-03-15", "2030-03-16", "2030-03-17"]) {
      await expect(weekDay(page, empty).getByTestId("week-day-tasks")).toHaveCount(0);
    }
    await expect(anyBadge(page)).toHaveCount(3);
  });

  test("AC-4: each day counts only its own date; next Monday's task is not in this week", async ({ page }) => {
    await signIn(page, MEMBER);
    await seedDay(page, TOMORROW, ["Wednesday one"]);
    await seedDay(page, NEXT_MONDAY, ["Next Monday one", "Next Monday two"]);

    await openWeek(page);
    await expect(badge(page, TOMORROW)).toHaveText("0/1");
    await expect(badge(page, TOMORROW)).toHaveAttribute("aria-label", "0 of 1 task done");
    await expect(anyBadge(page)).toHaveCount(1);

    await page.getByTestId("week-next").click();
    await expect(page.getByTestId("week-anchor")).toHaveAttribute("data-week-start", NEXT_MONDAY);
    await expect(badge(page, NEXT_MONDAY)).toHaveText("0/2");
    await expect(anyBadge(page)).toHaveCount(1);
  });

  test("AC-5: another member's tasks are never counted", async ({ page }) => {
    await signIn(page, MEMBER);
    await seedDay(page, TOMORROW, ["Mine one", "Mine two"], 1);
    await switchTo(page, TEAMMATE);
    await seedDay(page, TOMORROW, ["Theirs one", "Theirs two", "Theirs three", "Theirs four"]);

    await openWeek(page);
    await expect(badge(page, TOMORROW)).toHaveText("0/4");

    await switchTo(page, MEMBER);
    await openWeek(page);
    await expect(badge(page, TOMORROW)).toHaveText("1/2");

    // A member who owns no tasks, whatever their teammates own.
    await switchTo(page, ADMIN);
    await openWeek(page);
    await page.waitForTimeout(PAST_THE_TASK_READ);
    await expect(anyBadge(page)).toHaveCount(0);
  });

  test("AC-6: an admin and a manager see only their own", async ({ page }) => {
    // Make the teammate a manager, as an admin does — the one `goto` in this test, before any task.
    await signIn(page, ADMIN);
    await page.goto("/members");
    const linh = page.getByTestId("member-list-row").filter({ hasText: TEAMMATE_NAME });
    await linh.getByTestId("member-list-row-manager").click();
    await expect(linh.getByTestId("member-list-row-manager")).toHaveAttribute("data-role", "manager");

    await switchTo(page, MEMBER);
    await seedDay(page, TOMORROW, ["Member's task"]);

    for (const who of [ADMIN, TEAMMATE]) {
      await switchTo(page, who);
      await openWeek(page);
      await page.waitForTimeout(PAST_THE_TASK_READ);
      await expect(weekDay(page, TOMORROW).getByTestId("week-day-tasks")).toHaveCount(0);
    }
  });

  test("AC-7: no badge on another team's calendar, and it returns on the admin's own", async ({ page }) => {
    await signIn(page, ADMIN);
    await seedDay(page, TOMORROW, ["Admin's task"]);
    await openWeek(page);
    await expect(badge(page, TOMORROW)).toHaveText("0/1");

    await page.locator(`[data-testid="shell-team-option"][data-team-id="${OTHER_TEAM}"]`).click();
    await expect(page.getByTestId("shell-viewing-other-team")).toBeVisible();
    await expect(page.getByTestId("week-loading")).toHaveCount(0);
    await page.waitForTimeout(PAST_THE_TASK_READ);
    await expect(anyBadge(page)).toHaveCount(0);
    await expect(page.getByTestId("week-tasks-unavailable")).toHaveCount(0);

    await page.getByTestId("shell-back-to-own-team").click();
    await expect(page.getByTestId("shell-viewing-other-team")).toHaveCount(0);
    await expect(badge(page, TOMORROW)).toHaveText("0/1");
  });

  test("AC-8: the month and year views show no count", async ({ page }) => {
    await signIn(page, MEMBER);
    await seedDay(page, TOMORROW, ["Somewhere in March"]);
    await openWeek(page);
    await expect(badge(page, TOMORROW)).toHaveText("0/1");

    await page.getByTestId("week-month").click();
    await expect(page.getByTestId("month-anchor")).toBeVisible();
    await expect(page.locator('[data-testid="month-cell"]').first()).toBeVisible();
    await page.waitForTimeout(PAST_THE_TASK_READ);
    await expect(anyBadge(page)).toHaveCount(0);
    await expect(page.locator('[data-testid="month-cell"][data-date="2030-03-13"]')).not.toContainText("0/1");

    await page.getByTestId("month-year").click();
    await expect(page.getByTestId("year-anchor")).toBeVisible();
    await page.waitForTimeout(PAST_THE_TASK_READ);
    await expect(anyBadge(page)).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText("0/1");
  });

  test("AC-9: the badge costs no row and shares the date's line", async ({ page }) => {
    await signIn(page, MEMBER);
    await seedDay(page, TOMORROW, ["Height check"]);
    await openWeek(page);
    await expect(badge(page, TOMORROW)).toHaveText("0/1");

    // Precondition of the AC: neither day is a holiday or a bridge day, whose badge line differs.
    for (const d of [TOMORROW, DAY_AFTER]) {
      await expect(weekDay(page, d)).toHaveAttribute("data-day-status", "working");
      await expect(weekDay(page, d)).toHaveAttribute("data-bridge", "false");
    }

    const withTasks = await weekDay(page, TOMORROW).getByTestId("week-day-label").boundingBox();
    const without = await weekDay(page, DAY_AFTER).getByTestId("week-day-label").boundingBox();
    expect(withTasks?.height).toBe(without?.height);

    const sameParent = await badge(page, TOMORROW).evaluate((el) => {
      const parent = el.parentElement;
      return parent !== null && Array.from(parent.children).some((c) => c !== el && /^\d{2}\/\d{2}$/.test(c.textContent ?? ""));
    });
    expect(sameParent).toBe(true);
  });

  test("AC-10: the count reflects a tick made on the task page", async ({ page }) => {
    await signIn(page, MEMBER);
    await seedDay(page, TOMORROW, ["Tick me", "Leave me"]);
    await openWeek(page);
    await expect(badge(page, TOMORROW)).toHaveText("0/2");

    await openTasksOn(page, TOMORROW);
    await tick(page, "Tick me");
    await openWeek(page);
    await expect(badge(page, TOMORROW)).toHaveText("1/2");
  });

  test("AC-11: the absence count is unchanged by tasks", async ({ page }) => {
    await signIn(page, MEMBER);
    await openWeek(page);
    await page.waitForTimeout(PAST_THE_TASK_READ);
    const before = await weekDay(page, TOMORROW).getAttribute("data-count");
    const beforeText = await weekDay(page, TOMORROW).getByTestId("week-day-count").textContent();

    await seedDay(page, TOMORROW, ["One", "Two", "Three"], 1);
    await openWeek(page);
    await expect(badge(page, TOMORROW)).toHaveText("1/3");
    await expect(weekDay(page, TOMORROW)).toHaveAttribute("data-count", before ?? "");
    await expect(weekDay(page, TOMORROW).getByTestId("week-day-count")).toHaveText(beforeText ?? "");
  });

  test("AC-12: a successful task read shows no unavailable notice", async ({ page }) => {
    await signIn(page, MEMBER);
    await seedDay(page, TOMORROW, ["Present"]);
    await openWeek(page);
    await expect(badge(page, TOMORROW)).toHaveText("0/1");
    await expect(page.getByTestId("week-tasks-unavailable")).toHaveCount(0);
  });

  test("AC-13: a signed-out visitor sees no badge and no notice", async ({ page }) => {
    await page.clock.setFixedTime(at(TODAY));
    await page.goto(`/week/${TODAY}`);
    await page.waitForTimeout(PAST_THE_TASK_READ);
    await expect(anyBadge(page)).toHaveCount(0);
    await expect(page.getByTestId("week-tasks-unavailable")).toHaveCount(0);
  });
});
