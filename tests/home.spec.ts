import { expect, test } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

test("the updated garage objects open the site sections", async ({ page }) => {
  for (const [key, path] of [
    ["game", "/mission/freight"],
    ["video", "/video"],
    ["reports", "/library"],
    ["shop", "/rewards"],
  ]) {
    await page.goto("/");
    const garage = page.frameLocator('iframe[title="Interactive Make A Mark garage"]');
    await expect(garage.locator(".garage-image")).toBeVisible();
    await garage.locator(`.object-${key}`).click();
    await expect(page).toHaveURL(path);
  }
});

test("the garage menu opens a destination", async ({ page }) => {
  await page.goto("/");
  const garage = page.frameLocator('iframe[title="Interactive Make A Mark garage"]');
  await garage.locator("#menu-toggle").click();
  await garage.locator('[data-destination="reports"]').click();
  await expect(page).toHaveURL("/library");
});

test("mobile shortcuts open a destination with one tap", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const garage = page.frameLocator('iframe[title="Interactive Make A Mark garage"]');
  await garage.locator('.mobile-shortcuts [data-shortcut="shop"]').click();
  await expect(page).toHaveURL("/rewards");
});
