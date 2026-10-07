# Make A Mark Impact Drive

An inclusive hackathon R1 prototype plan for one fictional freight mission, a manually advanced live-style demo view, a limited source-reviewed AMF1 evidence library, and an optional Race Engineer.

## Current prototype status

The current local app is React/Vite with an Express API. The fictional freight mission and its deterministic outcome use shared runtime-validated contracts in the browser and API. A small Discovery recap stays in this browser and can be cleared from the summary page. The evidence library contains six source-reviewed claims from the official 2025 Make A Mark report, with reviewer details, source locations, scope notes, and limitations; illustrative samples remain separate. Simulated telemetry offers direct selection of four fixed feed states, each using speed, gear, throttle, and brake signals. The Race Engineer retrieves a bounded set of reviewed records, generates an answer through a server-configured model provider, and resolves citations from those records. The default local Compose stack includes the production web/API containers and Grafana, Loki, Prometheus, and Alloy observability services.

The homepage is a four-card entry point for the decision game, an embedded partner pit-stop film with a source-linked sustainability caption, official team reports and articles, and a first-campaign reward preview. Completing the freight mission and its learning check opens a proposed planting contribution and an illustrative 20% merchandise offer, followed by an optional referral link and two-question check. A local demo API aggregates starts, finishes, copy actions, referred starts, simulated offer uses, and survey answers across browsers at `/pilot/metrics`. No partner fulfillment, actual discount redemption, or real planting is connected. The earlier carbon-coin exchange flow has been removed.

## R1 boundaries

- No AMF1 telemetry or internal-system access is needed.
- Synthetic telemetry and its timestamps are manually advanced demo values.
- Mission outcomes are fictional and do not calculate environmental or social impact.
- Reported claims require source, reporting period, and limitations.
- Illustrative impact placeholders must carry “Illustrative demo data — not live AMF1 data or a measured impact result.”
- The Race Engineer calls a hosted provider only after a user submits a supported question. Provider credentials remain server-side; prepared fallback and no-answer responses remain available when generation is not configured or fails. Questions and selected context are not persisted or logged.
- No account or player profile is required. The mission and evidence library remain usable when the API/provider is unavailable.

## Run the current app

```sh
npm install
npm run dev
```

Open `http://localhost:5180`. This site uses its own development ports: Vite on `5180` and the TypeScript API on `4180`. The Vite proxy points only to `127.0.0.1:4180`, separate from the retired prototype defaults, and refuses to silently move to another frontend port.

For a production build:

```sh
npm run build
npm start
```

## Run the full local Compose stack

Docker Desktop with Compose is required. From the repository root, copy `.env.example` to `.env`, set a local Grafana password, and set `KIRA_API_KEY` to enable generated Race Engineer answers. The mission and evidence library remain usable without a model key.

```sh
cp .env.example .env
docker compose -f deploy/local/compose.yaml up --build
```

Open `http://localhost:8080`. The web/API health endpoint is `http://localhost:8080/api/health`; Grafana is bound to `http://127.0.0.1:3000` (default local login: `admin` / `admin`). Prometheus, Loki, API, and Alloy have no published host ports. Grafana includes a provisioned dashboard for API availability, latency, validation failures, Engineer response modes, provider errors, log volume, and Prometheus storage. API logs include only the route, method, status class, response mode, duration, and sanitized provider error category; they exclude questions, prompts, evidence text, selected context, simulated values, and credentials.

Stop the stack with `docker compose -f deploy/local/compose.yaml down`; named Grafana, Loki, and Prometheus state is preserved. To remove only those local observability volumes, run `docker compose -f deploy/local/compose.yaml down -v`. Neither command changes source files, the versioned demo fixture, or browser discoveries. Clear browser `localStorage` separately to reset discoveries. Nginx publishes only the web port (default `8080`), while Grafana is loopback-bound (default `3000`).

## Configuration checklist

- **Local development (required):** From this repository root, install Node.js and npm, then run `npm install` and `npm run dev`. This starts the new site on ports `5180` (web) and `4180` (API). `npm run build` type-checks and builds the app. Copy `.env.example` to `.env` and set `KIRA_API_KEY` to enable generated answers; a GCP project is not needed.
- **Generated Race Engineer answers:** Set `KIRA_API_KEY` in the API environment to use Kira's OpenAI-compatible Chat Completions API with model `gpt-oss-120b`. The server sends the question, detail preference, up to six reviewed records, selected Mission/telemetry context, a 10,000-token output budget, and medium reasoning effort. The model writes a direct answer; reviewed records guide AMF1-specific claims and the server resolves citations from approved records. A custom HTTPS provider can instead use `ENGINEER_PROVIDER_URL` and, when needed, `ENGINEER_PROVIDER_API_KEY`; it should return `{"answer":"…","recordIds":["…"]}`. If no provider is configured or generation fails, the app returns a prepared fallback. Credentials stay server-side and must never be put in browser variables.
- **GCP demo hosting (optional):** Cloud project and deployment settings are only needed for the optional hosted profile. Keep them separate from local development settings; no cloud resource is required to run this prototype locally.

Run the app acceptance suite with `npm run test:e2e`. It starts the local frontend and API and uses deterministic mission content. To run the same browser acceptance suite against the no-provider Compose stack, run `npm run test:e2e:compose`; this builds and starts an isolated Compose project, waits for each service health check, runs the app tests against the published web port, then removes only that temporary test stack and its volumes. It leaves a separately running default local profile untouched. If host ports `8080` or `3000` are already in use, override them, for example `WEB_PORT=8081 GRAFANA_PORT=3001 npm run test:e2e:compose`.

## Development documents

- [Inclusive R1 concept](docs/Make-a-Mark-R1-inclusive-AI-concept.md) — product, audience, business, and evaluation requirements.
- [System architecture](docs/architecture.md)
- [Component and container plan](docs/component-and-container-plan.md)
- [R1 development plan](docs/r1-development-plan.md)
- [Nine-step build order with detailed action guides](docs/build-plan/index.md)
- [Base project structure](docs/build-plan/project-structure.md)
- [Consolidated architecture and component design](docs/Make-a-Mark-architecture-and-component.md)
- [Architecture decision record](docs/adr/0002-inclusive-r1-architecture.md)
- [Visual fidelity ledger](docs/design/fidelity-ledger.md)
- [Evidence source review notes](docs/research/evidence-review.md)
- [First campaign pilot rules and measurement contract](docs/first-campaign-pilot.md)

The local Compose stack is the default deployment and acceptance profile. The optional hosted demo profile uses Google Cloud Run with an HTTPS load balancer; it is documented separately and is not needed for local development. No Google Cloud project or deployment resources are configured.
