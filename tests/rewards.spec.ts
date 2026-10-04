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
  await expect(page.getByText("0", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Freight mission" }).click();
  await page.getByRole("radio", { name: /Sea/ }).click();
  await page.getByRole("link", { name: "Impact rewards" }).click();
  await expect(page.getByText("0", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Freight mission" }).click();
  await page.getByRole("button", { name: "Complete mission" }).click();
  await expect(page.getByRole("status")).toContainText("earned 1 demo Impact Credit");
  await page.getByRole("link", { name: "Impact rewards" }).click();
  await expect(page.getByText("1", { exact: true })).toBeVisible();

  const firstSavedState = await page.evaluate(() => JSON.parse(localStorage.getItem("impact-drive-rewards") ?? "null"));
  expect(firstSavedState).toMatchObject({ version: 1, credits: 1 });
  expect(firstSavedState.missionCompletionIds).toHaveLength(1);

  await page.reload();
  await expect(page.getByText("1", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Freight mission" }).click();
  await page.getByRole("button", { name: "Retry mission" }).click();
  await page.getByRole("radio", { name: /Air/ }).click();
  await page.getByRole("button", { name: "Complete mission" }).click();
  await expect(page.getByRole("status")).toContainText("earned 1 demo Impact Credit");
  await page.getByRole("link", { name: "Impact rewards" }).click();
  await expect(page.getByText("2", { exact: true })).toBeVisible();

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
  await expect(page.getByText("4", { exact: true })).toBeVisible();

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

  await expect(page.getByText("0", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText(/invalid saved rewards data was reset/i);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("impact-drive-rewards"))).toBeNull();
});

test("malformed rewards JSON is removed and explained", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("impact-drive-rewards", "{"));

  await page.goto("/rewards");

  await expect(page.getByText("0", { exact: true })).toBeVisible();
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

  await expect(page.getByText("0", { exact: true })).toBeVisible();
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

  await expect(page.getByText("0", { exact: true })).toBeVisible();
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

  await expect(page.getByText("1", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("won’t persist after reload or tab close");
  await page.reload();
  await expect(page.getByText("0", { exact: true })).toBeVisible();
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
  await expect(page.getByText("3", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  const resetButton = page.getByRole("button", { name: "Reset rewards" });
  await resetButton.focus();
  await resetButton.press("Enter");

  await expect(page.getByText("0", { exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("rewards were reset");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("impact-drive-rewards"))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("impact-drive-discovery"))).toContain('"routeChoice":"sea"');
  expect(await page.evaluate(() => localStorage.getItem("unrelated-browser-key"))).toBe("keep me");
});
