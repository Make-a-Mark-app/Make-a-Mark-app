import type { EngineerProvider, EngineerProviderInput } from "./engineer.js";

const defaultProviderUrl = "https://kiraai.vn/api/v1/chat/completions";
const defaultModel = "gpt-oss-120b";

export function createEngineerProvider(
  environment: NodeJS.ProcessEnv,
  fetcher: typeof fetch = fetch,
): EngineerProvider | undefined {
  const enabled = environment.ENGINEER_PROVIDER_ENABLED ?? "false";
  if (enabled === "false") return undefined;
  if (enabled !== "true") {
    throw new Error("ENGINEER_PROVIDER_ENABLED must be either true or false.");
  }

  const apiKey = environment.ENGINEER_PROVIDER_API_KEY?.trim();
  if (!apiKey) return undefined;

  const endpoint = environment.ENGINEER_PROVIDER_URL?.trim() || defaultProviderUrl;

  let providerUrl: URL;
  try {
    providerUrl = new URL(endpoint);
  } catch {
    throw new Error("ENGINEER_PROVIDER_URL must be a valid HTTPS URL.");
  }
  if (providerUrl.protocol !== "https:" || providerUrl.username || providerUrl.password || providerUrl.hash) {
    throw new Error("ENGINEER_PROVIDER_URL must be an HTTPS URL without embedded credentials or a fragment.");
  }

  const model = environment.ENGINEER_PROVIDER_MODEL?.trim() || defaultModel;

  return async (input: EngineerProviderInput) => {
    const response = await fetcher(providerUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: input.detailLevel === "concise" ? 600 : 800,
        reasoning_effort: input.detailLevel === "concise" ? "low" : "medium",
        messages: [
          { role: "system", content: input.instructions },
          {
            role: "user",
            content: JSON.stringify({
              question: input.question,
              detailLevel: input.detailLevel,
              records: input.records,
            }),
          },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}.`);
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    const choices = (payload as { choices?: unknown }).choices;
    if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") return null;
    const message = (choices[0] as { message?: unknown }).message;
    if (!message || typeof message !== "object") return null;
    const content = (message as { content?: unknown }).content;
    if (typeof content !== "string") return null;
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  };
}
