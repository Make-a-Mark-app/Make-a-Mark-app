import { expect, test } from "@playwright/test";
import { isReportedImpact, lookupEvidence, parseEvidenceRecord, type EvidenceRecord, type ReviewState } from "../shared/contracts/evidence";

const solarRecord: EvidenceRecord = {
  id: "env-test-source-claim",
  title: "Test source claim",
  topic: "Environment",
  topicTag: "travel-logistics-reduction",
  claim: "The source reports a bounded result.",
  claimType: "report_result",
  reportingPeriod: "2024",
  source: {
    title: "Public report",
    edition: "2024",
    publicationDate: "Not stated in source",
    url: "https://example.gov/report.pdf",
    location: "Page 1",
  },
  reviewState: "reviewed",
  reviewNote: "Checked against the cited source.",
  reviewer: "Test reviewer",
  reviewDate: "2026-10-01",
  history: [],
  limitations: ["The source reports this value only for its stated period."],
};

test("only reviewed report results qualify as Reported impact", () => {
  const states: ReviewState[] = ["illustrative", "pending_review", "reviewed", "rejected", "corrected", "withdrawn"];
  for (const reviewState of states) {
    const record = parseEvidenceRecord({ ...solarRecord, reviewState });
    expect(record?.reviewState).toBe(reviewState);
    expect(record ? isReportedImpact(record) : false).toBe(reviewState === "reviewed");
  }

  expect(isReportedImpact({ ...solarRecord, claimType: "target" })).toBe(false);
  expect(parseEvidenceRecord({ ...solarRecord, source: { ...solarRecord.source, url: "javascript:alert(1)" } })).toBeNull();
});

test("the evidence API exposes validated source-reviewed claims with provenance", async ({ request }) => {
  const response = await request.get("/api/evidence");
  expect(response.ok()).toBeTruthy();

  const dataset = await response.json();
  expect(dataset.version).toBe("evidence-r1-v2");
  expect(dataset.records).toHaveLength(6);
  expect(dataset.records.map((record: { topic: string }) => record.topic)).toEqual(
    expect.arrayContaining(["Environment", "Belong", "Community"]),
  );
  expect(dataset.records.every((record: { reviewState: string }) => record.reviewState === "reviewed")).toBeTruthy();

  const solarClaim = dataset.records.find((record: { id: string }) => record.id === "env-2025-travel-logistics-reduction");
  expect(solarClaim).toMatchObject({
    title: "Travel and logistics emissions reduction",
    claimType: "report_result",
    value: 14,
    valueDisplay: "14",
    unit: "% reduction",
    reportingPeriod: "2025 results (exact measurement dates and comparison baseline not stated)",
    source: {
      title: "2025 Make A Mark Report",
      edition: "2025",
      publicationDate: "Not stated in source",
      location: "Printed p. 9 (PDF p. 8), 2025 impact highlights; see also printed p. 24, footnote 14",
    },
    reviewState: "reviewed",
  });
  expect(solarClaim.source.url).toBe("https://downloads.astonmartinf1.com/MakeAMark_ESG_Report_2025.pdf#page=8");
  expect(solarClaim.reviewNote.length).toBeGreaterThan(20);
  expect(solarClaim.limitations.length).toBeGreaterThan(0);
});

test("visitors can browse reviewed claims separately from illustrative samples", async ({ page }) => {
  await page.goto("/library");
  await expect(page.getByRole("heading", { name: "Source-reviewed evidence" })).toBeVisible();
  await expect(page.getByText(/AMF1 reports a 14% reduction in travel and logistics emissions/)).toBeVisible();
  await expect(page.getByText(/93% of the 2025 Aleto group felt they grew their professional network/)).toBeVisible();
  await expect(page.getByText("Report result").first()).toBeVisible();

  await page.getByRole("button", { name: "Illustrative samples" }).click();
  await expect(page.getByText("Illustrative demo data — not live AMF1 data or a measured impact result.")).toBeVisible();
  await expect(page.getByText("Freight and logistics evidence")).toBeVisible();
  await expect(page.getByText(/AMF1 reports a 14% reduction in travel and logistics emissions/)).toHaveCount(0);
  await page.getByRole("button", { name: "Open record: Target and result are different claim types" }).click();
  await expect(page.getByRole("dialog")).toContainText("Target");
});

test("visitors can combine pillar, controlled topic, and reporting-period filters with literal normalized search", async ({ page }) => {
  await page.goto("/library");
  await page.getByLabel("Filter by pillar").selectOption("Belong");
  await page.getByLabel("Filter by controlled topic").selectOption("aleto-network");
  await page.getByLabel("Filter by reporting period").selectOption("2025");
  await expect(page.getByRole("button", { name: "Open record: Aleto cohort: professional network" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open record: Aleto cohort: skills and confidence" })).toHaveCount(0);
  await page.getByLabel("Search evidence library").fill("93% felt they grew their professional network");
  await expect(page.getByRole("button", { name: "Open record: Aleto cohort: professional network" })).toBeVisible();
  await page.getByLabel("Search evidence library").fill("dragon telemetry");
  await expect(page.getByText("Not enough evidence", { exact: false })).toBeVisible();
});

test("the About page reflects the reviewed library and Engineer boundary", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByText(/limited set of source-reviewed claims/i)).toBeVisible();
  await expect(page.getByText(/retrieves only reviewed records and context you choose to include/i)).toBeVisible();
  await expect(page.getByText("This prototype uses illustrative content only.")).toHaveCount(0);
});

test("the Home page points to the available source-reviewed library", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/small source-reviewed set/i)).toBeVisible();
  await expect(page.getByText("Reviewed evidence will appear here.")).toHaveCount(0);
});

test("reviewed evidence details show source, period, review note, and limitations", async ({ page }) => {
  await page.goto("/library");
  await page.getByRole("button", { name: "Open record: Travel and logistics emissions reduction" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Source-reviewed for this prototype");
  await expect(dialog.locator(".record-fields > div").filter({ hasText: "REPORTED VALUE" })).toContainText("14 % reduction");
  await expect(dialog).toContainText("2025 results");
  await expect(dialog).toContainText("comparison baseline");
  await expect(dialog).toContainText("No prior corrections recorded.");
  await expect(dialog.getByRole("link", { name: "Open source report" })).toHaveAttribute(
    "href",
    "https://downloads.astonmartinf1.com/MakeAMark_ESG_Report_2025.pdf#page=8",
  );
  await expect(dialog).toContainText("Codex source review · 2026-10-01");
});

test("the evidence lookup normalizes literal text, applies filters, and excludes corrected or withdrawn records", async ({ request }) => {
  const exact = await request.get("/api/evidence?q=TRAVEL%20AND%20LOGISTICS%20EMISSIONS%20REDUCTION");
  const exactResult = await exact.json();
  expect(exactResult.status).toBe("matched");
  expect(exactResult.records[0].id).toBe("env-2025-travel-logistics-reduction");
  expect(exactResult.records.length).toBeLessThanOrEqual(10);

  const punctuation = await request.get("/api/evidence?q=avoided%20air%20freight%20emissions");
  expect((await punctuation.json()).records[0].id).toBe("env-2025-travel-logistics-avoided");
  const filtered = await request.get("/api/evidence?pillar=Belong&topic=aleto-network&period=2025");
  expect((await filtered.json()).records.map((record: { id: string }) => record.id)).toEqual(["bel-2025-aleto-network"]);
  const unsupported = await request.get("/api/evidence?q=dragon%20telemetry");
  expect(await unsupported.json()).toMatchObject({ status: "not_enough_evidence", records: [] });

  const corrected = parseEvidenceRecord({ ...solarRecord, id: "env-test-source-claim", reviewState: "corrected", history: [{ claim: "The previous value was four kilograms.", value: 4, unit: "kg", reviewState: "reviewed", date: "2026-10-01", note: "Replaced after a source correction." }] });
  expect(corrected?.history[0]).toMatchObject({ claim: "The previous value was four kilograms.", value: 4, unit: "kg" });
  const records = [solarRecord, { ...solarRecord, id: "test-corrected", reviewState: "corrected" as const, history: corrected!.history }, { ...solarRecord, id: "test-withdrawn", reviewState: "withdrawn" as const }];
  expect(lookupEvidence(records).map(({ id }) => id)).toEqual(["env-test-source-claim"]);
  const many = Array.from({ length: 12 }, (_, index) => ({ ...solarRecord, id: `test-${String(index).padStart(2, "2")}` }));
  expect(lookupEvidence(many).map(({ id }) => id)).toHaveLength(10);
  expect(lookupEvidence(many).map(({ id }) => id)).toEqual([...lookupEvidence(many).map(({ id }) => id)].sort());
});
