import { expect, test } from "@playwright/test";

test("prototype panel adds credits, rejects invalid amounts, and saves the balance", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("impact-drive-rewards")) localStorage.setItem("impact-drive-rewards", JSON.stringify({
      version: 2, year: new Date().getFullYear(), credits: 1, treesThisYear: 0,
      treesAllTime: 0, missionCompletionIds: [], rewardedContentIds: [],
    }));
  });
  await page.goto("/rewards");
  await page.getByRole("button", { name: "Carbon Coins: 1" }).click();
  const panel = page.getByRole("dialog", { name: "Add Carbon Coins" });
  await expect(panel).toBeVisible();
  await expect(panel.getByText("FOR PROTOTYPE PREVIEW PURPOSES ONLY")).toBeVisible();
  const amount = panel.getByRole("spinbutton", { name: /How many Carbon Coins/ });
  await amount.fill("1.5");
  await panel.getByRole("button", { name: "Add Carbon Coins" }).click();
  await expect(panel.getByRole("alert")).toContainText("whole number");
  await amount.fill("1000000");
  await panel.getByRole("button", { name: "Add Carbon Coins" }).click();
  await expect(panel.getByRole("alert")).toContainText("999,999");
  await amount.fill("9");
  await panel.getByRole("button", { name: "Add Carbon Coins" }).click();
  await expect(panel).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Carbon Coins: 10" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("impact-drive-rewards") ?? "null")?.credits)).toBe(10);
  await page.reload();
  await expect(page.getByRole("button", { name: "Carbon Coins: 10" })).toBeVisible();
  await page.getByRole("button", { name: "Carbon Coins: 10" }).click();
  await panel.getByRole("button", { name: "Full reset" }).click();
  await expect(panel.getByText(/shared tree and water exchange totals for everyone/)).toBeVisible();
  await panel.getByRole("button", { name: "Cancel" }).click();
  await expect(panel.getByRole("button", { name: "Full reset" })).toBeVisible();
});

test("Share completes the journey even when clipboard copying fails", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("impact-drive-campaign-pilot-v1")) localStorage.setItem("impact-drive-campaign-pilot-v1", JSON.stringify({ completed: true, shareActions: 0 }));
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new Error("Clipboard unavailable")) } });
  });
  await page.goto("/rewards");
  const shareCircle = page.getByRole("list", { name: "Impact rewards journey" }).locator("li").nth(2);
  await expect(shareCircle).toHaveCSS("background-color", "rgb(227, 231, 229)");
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(shareCircle).toHaveCSS("background-color", "rgb(3, 73, 63)");
  await expect(page.getByText("Invite link ready below. Select it to copy and share.")).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("impact-drive-campaign-pilot-v1") ?? "null")?.shareActions)).toBe(1);
  await page.reload();
  await expect(shareCircle).toHaveCSS("background-color", "rgb(3, 73, 63)");
});

test("full reset clears browser progress and shared exchanges, then opens the main page", async ({ page, request }) => {
  test.skip(process.env.PLAYWRIGHT_RESET_TEST !== "1", "Only run against an isolated prototype data file");
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("impact-drive-rewards", JSON.stringify({
      version: 2, year: new Date().getFullYear(), credits: 21, treesThisYear: 1,
      treesAllTime: 1, missionCompletionIds: ["preview"], rewardedContentIds: ["article"],
    }));
    localStorage.setItem("impact-drive-discovery", JSON.stringify({
      missionComplete: true, routeChoice: "sea", foundToken: true, openedRecords: [], topics: [],
    }));
    localStorage.setItem("impact-drive-campaign-pilot-v1", JSON.stringify({ completed: true, shareActions: 1 }));
  });
  for (const kind of ["tree", "water"]) {
    const result = await request.post("/api/impact-exchanges", { data: { kind, eventId: crypto.randomUUID() } });
    expect(result.ok()).toBe(true);
  }
  await page.goto("/rewards");
  await expect(page.getByRole("button", { name: "Carbon Coins: 21" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Impact exchange totals" })).toContainText("1");
  await page.getByRole("button", { name: "Carbon Coins: 21" }).click();
  const panel = page.getByRole("dialog", { name: "Add Carbon Coins" });
  await panel.getByRole("button", { name: "Full reset" }).click();
  await expect(panel.getByText(/shared tree and water exchange totals for everyone/)).toBeVisible();
  await panel.getByRole("button", { name: "Confirm full reset" }).click();
  await expect(page).toHaveURL("/");
  const saved = await page.evaluate(() => ({
    rewards: JSON.parse(localStorage.getItem("impact-drive-rewards") ?? "null"),
    discovery: localStorage.getItem("impact-drive-discovery"),
    pilot: JSON.parse(localStorage.getItem("impact-drive-campaign-pilot-v1") ?? "null"),
  }));
  expect(saved.rewards.credits).toBe(0);
  expect(saved.rewards.treesThisYear).toBe(0);
  expect(saved.rewards.treesAllTime).toBe(0);
  expect(saved.rewards.rewardedContentIds).toEqual([]);
  expect(saved.discovery).toBeNull();
  expect(saved.pilot.completed).toBe(false);
  expect(saved.pilot.shareActions).toBe(0);
  expect(await (await request.get("/api/impact-totals")).json()).toEqual({ trees: 0, waterDollars: 0 });
  await page.goto("/rewards");
  await expect(page.getByRole("button", { name: "Carbon Coins: 0" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Impact exchange totals" })).toContainText("0");
});
