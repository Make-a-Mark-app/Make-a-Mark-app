import { expect, test } from "@playwright/test";
import { createServer } from "node:http";
import { createApp } from "../server/app";

test("the Engineer answers a supported evidence question with server-resolved citations", async ({ request }) => {
  const response = await request.post("/api/engineer", {
    data: { question: "  What is the travel and logistics emissions reduction?  ", detailLevel: "concise" },
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
  const conciseResponse = await request.post("/api/engineer", { data: { question: "What is the travel and logistics emissions reduction?" } });
  const detailedResponse = await request.post("/api/engineer", { data: { question: "What is the travel and logistics emissions reduction?", detailLevel: "detailed" } });
  const telemetryResponse = await request.post("/api/engineer", {
    data: { question: "What signals does this simulated snapshot include?", context: { telemetry: { stepId: "step-04" } } },
  });

  const concise = await conciseResponse.json();
  const detailed = await detailedResponse.json();
  const telemetry = await telemetryResponse.json();
  expect(concise.answer).not.toContain("Printed p. 9");
  expect(detailed.answer).toContain("Printed p. 9 (PDF p. 8)");
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
    const response = await request.post("/api/engineer", { data: { question } });
    const result = await response.json();
    expect(result.mode).toBe("prepared_fallback");
    expect(result.relatedRecordIds).toContain(recordId);
  }
});

test("the Engineer declines a factual question unsupported by reviewed records or selected context", async ({ request }) => {
  for (const question of ["What is the team’s total lifetime carbon footprint?", "Does solar generation improve race performance?"]) {
    const response = await request.post("/api/engineer", { data: { question } });
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

test("selected Mission and telemetry context resolves to canonical server values", async () => {
  const providerInputs: Array<Record<string, unknown>> = [];
  const app = createApp({
    provider: async (input) => {
      providerInputs.push(input as unknown as Record<string, unknown>);
      return input.missionSummary
        ? { answer: "Air: The route prioritizes a tight delivery window.", recordIds: [] }
        : { answer: "The simulated snapshot is unavailable; speed, gear, throttle, and brake are unavailable.", recordIds: [] };
    },
  });
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("The test API did not bind a TCP port.");

  try {
    const missionResponse = await fetch("http://127.0.0.1:" + address.port + "/api/engineer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What happens in this freight mission?", context: { mission: { missionId: "freight", configId: "freight-r1-v1", choiceId: "air" } } }),
    });
    const telemetryResponse = await fetch("http://127.0.0.1:" + address.port + "/api/engineer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What signals are in this simulated snapshot?", context: { telemetry: { stepId: "step-04" } } }),
    });
    const unrelatedResponse = await fetch("http://127.0.0.1:" + address.port + "/api/engineer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What is the weather in Singapore?", context: { telemetry: { stepId: "step-04" } } }),
    });
    const unsupportedMissionResponse = await fetch("http://127.0.0.1:" + address.port + "/api/engineer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "Does the mission make money?", context: { mission: { missionId: "freight", configId: "freight-r1-v1", choiceId: "air" } } }),
    });
    const unsupportedTelemetryResponse = await fetch("http://127.0.0.1:" + address.port + "/api/engineer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "How should I improve battery life?", context: { telemetry: { stepId: "step-04" } } }),
    });
    expect((await missionResponse.json()).mode).toBe("grounded_ai");
    expect((await telemetryResponse.json()).mode).toBe("grounded_ai");
    expect(providerInputs[0].missionSummary).toMatchObject({ selectedRoute: "Air" });
    expect(providerInputs[0]).not.toHaveProperty("telemetrySnapshot");
    expect(providerInputs[1].telemetrySnapshot).toMatchObject({
      stepId: "step-04", status: "unavailable", signals: expect.arrayContaining([
        { id: "speed", name: "Speed", value: null, unit: "km/h", valueType: "number", interpretation: "Shows the simulated car speed." },
      ]),
    });
    expect(providerInputs[1]).not.toHaveProperty("missionSummary");
    expect((await unrelatedResponse.json()).mode).toBe("no_answer");
    expect((await unsupportedMissionResponse.json()).mode).toBe("no_answer");
    expect((await unsupportedTelemetryResponse.json()).mode).toBe("no_answer");
    expect(providerInputs).toHaveLength(2);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("the Engineer rejects invalid questions and untrusted context selections", async ({ request }) => {
  const invalidInputs = [
    { question: "   " },
    { question: "x".repeat(501) },
    { question: "What does the report say?", detailLevel: "verbose" },
    { question: "What does the report say?", context: { telemetry: { stepId: "step-01", value: 999 } } },
    { question: "What does the report say?", context: { mission: { missionId: "other", configId: "freight-r1-v1", choiceId: "air" } } },
  ];

  for (const data of invalidInputs) {
    const response = await request.post("/api/engineer", { data });
    expect(response.status()).toBe(400);
  }
});

test("a configured provider receives bounded reviewed records and returned citations resolve from them", async () => {
  let providerInput: unknown;
  const app = createApp({
    provider: async (input) => {
      providerInput = input;
      return {
        answer: "The report reports a 14% reduction in travel and logistics emissions.",
        recordIds: ["env-2025-travel-logistics-reduction", "invented-record"],
      };
    },
  });
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("The test API did not bind a TCP port.");

  try {
    const response = await fetch("http://127.0.0.1:" + address.port + "/api/engineer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What is the travel and logistics emissions reduction?", detailLevel: "detailed" }),
    });
    expect(response.ok).toBeTruthy();
    const result = await response.json();
    expect(result).toMatchObject({ mode: "grounded_ai", answer: "The report reports a 14% reduction in travel and logistics emissions." });
    expect(result.relatedRecordIds).toEqual(["env-2025-travel-logistics-reduction"]);
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]).toMatchObject({
      recordId: "env-2025-travel-logistics-reduction",
      sourceUrl: "https://downloads.astonmartinf1.com/MakeAMark_ESG_Report_2025.pdf#page=8",
    });
    expect(providerInput).toMatchObject({
      question: "What is the travel and logistics emissions reduction?",
      detailLevel: "detailed",
      records: [{ id: "env-2025-travel-logistics-reduction" }],
    });
    expect(providerInput).not.toHaveProperty("telemetrySnapshot");
    expect(providerInput).not.toHaveProperty("missionSummary");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("provider failure returns a prepared answer from the retrieved record", async () => {
  const app = createApp({ provider: async () => { throw new Error("provider timeout"); } });
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("The test API did not bind a TCP port.");

  try {
    const response = await fetch("http://127.0.0.1:" + address.port + "/api/engineer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What is the travel and logistics emissions reduction?" }),
    });
    const result = await response.json();
    expect(result.mode).toBe("prepared_fallback");
    expect(result.relatedRecordIds).toEqual(["env-2025-travel-logistics-reduction"]);
    expect(result.limitations).toContain("The optional explanation provider is unavailable; this prepared response uses only the selected context and reviewed records.");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("the API rejects provider claims outside the retrieved record and uses the prepared answer", async () => {
  const app = createApp({
    provider: async () => ({ answer: "Travel and logistics emissions improved race performance by 25%.", recordIds: ["env-2025-travel-logistics-reduction"] }),
  });
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("The test API did not bind a TCP port.");

  try {
    const response = await fetch("http://127.0.0.1:" + address.port + "/api/engineer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What is the travel and logistics emissions reduction?" }),
    });
    const result = await response.json();
    expect(result.mode).toBe("prepared_fallback");
    expect(result.answer).toContain("14% reduction in travel and logistics emissions");
    expect(result.answer).not.toContain("25%");
    expect(result.limitations).toContain("The provider response could not be grounded in the selected records and context, so it was not used.");
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
  await page.getByLabel(/Include simulated snapshot/).check();
  await page.getByRole("button", { name: "Send question" }).click();

  await expect(page.getByText("AMF1 reports a 14% reduction in travel and logistics emissions through", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Travel and logistics emissions reduction/ })).toHaveAttribute(
    "href",
    "https://downloads.astonmartinf1.com/MakeAMark_ESG_Report_2025.pdf#page=8",
  );
  expect(submittedBodies).toHaveLength(1);
  expect(submittedBodies[0]).toMatchObject({
    question: "What is the travel and logistics emissions reduction?",
    detailLevel: "detailed",
    context: { telemetry: { stepId: "step-01" } },
  });
  expect((submittedBodies[0].context as Record<string, unknown>)).not.toHaveProperty("mission");
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.includes("engineer")))).toEqual([]);
});
