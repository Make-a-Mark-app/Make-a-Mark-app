import { expect, test } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { parseEvidenceDataset } from "../shared/contracts/evidence";
import { createApp } from "../server/app";

test("the Engineer answers a supported evidence question with server-resolved citations", async ({ request }) => {
  const response = await request.post("/api/engineer", {
    data: { category: "evidence", question: "  What is the travel and logistics emissions reduction?  ", detailLevel: "concise" },
  });

  expect(response.ok()).toBeTruthy();
  expect(await response.json()).toMatchObject({
    mode: "prepared_fallback",
    relatedRecordIds: ["env-2025-travel-logistics-reduction"],
    citations: [{
      recordId: "env-2025-travel-logistics-reduction",
      title: "Travel and logistics emissions reduction",
      sourceTitle: "2025 Make A Mark Report",
      sourceUrl: "https://downloads.astonmartinf1.com/MakeAMark_ESG_Report_2025.pdf#page=8",
      reportingPeriod: "2025 results (exact measurement dates and comparison baseline not stated)",
      sourceLocation: "Printed p. 9 (PDF p. 8), 2025 impact highlights; see also printed p. 24, footnote 14",
    }],
  });
});

test("detail preference expands a prepared source explanation and unavailable telemetry stays null", async ({ request }) => {
  const conciseResponse = await request.post("/api/engineer", { data: { category: "evidence", question: "What is the travel and logistics emissions reduction?" } });
  const detailedResponse = await request.post("/api/engineer", { data: { category: "evidence", question: "What is the travel and logistics emissions reduction?", detailLevel: "detailed" } });
  const telemetryResponse = await request.post("/api/engineer", {
    data: { category: "telemetry", question: "What signals does this simulated snapshot include?", context: { telemetry: { stepId: "step-04" } } },
  });

  const concise = await conciseResponse.json();
  const detailed = await detailedResponse.json();
  const telemetry = await telemetryResponse.json();
  expect(concise.answer.trim().split(/\s+/).length).toBeLessThanOrEqual(150);
  expect(detailed.answer.trim().split(/\s+/).length).toBeLessThanOrEqual(400);
  expect(concise.answer).not.toContain("Printed p. 9");
  expect(detailed.answer).toContain("Printed p. 9 (PDF p. 8)");
  expect(detailed.relatedRecordIds).toEqual(concise.relatedRecordIds);
  expect(telemetry.mode).toBe("prepared_fallback");
  expect(telemetry.answer).toContain("Speed: Unavailable");
  expect(telemetry.answer).toContain("Gear: Unavailable");
  expect(telemetry.answer).not.toMatch(/Speed: \d/);
  expect(telemetry.limitations).toContain("Telemetry values are simulated fixture data, not a live AMF1 feed.");
});

test("keyword retrieval supports the reviewed Belong and Community claims", async ({ request }) => {
  const questions = [
    ["What did the Aleto cohort feel about their professional network?", "bel-2025-aleto-network"],
    ["How many students were engaged?", "com-2025-make-a-mark-week-students"],
  ];
  for (const [question, recordId] of questions) {
    const response = await request.post("/api/engineer", { data: { category: "evidence", question } });
    const result = await response.json();
    expect(result.mode).toBe("prepared_fallback");
    expect(result.relatedRecordIds).toContain(recordId);
  }
});

test("the Engineer declines a factual question unsupported by reviewed records or selected context", async ({ request }) => {
  for (const question of ["What is the team’s total lifetime carbon footprint?", "Does solar generation improve race performance?"]) {
    const response = await request.post("/api/engineer", { data: { category: "evidence", question } });
    expect(response.ok()).toBeTruthy();
    expect(await response.json()).toMatchObject({
      answer: "Not enough evidence in the reviewed records or selected context to support an answer.",
      mode: "no_answer",
      citations: [],
      relatedRecordIds: [],
      limitations: ["This prototype does not answer from general model knowledge."],
    });
  }
});

test("selected Mission and telemetry context resolves to canonical server values without a provider", async () => {
  const app = createApp();
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("The test API did not bind a TCP port.");

  try {
    const missionResponse = await fetch("http://127.0.0.1:" + address.port + "/api/engineer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "mission", question: "What happens in this freight mission?", context: { mission: { missionId: "freight", configId: "freight-r1-v1", choiceId: "air" } } }),
    });
    const telemetryResponse = await fetch("http://127.0.0.1:" + address.port + "/api/engineer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "telemetry", question: "What signals are in this simulated snapshot?", context: { telemetry: { stepId: "step-04" } } }),
    });
    const mismatchedMissionResponse = await fetch("http://127.0.0.1:" + address.port + "/api/engineer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "mission", question: "What is the travel and logistics emissions reduction?", context: { mission: { missionId: "freight", configId: "freight-r1-v1", choiceId: "air" } } }),
    });
    const unrelatedResponse = await fetch("http://127.0.0.1:" + address.port + "/api/engineer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "telemetry", question: "What is the weather in Singapore?", context: { telemetry: { stepId: "step-04" } } }),
    });
    const unsupportedMissionResponse = await fetch("http://127.0.0.1:" + address.port + "/api/engineer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "mission", question: "Does the mission make money?", context: { mission: { missionId: "freight", configId: "freight-r1-v1", choiceId: "air" } } }),
    });
    const unsupportedTelemetryResponse = await fetch("http://127.0.0.1:" + address.port + "/api/engineer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "telemetry", question: "How should I improve battery life?", context: { telemetry: { stepId: "step-04" } } }),
    });
    expect(await missionResponse.json()).toMatchObject({ mode: "prepared_fallback", modeLabel: "Prepared answer" });
    expect(await telemetryResponse.json()).toMatchObject({ mode: "prepared_fallback", modeLabel: "Prepared answer" });
    expect(await mismatchedMissionResponse.json()).toMatchObject({
      mode: "no_answer",
      whatItMeans: "This question is not supported by the selected category or context. Choose a matching question category and try again.",
    });
    expect((await unrelatedResponse.json()).mode).toBe("no_answer");
    expect((await unsupportedMissionResponse.json()).mode).toBe("no_answer");
    expect((await unsupportedTelemetryResponse.json()).mode).toBe("no_answer");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("conflicting retrieved records produce no answer", async () => {
  const dataset = parseEvidenceDataset(JSON.parse(readFileSync(new URL("../shared/data/evidence.r1.v2.json", import.meta.url), "utf8")));
  const original = dataset?.records.find(({ id }) => id === "env-2025-travel-logistics-reduction");
  if (!original) throw new Error("Expected reviewed evidence fixture is missing.");
  const conflicting = {
    ...original,
    id: "env-2025-travel-logistics-reduction-conflict",
    value: 15,
    valueDisplay: "15",
    claim: "AMF1 reports a 15% reduction in travel and logistics emissions.",
  };
  const cases = [
    conflicting,
    { ...original, id: "env-2025-travel-logistics-reduction-no-value", value: undefined, valueDisplay: undefined, unit: undefined, claim: "AMF1 reports no reduction in travel and logistics emissions." },
    { ...original, id: "env-2025-travel-logistics-reduction-other-unit", unit: "percentage points", claim: "AMF1 reports a 14% reduction in travel and logistics emissions." },
  ];
  for (const conflictingRecord of cases) {
    const server = createServer(createApp({ engineerRecords: [original, conflictingRecord] }));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("The test API did not bind a TCP port.");
    try {
      const response = await fetch("http://127.0.0.1:" + address.port + "/api/engineer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "evidence", question: "What is the travel and logistics emissions reduction?" }),
      });
      expect(await response.json()).toMatchObject({
        mode: "no_answer",
        citations: [],
        limitations: ["This prototype does not answer from general model knowledge.", "Conflicting reviewed records were not used to produce an answer."],
      });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  }
});

test("the Engineer rejects invalid questions and untrusted context selections", async ({ request }) => {
  const invalidInputs = [
    { category: "evidence", question: "   " },
    { category: "evidence", question: "x".repeat(501) },
    { category: "evidence", question: "What does the report say?", detailLevel: "verbose" },
    { question: "What does the report say?" },
    { category: "evidence", question: "What does the report say?", detailLevel: "concise", context: { telemetry: { stepId: "step-01" } } },
    { category: "telemetry", question: "What does the report say?", context: { telemetry: { stepId: "step-01", value: 999 } } },
    { category: "mission", question: "What does the report say?", context: { mission: { missionId: "other", configId: "freight-r1-v1", choiceId: "air" } } },
    { category: "telemetry", question: "What does the report say?", context: { mission: { missionId: "freight", configId: "freight-r1-v1", choiceId: "air" } } },
  ];

  for (const data of invalidInputs) {
    const response = await request.post("/api/engineer", { data });
    expect(response.status()).toBe(400);
  }
});

test("a configured provider endpoint is ignored by the initial release", async () => {
  const previousEndpoint = process.env.ENGINEER_PROVIDER_URL;
  process.env.ENGINEER_PROVIDER_URL = "https://127.0.0.1:1/engineer";
  const server = createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("The test API did not bind a TCP port.");
  try {
    const response = await fetch("http://127.0.0.1:" + address.port + "/api/engineer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "evidence", question: "What is the travel and logistics emissions reduction?" }),
    });
    const result = await response.json() as { mode: string; limitations: string[] };
    expect(result.mode).toBe("prepared_fallback");
    expect(result.limitations).not.toContain("The optional explanation provider is unavailable; this prepared response uses only the selected context and reviewed records.");
  } finally {
    if (previousEndpoint === undefined) delete process.env.ENGINEER_PROVIDER_URL;
    else process.env.ENGINEER_PROVIDER_URL = previousEndpoint;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("an injected provider sees only retrieved records and citations resolve from the server", async () => {
  let suppliedRecordIds: string[] = [];
  const server = createServer(createApp({ provider: async (input) => {
    suppliedRecordIds = input.records.map(({ id }) => id);
    return { answer: "The report reports a 14% reduction in travel and logistics emissions.", recordIds: suppliedRecordIds };
  } }));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("The test API did not bind a TCP port.");
  try {
    const response = await fetch("http://127.0.0.1:" + address.port + "/api/engineer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "evidence", question: "What is the travel and logistics emissions reduction?" }),
    });
    const result = await response.json() as { mode: string; citations: Array<{ recordId: string; sourceUrl: string }> };
    expect(result.mode).toBe("grounded_ai");
    expect(suppliedRecordIds).toEqual(["env-2025-travel-logistics-reduction"]);
    expect(result.citations).toEqual([expect.objectContaining({
      recordId: "env-2025-travel-logistics-reduction",
      sourceUrl: "https://downloads.astonmartinf1.com/MakeAMark_ESG_Report_2025.pdf#page=8",
    })]);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("an injected provider failure returns a prepared answer with a limitation", async () => {
  const server = createServer(createApp({ provider: async () => { throw new Error("provider timeout"); } }));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("The test API did not bind a TCP port.");
  try {
    const response = await fetch("http://127.0.0.1:" + address.port + "/api/engineer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "evidence", question: "What is the travel and logistics emissions reduction?" }),
    });
    const result = await response.json() as { mode: string; limitations: string[] };
    expect(result.mode).toBe("prepared_fallback");
    expect(result.limitations).toContain("The optional explanation provider is unavailable; this prepared response uses only the selected context and reviewed records.");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("the full app asks only on submit and sends only selected context", async ({ page }) => {
  const submittedBodies: Array<Record<string, unknown>> = [];
  await page.route("**/api/engineer", async (route) => {
    submittedBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.continue();
  });
  await page.goto("/engineer");
  expect(submittedBodies).toEqual([]);
  await expect(page.getByRole("heading", { name: "Ask the Race Engineer." })).toBeVisible();
  await page.getByLabel("YOUR QUESTION").fill("What is the travel and logistics emissions reduction?");
  await page.getByLabel("ANSWER DETAIL").selectOption("detailed");
  await page.getByRole("button", { name: "Send question" }).click();

  await expect(page.getByText("AMF1 reports a 14% reduction in travel and logistics emissions through", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Travel and logistics emissions reduction/ })).toHaveAttribute(
    "href",
    "https://downloads.astonmartinf1.com/MakeAMark_ESG_Report_2025.pdf#page=8",
  );
  expect(submittedBodies).toHaveLength(1);
  expect(submittedBodies[0]).toMatchObject({
    category: "evidence",
    question: "What is the travel and logistics emissions reduction?",
    detailLevel: "detailed",
  });
  expect(submittedBodies[0]).not.toHaveProperty("context");
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.includes("engineer")))).toEqual([]);
});

test("the full app explains when the Engineer API is unavailable", async ({ page }) => {
  await page.route("**/api/engineer", (route) => route.abort());
  await page.goto("/engineer");
  await page.getByLabel("YOUR QUESTION").fill("What is the travel and logistics emissions reduction?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.getByText("The Race Engineer API is unavailable, so I could not retrieve an approved record or selected-context explanation.")).toBeVisible();
  await expect(page.getByText("API unavailable", { exact: true })).toBeVisible();
});

test("the API reports an oversized request as JSON 413", async ({ request }) => {
  const response = await request.post("/api/engineer", { data: { category: "evidence", question: "x".repeat(17_000) } });
  expect(response.status()).toBe(413);
  expect(await response.json()).toEqual({ error: "Engineer request body exceeds the 16KB limit." });
});
