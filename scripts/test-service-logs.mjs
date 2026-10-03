import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createServiceLogWriter } from "../server/logging.ts";

test("service logs emit allowlisted fields to stdout and rotating source files", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "service-logs-"));
  writeFileSync(path.join(directory, "api.jsonl.3"), "stale rotated log\n");
  let stdout = "";
  const writer = createServiceLogWriter({
    directory,
    service: "api",
    environment: "local",
    maxBytes: 480,
    stdout: { write: (chunk) => { stdout += chunk; return true; } },
  });

  try {
    for (let index = 0; index < 8; index += 1) {
      writer.write({
        severity: "info",
        method: "POST",
        route: "/api/engineer",
        status: "2xx",
        duration_ms: 4,
        response_mode: "prepared_fallback",
        question: "SENTINEL_QUESTION_PRIVATE",
        prompt: "SENTINEL_PROMPT_PRIVATE",
        request_body: "SENTINEL_BODY_PRIVATE",
        query: "SENTINEL_QUERY_PRIVATE",
        selected_context: "SENTINEL_CONTEXT_PRIVATE",
        api_key: "SENTINEL_CREDENTIAL_PRIVATE",
        user_id: "SENTINEL_USER_ID_PRIVATE",
      });
    }
    await writer.flush();

    const names = readdirSync(directory).sort();
    assert.deepEqual(names, ["api.jsonl", "api.jsonl.1", "api.jsonl.2"]);
    const stored = names.map((name) => readFileSync(path.join(directory, name), "utf8")).join("");
    assert.equal(stored.trim().split("\n").length, 6);
    assert.equal(stored.trim().split("\n").every((line) => stdout.includes(line)), true);
    for (const sentinel of ["SENTINEL_QUESTION_PRIVATE", "SENTINEL_PROMPT_PRIVATE", "SENTINEL_BODY_PRIVATE", "SENTINEL_QUERY_PRIVATE", "SENTINEL_CONTEXT_PRIVATE", "SENTINEL_CREDENTIAL_PRIVATE", "SENTINEL_USER_ID_PRIVATE"]) {
      assert.equal(stored.includes(sentinel), false, `log included ${sentinel}`);
    }
    const record = JSON.parse(stored.trim().split("\n")[0]);
    assert.deepEqual(Object.keys(record).sort(), ["duration_ms", "environment", "method", "response_mode", "route", "service", "severity", "status"]);
    assert.deepEqual([record.service, record.environment, record.severity], ["api", "local", "info"]);
  } finally {
    await writer.flush();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("file logging failure never throws from the logger or blocks stdout", async () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), "service-log-failure-"));
  const blockedDirectory = path.join(directory, "not-a-directory");
  writeFileSync(blockedDirectory, "file");
  let stdout = "";
  const writer = createServiceLogWriter({
    directory: path.join(blockedDirectory, "logs"),
    service: "api",
    environment: "local",
    stdout: { write: (chunk) => { stdout += chunk; return true; } },
  });

  try {
    assert.doesNotThrow(() => writer.write({ severity: "info", method: "GET", route: "/api/health", status: "2xx", duration_ms: 1 }));
    await writer.flush();
    assert.match(stdout, /"route":"\/api\/health"/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
