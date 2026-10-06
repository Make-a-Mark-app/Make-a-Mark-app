import { expect, test } from "@playwright/test";

test("the live app pilot unlocks only after the mission lesson and records the demo funnel", async ({ page, request }) => {
  await page.goto("/campaign");
  await expect(page.getByRole("heading", { name: /Finish the mission/ })).toBeVisible();
  await expect(page.getByText("One tree contribution")).toBeVisible();
  await expect(page.getByText("Sample offer unlocked", { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "Start the pilot mission" }).click();
  await expect(page.getByRole("heading", { name: "Deliver the parts." })).toBeVisible();
  await page.getByRole("radio", { name: /Sea/ }).click();
  await expect(page.getByRole("button", { name: "Complete mission" })).toBeDisabled();
  await page.getByLabel("AMF1 sustainability claims need a source and reporting period.").check();
  await page.getByRole("button", { name: "Complete mission" }).click();
  await page.getByRole("button", { name: "View unlocked rewards" }).click();
  await expect(page).toHaveURL(/\/campaign$/);
  await expect(page.getByText("Sample offer unlocked", { exact: false })).toBeVisible();
  await expect(page.getByText("Demo unlock recorded — no tree planted")).toBeVisible();
  await page.getByRole("button", { name: "Simulate offer use" }).click();
  await expect(page.getByRole("button", { name: "Sample use recorded" })).toBeDisabled();
  const id = await page.evaluate(() => localStorage.getItem("impact-drive-pilot-id"));
  const response = await request.get(`/api/pilot?id=${id}`);
  expect((await response.json()).participant).toMatchObject({ started: true, completed: true, offerUsed: true });
});

test("the pilot API counts unique participants and checks step order", async ({ request }) => {
  const id = crypto.randomUUID();
  const event = (action: string, extra = {}) => request.post("/api/pilot", { data: { id, action, ...extra } });
  expect((await event("complete")).status()).toBe(409);
  expect((await event("start")).ok()).toBeTruthy();
  expect((await event("start")).ok()).toBeTruthy();
  expect((await event("complete")).ok()).toBeTruthy();
  expect((await event("share")).ok()).toBeTruthy();
  expect((await event("feedback", { recall: "yes", interest: "more" })).ok()).toBeTruthy();
  const participant = (await (await request.get(`/api/pilot?id=${id}`)).json()).participant;
  expect(participant).toMatchObject({ started: true, completed: true, shared: true, recall: "yes", interest: "more" });
});

test("a completed participant's separate share code attributes one referral start", async ({ request }) => {
  const referrerId = crypto.randomUUID();
  const referredId = crypto.randomUUID();
  const before = await (await request.get("/api/pilot/metrics")).json() as { referralStarts: number };
  await request.post("/api/pilot", { data: { id: referrerId, action: "start" } });
  const completed = await (await request.post("/api/pilot", { data: { id: referrerId, action: "complete" } })).json() as { participant: { shareCode: string } };
  expect(completed.participant.shareCode).not.toBe(referrerId);
  await request.post("/api/pilot", { data: { id: referredId, action: "start", referralCode: completed.participant.shareCode } });
  await request.post("/api/pilot", { data: { id: referredId, action: "start", referralCode: completed.participant.shareCode } });
  const after = await (await request.get("/api/pilot/metrics")).json() as { referralStarts: number };
  expect(after.referralStarts).toBe(before.referralStarts + 1);
});
