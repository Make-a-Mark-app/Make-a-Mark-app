# Step 5 Package Local Containers and Observability

**Status:** Implemented by [`deploy/local/compose.yaml`](../../deploy/local/compose.yaml).
**Depends on:** Steps 2–4.  
**Outcome:** A developer can start and reset the whole local prototype consistently, while inspecting service health and sanitized logs.

## Function

Package the web app, API, and local observability stack using Docker Compose. Nginx serves built React assets and proxies same-origin `/api` requests to Express. Grafana explores API metrics and container logs collected by Prometheus, Loki, and Alloy.

## Services and functions

| Container/service | Function | Network/data policy |
|---|---|---|
| `web` (Nginx + React build) | Serves app and proxies `/api` to API | Only default host-published app port |
| `api` (Node/Express) | Health, evidence retrieval, optional model adapter, metrics | Private Compose network; provider outbound only when enabled |
| `prometheus` | Scrapes API `/metrics` | Private or loopback-only; bounded local volume |
| `loki` | Stores local container logs | Private; bounded retention volume |
| `alloy` | Collects Docker/container stdout and forwards logs | Local collector; no public UI |
| `grafana` | Dashboards, log queries, alerts | Bind to `127.0.0.1`; optional state volume |

The browser fixture and source-reviewed records are files, not volumes that must be reset. Do not add database, Redis, ingestion, or model containers.

## Actions

1. **Create a production web image.** Build React/Vite assets, copy them into an Nginx image, and configure SPA fallback routing. Proxy `/api` to the Compose `api` service without exposing the API port publicly.
2. **Create the API image.** Run the compiled/server entry point with production settings. Add `/api/health` and `/metrics`; fail health only when the API itself cannot serve requests, not when an optional model is unavailable.
3. **Define Compose networking and ports.** Name the project `cognizant-local`. Put services on a private network. Bind the configurable web port (default `8080`) and Grafana port (default `3000`) to loopback. Keep API, Loki, Prometheus, and Alloy APIs private by default.
4. **Add startup health checks.** Make checks inspect app availability. Avoid hard dependency on the external LLM API for initial startup.
5. **Add Alloy log collection.** Collect service stdout and send to Loki. Keep labels low-cardinality: service, environment, severity. Exclude question text, prompts, evidence passage content, simulated values, credentials, and user-controlled IDs.
6. **Provision useful dashboards.** Show API up/down, latency, status classes, validation failures, answer modes, provider error classes, and local log/metric retention. Never turn questions or record/session IDs into metric labels.
7. **Add local secret handling.** `npm run setup:local` creates an ignored `.env` with a generated Grafana password and disabled provider flag; it preserves an existing file. Require a nonempty Grafana password, commit only the blank-password example, and pass provider variables only to `api`. Provider use requires explicit enablement and valid configuration; health remains independent of provider credentials.
8. **Document start/stop/reset.** `docker compose up --build` starts services. `docker compose down` preserves observability volumes. A separate full reset removes Grafana/Loki/Prometheus state. Clear browser local storage separately. Versioned fixture and records must survive every reset.
9. **Keep development hot reload separate.** If desired, use a development Compose override for Vite/tsx watch; the default demo profile should resemble the production build.

## Deliverables

- Compose file and service Dockerfiles/configuration.
- Nginx route config and health checks.
- Alloy/Loki/Prometheus/Grafana local configuration and starter dashboards.
- Start, stop, clean-reset, and secret-setup instructions.

## Completion checks

- Fresh start builds and reaches the app from one published web port.
- `npm run test:compose:config` verifies resolved ports, private services, provider-variable placement, and Grafana password requirements; `npm run setup:local` is idempotent and creates a private local env file.
- `/api` works through Nginx; API, metrics, logs, and Grafana are not publicly exposed.
- Grafana is loopback-only; health behavior is correct without a model credential.
- Full reset clears only named local state and leaves versioned demo/evidence files intact.
- Logs contain no excluded sensitive or user-specific data.

## Handoff

For local-only use, proceed directly to [Step 8](step-08-acceptance-and-rehearsal.md). If a shareable hosted demo is needed, use [Step 6](step-06-google-cloud-deployment.md).
