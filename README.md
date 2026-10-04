# Make A Mark Impact Drive

An inclusive hackathon R1 prototype plan for one fictional freight mission, a manually advanced live-style demo view, a limited source-reviewed AMF1 evidence library, and an optional Race Engineer.

## Current prototype status

The current local app is React/Vite with an Express API. The fictional freight mission and its deterministic outcome use shared runtime-validated contracts in the browser and API. A small Discovery recap stays in this browser and can be cleared from the summary page. The evidence library contains six source-reviewed claims from the official 2025 Make A Mark report, with reviewer details, source locations, scope notes, and limitations; illustrative samples remain separate. Simulated telemetry offers direct selection of four fixed feed states, each using speed, gear, throttle, and brake signals. The Race Engineer retrieves a bounded set of reviewed records, resolves citations from those records, and can optionally call a server-configured provider. The default local Compose stack includes the production web/API containers and Grafana, Loki, Prometheus, and Alloy observability services.

## R1 boundaries

- No AMF1 telemetry or internal-system access is needed.
- Synthetic telemetry and its timestamps are manually advanced demo values.
- Mission outcomes are fictional and do not calculate environmental or social impact.
- Reported claims require source, reporting period, and limitations.
- Illustrative impact placeholders must carry “Illustrative demo data — not live AMF1 data or a measured impact result.”
- The Race Engineer calls an optional hosted provider only after a user submits a supported question. Provider credentials remain server-side; prepared fallback and no-answer responses remain available. Questions and selected context are not persisted or logged.
- No account or player profile is required. The mission and evidence library remain usable when the API/provider is unavailable.

## Run the current app

```sh
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite server proxies `/api` requests to the local TypeScript API on port `4178`.

For a production build:

```sh
npm run build
npm start
```

## Run the full local Compose stack

Docker Desktop with Compose is required. Create the ignored local environment file once; it generates a unique Grafana password and preserves any existing `.env` on later runs. The full stack starts by default. The Race Engineer provider stays disabled unless explicitly enabled and configured; no model key, GCP project, or hosted provider is required for the app or its health check.

```sh
npm run setup:local
docker compose -f deploy/local/compose.yaml up --build
```

Open `http://127.0.0.1:8080`. The web/API health endpoint is `http://127.0.0.1:8080/api/health`; Grafana is bound to `http://127.0.0.1:3000` and uses the generated `GRAFANA_USER` / `GRAFANA_PASSWORD` in `.env`. Prometheus, Loki, API, and Alloy have no published host ports. To run only the app, use `docker compose -f deploy/local/compose.yaml up --build web api`; this does not start the observability services. Override the loopback ports with `WEB_PORT` and `GRAFANA_PORT` in `.env`. Grafana includes API availability, latency, status classes, validation failures, Engineer response modes, provider errors, log volume, Prometheus storage, and Loki WAL usage. It provisions local alerts for an API outage over one minute, Prometheus storage above 80% of its target, and Loki WAL disk pressure. No outbound alert notifications are configured by default. Loki usage reporting is disabled.

API request logs are emitted as allowlisted JSON to stdout and to the shared `service-logs` volume. Alloy reads that volume read-only and forwards logs to Loki with only service, environment, and severity labels; it does not access the Docker socket. Source files rotate at 10 MiB and retain three files total per service, including the active file. A file logging error is ignored so it does not affect requests or health.

Prometheus retains metrics for 15 days and limits retained TSDB blocks to 850 MiB (`850MB` in its configuration uses binary units). This is about 83% of the 1 GiB planning target, leaving about 17% for compaction headroom; WAL, head data, and compaction can temporarily use more space. A local alert watches block bytes at 80% of the 1 GiB target, not total filesystem use. Loki keeps logs for 7 days through age-based retention. Its 2 GiB figure is a capacity target, not a hard volume limit: Docker's filesystem capacity is the limit, and disk pressure may cause Loki to reject new log writes while the API continues serving. Grafana's 256 MiB state figure is also a planning target; Compose named volumes do not provide a portable hard quota. The storage dashboard shows Prometheus blocks, recent Loki log volume, and Loki WAL disk usage.

Stop the stack with `docker compose -f deploy/local/compose.yaml down`; its named Grafana, Loki, Prometheus, source-log, and Alloy-position volumes are preserved. For a full reset of only this Compose project's observability state, run `docker compose -f deploy/local/compose.yaml down --volumes`. This removes the five named volumes (`grafana-data`, `loki-data`, `prometheus-data`, `service-logs`, and `alloy-data`) for the default `cognizant-local` project; it leaves `.env`, source files, the versioned demo fixture, and source-reviewed evidence untouched. Clear browser Discovery data separately from the app's `/summary` page with **Clear my discoveries**; that data stays in browser storage and is not part of Compose reset. Nginx publishes only the web port (default `8080`), while Grafana is loopback-bound (default `3000`).

## Share privately over Tailscale

With Docker and Tailscale connected on this machine, start a separate Compose project for the tailnet deployment:

```sh
npm run tailnet:up
```

The command builds and health-checks the stack, binds the web port to `127.0.0.1`, and configures Tailscale Serve on the first free HTTPS port from `10000` through `10100`. It prints the HTTPS URL for this machine's tailnet DNS name. The API remains behind Nginx; Grafana stays on loopback and the other observability services have no host ports. Only tailnet devices permitted by your Tailscale access policy can reach the app. This deployment uses `tailscale serve`; it does not enable Funnel or create a public URL.

```sh
npm run tailnet:status
npm run tailnet:down
```

Status checks the saved Serve route, local app health, and Compose services. Stop removes only the Make a Mark route and its Compose containers; it preserves other Serve routes and named observability volumes. The tailnet deployment uses its own Compose project and defaults to web port `8081` and Grafana port `3001`, so it can run beside the standard local Compose stack. Override these with `TAILNET_WEB_PORT` or `TAILNET_GRAFANA_PORT` if needed. Set `TAILNET_HTTPS_PORT` to request a specific available Serve port; a port already used by Serve or Funnel is rejected without changing that route.

To run the browser acceptance suite through the tailnet HTTPS entry point, set the URL printed by `tailnet:up`:

```sh
PLAYWRIGHT_BASE_URL="https://<machine>.<tailnet>.ts.net:<port>/" npm run test:e2e:tailnet
```

The suite runs against the existing app and does not start or stop Compose services. Also verify from a device outside the tailnet that the URL is inaccessible.

## Configuration checklist

- **Local development (required):** Install Node.js and npm, then run `npm install`. `npm run dev` starts the Vite app and local Express API. `npm run build` type-checks and builds the app. No `.env` file, GCP project, model credential, or provider selection is needed for the mission and evidence-preview paths.
- **Race Engineer provider (optional):** Set `ENGINEER_PROVIDER_ENABLED=true` and a valid HTTPS `ENGINEER_PROVIDER_URL` in the API environment; set `ENGINEER_PROVIDER_API_KEY` when the provider requires a bearer key. The server sends a JSON request with the question, detail preference, retrieved reviewed records, and only selected Mission/telemetry context after a supported user submission. The provider should return `{"answer":"…","recordIds":["…"]}`. The server discards IDs outside the retrieved records and resolves source links and metadata itself. With the provider disabled or when it fails, the app uses a prepared response. Never put provider credentials in client-side variables.
- **GCP demo hosting (optional):** Cloud project and deployment settings are only needed for the optional hosted profile. Keep them separate from local development settings; no cloud resource is required to run this prototype locally.

Run focused resolved-Compose checks with `npm run test:compose:config`, provider configuration checks with `npm run test:provider:config`, and allowlisted log/rotation checks with `npm run test:service:logs`. Run the app acceptance suite with `npm run test:e2e`. It starts the local frontend and API and uses deterministic mission content. To check the no-provider Compose stack, run `npm run test:e2e:compose`; this builds and starts an isolated Compose project, waits for each service health check, confirms the browser can load the app and the API health endpoint succeeds without provider credentials, then removes only that temporary test stack and its volumes. It leaves a separately running default local profile untouched. If host ports `8080` or `3000` are already in use, override them, for example `WEB_PORT=8081 GRAFANA_PORT=3001 npm run test:e2e:compose`.

## Development documents

- [Inclusive R1 concept](docs/Make-a-Mark-R1-inclusive-AI-concept.md) — product, audience, business, and evaluation requirements.
- [System architecture](docs/architecture.md)
- [Component and container plan](docs/component-and-container-plan.md)
- [R1 development plan](docs/r1-development-plan.md)
- [Eight-step build order with detailed action guides](docs/build-plan/index.md)
- [Base project structure](docs/build-plan/project-structure.md)
- [Consolidated architecture and component design](docs/Make-a-Mark-architecture-and-component.md)
- [Architecture decision record](docs/adr/0002-inclusive-r1-architecture.md)
- [Visual fidelity ledger](docs/design/fidelity-ledger.md)
- [Evidence source review notes](docs/research/evidence-review.md)

The local Compose stack is the default deployment and acceptance profile. The optional hosted demo profile uses Google Cloud Run with an HTTPS load balancer; it is documented separately and is not needed for local development. No Google Cloud project or deployment resources are configured.
