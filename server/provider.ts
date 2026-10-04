import type { EngineerProvider, EngineerProviderInput } from "./engineer.js";

export function createEngineerProvider(
  environment: NodeJS.ProcessEnv,
  fetcher: typeof fetch = fetch,
): EngineerProvider | undefined {
  const enabled = environment.ENGINEER_PROVIDER_ENABLED ?? "false";
  if (enabled === "false") return undefined;
  if (enabled !== "true") {
    throw new Error("ENGINEER_PROVIDER_ENABLED must be either true or false.");
  }

  const endpoint = environment.ENGINEER_PROVIDER_URL?.trim();
  if (!endpoint) {
    throw new Error("ENGINEER_PROVIDER_URL must be set when ENGINEER_PROVIDER_ENABLED is true.");
  }

  let providerUrl: URL;
  try {
    providerUrl = new URL(endpoint);
  } catch {
    throw new Error("ENGINEER_PROVIDER_URL must be a valid HTTPS URL.");
  }
  if (providerUrl.protocol !== "https:" || providerUrl.username || providerUrl.password || providerUrl.hash) {
    throw new Error("ENGINEER_PROVIDER_URL must be an HTTPS URL without embedded credentials or a fragment.");
  }

  const apiKey = environment.ENGINEER_PROVIDER_API_KEY?.trim();
  return async (input: EngineerProviderInput) => {
    const response = await fetcher(providerUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(apiKey && { authorization: `Bearer ${apiKey}` }),
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}.`);
    return response.json();
  };
}
