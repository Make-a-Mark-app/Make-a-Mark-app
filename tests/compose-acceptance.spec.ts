import { expect, test } from "@playwright/test";

test("the published web app loads and the API stays healthy without provider credentials", async ({ page, request }) => {
  const sentinel = "SENTINEL_QUESTION_SHOULD_NOT_BE_LOGGED";
  const health = await request.get(`/api/health?marker=${sentinel}`);
  expect(health.ok()).toBeTruthy();
  await expect(health.json()).resolves.toMatchObject({ status: "ok" });

  const engineer = await request.post("/api/engineer", { data: { category: "evidence", question: sentinel } });
  expect(engineer.ok()).toBeTruthy();

  const app = await page.goto("/");
  expect(app?.ok()).toBeTruthy();
  await expect(page.locator("#root > *")).toHaveCount(1);
});
