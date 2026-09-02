import { expect, test } from "@playwright/test";

// BUG-001. The seam guard. `chromium` declares this project in `dependencies`, so a failure here
// aborts the acceptance suite instead of merely reporting alongside it.
//
// It reads THE SERVED PAGE and nothing else. `reuseExistingServer` means the page may come from a
// build that never saw `webServer.env`, so a guard reading the environment, the config or
// `import.meta.env` would agree with itself and prove nothing.
const EXPECTED_SEAM = "mock";

test("the served page reports the in-memory seam", async ({ page }) => {
  await page.goto("/");
  const root = page.getByTestId("app-root");
  await expect(root, "the application root did not render: no seam could be read").toBeVisible();
  await expect(root).toHaveAttribute("data-seam", EXPECTED_SEAM);
});
