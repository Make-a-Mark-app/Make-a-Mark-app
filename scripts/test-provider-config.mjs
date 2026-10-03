import assert from "node:assert/strict";
import test from "node:test";
import { createEngineerProvider } from "../server/provider.ts";

test("provider configuration stays disabled by default even if credentials are present", () => {
  assert.equal(createEngineerProvider({
    ENGINEER_PROVIDER_URL: "not a URL",
    ENGINEER_PROVIDER_API_KEY: "secret",
  }), undefined);
});

test("provider enablement requires a valid HTTPS endpoint", () => {
  assert.throws(
    () => createEngineerProvider({ ENGINEER_PROVIDER_ENABLED: "true" }),
    /ENGINEER_PROVIDER_URL/,
  );
  assert.throws(
    () => createEngineerProvider({ ENGINEER_PROVIDER_ENABLED: "true", ENGINEER_PROVIDER_URL: "http://provider.test" }),
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
    ENGINEER_PROVIDER_URL: "https://provider.example/v1/engineer",
    ENGINEER_PROVIDER_API_KEY: "private-key",
  }, async (url, options) => {
    call = { url, options };
    return new Response(JSON.stringify({ answer: "Grounded answer.", recordIds: ["record-1"] }), { status: 200 });
  });

  assert.equal(call, undefined);
  const result = await provider({ question: "question", detailLevel: "concise", records: [] });
  assert.deepEqual(result, { answer: "Grounded answer.", recordIds: ["record-1"] });
  assert.equal(call.url.href, "https://provider.example/v1/engineer");
  assert.equal(call.options.method, "POST");
  assert.equal(call.options.headers.authorization, "Bearer private-key");
  assert.deepEqual(JSON.parse(call.options.body), { question: "question", detailLevel: "concise", records: [] });
});
