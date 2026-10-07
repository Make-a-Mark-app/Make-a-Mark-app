# Step 4: Race Engineer API and bounded explanations

## Problem Statement

People using the Impact Drive prototype need a dependable way to ask about the fictional mission, a selected simulated telemetry snapshot, or the small set of source-reviewed impact records. The Race Engineer should generate natural answers while preserving clear trust boundaries for context, predictable evidence limits, and useful outcomes when its model provider is unavailable.

The API must keep the experience understandable without a hosted model. It must not turn simulated values into AMF1 facts, let a model invent citations or alter approved data, or make mission and evidence browsing depend on the API or a provider.

## Solution

Keep Express as the boundary between the browser, canonical mission/telemetry data, source-reviewed evidence, and hosted model. The Race Engineer accepts one explicitly submitted question with a validated category and optional relevant context. It performs deterministic lookup against reviewed records, then asks the configured model to synthesize a natural answer. General concept questions can use general knowledge; AMF1-specific claims must be supported by retrieved records. Citations and source metadata are resolved by the API.

The API supports Kira's OpenAI-compatible Chat Completions API when `KIRA_API_KEY` is configured and retains the HTTPS provider adapter for compatible custom services. When no provider is configured or a call fails, supported requests receive a prepared fallback; unsupported questions receive a clear no-answer response. Mission and evidence browsing remain usable when the API is unavailable.

## User Stories

1. As a fan, I want to ask a question only after I submit it, so that opening the Engineer or advancing the demo never triggers an unexpected model call.
2. As a fan, I want to identify whether my question concerns mission rules, reported evidence, or simulated telemetry, so that the answer uses the right source and limitations.
3. As a fan, I want mixed or mismatched question categories rejected with a clear prompt to choose one, so that the API does not silently apply the wrong answer rules.
4. As a fan, I want concise explanations by default, so that I can understand an answer quickly.
5. As a fan, I want to choose a detailed explanation, so that I can inspect more context without changing which records support the answer.
6. As a fan, I want the API to enforce answer-length limits, so that concise and detailed responses remain readable and bounded.
7. As a fan, I want factual answers to use only reviewed records retrieved for my question, so that unsupported claims are not presented as reported impact.
8. As a fan, I want general sustainability concepts explained naturally and AMF1-specific claims supported by reviewed records, so that the answer is useful without inventing team facts.
9. As a fan, I want a small, relevant set of matching records used for an explanation, so that answers remain focused and provider context stays bounded.
10. As a fan, I want conflicting evidence to result in a no-answer response with an explanation of the evidence limit, so that the API does not imply the records agree.
11. As a fan, I want citations to link to the source metadata held by the API, so that I can inspect the report and its stated limitations.
12. As a fan, I want citations to include the record title, source, reporting period, and source location when available, so that I can place each claim in context.
13. As a fan, I want the API to reject citations that do not refer to records retrieved for my question, so that invented or unrelated citations are never shown.
14. As a fan, I want a selected fictional mission choice resolved against canonical mission data, so that client-supplied context cannot rewrite mission outcomes.
15. As a fan, I want telemetry explanations to use only the selected canonical demo snapshot and server-controlled signal definitions, so that arbitrary browser values cannot be mistaken for a live feed.
16. As a fan, I want telemetry values clearly labeled as simulated demo data, so that they are not confused with AMF1 telemetry or measured impact.
17. As a fan, I want unavailable telemetry signals to remain unavailable in explanations, so that the API never infers or fabricates a value.
18. As a fan, I want a deterministic prepared answer when reviewed records or selected context clearly support one and no provider is configured, so that the Engineer remains useful offline.
19. As a fan, I want a clear provider-unavailable limitation if a future configured provider fails, so that I know the answer came from the prepared response path.
20. As a fan, I want `no_answer` when a prepared response cannot be supported, so that a provider failure does not lead to speculation.
21. As a fan, I want mission and evidence browsing to continue when the API is unavailable, so that one service failure does not block the core experience.
22. As a fan, I want a clear API-unavailable message in the Engineer, so that I know why I cannot submit a question.
23. As a fan, I want no automatic retries after an API or provider failure, so that a single submission does not create duplicate work or unexpected provider usage.
24. As a fan, I want a valid no-answer or prepared-fallback response returned as a normal API result, so that the browser can render expected answer modes consistently.
25. As a fan, I want malformed requests and oversized requests rejected clearly, so that invalid or excessive input cannot destabilize the API.
26. As a fan, I want the question and selected context discarded after the response, so that the prototype does not create a conversation history or player profile.
27. As a fan, I want the Engineer to work without an account, so that I can use the mission and evidence experience directly.

## Implementation Decisions

- Keep the existing Express boundary and preserve `GET /api/health` and `POST /api/engineer`.
- Validate the request with a shared contract. It contains a 1–500 character question, an explicit category (`mission`, `evidence`, or `telemetry`), a detail level (`concise` by default or `detailed`), and only the optional context appropriate to that category. Reject unknown fields, invalid context, mixed categories, and category/content mismatches rather than silently reclassifying.
- Limit the full JSON request to 16 KB. Return HTTP 400 for malformed or invalid fields and HTTP 413 for an oversized request. Return HTTP 200 with the stable response envelope for valid `prepared_fallback` and `no_answer` outcomes.
- Keep versioned source-reviewed evidence records and citation metadata on the server. Do not accept evidence records, source URLs, citation metadata, or review state from the browser.
- Resolve mission context against the canonical mission definition and selected choice. Resolve telemetry context against the canonical selected demo snapshot and server-controlled signal definitions; do not trust arbitrary signal values or definitions supplied by the browser. Include only the selected context relevant to the request.
- Use deterministic retrieval first: exact IDs and terms before normalized keyword lookup. Return at most five stable record IDs with provenance. Do not send the complete evidence library to a future provider.
- If records conflict, retrieval does not support a single answer, or selected context does not support the question, return `no_answer`; do not use general model knowledge to fill a gap.
- Configure either `KIRA_API_KEY` (with optional `KIRA_MODEL`) or an HTTPS custom provider. Provider credentials remain server-only. Calls occur only after explicit question submission and receive only the question, selected detail level, retrieved reviewed records, and relevant canonical context.
- Constrain provider output to an answer and candidate record IDs. Do not accept generated URLs or changes to source metadata, signal values, mission outcomes, or review status. Accept only IDs in the retrieved set, and resolve all citation fields from the server-side records.
- Provider requests use a 30-second timeout and no automatic retry. A provider timeout or outage uses a prepared fallback when selected records or context support one; unsupported requests use `no_answer`.
- Return a stable response envelope with answer text, `whatSourceStates`, `whatItMeans`, citations, related record IDs, limitations, response mode (`grounded_ai`, `prepared_fallback`, or `no_answer`), and a user-visible mode label. The initial no-provider release uses `prepared_fallback` or `no_answer`.
- Give the model a 10,000-token output budget and medium reasoning effort. Keep citations and limitations in separate response fields and do not let detail mode broaden retrieval.
- When a prepared answer is supported, compose it deterministically from reviewed claims and canonical selected context. Include source information and record limitations in detailed mode. Identify the prepared mode and state when a configured provider was unavailable.
- Keep logs and metrics low-risk: route, method, status class, duration, response mode, and sanitized dependency error category only. Do not log question text, prompts, retrieved text, demo values, player identifiers, or credentials. Do not persist questions, prompts, selected context, or player history.
- Keep provider configuration server-only. The application needs no database, vector index, or model-serving container.
- Preserve mission, fixture walkthrough, and evidence library behavior if the API is down. The browser shows the Engineer's unavailable state and does not retry automatically.

## Testing Decisions

- Test observable behavior through the highest practical seam: create the Express app with controlled dependencies and exercise the `POST /api/engineer` HTTP boundary. Verify request validation, category handling, retrieval limits, no-answer behavior, response modes, citation resolution, provider-boundary behavior, and privacy-sensitive logging from requests and responses rather than testing internal helper structure.
- Add browser acceptance coverage for the user-visible boundary: no request on page visit or fixture movement, exactly one request on submit, only the selected category/context is sent, and mission/evidence browsing remains usable with an unavailable API.
- Exercise provider behavior with an injected test provider, not a live external service. Cover timeout/failure fallback and rejection of malformed, unsupported, or out-of-set citations without depending on provider internals.
- Use the existing Race Engineer Playwright coverage as prior art for supported evidence questions, detailed responses, no-answer outcomes, canonical context resolution, invalid input, citation validation, provider failure, and submit-only calls.
- Use existing observability acceptance coverage as prior art for ensuring metrics and standard logs omit question text and demo values while retaining bounded route, status, duration, mode, and dependency error fields.
- Good tests assert the API and browser behavior visible to users or operators. They should not lock tests to private retrieval helper names, provider implementation details, or internal call order beyond the externally required single submission.

## Out of Scope

- Integrating additional hosted providers beyond Kira and the compatible HTTPS adapter.
- Database-backed evidence storage, vector search, ingestion pipelines, or a model-serving container.
- AMF1 telemetry access, live impact feeds, or real-world impact calculations.
- Model-generated citations, source metadata, mission outcomes, or signal values.
- Persistent questions, conversation histories, player accounts, or profiles.
- Automatic model calls on page load, fixture movement, mission actions, or other background events.
- Cloud deployment, provider operations, and cloud secret provisioning; those belong to later build steps.

## Further Notes

- This spec follows the accepted terminology and boundaries in ADR-0002: Race Engineer, source-reviewed records, reported impact, simulated telemetry, and fictional mission scenario. The original optional-provider decision was superseded by the generated-answer requirement.
- The API and browser contracts depend on the shared mission, evidence, and telemetry contracts established by earlier build steps.
- Handoff is to the local containers and observability step with the health route, request limits, response modes, log fields, metrics, and server-only configuration requirements defined here.
- Repository review found existing Express and Playwright seams for the Race Engineer behavior. The agreed test seam is the API route plus one browser acceptance layer for submit-only calls and API-unavailable behavior.
