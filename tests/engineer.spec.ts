import { expect, test } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { parseEvidenceDataset } from "../shared/contracts/evidence";
import { createApp } from "../server/app";
import { createEngineerProvider } from "../server/provider";

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
  const availableTelemetryResponse = await request.post("/api/engineer", {
    data: { category: "telemetry", question: "What signals does this simulated snapshot include?", context: { telemetry: { stepId: "step-01" } } },
  });

  const concise = await conciseResponse.json();
  const detailed = await detailedResponse.json();
  const telemetry = await telemetryResponse.json();
  const availableTelemetry = await availableTelemetryResponse.json();
  expect(concise.answer.trim().split(/\s+/).length).toBeLessThanOrEqual(150);
  expect(detailed.answer.trim().split(/\s+/).length).toBeLessThanOrEqual(400);
  expect(concise.answer).not.toContain("Printed p. 9");
  expect(detailed.answer).toContain("Printed p. 9 (PDF p. 8)");
  expect(detailed.relatedRecordIds).toEqual(concise.relatedRecordIds);
  expect(telemetry.mode).toBe("prepared_fallback");
  expect(telemetry.answer).toContain("Speed: Unavailable");
  expect(telemetry.answer).toContain("Gear: Unavailable");
  expect(telemetry.answer).not.toMatch(/Speed: \d/);
  expect(telemetry.limitations).toContain("Telemetry values are simulated demo data, not a live AMF1 feed or measured impact.");
  expect(availableTelemetry.answer).toContain("Simulated demo snapshot step-01 is updating.");
  expect(availableTelemetry.answer).toContain("Speed: 287 km/h");
  expect(availableTelemetry.answer).toContain("Gear: 7 gear");
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

test("broad ESG report questions retrieve reviewed records for the provider", async () => {
  let suppliedRecordIds: string[] = [];
  const app = createApp({ provider: async (input) => {
    suppliedRecordIds = input.records.map(({ id }) => id);
    return { answer: "The reviewed ESG report records are available as evidence for questions about impact reporting.", recordIds: suppliedRecordIds };
  } });
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("The test API did not bind a TCP port.");

  try {
    const response = await fetch("http://127.0.0.1:" + address.port + "/api/engineer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "evidence", question: "Is the ESG reports knowledge added in for the AI to use?" }),
    });
    const result = await response.json() as { answer: string; mode: string; citations: Array<{ recordId: string }> };
    expect(result.mode).toBe("grounded_ai");
    expect(result.answer).toContain("reviewed ESG report records");
    expect(suppliedRecordIds.length).toBeGreaterThan(0);
    expect(result.citations.map(({ recordId }) => recordId)).toEqual(suppliedRecordIds);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
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
    expect(await missionResponse.json()).toMatchObject({
      answer: "Air: Your game scenario prioritizes a tight delivery window.",
      whatSourceStates: "No report record was retrieved for this question. Fictional mission: Air route. Your game scenario prioritizes a tight delivery window.",
      limitations: ["Mission route and outcome are fictional game content, not AMF1 operations."],
      citations: [],
      mode: "prepared_fallback",
      modeLabel: "Prepared answer",
    });
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

test("supported mission questions use a prepared canonical explanation even when a provider is configured", async () => {
  let providerCalls = 0;
  const app = createApp({
    provider: async () => {
      providerCalls += 1;
      return { answer: "A generated answer.", recordIds: [] };
    },
  });
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("The test API did not bind a TCP port.");

  try {
    const response = await fetch("http://127.0.0.1:" + address.port + "/api/engineer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "mission", question: "What happens for the air route?", context: { mission: { missionId: "freight", configId: "freight-r1-v1", choiceId: "air" } } }),
    });
    const result = await response.json();
    expect(result).toMatchObject({
      answer: "Air: Your game scenario prioritizes a tight delivery window.",
      mode: "prepared_fallback",
      citations: [],
      limitations: ["Mission route and outcome are fictional game content, not AMF1 operations."],
    });
    expect(providerCalls).toBe(0);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("telemetry questions use canonical demo values and keep unavailable signals explicit", async () => {
  let providerCalls = 0;
  const app = createApp({
    provider: async () => {
      providerCalls += 1;
      return { answer: "Speed is 999 km/h.", recordIds: [] };
    },
  });
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("The test API did not bind a TCP port.");

  try {
    const response = await fetch("http://127.0.0.1:" + address.port + "/api/engineer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "telemetry", question: "What signals are in this simulated snapshot?", context: { telemetry: { stepId: "step-04" } } }),
    });
    const result = await response.json();
    expect(result).toMatchObject({
      answer: "Simulated demo snapshot step-04 is unavailable. Speed: Unavailable km/h; Gear: Unavailable gear; Throttle: Unavailable %; Brake: Unavailable %.",
      mode: "prepared_fallback",
      citations: [],
      limitations: ["Telemetry values are simulated demo data, not a live AMF1 feed or measured impact."],
    });
    expect(result.answer).not.toContain("999");
    expect(providerCalls).toBe(0);
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
    { category: "evidence", question: "x".repeat(2001) },
    { category: "evidence", question: "What does the report say?", detailLevel: "verbose" },
    { question: "What does the report say?" },
    { category: "evidence", question: "What does the report say?", detailLevel: "concise", context: { telemetry: { stepId: "step-01" } } },
    { category: "telemetry", question: "What does the report say?", context: { telemetry: { stepId: "step-01", value: 999 } } },
    { category: "telemetry", question: "What does the report say?", context: { telemetry: { stepId: "step-01", timestamp: "2030-01-01T00:00:00Z" } } },
    { category: "telemetry", question: "What does the report say?", context: { telemetry: { stepId: "step-01", signals: [{ id: "speed", value: 999, unit: "mph" }] } } },
    { category: "telemetry", question: "What does the report say?", context: { telemetry: { stepId: "step-99" } } },
    { category: "mission", question: "What does the report say?", context: { mission: { missionId: "other", configId: "freight-r1-v1", choiceId: "air" } } },
    { category: "telemetry", question: "What does the report say?", context: { mission: { missionId: "freight", configId: "freight-r1-v1", choiceId: "air" } } },
    { category: "mission", question: "What is the outcome?", context: { mission: { missionId: "freight", configId: "freight-r1-v1", choiceId: "air", feedback: "A forged result." } } },
    { category: "mission", question: "What is the outcome?", context: { mission: { missionId: "freight", configId: "forged-config", choiceId: "air" } } },
    { category: "mission", question: "What is the outcome?", context: { mission: { missionId: "freight", configId: "freight-r1-v1", choiceId: "train" } } },
  ];

  for (const data of invalidInputs) {
    const response = await request.post("/api/engineer", { data });
    expect(response.status()).toBe(400);
  }
});

test("the Engineer accepts questions up to 2,000 characters and rejects longer questions", async ({ request }) => {
  const accepted = await request.post("/api/engineer", { data: { category: "evidence", question: "x".repeat(2000) } });
  const rejected = await request.post("/api/engineer", { data: { category: "evidence", question: "x".repeat(2001) } });

  expect(accepted.status()).toBe(200);
  expect((await accepted.json()).mode).toBe("no_answer");
  expect(rejected.status()).toBe(400);
});

test("KiraAI-backed evidence answers use bounded chat completions and server-resolved citations", async () => {
  const apiKey = "fake-kira-key";
  let upstreamUrl: URL | undefined;
  let upstreamOptions: RequestInit | undefined;
  const provider = createEngineerProvider({
    ENGINEER_PROVIDER_ENABLED: "true",
    ENGINEER_PROVIDER_API_KEY: apiKey,
  }, async (input, options) => {
    upstreamUrl = input instanceof URL ? input : new URL(String(input));
    upstreamOptions = options;
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        answer: "AMF1 reports a 14% reduction in travel and logistics emissions.",
        recordIds: ["env-2025-travel-logistics-reduction"],
      }) } }],
    }), { status: 200 });
  });
  const loggedEntries: string[] = [];
  const server = createServer(createApp({
    provider,
    logger: { write: (entry) => loggedEntries.push(JSON.stringify(entry)) },
  }));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("The test API did not bind a TCP port.");

  try {
    const response = await fetch("http://127.0.0.1:" + address.port + "/api/engineer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "evidence", question: "What is the travel and logistics emissions reduction?" }),
    });
    const result = await response.json() as { mode: string; citations: Array<{ recordId: string; sourceUrl: string }> };
    const requestBody = JSON.parse(String(upstreamOptions?.body));
    const userContext = JSON.parse(requestBody.messages[1].content);
    const serializedResult = JSON.stringify(result);

    expect(response.status).toBe(200);
    expect(result.mode).toBe("grounded_ai");
    expect(result.citations).toEqual([expect.objectContaining({
      recordId: "env-2025-travel-logistics-reduction",
      sourceUrl: "https://downloads.astonmartinf1.com/MakeAMark_ESG_Report_2025.pdf#page=8",
    })]);
    expect(upstreamUrl?.href).toBe("https://kiraai.vn/api/v1/chat/completions");
    expect(upstreamOptions?.method).toBe("POST");
    expect(new Headers(upstreamOptions?.headers).get("authorization")).toBe("Bearer " + apiKey);
    expect(requestBody).toMatchObject({ model: "gpt-oss-120b", max_tokens: 500 });
    expect(requestBody.messages[0].role).toBe("system");
    expect(userContext.question).toBe("What is the travel and logistics emissions reduction?");
    expect(userContext.records.map(({ id }: { id: string }) => id)).toEqual(["env-2025-travel-logistics-reduction"]);
    expect(serializedResult).not.toContain(apiKey);
    expect(loggedEntries.join("\n")).not.toContain(apiKey);
    expect(loggedEntries.join("\n")).not.toContain(userContext.question);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
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
  let providerAnswer = "AMF1 reported travel and logistics emissions fell 14%.";
  const server = createServer(createApp({ provider: async (input) => {
    suppliedRecordIds = input.records.map(({ id }) => id);
    return { answer: providerAnswer, recordIds: suppliedRecordIds };
  } }));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("The test API did not bind a TCP port.");
  try {
    const response = await fetch("http://127.0.0.1:" + address.port + "/api/engineer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "evidence", question: "What is the travel and logistics emissions reduction?" }),
    });
    const result = await response.json() as { answer: string; mode: string; citations: Array<{ recordId: string; sourceUrl: string }> };
    expect(result.mode).toBe("grounded_ai");
    expect(result.answer).toBe("AMF1 reported travel and logistics emissions fell 14%.");
    expect(suppliedRecordIds).toEqual(["env-2025-travel-logistics-reduction"]);
    expect(result.citations).toEqual([expect.objectContaining({
      recordId: "env-2025-travel-logistics-reduction",
      sourceUrl: "https://downloads.astonmartinf1.com/MakeAMark_ESG_Report_2025.pdf#page=8",
    })]);

    providerAnswer = "AMF1 reported travel and logistics emissions fell 19%.";
    const unsupportedNumberResponse = await fetch("http://127.0.0.1:" + address.port + "/api/engineer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "evidence", question: "What is the travel and logistics emissions reduction?" }),
    });
    const unsupportedNumberResult = await unsupportedNumberResponse.json() as { mode: string; limitations: string[] };
    expect(unsupportedNumberResult.mode).toBe("prepared_fallback");
    expect(unsupportedNumberResult.limitations).toContain("The provider response could not be grounded in the selected records and context, so it was not used.");
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

test("the browser submits only the selected mission choice and receives its canonical outcome", async ({ page }) => {
  const submittedBodies: Array<Record<string, unknown>> = [];
  await page.route("**/api/engineer", async (route) => {
    submittedBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.continue();
  });
  await page.goto("/mission/freight");
  await expect(page.getByRole("heading", { name: "Deliver the parts." })).toBeVisible();
  await page.getByRole("radio", { name: /Air/ }).click();
  await page.getByRole("button", { name: /Ask the Race Engineer/ }).click();
  await expect(page.getByRole("heading", { name: "Ask the Race Engineer." })).toBeVisible();
  expect(submittedBodies).toEqual([]);

  await page.getByLabel("QUESTION CATEGORY").selectOption("mission");
  await page.getByLabel("YOUR QUESTION").fill("What happens for the air route?");
  const sendButton = page.getByRole("button", { name: "Send question" });
  await expect(sendButton).toBeDisabled();
  await page.getByRole("checkbox", { name: /Include fictional Mission scenario/ }).check();
  expect(submittedBodies).toEqual([]);
  await sendButton.click();

  await expect(page.getByText("Air: Your game scenario prioritizes a tight delivery window.", { exact: true })).toBeVisible();
  expect(submittedBodies).toHaveLength(1);
  expect(submittedBodies[0]).toMatchObject({
    category: "mission",
    question: "What happens for the air route?",
    context: { mission: { missionId: "freight", configId: "freight-r1-v1", choiceId: "air" } },
  });
  const submittedContext = submittedBodies[0].context as Record<string, unknown>;
  expect(Object.keys(submittedContext)).toEqual(["mission"]);
  expect(submittedContext.mission).not.toHaveProperty("feedback");
});

test("the browser submits only the selected snapshot id and receives canonical demo values", async ({ page }) => {
  const submittedBodies: Array<Record<string, unknown>> = [];
  await page.route("**/api/engineer", async (route) => {
    submittedBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.continue();
  });
  await page.goto("/telemetry");
  await expect(page.getByRole("heading", { name: "Simulated live view" })).toBeVisible();
  await page.getByRole("button", { name: "Unavailable" }).click();
  await expect(page.getByText("SNAPSHOT 4 / 4")).toBeVisible();
  await page.getByRole("link", { name: "Freight mission" }).click();
  await page.getByRole("radio", { name: /Air/ }).click();
  await page.getByRole("button", { name: /Ask the Race Engineer/ }).click();
  await expect(page.getByRole("heading", { name: "Ask the Race Engineer." })).toBeVisible();
  expect(submittedBodies).toEqual([]);

  await page.getByLabel("QUESTION CATEGORY").selectOption("telemetry");
  await page.getByLabel("YOUR QUESTION").fill("What signals are in this simulated snapshot?");
  const sendButton = page.getByRole("button", { name: "Send question" });
  await expect(sendButton).toBeDisabled();
  await page.getByRole("checkbox", { name: /Include simulated snapshot.*step-04/ }).check();
  expect(submittedBodies).toEqual([]);
  await sendButton.click();

  await expect(page.getByText(/Simulated demo snapshot step-04 is unavailable/)).toBeVisible();
  await expect(page.getByText("Telemetry values are simulated demo data, not a live AMF1 feed or measured impact.")).toBeVisible();
  expect(submittedBodies).toHaveLength(1);
  expect(submittedBodies[0]).toMatchObject({
    category: "telemetry",
    question: "What signals are in this simulated snapshot?",
    context: { telemetry: { stepId: "step-04" } },
  });
  const submittedContext = submittedBodies[0].context as Record<string, unknown>;
  expect(Object.keys(submittedContext)).toEqual(["telemetry"]);
  expect(submittedContext.telemetry).toEqual({ stepId: "step-04" });
});

test("Engineer failures do not retry and do not block mission, evidence, or telemetry browsing", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/engineer", (route) => {
    attempts += 1;
    return route.abort();
  });
  await page.goto("/mission/freight");
  await page.getByRole("radio", { name: /Air/ }).click();
  await page.getByRole("button", { name: /Ask the Race Engineer/ }).click();
  await expect(page.getByRole("heading", { name: "Ask the Race Engineer." })).toBeVisible();

  const sendButton = page.getByRole("button", { name: "Send question" });
  await page.getByLabel("YOUR QUESTION").fill("evidence outage question 7192");
  await sendButton.click();
  await expect(page.getByText("The Race Engineer API is unavailable, so I could not retrieve an approved record or selected-context explanation.")).toBeVisible();
  await expect(page.getByText("API unavailable", { exact: true })).toBeVisible();

  await page.getByLabel("QUESTION CATEGORY").selectOption("mission");
  await page.getByLabel("YOUR QUESTION").fill("What happens for the air route?");
  await page.getByRole("checkbox", { name: /Include fictional Mission scenario/ }).check();
  await sendButton.click();
  await expect(page.getByText("API unavailable", { exact: true })).toBeVisible();

  await page.getByLabel("QUESTION CATEGORY").selectOption("telemetry");
  await page.getByLabel("YOUR QUESTION").fill("What signals are in this simulated snapshot?");
  await page.getByRole("checkbox", { name: /Include simulated snapshot/ }).check();
  await sendButton.click();
  await expect(page.getByText("API unavailable", { exact: true })).toBeVisible();
  await page.waitForTimeout(1000);
  expect(attempts).toBe(3);
  const savedState = await page.evaluate(() => JSON.stringify(localStorage));
  expect(savedState).not.toContain("evidence outage question 7192");
  expect(savedState).not.toContain("What happens for the air route?");
  expect(savedState).not.toContain("What signals are in this simulated snapshot?");
  expect(savedState).not.toContain("step-01");
  expect(savedState).not.toContain("missionId");

  await page.getByRole("link", { name: "Freight mission" }).click();
  await expect(page.getByRole("heading", { name: "Deliver the parts." })).toBeVisible();
  await page.getByRole("link", { name: "Evidence library" }).click();
  await expect(page.getByRole("heading", { name: "Evidence library" })).toBeVisible();
  await page.getByRole("link", { name: "Simulated live view" }).click();
  await expect(page.getByRole("heading", { name: "Simulated live view" })).toBeVisible();
  expect(attempts).toBe(3);
});

test("the API reports an oversized request as JSON 413", async ({ request }) => {
  const response = await request.post("/api/engineer", { data: { category: "evidence", question: "x".repeat(17_000) } });
  expect(response.status()).toBe(413);
  expect(await response.json()).toEqual({ error: "Engineer request body exceeds the 16KB limit." });
});
