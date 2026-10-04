# Step 7 Configure KiraAI and Private-Demo Operations

**Depends on:** Race Engineer behavior from Step 4; Step 6 when sharing through Tailscale.
**Outcome:** The optional Race Engineer can call KiraAI from the API container, while operators can monitor provider usage and diagnose failures with the local observability stack.

## Function

Use KiraAI's OpenAI-compatible chat completions endpoint with model `gpt-oss-120b`. Keep the provider disabled by default. Only the Express API calls KiraAI after a supported user-submitted evidence question; the server validates the response and resolves citations from retrieved records.

The selected hosted profile runs on the Tailscale-connected machine. It uses the existing Compose API service and local Prometheus, Loki, and Grafana services; it does not require Vertex AI, Cloud Run, Secret Manager, Cloud Logging, or Cloud Monitoring.

## Configuration and key handling

1. Run `npm run setup:local` to create the ignored `.env` file with mode `0600` and a generated Grafana password.
2. Keep `ENGINEER_PROVIDER_ENABLED=false` until a replacement key is configured. Set it to `true` only when the operator is ready to enable model calls.
3. Use `ENGINEER_PROVIDER_URL=https://kiraai.vn/api/v1/chat/completions` and `ENGINEER_PROVIDER_MODEL=gpt-oss-120b`. These are the supplied defaults.
4. Put the replacement `ENGINEER_PROVIDER_API_KEY` only in `.env`. Use a key restricted to `gpt-oss-120b` with an expiry, and revoke the key previously disclosed in chat before enabling provider traffic.
5. Verify `.env` is ignored by Git and Docker. Compose sends provider settings only to the API container; the web image and browser receive no credentials.
6. Start or rebuild the private stack with `npm run tailnet:up`. It continues to use the dedicated Compose project and tailnet-only Tailscale Serve path from Step 6. Keep Funnel disabled.

## Usage and operational guardrails

- KiraAI wallet use has no additional application-level submission cap or separate daily/monthly spending ceiling in the selected configuration. After signing in to KiraAI, check the account Dashboard for the remaining wallet balance and usage today, and use [Billing History](https://kiraai.vn/billing/) to review transactions. Partner-model usage can spend down the available VND wallet balance.
- Respect KiraAI's per-key request limits. Do not retry rate-limited generations automatically.
- The selected Tailscale deployment does not use Cloud Armor, public-edge rate limiting, or Google Cloud billing alerts. Monitor provider wallet usage in KiraAI.
- Keep the request and answer bounds, timeout, response grounding, and prepared fallback behavior described in Step 4.
- Use Grafana on the host's loopback address for API availability, latency, request status, Engineer response modes, provider errors, and storage dashboards. Grafana is not exposed through Tailscale Serve.
- Keep logs allowlisted. Do not record prompts, question text, evidence passages, simulated values, secrets, or player identifiers. Avoid high-cardinality metric labels.

## Actions

1. **Exercise the provider configuration.** With the provider disabled or no key present, confirm prepared answers and browsing continue to work. With the replacement key configured, submit a supported evidence question and confirm the answer uses the reviewed records and canonical server-resolved citations.
2. **Check failure handling.** Exercise authorization denial, rate limiting, timeout, and malformed provider output. Confirm the API returns its prepared fallback and does not retry the generation request.
3. **Inspect local telemetry.** Confirm Grafana shows API errors, latency, fallback/no-answer modes, and provider error categories. Verify log contents and metric labels contain no private content.
4. **Check provider spend separately.** Use the KiraAI [account Dashboard](https://kiraai.vn/) for the remaining wallet balance and today's usage, and [Billing History](https://kiraai.vn/billing/) for transactions. Local Compose and Tailscale do not provide a KiraAI spending cap.
5. **Verify the sharing boundary.** Confirm Tailscale Serve is active for the app, Funnel is off, and Grafana remains reachable only over host loopback.

## Diagnose the private deployment

1. Open Grafana on the host at `http://127.0.0.1:3001` (or the configured `TAILNET_GRAFANA_PORT`) and sign in with `GRAFANA_USER` and `GRAFANA_PASSWORD` from the ignored `.env`. Open the **Impact Drive local operations** dashboard.
2. For API availability, check the **API availability** panel and the local **API Down** alert. Confirm container health with `npm run tailnet:status`; verify Grafana is still loopback-only and the API is available through the app URL.
3. For slow or failed API requests, use **API latency p95** and **HTTP request rate by status**. Filter logs in Loki by `service="api"` and inspect only the allowlisted route, status, duration, response mode, and provider error category.
4. For a **prepared fallback** with `request_failed`, check whether the provider is enabled and the key is present, current, and restricted to the configured model. Then check KiraAI key limits, wallet balance/transactions, and provider availability. This category intentionally groups authorization, rate-limit, HTTP, network, and timeout failures; local telemetry does not expose upstream response details.
5. For a **prepared fallback** with `invalid_response`, the provider response was missing, malformed, or could not be grounded in the selected records/context. The API discarded it and returned its prepared answer. Check the model setting and repeat with a supported evidence question; never use raw prompts or provider response bodies as diagnostic logs.
6. A **prepared fallback** without a provider error usually means the provider is disabled or no key is configured; check the two provider settings in `.env`. A **no-answer** mode with no provider error means retrieval/context did not support the question, so try a question supported by a reviewed record or selected context.
7. Check **Race Engineer response modes** and **Optional provider errors** for aggregate behavior. Provider errors have no local alert threshold: low-volume demo traffic does not support a useful threshold, and no wallet-spend threshold is enforced here. Inspect these panels and KiraAI wallet usage manually. Local alerts cover API availability and storage pressure only; no outbound alert notifications are configured.

## Deliverables

- KiraAI endpoint/model defaults and optional API key configuration for the API container.
- Private `.env` setup guidance and a documented key rotation/revocation step.
- Provider-off, failure, and supported-answer demonstration instructions.
- Local dashboards and operator instructions for provider errors and wallet usage.

## Completion checks

- No provider key is committed, included in a container image, or exposed to the browser/web service.
- The provider remains optional and disabled by default; missing credentials preserve prepared fallback behavior.
- KiraAI is called only by the API for an explicit supported question, and citations resolve only from retrieved reviewed records.
- Auth, rate-limit, timeout, and malformed-output failures return a prepared answer without automatic retries.
- Logs and metrics contain no prompts, evidence passages, simulated values, secrets, or player identifiers.
- Wallet usage and the lack of a separate spending cap are clear to operators.

## Optional public-cloud operations

If the project later selects Cloud Run, create a separate approved deployment plan for secret injection, cloud IAM, public ingress, logging, alerting, and billing. Those resources are outside the selected Tailscale profile and are not prerequisites for its acceptance.

## Handoff

Complete [Step 8](step-08-acceptance-and-rehearsal.md) before sharing the private demo.
