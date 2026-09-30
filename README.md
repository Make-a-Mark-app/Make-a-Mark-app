# Make A Mark Impact Drive

An inclusive hackathon R1 prototype plan for one fictional freight mission, a manually advanced live-style demo view, a limited source-reviewed AMF1 evidence library, and an optional Race Engineer.

## Current prototype status

The current local app is React/Vite with an Express API. The fictional freight mission and its deterministic outcome use shared runtime-validated contracts in the browser and API. A small Discovery recap stays in this browser and can be cleared from the summary page. The evidence library includes three source-reviewed claims from the official Make A Mark ESG Report 2024, with scope notes and limitations; illustrative samples remain separate. The R1 telemetry fixture, hosted model integration, Docker Compose, and Grafana observability services remain planned work. Documentation describes planned behavior; it is not a claim that those features are implemented.

## R1 boundaries

- No AMF1 telemetry or internal-system access is needed.
- Synthetic telemetry and its timestamps are manually advanced demo values.
- Mission outcomes are fictional and do not calculate environmental or social impact.
- Reported claims require source, reporting period, and limitations.
- Illustrative impact placeholders must carry “Illustrative demo data — not live AMF1 data or a measured impact result.”
- The Race Engineer calls an optional hosted provider only when a user asks a question. Provider credentials remain server-side; prepared fallback and no-answer responses remain available.
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

## Configuration checklist

- **Local development (required):** Install Node.js and npm, then run `npm install`. `npm run dev` starts the Vite app and local Express API. `npm run build` type-checks and builds the app. No `.env` file, GCP project, model credential, or provider selection is needed for the mission and evidence-preview paths.
- **Hosted model (optional, later step):** Provider credentials belong on the server only. The app and prepared Race Engineer response remain available when a provider is not configured. Provider-specific settings are documented when that integration is implemented.
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

Docker Compose and Grafana instructions are target plans. They become runnable after the implementation adds the described files and configuration. An optional hosted demo profile uses Google Cloud Run with an HTTPS load balancer; it is documented separately and is not needed for local development. No Google Cloud project or deployment resources are configured yet.
