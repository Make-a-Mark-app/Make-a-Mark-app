# Step 1 Define the Environment and Data Contracts

**Outcome:** The team agrees what the R1 app will contain, where it runs, and how mission, demo, evidence, and AI data remain separate. This is a planning and contract step; no cloud project is needed.

## Function

Prepare the existing React/Vite and Express prototype for the R1 additions without adding infrastructure prematurely. The current source starts in `src/App.tsx`, `src/data.ts`, and `server/index.ts`. The [base project structure](project-structure.md) adds empty feature/service folders while preserving these working entry points. Record planned types in one shared contract location so the browser and API use the same names and validation rules.

## Services and tools

| Tool/service | Function | Needed now? |
|---|---|---|
| Node.js and npm | Run the existing frontend/API development commands and type-check/build | Yes |
| Git branch or worktree | Keep R1 work isolated and reviewable | Recommended |
| Docker Desktop/Compose | Run the later local multi-container stack | Needed at Step 5, not for this contract document |
| Google Cloud Console/project | Hosted deployment administration | Not needed for local R1 development |
| Model API credentials | Live model requests | Not needed; fallback path is part of the scope |

## Actions

1. **Record the target scope.** Confirm one fictional freight mission, user-advanced telemetry, limited source-reviewed reports, optional user-invoked Race Engineer, and local Compose services. Mark GCP hosting and hosted model selection as optional deployment choices.
2. **Separate four data classes.** Use distinct types/names for simulated live view, reported impact, illustrative impact placeholder, and mission scenario. Do not derive a real impact score from the other classes.
3. **Define mission configuration.** Include stable mission/config IDs, scenario title, fictional context, finite choices, deterministic feedback/result, and retry behavior. Exclude telemetry and evidence fields from the mission outcome contract.
4. **Define the telemetry fixture.** Specify fixture version, ordered step ID, simulated timestamp, status (`updating`, `delayed`, `stale`, `unavailable`), and zero or more typed signals with names and units. State how unavailable values are represented; never infer a missing value.
5. **Define evidence and source records.** Give records a stable ID, pillar/topic, claim wording/type, value/unit when published, reporting period, source title/edition/date, public URL, page/location when available, review state, review note, and limitations. Keep source documents and illustrative UI placeholders separate.
6. **Define the Engineer request/response.** Request: bounded question, concise/detailed choice, optional fictional mission summary, optional selected telemetry snapshot. Response: mode (`grounded_ai`, `prepared_fallback`, `no_answer`), answer, limitation, and record IDs/citation metadata resolved by the API.
7. **Set privacy and retention rules.** No account or server-side player history. Fixture snapshots exist only in the user’s current view/request; questions, prompts, and demo values are not persisted or logged.
8. **Capture architecture decisions.** Record that R1 uses file-backed records and exact/keyword lookup, not Postgres, Redis, pgvector, ingestion workers, or continuous model narration.

## Deliverables

- Versioned type/schema notes for mission, telemetry, evidence, and Engineer request/response.
- A source review checklist and rules for the four visible data labels.
- A configuration checklist separating local variables from optional GCP settings.

## Completion checks

- A reader can tell which values are fictional, simulated, source-reported, and illustrative.
- Every evidence claim has a source and reporting period or a documented absence of one.
- The model contract cannot invent or rewrite mission rules, telemetry values, source records, or citations.
- The app’s core path can be described without mentioning GCP, a database, or an LLM credential.

## Handoff

Proceed to [Step 2](step-02-frontend-and-mission.md) with approved labels, types, and fixed mission rules. Update contracts before changing UI or API behavior if a later step uncovers a gap.
