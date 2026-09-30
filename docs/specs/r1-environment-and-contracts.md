# R1 Environment and Data Contracts

## Problem Statement

The R1 prototype combines a fictional freight mission, simulated live view, source-reviewed evidence, illustrative impact placeholders, and an optional Race Engineer. Without explicit boundaries and shared contracts, users could mistake fictional or simulated values for AMF1 operations or reported impact, while the browser and API could interpret the same data differently. The team needs a versioned contract and environment plan before changing UI or API behavior.

## Solution

Define R1 as a local-first React/Vite application with a small Express API for the optional Race Engineer. Add shared, runtime-validated contracts used by both browser and API. Keep mission scenarios, simulated live view, reported impact, and illustrative impact placeholders as separate data classes. Use file-backed mission and evidence content, finite user-advanced telemetry fixtures, and exact/keyword evidence lookup. Keep provider credentials and optional GCP deployment settings out of the local core path.

## User Stories

1. As a first-time visitor, I want to enter a fictional freight mission without signing in, so that I can use the prototype without creating an account.
2. As a visitor, I want the product to identify the mission as fictional, so that I do not confuse game outcomes with AMF1 operations or measured impact.
3. As a visitor, I want to enter the mission, simulated live view, or evidence library directly, so that I can choose the experience that interests me.
4. As a mission participant, I want three finite route choices (Air, Sea, and Road) with fixed fictional feedback, so that the mission is repeatable and understandable.
5. As a mission participant, I want each route to present a trade-off rather than a right/wrong score, so that a route choice does not claim to measure impact or performance.
6. As a mission participant, I want retry to reset the active route and completion state while preserving unrelated discoveries, so that I can replay the scenario without losing the rest of my local recap.
7. As a visitor, I want mission definitions and outcomes to have stable identifiers, so that the browser and API refer to the same scenario configuration.
8. As a visitor, I want to advance simulated live view snapshots manually, so that demo data never appears to be a live AMF1 feed.
9. As a visitor, I want simulated timestamps to advance with the selected fixture step, so that snapshots are reproducible and independent of the computer clock.
10. As a visitor, I want each simulated live view snapshot to state whether it is updating, delayed, stale, or unavailable, so that I can interpret the feed state.
11. As a visitor, I want signal names, numeric values, and units shown together, so that simulated values are not ambiguous.
12. As a visitor, I want unavailable signal values represented as unavailable rather than guessed, so that missing fixture data cannot be mistaken for a measurement.
13. As a visitor, I want simulated live view clearly separated from reported impact, so that an operational-looking demo value is not presented as a report result.
14. As a visitor, I want illustrative impact placeholders labeled beside their values, so that sample values cannot be mistaken for live or measured results.
15. As a visitor, I want each reported impact claim to link to a public source, so that I can inspect the evidence behind it.
16. As a visitor, I want each claim to show its claim type, reporting period, review state, and limitations, so that targets and methods are not presented as achieved results.
17. As a visitor, I want Environment, Belong, and Community evidence kept distinct from Governance review-method material, so that governance content is not confused with an impact pillar.
18. As a content reviewer, I want one source-backed claim per evidence record, so that review status and provenance apply to a precise statement.
19. As a content reviewer, I want to record source title, edition/date, public URL, location when available, review note, and limitations, so that every published claim can be traced and interpreted.
20. As a content reviewer, I want a reporting period recorded or its absence stated explicitly, so that a missing period is not silently inferred.
21. As a content reviewer, I want to check wording, claim type, period, value and unit, source location, and limitations before marking a claim reviewed, so that published evidence has a consistent review standard.
22. As a visitor, I want only reviewed claims shown as reported impact, so that illustrative, pending, or rejected content cannot appear as verified evidence.
23. As a visitor, I want illustrative samples kept separate from source documents and reviewed claims, so that interface examples do not appear to be factual evidence.
24. As a visitor, I want to search or browse a limited evidence library using exact or keyword lookup, so that I can find relevant reviewed claims without implying complete coverage.
25. As a visitor, I want to ask the optional Race Engineer a question only when I choose to submit it, so that the application does not narrate telemetry or send questions automatically.
26. As a visitor, I want my question limited to 500 characters and an option for concise or detailed responses, so that requests and answers have predictable bounds.
27. As a visitor, I want to choose whether to include the fictional mission summary or a selected telemetry snapshot, so that only context I select is sent with that request.
28. As a visitor, I want a grounded response to cite only records resolved by the API, so that citation metadata cannot be invented by a model.
29. As a visitor, I want the Engineer to explain approved records and selected fictional context without changing mission rules, telemetry values, evidence, or citations, so that authoritative demo data remains stable.
30. As a visitor, I want a prepared fallback when a provider is unconfigured or unavailable, so that the core experience remains useful without credentials or network model access.
31. As a visitor, I want an explicit no-answer response when approved records cannot support an evidence question, so that the Engineer does not fill gaps with unsupported claims.
32. As a visitor, I want question, prompt, and demo-value data neither persisted nor logged, so that using the optional explanation does not create a server-side history.
33. As a visitor, I want only a small mission/discovery recap stored in this browser, with an in-app clear/reset action, so that I can review this device's session and remove it when I choose.
34. As a visitor, I want the mission and evidence library to remain usable when the API or hosted provider is unavailable, so that those core paths do not depend on AI credentials.
35. As a keyboard or touch user, I want the experience to remain operable without a pointer and to respect reduced-motion preferences, so that I can use the prototype with different input and motion needs.
36. As a visitor who does not want to drive, I want an untimed non-driving route through the experience, so that the mission is accessible without game controls or time pressure.
37. As a developer, I want one set of runtime-validated contracts shared by the browser and API, so that both sides enforce the same names and validation rules.
38. As a developer, I want the local core path to run with Node.js and npm and without GCP settings or model credentials, so that development does not require cloud setup.
39. As a developer, I want optional model-provider settings separated from local and GCP configuration, so that enabling a provider does not make it a prerequisite for local development.
40. As a developer, I want the planned local Compose profile and optional hosted profile documented separately from this contract step, so that infrastructure is introduced only at its planned implementation step.

## Implementation Decisions

- **R1 scope:** One fictional freight mission; user-advanced simulated live view; a limited, manually source-reviewed evidence library; and an optional, user-invoked Race Engineer. R1 does not connect to AMF1 telemetry or internal systems.
- **Environment:** Use the existing React/Vite browser application and Express/TypeScript API. Node.js and npm support local development and build. Docker Desktop/Compose belongs to the later local-stack step. Hosted GCP configuration is optional and is not required for the core path.
- **Shared contracts:** Place shared contract definitions in a root-level `shared/contracts` module usable by the browser and API. Include runtime validation as well as TypeScript types. Validate incoming Engineer requests and file-backed mission/evidence/fixture records at the API boundary or load boundary before use.
- **Domain language and visible labels:** Use the project concepts `Mission scenario`, `Simulated live view`, `Reported impact`, `Illustrative impact placeholder`, `Source-reviewed evidence`, `Prepared answer`, and `Discovery`. Keep the agreed visible labels distinct: “Simulated telemetry,” “Source-reported claim,” “Illustrative placeholder,” and “Fictional mission result.” Do not say or imply that AMF1 endorsed a claim unless it actually did.
- **Mission scenario contract:** Include stable mission and configuration IDs, scenario title, fictional context, finite choices, deterministic choice feedback and outcome, and retry behavior. Use the existing Air, Sea, and Road choice IDs as the initial finite set. Outcomes are fictional trade-offs, not scores or impact calculations. Exclude telemetry and evidence fields from the mission outcome.
- **Discovery retention:** The browser may retain the small mission/discovery recap on that device until the user clears it through an in-app action. Retry resets the active mission choice/completion while preserving unrelated discoveries. Do not persist server-side player history.
- **Simulated live view contract:** A fixture includes its version, ordered step ID, fixed ISO 8601 timestamp with explicit UTC offset, snapshot status, and zero or more typed signals. Snapshot status is one of `updating`, `delayed`, `stale`, or `unavailable`. Signals contain a name, numeric value or `null`, and unit. A null value means unavailable; never infer or substitute a reading. Advance through fixed snapshots by user action, independently of the system clock. Exact signal catalog and sample values are fixture content to be selected during the later content/UI step.
- **Evidence contract:** Each record represents one claim and includes stable ID, pillar/topic, claim wording and type, optional published value/unit, reporting period or an explicit statement that none is provided, source title/edition/date, public URL, page/location when available, review state, review note, and limitations. Keep `report_result`, `target`, and `method` distinct. Reported-claim topics are Environment, Belong, and Community; Governance is reserved for review-method material.
- **Source review:** Prefer public government or institutional primary sources. Reputable secondary sources may be used when needed, with limitations recorded. Review each claim manually against its source before publication. Review checks wording, claim type, reporting period, value/unit, source location, and limitations. Use review states `illustrative`, `pending_review`, `reviewed`, and `rejected`; only `reviewed` records qualify as reported impact. Keep illustrative UI placeholders separate from source documents and evidence records.
- **Evidence retrieval:** Keep records in versioned local files. Use exact or keyword lookup for R1. Do not imply complete evidence coverage.
- **Race Engineer request:** Accept a question of 1–500 characters, concise/detailed preference, and optional fictional mission summary and/or selected telemetry snapshot. Context is sent only when the user selects it and only for the current request. The provider is called only on explicit submission through the API.
- **Race Engineer response:** Return mode (`grounded_ai`, `prepared_fallback`, or `no_answer`), answer, limitation, and citations/related record identifiers resolved by the API. Citation metadata comes from retrieved approved records and includes record ID and source title/date/URL/location where available. A model may explain bounded records and selected fictional context; it cannot rewrite mission rules, telemetry values, source records, or citations. Use `prepared_fallback` when the provider is unconfigured or unavailable and a prepared response applies. Use `no_answer` when approved evidence cannot support the question.
- **Privacy and logging:** Do not persist or log questions, prompts, selected telemetry snapshots, or demo values. Do not add accounts or server-side player history. Provider credentials remain server-side when configured.
- **Configuration:** Document local runtime/build requirements separately from optional model-provider and GCP settings. The local core must work without GCP credentials, a model API key, or a hosted model selection.
- **Architecture boundaries:** Keep mission scenario, simulated live view, reported impact, and illustrative impact placeholder as distinct data classes. Do not derive real impact scores from mission, telemetry, or placeholder data. Do not add Postgres, Redis, pgvector, automatic ingestion workers, continuous model narration, or a model-serving container. Local Compose observability and optional hosted deployment remain later architecture steps described by the accepted ADR.
- **Accessibility:** Preserve keyboard and touch operation, reduced-motion support, user-selected explanation detail, direct entry routes, and an untimed non-driving route.

## Testing Decisions

- **Proposed seam:** Use one black-box Playwright acceptance seam around the running Vite frontend and Express API, with the provider disabled and deterministic local fixture/content files. This is the highest single seam that exercises browser/API contract integration and user-visible behavior. No existing test framework or test files are present; Playwright acceptance infrastructure would be new. This uses the recommended seam because no response to the seam check arrived after the optional clarification window.
- **Behavior over internals:** Assert what a visitor can observe and what crosses the HTTP/storage boundary. Avoid tests coupled to private React component structure, handler names, filesystem layout, or implementation-specific helpers.
- **Mission coverage:** Verify all three route choices return their fixed fictional feedback, do not produce scores, and retry resets only the active mission state while preserving unrelated local discoveries.
- **Simulated live view coverage:** Verify user advancement selects ordered fixed snapshots; timestamps do not follow wall-clock time; status labels cover all four states; numeric values include units; and unavailable values render as unavailable without a substitute.
- **Evidence coverage:** Verify reviewed claims display their source, type, period, review state, and limitations; targets/methods remain distinct from report results; only reviewed claims enter reported-impact views; and illustrative examples remain clearly labeled and separate.
- **Engineer coverage:** Exercise valid and invalid 1–500-character requests, concise/detailed preference, explicit context inclusion/exclusion, API-resolved citations, provider-disabled fallback, unsupported-question no-answer, and the absence of persisted/logged question, prompt, snapshot, and demo-value data.
- **Shared contract coverage:** Through the app/API boundary, verify malformed requests and invalid file-backed records are rejected or safely withheld before they can be presented as reviewed evidence or authoritative telemetry.
- **Accessibility coverage:** Verify core routes can be reached and operated with keyboard and touch-oriented controls, reduced-motion preference is respected, and the non-driving route has no timer requirement.
- **Prior art:** There are currently no tests or test scripts to extend. Existing behavior is implemented in the React/Vite UI and Express API; the acceptance suite should exercise those public boundaries together.

## Out of Scope

- AMF1 telemetry, internal systems, or any live operational data connection.
- GCP project creation, Cloud Run/load-balancer deployment, or hosted environment provisioning.
- Docker Compose implementation and local Grafana/Loki/Prometheus/Alloy services; these belong to a later step.
- Postgres, Redis, pgvector, database-backed histories, or persistent player accounts/profiles.
- Automated source scraping/ingestion, vector search, or claims of complete evidence coverage.
- Continuous AI narration, model-serving containers, or a required model API credential.
- Real environmental/social impact scores derived from mission outcomes, simulated telemetry, or illustrative placeholders.
- New mission branches, route scoring, timed driving requirements, or personalization inferred from age or user behavior.
- Selecting final telemetry signal names/sample values or populating the final source-reviewed report subset; those are content choices for later steps.

## Further Notes

- This spec records the Step 1 environment and contract decisions; it does not claim the planned contracts, fixtures, evidence subset, hosted model, Compose stack, or observability services are already implemented.
- The accepted ADR keeps the local Compose profile as the later default run profile and allows an optional hosted GCP demo profile. Neither requires a cloud project for this step.
- “Source-reviewed” means checked against a public source for inclusion. It does not mean AMF1-approved or formally endorsed.
