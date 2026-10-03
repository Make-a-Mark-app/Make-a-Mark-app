import { expect, test } from "@playwright/test";

test("the published web app loads and the API stays healthy without provider credentials", async ({ page, request }) => {
  const health = await request.get("/api/health");
  expect(health.ok()).toBeTruthy();
  await expect(health.json()).resolves.toMatchObject({ status: "ok" });

  const app = await page.goto("/");
  expect(app?.ok()).toBeTruthy();
  await expect(page.locator("#root > *")).toHaveCount(1);
});
