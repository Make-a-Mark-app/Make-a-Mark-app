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
