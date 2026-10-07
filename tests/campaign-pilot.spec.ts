import { expect, test } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

test("mission completion unlocks the proposed rewards and optional share journey", async ({ page, context, browser }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/rewards");
  await expect(page.getByRole("button", { name: "Start mission" })).toBeVisible();
  await expect(page.getByText("Complete the mission to reveal your link.")).toBeVisible();
  await page.getByRole("button", { name: "Start mission" }).click();
  await page.getByRole("button", { name: "Start mission" }).click();

  for (let scenario = 1; scenario <= 3; scenario += 1) {
    await expect(page.locator(".game-location")).toBeVisible();
    await page.locator("video").dispatchEvent("ended");
    await page.locator(".game-options button").first().click();
    await expect(page.getByRole("heading", { name: `Scenario ${scenario} complete` })).toBeVisible();
    await page.getByRole("button", { name: scenario === 3 ? "See final scene" : `Continue to Scenario ${scenario + 1}` }).click();
  }
  await expect(page.locator(".game-location")).toBeVisible();
  await page.locator("video").dispatchEvent("ended");
  await expect(page.getByRole("button", { name: "Finish mission and see proposed rewards" })).toBeDisabled();
  await page.getByLabel("My game decisions reduced real emissions by 14%").check();
  await expect(page.getByText("Game decisions are fictional.", { exact: false })).toBeVisible();
  await page.getByLabel("AMF1 reported travel and logistics emissions were 14% lower").check();
  await page.getByRole("button", { name: "Finish mission and see proposed rewards" }).click();
  await expect(page).toHaveURL("/rewards");
  await expect(page.getByText("Preview unlocked")).toBeVisible();
  await expect(page.getByRole("heading", { name: "What finishing could unlock" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What finishing could unlock" })).toBeVisible();
  await expect(page.getByText(/Carbon Coins/i)).toHaveCount(0);
  await expect(page.getByText("Prototype status: proposed only. No tree has been funded or planted.")).toBeVisible();

  await page.getByRole("button", { name: "View illustrative offer details" }).click();
  await expect(page.getByText(/Illustrative checkout: reusable bottle £30/)).toBeVisible();
  await page.getByRole("button", { name: "Simulate offer use" }).click();
  await expect(page.getByRole("button", { name: "Demo offer use recorded" })).toBeDisabled();
  await page.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByText(/Link copied\. This records a copy action/)).toBeVisible();
  const link = await page.getByLabel("Your pilot link").inputValue();
  expect(link).toMatch(/\/mission\/freight\?ref=MM-[A-F0-9]{10}$/);

  await page.getByLabel("AMF1 reports travel and logistics emissions were 14% lower").check();
  await page.getByLabel("A little more interested").check();
  await page.getByRole("button", { name: "Save answers" }).click();
  await page.getByRole("button", { name: "View demo metrics" }).click();
  await expect(page).toHaveURL("/pilot/metrics");
  await expect(page.getByRole("heading", { name: "Pilot measurement" })).toBeVisible();
  await expect(page.locator(".race-engineer-companion")).toHaveCount(0);
  const beforeReferral = (await (await page.request.get("/api/pilot/metrics")).json()).referredJoins as number;

  const referredContext = await browser.newContext();
  const referredPage = await referredContext.newPage();
  await referredPage.goto(link);
  await referredPage.getByRole("button", { name: "Start mission" }).click();
  await expect.poll(async () => (await (await page.request.get("/api/pilot/metrics")).json()).referredJoins as number).toBeGreaterThan(beforeReferral);
  await referredContext.close();

  await page.getByRole("button", { name: "Return to the reward journey" }).click();
  await page.reload();
  await expect(page.getByText("Preview unlocked")).toBeVisible();
  await expect(page.getByLabel("A little more interested")).toBeChecked();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("impact-drive-campaign-pilot-v1") ?? "{}"))).toMatchObject({
    started: true, completed: true, shareActions: 1, offerViews: 1, offerUsed: true,
  });
});

test("the old Impact shop and the pilot journey appear on the same rewards page", async ({ page }) => {
  await page.goto("/rewards");
  await expect(page.getByRole("heading", { name: "Impact shop" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Illustrative planet/ })).toBeVisible();
  await expect(page.getByText(/Carbon Coins/i)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Tree planting" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Water conservation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What finishing could unlock" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start mission" })).toBeVisible();
  await expect(page.getByText("Shared prototype activity. No tree planting or donation has been fulfilled.")).toBeVisible();
});

test("referral attribution remains local and the phone layout has no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/rewards?ref=MM-123456789A");
  await expect(page.getByText(/You arrived with an invite link/)).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("impact-drive-campaign-pilot-v1") ?? "{}").referredBy)).toBe("MM-123456789A");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

test("an expired demo offer cannot be used", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("impact-drive-campaign-pilot-v1", JSON.stringify({
    participantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", referralCode: "MM-AAAAAAAAAA", referredBy: null,
    started: true, completed: true, completedAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
    shareActions: 0, offerViews: 0, offerUsed: false, recallAnswer: null, interestAnswer: null,
  })));
  await page.goto("/rewards");
  await page.getByRole("button", { name: "View illustrative offer details" }).click();
  await expect(page.getByRole("button", { name: "Demo offer window expired" })).toBeDisabled();
});
