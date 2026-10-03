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
| `prometheus` | Scrapes API and Loki metrics | Private; 15-day retention and an 850 MiB TSDB block retention limit |
| `loki` | Stores local API logs | Private; age-based retention, with disk usage governed by the filesystem |
| `alloy` | Collects Docker/container stdout and forwards logs | Local collector; no public UI |
| `grafana` | Dashboards, log queries, local alerts | Bind to `127.0.0.1`; persistent state has a 256 MiB planning target, not a portable volume quota |

The browser fixture and source-reviewed records are files, not volumes that must be reset. Do not add database, Redis, ingestion, or model containers.

## Actions

1. **Create a production web image.** Build React/Vite assets, copy them into an Nginx image, and configure SPA fallback routing. Proxy `/api` to the Compose `api` service without exposing the API port publicly.
2. **Create the API image.** Run the compiled/server entry point with production settings. Add `/api/health` and `/metrics`; fail health only when the API itself cannot serve requests, not when an optional model is unavailable.
3. **Define Compose networking and ports.** Name the project `cognizant-local`. Put services on a private network. Bind the configurable web port (default `8080`) and Grafana port (default `3000`) to loopback. Keep API, Loki, Prometheus, and Alloy APIs private by default.
4. **Add startup health checks.** Make checks inspect app availability. Avoid hard dependency on the external LLM API for initial startup.
5. **Add privacy-safe Alloy log collection.** API requests emit allowlisted structured JSON to stdout and a shared source volume. Alloy reads the volume read-only and forwards to Loki without Docker daemon access. Rotate source logs at 10 MiB and keep three files total per service, including the active file. Keep labels low-cardinality: service, environment, severity. Exclude question text, prompts, request bodies, query strings, evidence passage content, selected context, simulated values, credentials, raw provider messages, and user-controlled IDs.
6. **Provision useful dashboards.** Show API up/down, latency, status classes, validation failures, answer modes, provider error classes, and local log/metric retention. Never turn questions or record/session IDs into metric labels.
7. **Set honest local retention targets.** Prometheus retains 15 days and limits retained TSDB blocks to 850 MiB (the `850MB` setting uses binary units). This is about 83% of the 1 GiB planning target, leaving about 17% compaction headroom, within Prometheus' recommended retention sizing range. The whole volume can still temporarily exceed the target because WAL, head data, and compaction need space. Loki retains logs by age for 7 days. Its 2 GiB figure is a planning target, not a filesystem cap: the filesystem controls capacity, and disk pressure can make Loki reject new log writes while the API continues serving. Grafana state has a 256 MiB planning target; Compose named volumes do not provide a portable hard quota. Keep Loki usage reporting disabled.
8. **Provision local-only alerts.** Grafana warns when the API is down for over one minute, the Prometheus TSDB block metric passes 80% of the 1 GiB target, or Loki reports WAL disk pressure/failure. The Prometheus alert observes retained block bytes, not total filesystem usage. Do not alert by default on latency, validation, or provider errors. Do not configure outbound contact points or notifications by default.
9. **Add local secret handling.** `npm run setup:local` creates an ignored `.env` with a generated Grafana password and disabled provider flag; it preserves an existing file. Require a nonempty Grafana password, commit only the blank-password example, and pass provider variables only to `api`. Provider use requires explicit enablement and a valid HTTPS endpoint; the API validates configuration at startup and makes provider requests only after an eligible user submission. Health remains independent of provider credentials or availability.
10. **Document start/stop/reset.** `docker compose up --build` starts services. `docker compose down` preserves the five named observability volumes: Grafana, Loki, Prometheus, source logs, and Alloy file positions. A full reset for the default `cognizant-local` project uses `docker compose -f deploy/local/compose.yaml down --volumes` and removes only those project volumes. `.env`, versioned fixture/evidence files, and browser Discovery state remain intact. Clear Discovery data separately from `/summary` with **Clear my discoveries**. Keep secret setup, port overrides, and the app-only `up --build web api` command documented in the README.
11. **Keep development hot reload separate.** If desired, use a development Compose override for Vite/tsx watch; the default demo profile should resemble the production build.

### Local storage behavior

The configured retention applies to Prometheus TSDB blocks and Loki's age-based log retention; neither establishes a hard cap on the Docker volume's filesystem usage. Prometheus limits TSDB blocks to 850 MiB (about 83% of the 1 GiB storage target) to leave compaction headroom, and its alert watches block bytes at 80% of that 1 GiB target. The volume also holds WAL and head data, and compaction may need temporary extra space. Loki's filesystem object store has no size limit in this Compose setup. Under disk pressure, Loki can reject new log writes while the API keeps serving requests. The 1 GiB Prometheus, 2 GiB Loki, and 256 MiB Grafana figures are local capacity targets with different enforcement mechanisms, not interchangeable volume quotas.

## Deliverables

- Compose file and service Dockerfiles/configuration.
- Nginx route config and health checks.
- Alloy/Loki/Prometheus/Grafana local configuration and starter dashboards.
- Start, stop, clean-reset, and secret-setup instructions.

## Completion checks

- Fresh start builds and reaches the app from one published web port.
- `npm run test:compose:config` verifies resolved ports, private services, provider-variable placement, Grafana password requirements, retention settings, dashboard signals, and local alert rules; `npm run setup:local` is idempotent and creates a private local env file.
- `/api` works through Nginx; API, metrics, logs, and Grafana are not publicly exposed.
- Grafana is loopback-only; health behavior is correct without a model credential.
- Prometheus retains 15 days with an 850 MiB block limit below the 1 GiB target, Loki age-retains 7 days with no hard filesystem quota, and Grafana's 256 MiB state figure is documented as a target.
- Grafana provisions only local alerts for API availability and storage pressure; no outbound notification or Loki usage-reporting configuration is enabled by default.
- Normal shutdown preserves all five named observability volumes; full reset removes only those volumes for its Compose project, including service logs and Alloy positions.
- Full reset leaves `.env`, versioned demo/evidence files, and browser Discovery state intact; browser Discovery clears through the `/summary` action.
- Logs contain no excluded sensitive or user-specific data; a sentinel appears neither in the source volume nor Loki.
- Alloy has no Docker socket mount, can read but not write the shared source volume, and adds only service, environment, and severity labels.

## Handoff

For local-only use, proceed directly to [Step 8](step-08-acceptance-and-rehearsal.md). If a shareable hosted demo is needed, use [Step 6](step-06-google-cloud-deployment.md).
