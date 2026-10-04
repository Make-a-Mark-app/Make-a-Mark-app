import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createApp } from "../server/app.ts";
import { createEngineerProvider } from "../server/provider.ts";

test("KiraAI failures through the Engineer API return prepared evidence without retries", async () => {
  const failures = [
    { name: "authorization", respond: async () => new Response("unauthorized", { status: 401 }) },
    { name: "rate limit", respond: async () => new Response("limited", { status: 429 }) },
    { name: "timeout", respond: async () => { throw new DOMException("Timed out", "TimeoutError"); } },
    { name: "malformed output", respond: async () => new Response(JSON.stringify({ choices: [{ message: { content: "not JSON" } }] }), { status: 200 }) },
  ];

  for (const failure of failures) {
    let callCount = 0;
    const provider = createEngineerProvider({
      ENGINEER_PROVIDER_ENABLED: "true",
      ENGINEER_PROVIDER_API_KEY: "fake-kira-key",
    }, async (input, options) => {
      callCount += 1;
      return failure.respond(input instanceof URL ? input : new URL(String(input)), options);
    });
    assert.ok(provider, "configured KiraAI provider should be created");

    const server = createServer(createApp({ provider, logger: { write: () => undefined } }));
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string", "test API should bind a TCP port");

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/engineer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "evidence", question: "What is the travel and logistics emissions reduction?" }),
      });
      const result = await response.json();

      assert.equal(response.status, 200, failure.name);
      assert.equal(result.mode, "prepared_fallback", failure.name);
      assert.deepEqual(result.citations.map(({ recordId }) => recordId), ["env-2025-travel-logistics-reduction"], failure.name);
      assert.equal(callCount, 1, `${failure.name}: generation request must not retry`);
      assert.equal(JSON.stringify(result).includes("fake-kira-key"), false, `${failure.name}: API key must stay server-side`);
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  }
});
