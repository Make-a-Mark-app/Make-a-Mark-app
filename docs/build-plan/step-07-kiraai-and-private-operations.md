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

- KiraAI wallet use has no additional application-level submission cap or separate daily/monthly spending ceiling in the selected configuration. Operators should check the KiraAI account's wallet balance and usage directly; usage can spend down the available balance.
- Respect KiraAI's per-key request limits. Do not retry rate-limited generations automatically.
- Keep the request and answer bounds, timeout, response grounding, and prepared fallback behavior described in Step 4.
- Use Grafana on the host's loopback address for API availability, latency, request status, Engineer response modes, provider errors, and storage dashboards. Grafana is not exposed through Tailscale Serve.
- Keep logs allowlisted. Do not record prompts, question text, evidence passages, simulated values, secrets, or player identifiers. Avoid high-cardinality metric labels.

## Actions

1. **Exercise the provider configuration.** With the provider disabled or no key present, confirm prepared answers and browsing continue to work. With the replacement key configured, submit a supported evidence question and confirm the answer uses the reviewed records and canonical server-resolved citations.
2. **Check failure handling.** Exercise authorization denial, rate limiting, timeout, and malformed provider output. Confirm the API returns its prepared fallback and does not retry the generation request.
3. **Inspect local telemetry.** Confirm Grafana shows API errors, latency, fallback/no-answer modes, and provider error categories. Verify log contents and metric labels contain no private content.
4. **Check provider spend separately.** Use the KiraAI account page to monitor wallet balance and usage. Local Compose and Tailscale do not provide a KiraAI spending cap.
5. **Verify the sharing boundary.** Confirm Tailscale Serve is active for the app, Funnel is off, and Grafana remains reachable only over host loopback.

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
