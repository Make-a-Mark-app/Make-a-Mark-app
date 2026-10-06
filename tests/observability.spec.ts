import { expect, test } from "@playwright/test";
import { createServer } from "node:http";
import { createApp } from "../server/app";

const apiBaseURL = "http://127.0.0.1:" + (process.env.PORT ?? "4178");

test("API metrics use low-cardinality labels and do not contain question text or demo values", async ({ request }) => {
  test.skip(Boolean(process.env.PLAYWRIGHT_EXTERNAL), "The metrics endpoint stays private to the Compose network.");
  const privateQuestion = "Is this private prompt text 918273 supported?";
  const response = await request.post("/api/engineer", {
    data: { category: "telemetry", question: privateQuestion, context: { telemetry: { stepId: "step-04" } } },
  });
  expect(response.ok()).toBeTruthy();

  const metricsResponse = await fetch(apiBaseURL + "/metrics");
  expect(metricsResponse.ok).toBeTruthy();
  const metrics = await metricsResponse.text();
  expect(metrics).toContain('impact_drive_http_requests_total{method="POST",route="/api/engineer",status_class="2xx"}');
  expect(metrics).toContain('impact_drive_engineer_responses_total{mode="no_answer"}');
  expect(metrics).not.toContain(privateQuestion);
  expect(metrics).not.toContain("918273");
  expect(metrics).not.toContain("battery temperature");
});

test("API metrics count rejected request shapes without recording their contents", async ({ request }) => {
  test.skip(Boolean(process.env.PLAYWRIGHT_EXTERNAL), "The metrics endpoint stays private to the Compose network.");
  const response = await request.post("/api/engineer", { data: { question: "invalid-secret-000".repeat(30) } });
  expect(response.status()).toBe(400);

  const metricsResponse = await fetch(apiBaseURL + "/metrics");
  const metrics = await metricsResponse.text();
  expect(metrics).toContain('impact_drive_validation_failures_total{route="/api/engineer"}');
  expect(metrics).not.toContain("invalid-secret");
});

test("operational logs and metrics expose only sanitized metadata across Engineer categories", async () => {
  const app = createApp({
    provider: async () => {
      throw new Error("Bearer private-provider-token-8451");
    },
  });
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("The test API did not bind a TCP port.");

  const capturedLogs: string[] = [];
  const output = process.stdout as typeof process.stdout & { write: (chunk: string | Uint8Array) => boolean };
  const originalWrite = output.write;
  output.write = ((chunk: string | Uint8Array) => {
    capturedLogs.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
    return true;
  }) as typeof process.stdout.write;

  try {
    const baseUrl = "http://127.0.0.1:" + address.port;
    const responses = await Promise.all([
      fetch(baseUrl + "/api/engineer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: "evidence", question: "What is the travel and logistics emissions reduction?" }) }),
      fetch(baseUrl + "/api/engineer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: "mission", question: "What happens for the air route?", context: { mission: { missionId: "freight", configId: "freight-r1-v1", choiceId: "air" } } }) }),
      fetch(baseUrl + "/api/engineer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: "telemetry", question: "What signals are in this simulated snapshot?", context: { telemetry: { stepId: "step-01" } } }) }),
    ]);
    expect(responses.map(({ status }) => status)).toEqual([200, 200, 200]);
    expect((await responses[0].json()).mode).toBe("prepared_fallback");
    expect((await responses[1].json()).mode).toBe("prepared_fallback");
    expect((await responses[2].json()).mode).toBe("prepared_fallback");

    const categoryMismatch = await fetch(baseUrl + "/api/engineer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "mission", question: "What happens for this route?" }),
    });
    expect(categoryMismatch.status).toBe(400);
    expect(await categoryMismatch.json()).toEqual({ error: "Enter a valid question and optional context." });
    const malformed = await fetch(baseUrl + "/api/engineer", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{\"category\":",
    });
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ error: "Engineer request JSON is invalid." });
    const oversized = await fetch(baseUrl + "/api/engineer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "evidence", question: "oversized-private-question-6104 ".repeat(700) }),
    });
    expect(oversized.status).toBe(413);
    expect(await oversized.json()).toEqual({ error: "Engineer request body exceeds the 16KB limit." });

    const metricsResponse = await fetch(baseUrl + "/metrics");
    const metrics = await metricsResponse.text();
    const entries = capturedLogs.filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(entries).toHaveLength(7);
    for (const entry of entries) {
      expect(Object.keys(entry).every((key) => ["service", "environment", "severity", "route", "method", "status", "duration_ms", "response_mode", "dependency_error_category"].includes(key))).toBeTruthy();
    }
    expect(entries).toContainEqual(expect.objectContaining({ route: "/api/engineer", method: "POST", status: "2xx", response_mode: "prepared_fallback", dependency_error_category: "request_failed" }));
    expect(entries.filter((entry) => entry.status === "4xx")).toHaveLength(3);
    expect(metrics).toContain('impact_drive_http_requests_total{method="POST",route="/api/engineer",status_class="2xx"}');
    expect(metrics).toMatch(/impact_drive_engineer_provider_errors_total\{category="request_failed"\} [1-9]\d*/);
    for (const privateValue of [
      "travel and logistics emissions reduction", "What happens for the air route?", "What signals are in this simulated snapshot?",
      "private-provider-token-8451", "freight-r1-v1", "step-01", "287 km/h", "Your game scenario prioritizes a tight delivery window.", "oversized-private-question-6104",
    ]) {
      expect(capturedLogs.join(" ").includes(privateValue), `Logs contained ${privateValue}`).toBe(false);
      expect(metrics.includes(privateValue), `Metrics contained ${privateValue}`).toBe(false);
    }
  } finally {
    output.write = originalWrite;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
