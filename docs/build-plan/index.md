# Make A Mark R1 Build Order

**Status:** The core app is implemented. PR #27 adds the private Tailscale sharing path described in Step 6. Follow the steps in order; Steps 6–7 are optional for local-only use. Step 8 is the release and demo-readiness gate for local or tailnet use.

## Product boundary

Build one accessible prototype around one deterministic fictional freight mission, a manually advanced simulated telemetry fixture, a limited source-reviewed evidence library, and an optional Race Engineer. It does not connect to AMF1 systems, need a player account, or claim that synthetic values are measured impact. The [inclusive R1 concept](../Make-a-Mark-R1-inclusive-AI-concept.md) remains the product and audience requirements source. The [system architecture](../architecture.md) and [component/container plan](../component-and-container-plan.md) define the target boundaries.

## Recommended sequence

See the [base project structure](project-structure.md) for the scaffolded folder layout and the boundary between existing prototype files and planned R1 modules.

| Step | Guide | Outcome | Depends on |
|---|---|---|---|
| 1 | [Environment and data contracts](step-01-environment-and-contracts.md) | Agreed types, data labels, project setup, and scope | None |
| 2 | [Frontend and mission](step-02-frontend-and-mission.md) | Direct entry, accessible shell, deterministic freight mission | Step 1 |
| 3 | [Telemetry and evidence](step-03-telemetry-and-evidence.md) | User-advanced feed states and cited records | Steps 1–2 |
| 4 | [API and Race Engineer](step-04-api-and-race-engineer.md) | Bounded retrieval, optional model answers, citations, fallback | Steps 1 and 3 |
| 5 | [Local containers and observability](step-05-local-containers-and-observability.md) | One-command local stack with resettable monitoring | Steps 2–4 |
| 6 | [Private demo over Tailscale](step-06-private-tailscale-demo.md) | Share the local Compose app over tailnet-only HTTPS | Steps 1–5 |
| 7 | [KiraAI and private operations](step-07-kiraai-and-private-operations.md) | Server-side KiraAI configuration, wallet awareness, and local observability | Steps 4–6; optional provider |
| 8 | [Inclusive acceptance and rehearsal](step-08-acceptance-and-rehearsal.md) | Release-ready prototype and reproducible demo | Steps 1–5; Steps 6–7 for tailnet sharing |

## Run profiles

- **Local default:** Node.js/npm and Docker Compose; web/Nginx, Express API, Prometheus, Loki, Alloy, and Grafana. The model provider is optional. The game, library, and prepared answer path must work without it.
- **Private shared demo (selected):** Docker Compose and a machine connected to the Tailscale network. Tailscale Serve provides HTTPS to authorized tailnet devices. PR #27 adds `npm run tailnet:up`, `tailnet:status`, and `tailnet:down`; Funnel stays off, so this path does not create a public endpoint or require Google Cloud.
- **Public cloud demo (optional alternative):** Google Cloud project and billing; Cloud Build, Artifact Registry, Cloud Run, an HTTPS load balancer with serverless NEGs and URL-map routing, IAM, and a controlled domain/TLS certificate. This path is separate from the selected tailnet profile and is not a prerequisite for Steps 7–8.

The Google Cloud Console is used to configure and view resources; it does not run the app. Local Compose remains the default. Keep databases, vector search, Redis, continuous ingestion, player accounts, and AMF1 feed access out of R1.

## Shared implementation rules

- Keep simulated live view, reported impact, illustrative placeholders, and mission scenario visibly distinct.
- Put “Illustrative demo data — not live AMF1 data or a measured impact result.” beside every illustrative impact value.
- Invoke the model only after explicit user submission. The API—not the model—resolves source citations.
- Do not log question text, prompts, source passages, secrets, player identifiers, or simulated signal values.
- Support keyboard/touch use, visible focus, reduced motion, concise and detailed explanations, and an untimed non-driving route.
