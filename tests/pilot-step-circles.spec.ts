import { expect, test } from "@playwright/test";

test("unfinished circles are grey, clickable, and jump directly to their sections", async ({ page }) => {
  await page.goto("/rewards");
  const steps = page.getByRole("list", { name: "Impact rewards journey" });
  const circles = steps.locator("li");
  await expect(circles).toHaveCount(3);
  await expect(steps.getByRole("button")).toHaveCount(3);
  for (const circle of await circles.all()) {
    await expect(circle).toHaveCSS("background-color", "rgb(227, 231, 229)");
    await expect(circle).toHaveCSS("transition-duration", "0s");
  }

  await steps.getByRole("button", { name: /Go to rewards/ }).click();
  await expect(page.locator("#pilot-rewards-title")).toBeFocused();
  expect(await page.evaluate(() => { const top = document.getElementById("pilot-rewards-title")!.getBoundingClientRect().top; return top >= 0 && top < innerHeight; })).toBe(true);

  await steps.getByRole("button", { name: /Go to share link/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#pilot-share-title")).toBeFocused();
  expect(await page.evaluate(() => { const top = document.getElementById("pilot-share-title")!.getBoundingClientRect().top; return top >= 0 && top < innerHeight; })).toBe(true);

  await steps.getByRole("button", { name: /Go to freight mission/ }).click();
  await expect(page).toHaveURL("/mission/freight");
});

test("only completed tasks turn green and circles fit on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.addInitScript(() => {
    if (!localStorage.getItem("impact-drive-campaign-pilot-v1")) localStorage.setItem("impact-drive-campaign-pilot-v1", JSON.stringify({ completed: true, shareActions: 0 }));
  });
  await page.goto("/rewards");
  const circles = page.getByRole("list", { name: "Impact rewards journey" }).locator("li");
  await expect(circles.nth(0)).toHaveCSS("background-color", "rgb(3, 73, 63)");
  await expect(circles.nth(1)).toHaveCSS("background-color", "rgb(3, 73, 63)");
  await expect(circles.nth(2)).toHaveCSS("background-color", "rgb(227, 231, 229)");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("impact-drive-campaign-pilot-v1") ?? "{}");
    localStorage.setItem("impact-drive-campaign-pilot-v1", JSON.stringify({ ...state, shareActions: 1 }));
  });
  await page.reload();
  await expect(circles.nth(2)).toHaveCSS("background-color", "rgb(3, 73, 63)");
});
