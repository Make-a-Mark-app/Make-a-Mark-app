import { expect, test } from "@playwright/test";
import { parseTelemetryDataset } from "../shared/contracts/telemetry";

test("the telemetry API returns an ordered, versioned fixture with explicit timestamps", async ({ request }) => {
  const response = await request.get("/api/telemetry");
  expect(response.ok()).toBeTruthy();
  const fixture = await response.json();

  expect(parseTelemetryDataset(fixture)).not.toBeNull();
  const impossibleTimestamp = structuredClone(fixture);
  impossibleTimestamp.snapshots[0].timestamp = "2024-02-30T10:00:00+01:00";
  expect(parseTelemetryDataset(impossibleTimestamp)).toBeNull();

  expect(fixture.version).toBe("telemetry-r1-v1");
  expect(fixture.snapshots.map((snapshot: { stepId: string; status: string }) => [snapshot.stepId, snapshot.status])).toEqual([
    ["step-01", "updating"],
    ["step-02", "delayed"],
    ["step-03", "stale"],
    ["step-04", "unavailable"],
  ]);
  expect(fixture.snapshots.every((snapshot: { timestamp: string }) =>
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(snapshot.timestamp),
  )).toBeTruthy();
  expect(fixture.snapshots.flatMap((snapshot: { signals: Array<{ value: number | null; unit: string }> }) => snapshot.signals)
    .every((signal: { value: number | null; unit: string }) => (signal.value === null || typeof signal.value === "number") && signal.unit.length > 0))
    .toBeTruthy();
});

test("visitors manually advance through simulated feed states and unavailable values", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-01T00:00:00.000Z") });
  await page.goto("/telemetry");

  await expect(page.getByRole("heading", { name: "Simulated live view" })).toBeVisible();
  await expect(page.getByText("Simulated telemetry", { exact: true })).toBeVisible();
  await expect(page.getByText("2024-07-07T10:00:00+01:00")).toBeVisible();
  await expect(page.getByText("Updating", { exact: true })).toBeVisible();
  await expect(page.getByText("78 °C")).toBeVisible();

  const advance = page.getByRole("button", { name: "Next snapshot" });
  await advance.click();
  await expect(page.getByText("Delayed", { exact: true })).toBeVisible();
  await expect(page.getByText("2024-07-07T10:01:00+01:00")).toBeVisible();
  await advance.click();
  await expect(page.getByText("Stale", { exact: true })).toBeVisible();
  await advance.click();
  await expect(page.getByText("Unavailable", { exact: true })).toBeVisible();
  await expect(page.getByText("Unavailable", { exact: false }).count()).resolves.toBeGreaterThan(1);
  await expect(advance).toBeDisabled();

  const telemetryStorageKeys = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.toLowerCase().includes("telemetry")));
  expect(telemetryStorageKeys).toEqual([]);
});
