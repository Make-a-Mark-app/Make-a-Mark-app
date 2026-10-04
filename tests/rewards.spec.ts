import { expect, test } from "@playwright/test";

test("a completed freight mission earns one browser-local credit per distinct run", async ({ page }) => {
  await page.addInitScript(() => {
    let nextId = 0;
    Object.defineProperty(window.crypto, "randomUUID", {
      configurable: true,
      value: () => `mission-completion-${++nextId}`,
    });
  });

  await page.goto("/mission/freight");
  await page.getByRole("link", { name: "Impact rewards" }).click();
  await expect(page.getByText("Your Impact Credits")).toBeVisible();
  await expect(page.locator(".rewards-balance").getByText("0", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Freight mission" }).click();
  await page.getByRole("radio", { name: /Sea/ }).click();
  await page.getByRole("link", { name: "Impact rewards" }).click();
  await expect(page.locator(".rewards-balance").getByText("0", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Freight mission" }).click();
  await page.getByRole("button", { name: "Complete mission" }).click();
  await expect(page.getByRole("status")).toContainText("earned 1 demo Impact Credit");
  await expect(page.getByRole("status")).toContainText(/No tree was planted or impact measured/i);
  await page.getByRole("link", { name: "Impact rewards" }).click();
  await expect(page.locator(".rewards-balance").getByText("1", { exact: true })).toBeVisible();

  const firstSavedState = await page.evaluate(() => JSON.parse(localStorage.getItem("impact-drive-rewards") ?? "null"));
  expect(firstSavedState).toMatchObject({ version: 1, credits: 1 });
  expect(firstSavedState.missionCompletionIds).toHaveLength(1);

  await page.reload();
  await expect(page.locator(".rewards-balance").getByText("1", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Freight mission" }).click();
  await page.getByRole("button", { name: "Retry mission" }).click();
  await page.getByRole("radio", { name: /Air/ }).click();
  await page.getByRole("button", { name: "Complete mission" }).click();
  await expect(page.getByRole("status")).toContainText("earned 1 demo Impact Credit");
  await page.getByRole("link", { name: "Impact rewards" }).click();
  await expect(page.locator(".rewards-balance").getByText("2", { exact: true })).toBeVisible();

  const retriedState = await page.evaluate(() => JSON.parse(localStorage.getItem("impact-drive-rewards") ?? "null"));
  expect(retriedState.missionCompletionIds).toHaveLength(2);
  expect(new Set(retriedState.missionCompletionIds).size).toBe(2);
  expect(retriedState.missionCompletionIds[0]).toBe(firstSavedState.missionCompletionIds[0]);
});

test("replaying a completion ID already in browser storage does not award another credit", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.crypto, "randomUUID", {
      configurable: true,
      value: () => "mission-completion-duplicate",
    });
    localStorage.setItem("impact-drive-rewards", JSON.stringify({
      version: 1,
      year: new Date().getFullYear(),
      credits: 4,
      treesThisYear: 0,
      treesAllTime: 0,
      missionCompletionIds: ["mission-completion-duplicate"],
    }));
  });

  await page.goto("/mission/freight");
  await page.getByRole("radio", { name: /Road/ }).click();
  await page.getByRole("button", { name: "Complete mission" }).click();
  await expect(page.getByRole("status")).toContainText("already recorded");
  await page.getByRole("link", { name: "Impact rewards" }).click();
  await expect(page.locator(".rewards-balance").getByText("4", { exact: true })).toBeVisible();

  const savedIds = await page.evaluate(() => JSON.parse(localStorage.getItem("impact-drive-rewards") ?? "null").missionCompletionIds);
  expect(savedIds).toEqual(["mission-completion-duplicate"]);
});

test("invalid saved rewards are reset with an accessible notice", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("impact-drive-rewards", JSON.stringify({
      version: 1,
      year: new Date().getFullYear(),
      credits: -1,
      treesThisYear: 0,
      treesAllTime: 0,
      missionCompletionIds: [],
    }));
  });

  await page.goto("/rewards");

  await expect(page.locator(".rewards-balance").getByText("0", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText(/invalid saved rewards data was reset/i);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("impact-drive-rewards"))).toBeNull();
});

test("malformed rewards JSON is removed and explained", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("impact-drive-rewards", "{"));

  await page.goto("/rewards");

  await expect(page.locator(".rewards-balance").getByText("0", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText(/invalid saved rewards data was reset/i);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("impact-drive-rewards"))).toBeNull();
});

test("unsupported rewards versions are removed and explained", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("impact-drive-rewards", JSON.stringify({
    version: 99,
    year: new Date().getFullYear(),
    credits: 8,
    treesThisYear: 0,
    treesAllTime: 0,
    missionCompletionIds: ["old-version-completion"],
  })));

  await page.goto("/rewards");

  await expect(page.locator(".rewards-balance").getByText("0", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText(/invalid saved rewards data was reset/i);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("impact-drive-rewards"))).toBeNull();
});

test("invalid rewards remain empty and explain failed cleanup when storage removal fails", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("impact-drive-rewards", "{");
    const removeItem = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (key: string) {
      if (key === "impact-drive-rewards") throw new Error("storage removal blocked");
      return removeItem.call(this, key);
    };
  });

  await page.goto("/rewards");

  await expect(page.locator(".rewards-balance").getByText("0", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText(/invalid saved rewards data was reset for this visit/i);
  await expect(page.getByRole("status")).toContainText(/saved rewards key could not be cleared/i);
  await expect(page.getByRole("status")).toContainText(/won’t persist after reload or tab close/i);
});

test("rewards remain usable in memory when browser storage read and write fail", async ({ page }) => {
  await page.addInitScript(() => {
    const getItem = Storage.prototype.getItem;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key: string) {
      if (key === "impact-drive-rewards") throw new Error("storage read blocked");
      return getItem.call(this, key);
    };
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === "impact-drive-rewards") throw new Error("storage write blocked");
      return setItem.call(this, key, value);
    };
  });

  await page.goto("/mission/freight");
  await page.getByRole("radio", { name: /Sea/ }).click();
  await page.getByRole("button", { name: "Complete mission" }).click();
  await page.getByRole("link", { name: "Impact rewards" }).click();

  await expect(page.locator(".rewards-balance").getByText("1", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("won’t persist after reload or tab close");
  await page.reload();
  await expect(page.locator(".rewards-balance").getByText("0", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("won’t persist after reload or tab close");
});

test("confirmed rewards reset clears only rewards and preserves Discovery", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("impact-drive-rewards", JSON.stringify({
      version: 1,
      year: new Date().getFullYear(),
      credits: 3,
      treesThisYear: 0,
      treesAllTime: 0,
      missionCompletionIds: ["one", "two", "three"],
    }));
    localStorage.setItem("impact-drive-discovery", JSON.stringify({
      missionComplete: true,
      routeChoice: "sea",
      foundToken: true,
      openedRecords: ["record-1"],
      topics: ["Environment"],
    }));
    localStorage.setItem("unrelated-browser-key", "keep me");
  });

  await page.goto("/rewards");
  await expect(page.locator(".rewards-balance").getByText("3", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  const resetButton = page.getByRole("button", { name: "Reset rewards" });
  await resetButton.focus();
  await resetButton.press("Enter");

  await expect(page.locator(".rewards-balance").getByText("0", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("rewards were reset");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("impact-drive-rewards"))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("impact-drive-discovery"))).toContain('"routeChoice":"sea"');
  expect(await page.evaluate(() => localStorage.getItem("unrelated-browser-key"))).toBe("keep me");
});

test("video and merchandise simulations award repeatable local credits with clear boundaries", async ({ page }) => {
  await page.goto("/rewards");

  await expect(page.getByText(/simulated.*does not verify a video view/i)).toBeVisible();
  await expect(page.getByText(/simulated.*does not verify product eligibility or a purchase/i)).toBeVisible();
  await expect(page.getByText(/Bamboo-based merchandise and lower-impact shipping are hypothetical eligibility examples/i)).toBeVisible();

  await page.getByRole("button", { name: "Record demo video completion" }).click();
  await expect(page.locator(".rewards-balance").getByText("1", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Demo video completion recorded");
  await page.getByRole("button", { name: "Record demo video completion" }).click();
  await page.getByRole("button", { name: "Record demo merchandise purchase" }).click();
  await page.getByRole("button", { name: "Record demo merchandise purchase" }).click();
  await expect(page.locator(".rewards-balance").getByText("4", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Demo merchandise action recorded");

  const savedState = await page.evaluate(() => JSON.parse(localStorage.getItem("impact-drive-rewards") ?? "null"));
  expect(savedState.credits).toBe(4);
  expect(savedState.missionCompletionIds).toEqual([]);
  await page.reload();
  await expect(page.locator(".rewards-balance").getByText("4", { exact: true })).toBeVisible();
});

test("simulated earning actions report the credit bound without overflowing", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("impact-drive-rewards", JSON.stringify({
    version: 1,
    year: new Date().getFullYear(),
    credits: 1_000_000,
    treesThisYear: 0,
    treesAllTime: 0,
    missionCompletionIds: [],
  })));

  await page.goto("/rewards");
  await page.getByRole("button", { name: "Record demo video completion" }).click();

  await expect(page.locator(".rewards-balance").getByText("1000000", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText(/limit has been reached/i);
  const savedState = await page.evaluate(() => JSON.parse(localStorage.getItem("impact-drive-rewards") ?? "null"));
  expect(savedState.credits).toBe(1_000_000);
});

test("contribution redemption requires ten credits and updates all totals atomically", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("rewards-seeded")) return;
    sessionStorage.setItem("rewards-seeded", "yes");
    localStorage.setItem("impact-drive-rewards", JSON.stringify({
      version: 1,
      year: new Date().getFullYear(),
      credits: 9,
      treesThisYear: 2,
      treesAllTime: 7,
      missionCompletionIds: [],
    }));
  });

  await page.goto("/rewards");
  const redeemButton = page.getByRole("button", { name: "Redeem 10 credits for a demo contribution" });
  await expect(redeemButton).toBeDisabled();
  await expect(page.getByText(/Need 10 Impact Credits to redeem/i)).toBeVisible();
  const before = await page.evaluate(() => localStorage.getItem("impact-drive-rewards"));
  expect(JSON.parse(before ?? "null")).toMatchObject({ credits: 9, treesThisYear: 2, treesAllTime: 7 });

  await page.getByRole("button", { name: "Record demo video completion" }).click();
  await expect(redeemButton).toBeEnabled();
  await redeemButton.click();

  await expect(page.locator(".rewards-balance").getByText("0", { exact: true })).toBeVisible();
  await expect(page.locator(".rewards-contribution-totals > div").nth(0).locator("strong")).toHaveText("3");
  await expect(page.locator(".rewards-contribution-totals > div").nth(1).locator("strong")).toHaveText("8");
  await expect(page.getByRole("status")).toContainText(/No tree was planted.*impact measured/i);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("impact-drive-rewards") ?? "null"));
  expect(after).toMatchObject({ credits: 0, treesThisYear: 3, treesAllTime: 8 });
  await page.reload();
  await expect(page.locator(".rewards-balance").getByText("0", { exact: true })).toBeVisible();
  await expect(page.locator(".rewards-contribution-totals > div").nth(0).locator("strong")).toHaveText("3");
  await expect(page.locator(".rewards-contribution-totals > div").nth(1).locator("strong")).toHaveText("8");
});

test("a bounded contribution counter prevents redemption without changing rewards state", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("impact-drive-rewards", JSON.stringify({
    version: 1,
    year: new Date().getFullYear(),
    credits: 10,
    treesThisYear: 1_000_000,
    treesAllTime: 999_999,
    missionCompletionIds: [],
  })));

  await page.goto("/rewards");
  const redeemButton = page.getByRole("button", { name: "Redeem 10 credits for a demo contribution" });
  await expect(redeemButton).toBeDisabled();
  await expect(page.locator("#rewards-redemption-help")).toContainText(/contribution limit has been reached/i);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("impact-drive-rewards") ?? "null"));
  expect(saved).toMatchObject({ credits: 10, treesThisYear: 1_000_000, treesAllTime: 999_999 });
});

test("later device years roll only the current-year contribution count forward", async ({ page }) => {
  await page.addInitScript(() => {
    Date.prototype.getFullYear = () => 2030;
    localStorage.setItem("impact-drive-rewards", JSON.stringify({
      version: 1,
      year: 2029,
      credits: 15,
      treesThisYear: 5,
      treesAllTime: 11,
      missionCompletionIds: [],
    }));
  });

  await page.goto("/rewards");

  await expect(page.getByText(/THIS YEAR · 2030/)).toBeVisible();
  await expect(page.locator(".rewards-contribution-totals > div").nth(0).locator("strong")).toHaveText("0");
  await expect(page.locator(".rewards-contribution-totals > div").nth(1).locator("strong")).toHaveText("11");
  const rolled = await page.evaluate(() => JSON.parse(localStorage.getItem("impact-drive-rewards") ?? "null"));
  expect(rolled).toMatchObject({ year: 2030, credits: 15, treesThisYear: 0, treesAllTime: 11 });
});

test("an earlier device year keeps the recognized contribution year and count", async ({ page }) => {
  await page.addInitScript(() => {
    Date.prototype.getFullYear = () => 2028;
    localStorage.setItem("impact-drive-rewards", JSON.stringify({
      version: 1,
      year: 2029,
      credits: 12,
      treesThisYear: 4,
      treesAllTime: 9,
      missionCompletionIds: [],
    }));
  });

  await page.goto("/rewards");

  await expect(page.getByText(/THIS YEAR · 2029/)).toBeVisible();
  await expect(page.locator(".rewards-contribution-totals > div").nth(0).locator("strong")).toHaveText("4");
  await expect(page.locator(".rewards-contribution-totals > div").nth(1).locator("strong")).toHaveText("9");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("impact-drive-rewards") ?? "null"));
  expect(saved).toMatchObject({ year: 2029, credits: 12, treesThisYear: 4, treesAllTime: 9 });
});

test("campaign and leaderboard examples stay clearly illustrative and fictional", async ({ page }) => {
  await page.goto("/rewards");

  const campaign = page.getByRole("article", { name: "Illustrative campaign placeholder" });
  await expect(campaign.getByText("Illustrative campaign total")).toBeVisible();
  await expect(campaign.getByText("Illustrative demo data — not live AMF1 data or a measured impact result.")).toBeVisible();
  await expect(campaign.locator(".rewards-campaign-mark")).not.toContainText(/\d/);

  const leaderboard = page.getByRole("article", { name: "Example leaderboard" });
  await expect(leaderboard.getByRole("listitem")).toHaveCount(3);
  await expect(leaderboard.getByText("Avery Chen")).toBeVisible();
  await expect(leaderboard.getByText("Mika Okafor")).toBeVisible();
  await expect(leaderboard.getByText("Sofia Laurent")).toBeVisible();
  await expect(leaderboard).toContainText("Fictional names and ranks only");
  await expect(leaderboard.getByText("You", { exact: true })).toHaveCount(0);
  await expect(leaderboard).not.toContainText(/contributions?:\s*\d/i);

  await expect(page.getByText(/race-pass prize hypothesis only/i)).toBeVisible();
  await expect(page.getByText(/No prize or contest is active/i)).toBeVisible();
  await expect(page.getByText(/No payment is transferred, no order is placed, no tree is planted, no carbon credit or offset is issued, and no impact is measured/i)).toBeVisible();
});

test("rewards earning, redemption, and reset work offline from the keyboard", async ({ page }) => {
  await page.route("**/api/**", (route) => route.abort());
  await page.route("https://**", (route) => route.abort());
  await page.goto("/rewards");

  const videoButton = page.getByRole("button", { name: "Record demo video completion" });
  await videoButton.focus();
  await videoButton.press("Enter");
  for (let credit = 1; credit < 10; credit += 1) await videoButton.press("Enter");
  const redeemButton = page.getByRole("button", { name: "Redeem 10 credits for a demo contribution" });
  await expect(redeemButton).toBeEnabled();
  await redeemButton.focus();
  await redeemButton.press("Enter");
  await expect(page.locator(".rewards-balance strong")).toHaveText("0");
  await expect(page.locator(".rewards-contribution-totals > div").nth(1).locator("strong")).toHaveText("1");
  await expect(page.getByRole("status")).toContainText(/No tree was planted/i);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("impact-drive-rewards"))).toContain('"treesAllTime":1');

  await page.reload();
  await expect(page.locator(".rewards-contribution-totals > div").nth(1).locator("strong")).toHaveText("1");
  page.once("dialog", (dialog) => dialog.accept());
  const resetButton = page.getByRole("button", { name: "Reset rewards" });
  await resetButton.focus();
  await resetButton.press("Enter");
  await expect(page.getByRole("status")).toContainText(/rewards were reset/i);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("impact-drive-rewards"))).toBeNull();
});

test("reward actions fit narrow screens, work by touch, and respect reduced motion", async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${process.env.VITE_PORT ?? "5173"}`,
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto("/rewards");

  const videoButton = page.getByRole("button", { name: "Record demo video completion" });
  await expect(videoButton).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  expect(await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches)).toBeTruthy();
  const transitionDuration = await videoButton.evaluate((button) => getComputedStyle(button).transitionDuration);
  expect(transitionDuration.split(",").every((duration) => Number.parseFloat(duration) <= 0.0001)).toBeTruthy();

  await videoButton.tap();
  await expect(page.locator(".rewards-balance strong")).toHaveText("1");
  await context.close();
});
