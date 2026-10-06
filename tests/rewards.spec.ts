import { expect, test, type Page } from "@playwright/test";

async function seedRewards(page: Page, credits: number) {
  await page.addInitScript((initialCredits) => localStorage.setItem("impact-drive-rewards", JSON.stringify({
    version: 1,
    year: new Date().getFullYear(),
    credits: initialCredits,
    treesThisYear: 0,
    treesAllTime: 0,
    missionCompletionIds: [],
  })), credits);
}

test.beforeEach(async ({ page }) => {
  let trees = 0;
  let waterDollars = 0;
  await page.route("**/api/impact-totals", async (route) => route.fulfill({ json: { trees, waterDollars } }));
  await page.route("**/api/impact-exchanges", async (route) => {
    const { kind } = route.request().postDataJSON() as { kind: string };
    if (kind === "tree") trees += 1;
    if (kind === "water") waterDollars += 1;
    await route.fulfill({ json: { trees, waterDollars } });
  });
});

test("the Impact shop has a centered barren globe, shared counters, and only two exchange cards", async ({ page }) => {
  await page.goto("/rewards");
  await expect(page.getByRole("heading", { name: "Impact shop" })).toBeVisible();
  await expect(page.locator(".rewards-global-totals strong")).toHaveText(["0", "$0"]);
  await expect(page.locator(".rewards-balance")).toHaveText("Carbon Coins: 0");
  await expect(page.locator(".rewards-exchange-card")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Exchange for a tree" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Exchange for water" })).toBeDisabled();
  await expect(page.getByText("Example leaderboard")).toHaveCount(0);
  const centered = await page.locator(".shop-globe").evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return Math.abs(bounds.left + bounds.width / 2 - innerWidth / 2) < 1;
  });
  expect(centered).toBe(true);
});

test("tree and water exchanges spend ten coins each and update the shared demo counters", async ({ page }) => {
  await seedRewards(page, 20);
  await page.goto("/rewards");
  await page.getByRole("button", { name: "Exchange for a tree" }).click();
  await expect(page.locator(".rewards-global-totals strong")).toHaveText(["1", "$0"]);
  await expect(page.locator(".rewards-balance")).toHaveText("Carbon Coins: 10");
  await page.getByRole("button", { name: "Exchange for water" }).click();
  await expect(page.locator(".rewards-global-totals strong")).toHaveText(["1", "$1"]);
  await expect(page.locator(".rewards-balance")).toHaveText("Carbon Coins: 0");
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("impact-drive-rewards") ?? "null"));
  expect(state).toMatchObject({ credits: 0, treesThisYear: 1, treesAllTime: 1 });
});

test("invalid saved rewards show a notice and are cleared", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("impact-drive-rewards", "{"));
  await page.goto("/rewards");
  await expect(page.locator(".rewards-balance")).toHaveText("Carbon Coins: 0");
  await expect(page.locator(".rewards-status")).toContainText("Invalid saved rewards data was reset");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("impact-drive-rewards"))).toBeNull();
});

test("an unavailable shared counter disables exchanges without spending coins", async ({ page }) => {
  await page.unroute("**/api/impact-totals");
  await page.route("**/api/impact-totals", async (route) => route.fulfill({ status: 503, json: { error: "Unavailable" } }));
  await seedRewards(page, 20);
  await page.goto("/rewards");
  await expect(page.getByText("Shared demo totals are unavailable right now.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Exchange for a tree" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Exchange for water" })).toBeDisabled();
  await expect(page.locator(".rewards-balance")).toHaveText("Carbon Coins: 20");
});

test("the globe respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/rewards");
  await expect(page.locator(".shop-globe-surface")).toHaveCSS("animation-name", "none");
});
