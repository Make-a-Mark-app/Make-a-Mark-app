import { expect, test } from "@playwright/test";
import { isReportedImpact, parseEvidenceRecord, type EvidenceRecord, type ReviewState } from "../shared/contracts/evidence";
import { MAX_EVIDENCE_SEARCH_RESULTS, searchEvidenceRecords } from "../shared/evidence-search";

const solarRecord: EvidenceRecord = {
  id: "env-test-source-claim",
  title: "Test source claim",
  topic: "Environment",
  claim: "The source reports a bounded result.",
  claimType: "report_result",
  reportingPeriod: "2024",
  source: {
    title: "Public report",
    edition: "2024",
    publicationDate: null,
    url: "https://example.gov/report.pdf",
    location: "Page 1",
  },
  reviewState: "reviewed",
  reviewNote: "Checked against the cited source.",
  limitations: ["The source reports this value only for its stated period."],
};

test("only reviewed report results qualify as Reported impact", () => {
  const states: ReviewState[] = ["illustrative", "pending_review", "reviewed", "rejected"];
  for (const reviewState of states) {
    const record = parseEvidenceRecord({ ...solarRecord, reviewState });
    expect(record?.reviewState).toBe(reviewState);
    expect(record ? isReportedImpact(record) : false).toBe(reviewState === "reviewed");
  }

  expect(isReportedImpact({ ...solarRecord, claimType: "target" })).toBe(false);
  expect(parseEvidenceRecord({ ...solarRecord, source: { ...solarRecord.source, url: "javascript:alert(1)" } })).toBeNull();
});

test("evidence search ranks keyword matches, applies filters, and caps results", async ({ request }) => {
  const response = await request.get("/api/evidence");
  const dataset = await response.json() as { records: EvidenceRecord[] };

  const expandedRecords = Array.from({ length: 8 }, (_, index) => ({
    ...dataset.records[0],
    id: `solar-copy-${index}`,
    title: `Solar generation example ${index}`,
  }));
  const matches = searchEvidenceRecords(expandedRecords, "solar generation", { limit: 99 });
  expect(matches).toHaveLength(MAX_EVIDENCE_SEARCH_RESULTS);
  expect(matches.map((record) => record.id)).toEqual(["solar-copy-0", "solar-copy-1", "solar-copy-2"]);

  const oneKeyword = searchEvidenceRecords(dataset.records, "solar", { topic: "Environment", reportingPeriod: "2024" });
  expect(oneKeyword.map((record) => record.id)).toEqual(["env-2024-solar-generation"]);
  expect(searchEvidenceRecords(dataset.records, "unrelated claim", { topic: "Belong" })).toEqual([]);
});

test("the evidence API exposes validated source-reviewed claims with provenance", async ({ request }) => {
  const response = await request.get("/api/evidence");
  expect(response.ok()).toBeTruthy();

  const dataset = await response.json();
  expect(dataset.version).toBe("evidence-r1-v1");
  expect(dataset.records.map((record: { topic: string }) => record.topic)).toEqual(
    expect.arrayContaining(["Environment", "Belong", "Community"]),
  );
  expect(dataset.records.every((record: { reviewState: string }) => record.reviewState === "reviewed")).toBeTruthy();

  const solarClaim = dataset.records.find((record: { id: string }) => record.id === "env-2024-solar-generation");
  expect(solarClaim).toMatchObject({
    title: "Renewable solar generation",
    claimType: "report_result",
    value: 779682.3,
    valueDisplay: "779,682.30",
    unit: "kWh",
    reportingPeriod: "2024",
    source: {
      title: "Make A Mark ESG Report",
      edition: "2024",
      publicationDate: null,
      location: "Printed p. 26 (PDF p. 25); footnote 14, printed p. 93",
    },
    reviewState: "reviewed",
  });
  expect(solarClaim.source.url).toBe("https://downloads.astonmartinf1.com/MakeAMark_ESG_Report_2024.pdf#page=25");
  expect(solarClaim.reviewNote.length).toBeGreaterThan(20);
  expect(solarClaim.limitations.length).toBeGreaterThan(0);
});

test("visitors can browse reviewed claims separately from illustrative samples", async ({ page }) => {
  await page.goto("/library");
  await expect(page.getByRole("heading", { name: "Evidence library" })).toBeVisible();
  await expect(page.getByText("779,682.30 kWh of renewable solar energy generated", { exact: false })).toBeVisible();
  await expect(page.getByText(/23 nationalities represented within Aston Martin Aramco Formula One/)).toBeVisible();
  await expect(page.getByText("Report result").first()).toBeVisible();

  await page.getByRole("button", { name: "Illustrative samples" }).click();
  await expect(page.getByText("Illustrative samples are examples, not reported claims.")).toBeVisible();
  await expect(page.getByText("Freight and logistics evidence")).toBeVisible();
  await expect(page.getByText("779,682.30 kWh of renewable solar energy generated", { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "Open record: Target and result are different claim types" }).click();
  await expect(page.getByRole("dialog")).toContainText("Target");
});

test("visitors can filter reviewed claims by reporting period", async ({ page }) => {
  await page.goto("/library");

  const periodFilter = page.getByRole("combobox", { name: "Filter by reporting period" });
  await expect(periodFilter).toBeVisible();
  await expect(periodFilter.locator("option")).toHaveText([
    "All periods",
    "2024",
    "2023 DE&I Survey",
  ]);

  await periodFilter.selectOption("2023 DE&I Survey");
  await expect(page.getByRole("heading", { name: "Nationalities represented" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Renewable solar generation" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Students reached at Make A Mark Day" })).toHaveCount(0);

  await periodFilter.selectOption("all");
  await expect(page.getByRole("heading", { name: "Renewable solar generation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Students reached at Make A Mark Day" })).toBeVisible();
});

test("evidence search matches keywords and explains when records do not support a query", async ({ page }) => {
  await page.goto("/library");
  const search = page.getByRole("textbox", { name: "Search evidence library" });

  await search.fill("solar generation 2024");
  await expect(page.getByRole("heading", { name: "Renewable solar generation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nationalities represented" })).toHaveCount(0);

  await search.fill("avoided carbon emissions in 2040");
  await expect(page.getByRole("heading", { name: "Not enough evidence" })).toBeVisible();
  await expect(page.getByText(/no source-reviewed record supports this search/i)).toBeVisible();
});

test("the About page reflects the reviewed library and Engineer boundary", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByText(/limited set of source-reviewed claims/i)).toBeVisible();
  await expect(page.getByText(/retrieves reviewed records and only the mission or simulated telemetry context you choose to include/i)).toBeVisible();
  await expect(page.getByText("This prototype uses illustrative content only.")).toHaveCount(0);
});

test("the Home page points to the available source-reviewed library", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Source-reviewed claims are available to browse.")).toBeVisible();
  await expect(page.getByText("Reviewed evidence will appear here.")).toHaveCount(0);
});

test("reviewed evidence details show source, period, review note, and limitations", async ({ page }) => {
  await page.goto("/library");
  await page.getByRole("button", { name: "Open record: Renewable solar generation" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Source-reviewed for this prototype");
  await expect(dialog.locator(".record-fields > div").filter({ hasText: "REPORTED VALUE" })).toContainText("779,682.30 kWh");
  await expect(dialog).toContainText("2024");
  await expect(dialog).toContainText("The report attributes the data to its solar panel provider.");
  await expect(dialog.getByRole("link", { name: "Open source report" })).toHaveAttribute(
    "href",
    "https://downloads.astonmartinf1.com/MakeAMark_ESG_Report_2024.pdf#page=25",
  );
});
