# ADR-0002: File-backed evidence and user-advanced R1 demo architecture

**Status:** Accepted for the hackathon R1 design; not yet implemented.  
**Date:** 1 October 2026  
**Supersedes:** None. ADR-0001 remains the historical decision for the first local prototype.

## Context

The R1 concept adds a live-style session view, a source-backed evidence experience, and an optional Race Engineer while explicitly requiring no AMF1 telemetry access, no account, and no claim that sample values are real. The current prototype remains a small React/Vite and Express application with illustrative content and a prepared response.

A database, vector index, automatic ingestion pipeline, Redis, or model-serving container would add operation without improving this bounded demo. The most important risk is confusing scripted session data, published report claims, illustrative placeholders, and fictional mission feedback.

## Decision

- Keep one React/Vite frontend and one Express API. Keep the single freight mission deterministic and independent of evidence and telemetry.
- Advance telemetry through a finite, manually controlled local fixture with reproducible simulated timestamps and explicit updating, delayed, stale, and unavailable states.
- Store a small, source-reviewed evidence subset in versioned structured files and use exact/keyword lookup for R1.
- Call a provider-neutral hosted model only on an explicit user question, only from the API, and only with bounded relevant records and (when relevant) the selected demo summary. Preserve prepared fallback and no-answer behavior.
- Validate citations against retrieved records and resolve citation metadata from those records.
- Keep four display categories distinct: simulated live view, reported impact, illustrative impact placeholder, and mission scenario.
- Retain local Compose observability with Grafana, Loki, Prometheus, and Alloy. Do not include Postgres, pgvector, Redis, ingestion, or model-serving containers in R1.
- Keep local Compose as the default run profile. Permit an optional public demo-hosting profile using Google Cloud Run, with a shared HTTPS load balancer path-routing to separate web and API services. Use Cloud Logging/Monitoring in the hosted profile; keep local Grafana for Compose. Cloud hosting does not add accounts or change the no-AMF1-feed boundary.
- Keep access open without an account. Include keyboard/touch use, reduced motion, concise/detailed explanation choices, and an untimed non-driving route.

## Consequences

The R1 experience is demonstrable without AMF1 integration, but it does not prove a real-time impact feed exists. Factual coverage is limited to the source-reviewed record subset. Keyword retrieval may miss paraphrases; unsupported questions must be declined or limited rather than answered from general model knowledge. The future build has fewer infrastructure dependencies and predictable demo states. Local Compose remains the simplest developer and presenter run path; Google Cloud deployment adds build, registry, identity, routing, and observability setup only when a shareable hosted demo is needed.

## Alternatives considered

- **Hosted AMF1 telemetry or impact feed:** excluded because R1 requires no access and no verified integration contract.
- **PostgreSQL/pgvector and hybrid retrieval:** excluded for the small curated R1 corpus; reassess only if evaluation demonstrates a concrete retrieval need.
- **Automatic model narration of every fixture update:** excluded to control cost and prevent continuous unsupervised claims.
- **Age-based modes or account-based personalization:** excluded; users select depth and entry route themselves.
