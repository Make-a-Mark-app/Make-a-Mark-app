# Step 7 Configure the Optional Cloud Model and Operations

**Depends on:** Step 6 for Cloud Run hosting.  
**Outcome:** The optional Race Engineer can call a hosted model without exposing credentials, while operators can diagnose availability, latency, and failures.

## Function

Connect the Express API to a provider-neutral hosted-model adapter and cloud operational tools. For a Google Cloud deployment, Vertex AI Gemini is one provider choice. A different hosted LLM can be used through the same server-side adapter. No model is required for the app to start or for the mission/library to work.

## Services and functions

| Service | Function | When needed |
|---|---|---|
| Vertex AI API / Gemini | Hosted inference example | Only if Google is selected as provider |
| Cloud Run API service identity | Authenticates to Google Cloud APIs using workload identity | When API is deployed on Cloud Run |
| Vertex AI User IAM role (or narrower approved role) | Allows the API service identity to call model endpoints | Only for Vertex AI; grant least privilege |
| Secret Manager | Supplies a static API key for a non-Google hosted provider | Only when that provider requires a key |
| Cloud Logging | Stores Cloud Run request, container, and system logs | Cloud Run hosting |
| Cloud Monitoring | Displays Cloud Run metrics and supports alerts | Cloud Run hosting |
| Error Reporting | Groups application exceptions for triage | Recommended cloud operations |
| Cloud Armor | Edge protection and rate limiting at the load balancer | Optional for an externally reachable demo |

For local Compose, use an ignored `.env` for an optional provider key; do not check it in. Local logs continue through Alloy/Loki and metrics through Prometheus/Grafana.

## Actions

1. **Choose provider after core behavior works.** Keep the `ModelProvider`/adapter contract neutral. The fallback path must work before provider credentials are configured.
2. **Enable Vertex AI only if selected.** Enable the Vertex AI API, choose a supported project/location/model, and use a Node client or HTTPS adapter compatible with the existing Express runtime. Avoid hard-coding a model version in product logic.
3. **Use Cloud Run service identity.** Grant the API runtime identity only the required Vertex AI permission, commonly the Vertex AI User role. Avoid user-managed service-account key files and never expose credentials to React/Nginx/browser code.
4. **Use Secret Manager for static keys only.** If an external provider requires an API key, store it as a Secret Manager secret, grant the API identity Secret Accessor on that specific secret, and expose it only to the API container. Do not create a secret for a Vertex AI identity flow unless the chosen integration requires it.
5. **Set guardrails before enabling provider traffic.** Keep generation behind explicit submit; bound question length, retrieved records, output size, timeout, and retry count. Define graceful fallback for quota, auth, timeout, and malformed response errors.
6. **Inspect logs and metrics.** Use Cloud Logging for request/container/system logs, Cloud Monitoring for request/latency/instance metrics and alerts, and Error Reporting for exceptions. Create views for API errors, latency, no-answer/fallback modes, and provider error category.
7. **Apply privacy-safe logging.** Do not log prompts, question bodies, evidence passages, simulated values, secrets, or player identifiers. Avoid high-cardinality metric labels. Verify redaction before enabling broader access to logs.
8. **Set public-demo limits.** Apply Cloud Armor rate limiting or equivalent gateway policy if the demo is open to the public. Configure model request limits and project billing notifications. Alert budgets are notifications, not hard spending caps.
9. **Rehearse provider states.** Exercise provider absent, permission denied, rate limited, timed out, malformed answer, and supported answer. Ensure the game and evidence library remain usable in each case.

## Deliverables

- Provider configuration, service identity, and narrowly scoped IAM bindings.
- Secret reference only when an external provider key is needed.
- Cloud Logging filters/views, Cloud Monitoring dashboard/alerts, Error Reporting configuration, and optional Cloud Armor policy.
- A documented provider-off and provider-failure demonstration path.

## Completion checks

- Only the Express API can invoke the model, and only on explicit user submission.
- No long-lived service-account key is stored in the repository or container image.
- Secret access is scoped to the API identity and only required secrets.
- Logs/metrics exclude content and identifiers listed in the privacy rules.
- A missing or failed provider returns prepared fallback/no-answer without breaking mission or evidence browsing.

## Official references

- [Vertex AI Gemini API quickstart](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/quickstart)
- [Configure Cloud Run secrets](https://docs.cloud.google.com/run/docs/configuring/services/secrets)
- [Cloud Run logging and monitoring overview](https://docs.cloud.google.com/run/docs/monitoring-overview)

## Handoff

Complete [Step 8](step-08-acceptance-and-rehearsal.md) before presenting or sharing the hosted demo.
