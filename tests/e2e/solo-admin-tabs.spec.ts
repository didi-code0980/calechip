import { expect, test, type Page } from "@playwright/test";

// SOLO, 2026-09-09 — the admin area is a tab strip, and each tab is one admin page.
//
// **THIS WORK CARRIES NO TICKET AND NO ACCEPTANCE CRITERIA**, so the numbering below is local to
// this file and is deliberately NOT `AC-n` — an `AC-` prefix is a claim that a plan document states
// the criterion. What authorises the work is `.claude/agents/solo.md`.
//
// **WHAT THIS CHANGE IS, IN ONE SENTENCE.** UIE-09's five stacked link cards became a horizontal
// strip rendered above every admin screen by a layout route, and the five ADDRESSES did not move.
// That last clause is the whole design: sixty-nine assertions across ten spec files address
// `admin-hub-*` ids and follow those five paths, and NOT ONE of them was edited.
//
// **THE SHAPE UIE-09 REJECTED IS NOT THE SHAPE BUILT HERE, AND THE DIFFERENCE IS EXACTLY THE FENCE.**
// `UIE-09/01-plan.md:551` refuses "a tabbed admin area at `/admin/threshold`, `/admin/members` and so
// on", and `ticket.yaml` § 7 says reaching for it should have produced `BLOCKED` with
// `requires_adr: true`. Read the reasons it gives: it "re-addresses four shipped screens, changes
// every `page.goto` in their refusal tests, changes each screen's own back link, and reverses
// ADM-01's Open question 1". Every one of those is a consequence of RE-ADDRESSING, and nothing here
// re-addresses anything — `/threshold` is still `/threshold`. The operator was asked which of the
// two they wanted and chose the addresses left alone.
//
// **THE COUNT BADGE IS DELIBERATELY ABSENT.** The transcription showed a pink `5` on the approvals
// tab; UIE-09 § 1 fences a count as "a seam read, a loading state and a refusal path on a screen
// that otherwise has none ... a different ticket", and the operator was asked and chose to leave it
// out. Test 5 is the standing assertion that it stayed out.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it, `tests/e2e/seam.setup.ts` refuses the run
// otherwise). Fixtures (`src/lib/fixtures.ts`): FIXTURE_TEAM carries two admins and two members.

const PASSWORD = "password123";
const ADMIN_EMAIL = "quan@example.com";
const MEMBER_EMAIL = "thanh@example.com";

/** § Language's own pattern, from `ui-language.json`. */
const DIACRITIC = /[À-ɏḀ-ỿ]/;

/** The five, in UIE-09 § 2b's order — by how often an admin needs each. This file keeps its own copy
 *  rather than importing `ADMIN_TABS`, for the reason `uie-09-admin-hub.spec.ts` keeps one too: a
 *  test that imports the list under test asserts only that the component renders whatever it was
 *  given, and the ORDER is the thing being pinned. */
const TABS = [
  { testId: "admin-hub-pending-link", path: "/entries/pending" },
  { testId: "admin-hub-team-entries-link", path: "/entries/team" },
  { testId: "admin-hub-members-link", path: "/members" },
  { testId: "admin-hub-allow-list-link", path: "/signups" },
  { testId: "admin-hub-threshold-link", path: "/setting" },
  { testId: "admin-hub-teams-link", path: "/teams" }, // SOLO, 2026-09-11 — many teams, the sixth
];

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/");
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

test.describe("SOLO — the admin area is a tab strip", () => {
  test("1: pressing Admin opens the strip, and it carries the six destinations", async ({
    page,
  }) => {
    await signIn(page, ADMIN_EMAIL);
    await page.getByTestId("shell-admin-link").click();

    const strip = page.getByTestId("admin-tabs");
    await expect(strip).toBeVisible();
    await expect(strip).toHaveCount(1);

    // **THE SAME FIVE ROWS UIE-09 SHIPPED, IN THE SAME ORDER, UNDER THE SAME IDS.** This is the
    // assertion that says the change is a re-layout and not a migration — read off the rendered
    // rows, so a strip that quietly dropped or reordered one fails here.
    // Six since SOLO 2026-09-11 — the Teams tab. Still read off the rendered rows and compared in
    // order, so a strip that dropped or reordered one still fails.
    const rows = strip.getByTestId("admin-hub-link");
    await expect(rows).toHaveCount(6);
    expect(
      await rows.evaluateAll((nodes) =>
        nodes.map((n) => n.getAttribute("data-to")),
      ),
    ).toEqual(TABS.map((t) => t.path));

    for (const tab of TABS) {
      await expect(page.getByTestId(tab.testId)).toHaveAttribute(
        "href",
        tab.path,
      );
    }
  });

  test("2: the strip is on every admin screen, and the tab you are on is the active one", async ({
    page,
  }) => {
    await signIn(page, ADMIN_EMAIL);
    await page.getByTestId("shell-admin-link").click();

    for (const tab of TABS) {
      await page.getByTestId(tab.testId).click();
      await expect(page).toHaveURL(new RegExp(`${tab.path}$`));

      // THE STRIP TRAVELS WITH YOU. This is the layout half of the request — each tab is a page,
      // and the strip is on the page rather than only on the one you left.
      await expect(page.getByTestId("admin-tabs")).toBeVisible();

      // **EXACTLY ONE TAB IS ACTIVE, AND IT IS THIS ONE.** `aria-current` is `NavLink`'s own output,
      // derived from the router's matched location — asserting it rather than a class means the
      // test reads the same fact a screen reader does. The count is asserted too: `/entries/team`
      // and `/entries/pending` share a segment, and a partial match lighting both is the specific
      // failure this guards.
      const active = page.locator('[data-testid="admin-tabs"] [aria-current="page"]');
      await expect(active).toHaveCount(1);
      await expect(active).toHaveAttribute("data-testid", tab.testId);
    }
  });

  test("3: the addresses did not move", async ({ page }) => {
    // The fence UIE-09 built was around RE-ADDRESSING, not around tabs. This is the line that says
    // the fence was not crossed: each destination is reachable by typing the address it always had,
    // and lands on the same screen.
    await signIn(page, ADMIN_EMAIL);

    for (const tab of TABS) {
      await page.goto(tab.path);
      await expect(page).toHaveURL(new RegExp(`${tab.path}$`));
      await expect(page.getByTestId("admin-tabs")).toBeVisible();
    }

    // And `/admin` is still `/admin`, still its own screen, and still carries its own back control.
    await page.goto("/admin");
    await expect(page.getByTestId("admin-hub")).toBeVisible();
    await expect(page.getByTestId("admin-hub-back")).toHaveCount(1);

    // NO TAB IS ACTIVE ON `/admin` ITSELF, which is correct rather than an oversight: `/admin` is
    // not one of the five, and lighting a tab you are not on would be a lie about where you are.
    await expect(
      page.locator('[data-testid="admin-tabs"] [aria-current="page"]'),
    ).toHaveCount(0);
  });

  test("4: a member is offered no strip, on any admin address", async ({
    page,
  }) => {
    await signIn(page, MEMBER_EMAIL);

    // **THIS IS THE ONE ASSERTION THE CHANGE COULD MOST EASILY HAVE GOT WRONG.** Drawn for
    // everybody, the strip would hand a member a list of the five administrative addresses on every
    // screen that refuses them — which is exactly what UIE-10 AC-1 removed from the sidebar, for
    // both roles. The strip is gated on `isAdmin` in `AdminLayout` for that reason.
    //
    // It refuses nobody either way: each destination's own refusal is asserted below, so this is a
    // claim about what a member is OFFERED and never about what they can reach.
    for (const path of [...TABS.map((t) => t.path), "/admin"]) {
      await page.goto(path);
      await expect(page.getByTestId("admin-tabs")).toHaveCount(0);
      for (const tab of TABS) {
        await expect(
          page.getByTestId(tab.testId),
          `${tab.testId} must not be offered to a member on ${path}`,
        ).toHaveCount(0);
      }
    }

    // And the screens still refuse in place rather than redirecting — untouched by this change, and
    // asserted here because a layout that swallowed a refusal would look identical to one that did
    // not until somebody looked.
    await page.goto("/admin");
    await expect(page.getByTestId("admin-hub-refused")).toBeVisible();
    await page.goto("/setting");
    await expect(page.getByTestId("threshold-refused")).toBeVisible();
  });

  test("5: the strip renders no count and no badge", async ({ page }) => {
    await signIn(page, ADMIN_EMAIL);
    await page.getByTestId("shell-admin-link").click();

    // The transcription put a pink `5` on the approvals tab. UIE-09 § 1 fences a count as a seam
    // read, a loading state and a refusal path on a surface that otherwise has none, and the
    // operator chose to leave it out. **NO DIGIT ANYWHERE IN THE STRIP** — asserted over the whole
    // text rather than over one tab, so a count added to any of the five fails here.
    const text = (await page.getByTestId("admin-tabs").textContent()) ?? "";
    expect(text.match(/\d/)).toBeNull();

    // The strip is navigation and holds no control: no form, no input, no select, no button. A
    // write surface here would be one this area has never had.
    const strip = page.getByTestId("admin-tabs");
    await expect(strip.locator("form")).toHaveCount(0);
    await expect(strip.locator("input")).toHaveCount(0);
    await expect(strip.locator("select")).toHaveCount(0);
    await expect(strip.locator("button")).toHaveCount(0);

    // § Language. Every label is copy this component authors.
    expect(text).not.toMatch(DIACRITIC);
  });
});
