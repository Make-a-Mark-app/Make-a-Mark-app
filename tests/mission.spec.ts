import { expect, test } from "@playwright/test";

test("the API exposes a validated mission and deterministic outcome", async ({ request }) => {
  const missionResponse = await request.get("/api/mission");
  expect(missionResponse.ok()).toBeTruthy();
  const mission = await missionResponse.json();

  expect(mission).toMatchObject({
    missionId: "freight",
    configId: "freight-r1-v1",
    title: "Deliver the parts.",
    choices: expect.arrayContaining([
      expect.objectContaining({ id: "air", name: "Air" }),
      expect.objectContaining({ id: "sea", name: "Sea" }),
      expect.objectContaining({ id: "road", name: "Road" }),
    ]),
  });
  expect(mission).not.toHaveProperty("telemetry");
  expect(mission).not.toHaveProperty("evidence");

  const feedbackByChoice = {
    air: "Your game scenario prioritizes a tight delivery window.",
    sea: "Your game scenario trades immediacy for a steadier journey.",
    road: "Your game scenario keeps the final connection flexible.",
  };

  for (const [choiceId, feedback] of Object.entries(feedbackByChoice)) {
    const outcomeResponse = await request.post("/api/mission/outcome", {
      data: { missionId: "freight", configId: "freight-r1-v1", choiceId },
    });
    expect(outcomeResponse.ok()).toBeTruthy();
    expect(await outcomeResponse.json()).toEqual({
      missionId: "freight",
      configId: "freight-r1-v1",
      choiceId,
      outcomeLabel: "Fictional mission result",
      feedback,
    });
  }
});

test("the API rejects an unknown choice and unrelated outcome data", async ({ request }) => {
  const unknownChoice = await request.post("/api/mission/outcome", {
    data: { missionId: "freight", configId: "freight-r1-v1", choiceId: "rail" },
  });
  expect(unknownChoice.status()).toBe(400);

  const mixedOutcome = await request.post("/api/mission/outcome", {
    data: {
      missionId: "freight",
      configId: "freight-r1-v1",
      choiceId: "air",
      telemetry: { speed: 120 },
    },
  });
  expect(mixedOutcome.status()).toBe(400);
});

test("visitors can complete and retry the fictional route without an impact score", async ({ page }) => {
  await page.goto("/mission/freight");
  await expect(page.getByRole("heading", { name: "Deliver the parts." })).toBeVisible();

  const seaChoice = page.getByRole("radio", { name: /Sea/ });
  await seaChoice.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Your game scenario trades immediacy for a steadier journey.")).toBeVisible();
  await expect(page.getByText("FICTIONAL MISSION RESULT")).toBeVisible();
  await expect(page.getByText(/does not measure emissions or a real delivery/i)).toBeVisible();
  await expect(page.getByText(/score|impact result/i)).toHaveCount(0);

  await page.getByRole("button", { name: "Complete mission" }).click();
  await expect(page.getByRole("status")).toContainText("Mission complete");
  await page.getByRole("button", { name: "Retry mission" }).click();
  await expect(page.getByRole("radio", { name: /Sea/ })).toHaveAttribute("aria-checked", "false");
  await expect(page.getByText("Choose a route to see your game result.")).toBeVisible();
});

test("retry preserves other discoveries and visitors can clear the local recap", async ({ page }) => {
  await page.goto("/world");
  await page.getByRole("button", { name: /Discover freight crate and open mission/ }).click();
  await page.getByRole("radio", { name: /Road/ }).click();
  await page.getByRole("button", { name: "Complete mission" }).click();
  await page.getByRole("button", { name: "Retry mission" }).click();

  await page.getByRole("button", { name: "My discoveries" }).click();
  await expect(page.getByText("Discovery found")).toBeVisible();
  await expect(page.getByText("Not complete yet")).toBeVisible();

  await page.getByRole("button", { name: "Clear my discoveries" }).click();
  await expect(page.getByText("Not explored yet")).toBeVisible();
  await expect(page.getByText("Not complete yet")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Not explored yet")).toBeVisible();
});

test("completing the mission does not record a World discovery", async ({ page }) => {
  await page.goto("/mission/freight");
  await page.getByRole("radio", { name: /Air/ }).click();
  await page.getByRole("button", { name: "Complete mission" }).click();
  await page.getByRole("button", { name: "My discoveries" }).click();

  await expect(page.getByText("Complete", { exact: true })).toBeVisible();
  await expect(page.getByText("Not explored yet")).toBeVisible();
});

test("an invalid saved recap is ignored", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("impact-drive-discovery", JSON.stringify({
      missionComplete: true,
      routeChoice: "rail",
      foundToken: false,
      openedRecords: [],
      topics: [],
    }));
  });
  await page.goto("/summary");

  await expect(page.getByText("Not complete yet")).toBeVisible();
  await expect(page.getByText("Not explored yet")).toBeVisible();
});

test("the mission can be reached without driving and respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/world");
  await expect(page.locator(".app-shell")).toHaveClass(/motion-reduced/);
  await page.getByRole("button", { name: "Skip driving" }).click();
  await expect(page.getByRole("heading", { name: "Deliver the parts." })).toBeVisible();
  await expect(page.getByText(/timer/i)).toHaveCount(0);
});
