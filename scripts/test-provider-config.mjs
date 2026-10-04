import assert from "node:assert/strict";
import test from "node:test";
import { createEngineerProvider } from "../server/provider.ts";

test("provider configuration stays disabled by default even if credentials are present", () => {
  assert.equal(createEngineerProvider({
    ENGINEER_PROVIDER_URL: "not a URL",
    ENGINEER_PROVIDER_API_KEY: "secret",
  }), undefined);
});

test("provider enablement without a key stays on the prepared fallback path", () => {
  assert.equal(createEngineerProvider({ ENGINEER_PROVIDER_ENABLED: "true", ENGINEER_PROVIDER_URL: "http://invalid.test" }), undefined);
});

test("provider endpoint overrides must use HTTPS", () => {
  assert.throws(
    () => createEngineerProvider({ ENGINEER_PROVIDER_ENABLED: "true", ENGINEER_PROVIDER_API_KEY: "secret", ENGINEER_PROVIDER_URL: "http://provider.test" }),
    /HTTPS/,
  );
  assert.throws(
    () => createEngineerProvider({ ENGINEER_PROVIDER_ENABLED: "yes" }),
    /ENGINEER_PROVIDER_ENABLED/,
  );
});

test("the configured provider posts only when called by the Engineer route", async () => {
  let call;
  const provider = createEngineerProvider({
    ENGINEER_PROVIDER_ENABLED: "true",
    ENGINEER_PROVIDER_URL: "https://provider.example/v1/chat/completions",
    ENGINEER_PROVIDER_API_KEY: "private-key",
    ENGINEER_PROVIDER_MODEL: "test-model",
  }, async (url, options) => {
    call = { url, options };
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ answer: "Grounded answer.", recordIds: ["record-1"] }) } }],
    }), { status: 200 });
  });

  assert.equal(call, undefined);
  const result = await provider({ instructions: "Follow grounding rules.", question: "question", detailLevel: "concise", records: [] });
  assert.deepEqual(result, { answer: "Grounded answer.", recordIds: ["record-1"] });
  assert.equal(call.url.href, "https://provider.example/v1/chat/completions");
  assert.equal(call.options.method, "POST");
  assert.equal(call.options.headers.authorization, "Bearer private-key");
  const request = JSON.parse(call.options.body);
  assert.equal(request.model, "test-model");
  assert.equal(request.max_tokens, 500);
  assert.deepEqual(request.messages, [
    { role: "system", content: "Follow grounding rules." },
    { role: "user", content: JSON.stringify({ question: "question", detailLevel: "concise", records: [] }) },
  ]);
});

test("KiraAI maps Engineer input to a bounded chat completion and parses JSON content", async () => {
  let call;
  const provider = createEngineerProvider({
    ENGINEER_PROVIDER_ENABLED: "true",
    ENGINEER_PROVIDER_API_KEY: "private-key",
    ENGINEER_PROVIDER_MODEL: "gpt-oss-120b",
  }, async (url, options) => {
    call = { url, options };
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ answer: "Grounded answer.", recordIds: ["record-1"] }) } }],
    }), { status: 200 });
  });

  const result = await provider({
    instructions: "Use only supplied records.",
    question: "What does the record state?",
    detailLevel: "concise",
    records: [{ id: "record-1", title: "Record title" }],
  });

  assert.deepEqual(result, { answer: "Grounded answer.", recordIds: ["record-1"] });
  assert.equal(call.url.href, "https://kiraai.vn/api/v1/chat/completions");
  assert.equal(call.options.method, "POST");
  assert.equal(call.options.headers.authorization, "Bearer private-key");
  const request = JSON.parse(call.options.body);
  assert.equal(request.model, "gpt-oss-120b");
  assert.equal(request.max_tokens, 500);
  assert.deepEqual(request.messages.map(({ role }) => role), ["system", "user"]);
  assert.deepEqual(JSON.parse(request.messages[1].content), {
    question: "What does the record state?",
    detailLevel: "concise",
    records: [{ id: "record-1", title: "Record title" }],
  });
});
