# Make A Mark R1 Project Structure

**Status:** Initial project layout reference. R1 mission, evidence, telemetry, Race Engineer, and local Compose features have since been implemented.

## Existing application entry points

The current Vite/React and Express prototype remains in place:

- `src/main.tsx` mounts the React application.
- `src/App.tsx` contains the current app shell and prototype views.
- `src/data.ts` contains current illustrative prototype data.
- `src/styles.css` contains existing styles.
- `server/index.ts` starts the current Express API.
- `vite.config.ts` proxies local `/api` calls to Express.

The scaffold keeps these entry points working while reserving clearer boundaries for R1 work. Do not move existing files until a specific implementation step updates imports and verifies the running app.

## Target layout

```text
.
├── package.json                    # existing scripts and dependencies
├── index.html                      # existing Vite HTML shell
├── vite.config.ts                  # existing /api development proxy
├── tsconfig*.json                  # existing app/server TypeScript configs
├── docs/
│   └── build-plan/
│       ├── index.md
│       ├── project-structure.md
│       └── step-01...step-08-*.md
├── src/
│   ├── main.tsx                    # existing browser entry
│   ├── App.tsx                     # existing app; future shell/composition
│   ├── data.ts                     # existing prototype data during transition
│   ├── app/                        # app composition, routing, shared shell
│   ├── features/
│   │   ├── mission/                # fictional deterministic freight mission
│   │   │   ├── components/
│   │   │   ├── data/
│   │   │   └── types/
│   │   ├── telemetry/              # user-advanced simulated fixture and panel
│   │   │   ├── components/
│   │   │   ├── data/
│   │   │   └── types/
│   │   ├── evidence/               # record browsing, source detail, labels
│   │   │   ├── components/
│   │   │   ├── data/               # versioned source-reviewed record subset
│   │   │   └── types/
│   │   └── race-engineer/          # optional question and answer experience
│   │       ├── components/
│   │       └── types/
│   └── shared/
│       ├── api/                    # typed browser API client
│       ├── components/             # reusable accessible UI
│       ├── hooks/
│       ├── lib/
│       └── types/                  # only truly cross-feature contracts
├── server/
│   ├── index.ts                    # existing Express entry
│   ├── routes/                     # HTTP route handlers
│   ├── middleware/                 # validation, limits, error mapping
│   ├── services/
│   │   ├── evidence/               # exact/keyword lookup and citations
│   │   └── race-engineer/          # request policy and response modes
│   ├── providers/                  # provider-neutral hosted LLM adapter
│   ├── data/                       # server-only static configuration if needed
│   └── observability/              # privacy-safe logging and metrics
├── deploy/
│   ├── local/
│   │   ├── compose.yaml             # future local service orchestration
│   │   ├── web/                    # future web image build context
│   │   ├── api/                    # future API image build context
│   │   ├── nginx/
│   │   ├── prometheus/
│   │   ├── loki/
│   │   ├── alloy/
│   │   └── grafana/provisioning/
│   └── gcp/                        # optional Cloud Build/deployment config
└── public/                         # existing static assets
```

Some `.gitkeep` files preserve reserved directories. The local runtime configuration now lives under `deploy/local`; no real credentials are committed.

## Ownership boundaries

| Area | Owns | Must not own |
|---|---|---|
| `features/mission` | Fictional route, deterministic rules/result, retry | Telemetry-derived or impact-derived score; model-authored rules |
| `features/telemetry` | Finite user-advanced demo steps and signal definitions | Live AMF1 connection; impact calculation |
| `features/evidence` | Source-reviewed record display and source metadata | Unreviewed claims, placeholder metrics treated as report claims |
| `features/race-engineer` | User question, detail choice, answer-mode/citation presentation | Direct browser-to-model request or free-form source citation |
| `server/services` | Validation, bounded retrieval, policy, citation resolution | User profile persistence or raw-question logging |
| `server/providers` | Outbound provider protocol and timeout/error mapping | Access to unrestricted browser state or authority to edit records |
| `deploy/local` | Local Compose service configs and observability provisioning | Public service exposure beyond the web app by default |
| `deploy/gcp` | Optional hosted build and routing configuration | A requirement for local development |

## Scaffold rules

- Keep the source-reviewed record subset in version control and keep runtime state outside it.
- Use the shared types folder only for contracts actually used by more than one feature or by both browser and API. Avoid creating a shared package prematurely.
- Do not create database, Redis, vector-search, ingestion, account, or telemetry-connector directories for R1.
- Store local secrets in ignored environment files; use workload identity/Secret Manager only in the optional hosted profile.
- Add implementation files in the step order from the [build index](index.md), and remove `.gitkeep` from a folder when its real files are added.
