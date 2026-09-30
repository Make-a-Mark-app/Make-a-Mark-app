# Make A Mark R1 Development Plan

**Status:** Implementation plan only. No R1 app implementation is included in this document update. The product requirements and business/evaluation context remain in the [inclusive R1 concept](Make-a-Mark-R1-inclusive-AI-concept.md).

## Delivery boundary

Build one inclusive hackathon prototype with one fictional freight mission, a manually advanced live-style telemetry fixture, a limited source-reviewed evidence library, and an optional Race Engineer. Do not connect AMF1 systems, require sign-in, collect player profiles, or imply that demo telemetry is an impact measure. Keep the app usable without credentials or provider availability.

The key trust labels are fixed requirements:

- Simulated session values and timestamps are visibly labeled simulated.
- Every fictional mission result is labeled as a mission scenario.
- Every impact placeholder displays: “Illustrative demo data — not live AMF1 data or a measured impact result.”
- Reported AMF1 claims show their real source and reporting period. Source review for the prototype must not be represented as AMF1 approval unless AMF1 has granted it.

## Implementation sequence

Use the eight standalone guides in [Build Order](build-plan/index.md). Each guide defines its purpose, sub-step actions, required services, outputs, handoff, and completion checks.

| Order | Guide | Function |
|---|---|---|
| 1 | [Environment and data contracts](build-plan/step-01-environment-and-contracts.md) | Set project boundaries and shared data/request schemas |
| 2 | [Frontend and mission](build-plan/step-02-frontend-and-mission.md) | Build accessible entry paths and deterministic fictional mission |
| 3 | [Telemetry and evidence](build-plan/step-03-telemetry-and-evidence.md) | Add user-advanced fixture states and source-reviewed records |
| 4 | [API and Race Engineer](build-plan/step-04-api-and-race-engineer.md) | Add bounded search, optional model adapter, citations, and fallback |
| 5 | [Local containers and observability](build-plan/step-05-local-containers-and-observability.md) | Package Docker Compose stack and local Grafana signals |
| 6 | [Optional Google Cloud deployment](build-plan/step-06-google-cloud-deployment.md) | Host a shareable demo on Cloud Run behind HTTPS routing |
| 7 | [Optional cloud model and operations](build-plan/step-07-cloud-model-and-operations.md) | Configure Vertex/other provider, IAM/secrets, logs, and alerts |
| 8 | [Inclusive acceptance and rehearsal](build-plan/step-08-acceptance-and-rehearsal.md) | Verify accessibility, trust, failures, operations, and demo repeatability |

Steps 6 and 7 are optional for local-only work. Step 8 applies to either run profile.
## Acceptance matrix

### Mission and entry

- A first-time user can enter the freight mission or open the evidence library directly.
- The mission contains exactly one fictional freight scenario. Choosing or completing it never claims an AMF1 operational result or real-world impact.
- Mission start, retry, and completion work without the API or model provider.

### User-advanced telemetry

- Each manual step advances to a deterministic fixture snapshot with a signal definition, unit, and simulated timestamp.
- User can reach updating, delayed, stale, and unavailable states on demand; no wall-clock wait is required to demonstrate them.
- Missing or malformed values render as unavailable, not as inferred values.
- Every view that shows synthetic telemetry identifies it as simulated and not AMF1 feed data.
- Telemetry is never used to compute an emissions, inclusion, or community-impact result.

### Evidence and AI

- The library shows only the available reviewed subset of Environment, Belong, and Community records and exposes source, edition/date, reporting period, location where available, review state, and limitations.
- Unsupported, disputed, or absent evidence produces a limitation/no-answer response, not a model guess.
- The provider is called only after explicit user submission, with only the relevant retrieved records, mission context, and selected demo summary.
- Provider credentials remain server-side. The API validates response shape and citation IDs and fills citation fields from the record file.
- With no credentials, an unavailable provider, or an API error, the interface presents the prepared fallback or no-answer path; mission and library remain usable.
- The answer starts concise; a user-selected detail option yields a deeper explanation. The interface does not infer skill or preferences from age.

### Inclusion and privacy

- Keyboard and touch controls can reach all required actions; focus remains visible.
- Reduced-motion preferences are respected and an untimed non-driving route is available.
- No sign-in, profile, or server-side session is needed. Discovery state remains in this browser.
- Requests, prompts, source passages, and demo values are not written to standard logs or metrics.

### Operations

- Clean `docker compose up --build` starts the web/API and local observability stack; health checks report service state.
- Only the web interface is exposed to the host; Grafana is loopback-bound and log/metrics APIs are private.
- `down` preserves named observability data; the documented full reset removes only resettable service volumes. Browser discoveries and versioned sources are managed separately.

## Directional desirability check

Use a small convenience sample spanning newer and long-time fans and the concept’s age ranges (18–35, 36–54, 55+). This is a usability and comprehension check, not a representative survey. Ask participants to understand one simulated indicator, complete or bypass the mission, and find the source behind one report claim. Record task completion, source finding, understanding of simulated-versus-reported information, perceived relevance, accessibility problems, and willingness to return. Report sample size and limitations; do not infer population demand or convert this sample into market sizing.

## Demo script and observability

The demo must be reproducible without external AMF1 access. For local rehearsal use Docker Compose and Grafana; for a hosted rehearsal use the optional GCP profile and Cloud Logging/Monitoring. In either profile: enter through either supported route, advance each telemetry state, make a mission choice, inspect a source record, and ask a supported and unsupported question. Rehearse no-provider and provider-error behavior. Do not present a scripted demonstration as a live feed.

Operational dashboards show API availability, latency, response modes, validation failures, and provider error classes. They do not contain personal profiles or user question text.

## Handoff boundary

After this plan and the architecture documents are reviewed, the future implementation task should build only the R1 scope above. Any real AMF1 data feed, production deployment, accounts, persistent player history, additional mission, or post-R1 roadmap requires a separate decision.
