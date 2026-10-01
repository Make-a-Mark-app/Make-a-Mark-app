# Make A Mark Impact Drive

An inclusive hackathon R1 prototype plan for one fictional freight mission, a manually advanced live-style demo view, a limited source-reviewed AMF1 evidence library, and an optional Race Engineer.

## Current prototype status

The current local app is React/Vite with an Express API. The fictional freight mission and its deterministic outcome use shared runtime-validated contracts in the browser and API. A small Discovery recap stays in this browser and can be cleared from the summary page. The evidence library includes three source-reviewed claims from the official Make A Mark ESG Report 2024, with scope notes and limitations; illustrative samples remain separate. Simulated telemetry advances through a fixed, versioned fixture. The Race Engineer retrieves a bounded set of reviewed records, resolves citations from those records, and can optionally call a server-configured provider. The default local Compose stack includes the production web/API containers and Grafana, Loki, Prometheus, and Alloy observability services.

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

Docker Desktop with Compose is required. From the repository root, optionally copy `.env.example` to `.env` and set a local Grafana password. The Race Engineer provider values stay blank by default; no model key, GCP project, or hosted provider is required.

```sh
cp .env.example .env
docker compose -f deploy/local/compose.yaml up --build
```

Open `http://localhost:8080`. The web/API health endpoint is `http://localhost:8080/api/health`; Grafana is bound to `http://127.0.0.1:3000` (default local login: `admin` / `admin`). Prometheus, Loki, API, and Alloy have no published host ports. Grafana includes a provisioned dashboard for API availability, latency, validation failures, Engineer response modes, provider errors, log volume, and Prometheus storage. API logs include only the route, method, status class, response mode, duration, and sanitized provider error category; they exclude questions, prompts, evidence text, selected context, simulated values, and credentials.

Stop the stack with `docker compose -f deploy/local/compose.yaml down`; named Grafana, Loki, and Prometheus state is preserved. To remove only those local observability volumes, run `docker compose -f deploy/local/compose.yaml down -v`. Neither command changes source files, the versioned demo fixture, or browser discoveries. Clear browser `localStorage` separately to reset discoveries. Nginx publishes only the web port (default `8080`), while Grafana is loopback-bound (default `3000`).

## Configuration checklist

- **Local development (required):** Install Node.js and npm, then run `npm install`. `npm run dev` starts the Vite app and local Express API. `npm run build` type-checks and builds the app. No `.env` file, GCP project, model credential, or provider selection is needed for the mission and evidence-preview paths.
- **Race Engineer provider (optional):** Set an HTTPS `ENGINEER_PROVIDER_URL` and, when needed, `ENGINEER_PROVIDER_API_KEY` in the server environment. The server sends a JSON request with the question, detail preference, at most three retrieved reviewed records, and only selected Mission/telemetry context. The provider should return `{"answer":"…","recordIds":["…"]}`. The server discards IDs outside the retrieved records and resolves source links and metadata itself. With no provider configured or when it fails, the app uses a prepared response. Never put provider credentials in client-side variables.
- **GCP demo hosting (optional):** Cloud project and deployment settings are only needed for the optional hosted profile. Keep them separate from local development settings; no cloud resource is required to run this prototype locally.

Run the agreed full-app acceptance suite with `npm run test:e2e`. It starts the local frontend and API and uses deterministic mission content.

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
