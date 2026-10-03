import { expect, test } from "@playwright/test";

test("visitors can directly enter the mission, reviewed evidence, and trust guide without the API", async ({ page }) => {
  let apiRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/")) apiRequests += 1;
  });
  await page.route("**/api/**", (route) => route.abort());

  await page.goto("/");
  const startMission = page.getByRole("link", { name: "Start freight mission" });
  const browseEvidence = page.getByRole("link", { name: "Browse evidence library" });
  await expect(startMission).toHaveAttribute("href", "/mission");
  await expect(browseEvidence).toHaveAttribute("href", "/evidence");

  await startMission.click();
  await expect(page).toHaveURL(/\/mission$/);
  await expect(page.getByRole("heading", { name: "Deliver the parts." })).toBeVisible();

  await page.goto("/mission");
  await expect(page.getByRole("heading", { name: "Deliver the parts." })).toBeVisible();
  await page.goto("/evidence");
  await expect(page.getByRole("heading", { name: "Evidence library" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Travel and logistics emissions reduction" })).toBeVisible();
  await expect(page.getByText("Freight and logistics evidence")).toHaveCount(0);
  await page.getByRole("button", { name: "Illustrative samples" }).click();
  await expect(page.getByText("Illustrative demo data — not live AMF1 data or a measured impact result.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Travel and logistics emissions reduction" })).toHaveCount(0);
  await page.goto("/method");
  await expect(page.getByRole("heading", { name: "Know what each value means." })).toBeVisible();
  expect(apiRequests).toBe(0);
});

test("the trust guide distinguishes all four value categories and supports detail disclosure", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/method");

  await expect(page).toHaveURL(/\/method$/);
  await expect(page.locator(".app-shell")).toHaveClass(/motion-reduced/);
  await expect(page.getByRole("heading", { name: "Know what each value means." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Simulated live view" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Reported impact" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Illustrative impact placeholder" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mission scenario" })).toBeVisible();
  await expect(page.getByText("Illustrative demo data — not live AMF1 data or a measured impact result.")).toBeVisible();

  const detail = page.getByText("More detail", { exact: true }).nth(1);
  await detail.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/a source location is included when available/i)).toBeVisible();

  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(360);
});

test("navigation keeps the trust guide reachable after entering either path", async ({ page }) => {
  await page.goto("/mission");
  const methodLink = page.getByRole("link", { name: "How to read this" });
  await expect(methodLink).toHaveAttribute("href", "/method");
  await methodLink.click();
  await expect(page).toHaveURL(/\/method$/);

  await page.goto("/evidence");
  await expect(page.getByRole("link", { name: "Freight mission" })).toBeVisible();
  await expect(page.getByRole("link", { name: "How to read this" })).toBeVisible();
});
