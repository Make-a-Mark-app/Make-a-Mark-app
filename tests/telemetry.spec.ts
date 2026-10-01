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

  expect(fixture.version).toBe("telemetry-r1-v2");
  expect(fixture.snapshots.map((snapshot: { stepId: string; status: string }) => [snapshot.stepId, snapshot.status])).toEqual([
    ["step-01", "updating"],
    ["step-02", "delayed"],
    ["step-03", "stale"],
    ["step-04", "unavailable"],
  ]);
  expect(fixture.snapshots.every((snapshot: { timestamp: string }) =>
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(snapshot.timestamp),
  )).toBeTruthy();
  const expectedSignalIds = ["speed", "gear", "throttle", "brake"];
  const signals = fixture.snapshots.flatMap((snapshot: { signals: Array<{ id: string; valueType: string; value: number | null; unit: string; interpretation: string }> }) => snapshot.signals);
  expect(fixture.snapshots.map((snapshot: { signals: Array<{ id: string }> }) => snapshot.signals.map((signal) => signal.id)))
    .toEqual(Array(4).fill(expectedSignalIds));
  expect(signals.every((signal: { valueType: string; value: number | null; unit: string; interpretation: string }) =>
    ["number", "integer"].includes(signal.valueType)
    && (signal.value === null || typeof signal.value === "number")
    && signal.unit.length > 0
    && signal.interpretation.length > 0,
  ))
    .toBeTruthy();
  const fractionalGear = structuredClone(fixture);
  fractionalGear.snapshots[0].signals.find((signal: { id: string }) => signal.id === "gear").value = 2.5;
  expect(parseTelemetryDataset(fractionalGear)?.snapshots[0].signals.find((signal) => signal.id === "gear")?.value).toBeNull();
  const invalidSpeed = structuredClone(fixture);
  invalidSpeed.snapshots[0].signals.find((signal: { id: string }) => signal.id === "speed").value = "fast";
  expect(parseTelemetryDataset(invalidSpeed)?.snapshots[0].signals.find((signal) => signal.id === "speed")?.value).toBeNull();
  const missingSpeed = structuredClone(fixture);
  delete missingSpeed.snapshots[0].signals.find((signal: { id: string }) => signal.id === "speed").value;
  expect(parseTelemetryDataset(missingSpeed)?.snapshots[0].signals.find((signal) => signal.id === "speed")?.value).toBeNull();
  expect(fixture.snapshots.find((snapshot: { status: string; signals: Array<{ value: number | null }> }) =>
    snapshot.status !== "unavailable" && snapshot.signals.some((signal) => signal.value === null),
  )?.status).toBe("stale");
});

test("visitors can select any repeatable simulated feed state directly", async ({ page }) => {
  await page.clock.install({ time: new Date("2030-01-01T12:00:00.000Z") });
  await page.goto("/telemetry");

  await expect(page.getByRole("heading", { name: "Simulated live view" })).toBeVisible();
  await expect(page.getByText("Simulated telemetry", { exact: true })).toBeVisible();
  await expect(page.getByText("2024-07-07T10:00:00+01:00")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Updating");
  await expect(page.getByRole("heading", { name: "Speed" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Gear" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Throttle" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Brake" })).toBeVisible();
  await expect(page.getByText("Number · km/h", { exact: true })).toBeVisible();
  await expect(page.getByText("Integer · gear", { exact: true })).toBeVisible();
  await expect(page.getByText("Accelerator input in this simulated snapshot.")).toBeVisible();

  const stale = page.getByRole("button", { name: "Show stale snapshot" });
  await stale.click();
  await expect(stale).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("status")).toContainText("Stale");
  await expect(page.getByText("2024-07-07T10:02:00+01:00")).toBeVisible();
  const brakeSignal = page.locator("article").filter({ has: page.getByRole("heading", { name: "Brake" }) });
  await expect(brakeSignal).toContainText("Unavailable");
  await expect(brakeSignal).not.toContainText("0 %");
  await expect(page.getByText("263 km/h")).toBeVisible();

  await page.getByRole("button", { name: "Show updating snapshot" }).click();
  await expect(page.getByRole("status")).toContainText("Updating");
  await expect(page.getByText("2024-07-07T10:00:00+01:00")).toBeVisible();
  await stale.click();
  await expect(page.getByRole("status")).toContainText("Stale");
  await expect(page.getByText("263 km/h")).toBeVisible();

  await page.getByRole("button", { name: "Show delayed snapshot" }).click();
  await expect(page.getByRole("status")).toContainText("Delayed");
  await expect(page.getByText("2024-07-07T10:01:00+01:00")).toBeVisible();
  await page.getByRole("button", { name: "Show unavailable snapshot" }).click();
  await expect(page.getByRole("status")).toContainText("Unavailable");
  await expect(page.getByText("Unavailable", { exact: false }).count()).resolves.toBeGreaterThan(1);
  await expect(page.getByText("263 km/h")).toHaveCount(0);

  const telemetryStorageKeys = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.toLowerCase().includes("telemetry")));
  expect(telemetryStorageKeys).toEqual([]);
});
