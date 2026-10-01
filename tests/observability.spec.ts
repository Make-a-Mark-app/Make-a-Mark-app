import { expect, test } from "@playwright/test";

const apiBaseURL = "http://127.0.0.1:" + (process.env.PORT ?? "4178");

test("API metrics use low-cardinality labels and do not contain question text or demo values", async ({ request }) => {
  test.skip(Boolean(process.env.PLAYWRIGHT_EXTERNAL), "The metrics endpoint stays private to the Compose network.");
  const privateQuestion = "Is this private prompt text 918273 supported?";
  const response = await request.post("/api/engineer", {
    data: { question: privateQuestion, context: { telemetry: { stepId: "step-04" } } },
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
