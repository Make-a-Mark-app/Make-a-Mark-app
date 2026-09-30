# Step 4 Build the API and Optional Race Engineer

**Depends on:** Step 1 contracts and Step 3 evidence/fixture schemas.  
**Outcome:** The API can answer supported questions with bounded source context, validated citations, and safe fallback behavior.

## Function

Keep Express as the server boundary between the browser, curated records, and any hosted model. The provider-neutral adapter runs only after explicit user submission. The model explains already-approved context; it does not retrieve unrestricted information, change the mission, edit evidence, or author citations.

## Services and tools

| Service/tool | Function | Required? |
|---|---|---|
| Node.js and Express | API boundary, validation, retrieval, response modes | Yes |
| Versioned source-reviewed records | Factual retrieval and citation metadata | Yes for evidence answers |
| Hosted LLM API, e.g. Vertex AI Gemini | Explain a bounded context | Optional; prepared fallback remains |
| Server-side identity/secret | Authenticate model calls | Required only for configured provider; never in browser |
| Outbound HTTPS | Connect API to provider | Only when provider is enabled |

No database, vector index, or model-serving container is needed. Keep the API usable in no-provider mode.

## Actions

1. **Keep a narrow HTTP surface.** Preserve `GET /api/health`; implement or extend `POST /api/engineer`. Apply request-size and question-length limits and validate detail-level and optional context types.
2. **Classify and bound request context.** Separate mission-rule, evidence, and telemetry explanations. Include only relevant records, the selected current demo snapshot when requested, and concise mission context. Reject oversized or malformed context.
3. **Use deterministic retrieval first.** Search exact IDs/terms and normalized keywords against source-reviewed records. Return a small maximum result set with stable IDs and provenance. Do not send the whole evidence library to the provider.
4. **Enforce no-answer conditions.** If no records support a factual question, state the evidence limit; do not ask the model to fill gaps from general knowledge. Mission questions can use fixed mission rules. Telemetry answers can use only the supplied demo summary and signal definition.
5. **Call the provider after submit only.** The browser sends one API request on user action. The server adapter applies timeouts and bounded input/output. Fixture steps and page visits never trigger model calls.
6. **Require structured model output.** Ask for an explanation and candidate record IDs only. Do not accept a generated URL, changed source metadata, modified signal value, mission score, or review status.
7. **Validate and resolve citations server-side.** Discard IDs outside the retrieved set. Resolve title, source URL, period, and location from the record file. If output is malformed or citations fail validation, use prepared fallback or no-answer.
8. **Define response modes.** Return `grounded_ai`, `prepared_fallback`, or `no_answer`, plus answer text, citations, limitations, and a clear mode label. Concise is default; detail is user-selected.
9. **Keep logs low-risk.** Record route/status/duration/mode/error class only. Do not log question text, prompts, retrieved text, demo values, player IDs, or credentials.
10. **Use server-only configuration.** Local model credentials go in an ignored `.env`; deployed credentials use cloud identity for Vertex AI or Secret Manager for a static third-party key.

## Deliverables

- Validated request and response schemas.
- Deterministic record search and citation mapper.
- Provider-neutral adapter with explicit timeout/error behavior.
- Prepared fallback and no-answer response templates.

## Completion checks

- Opening the app, moving the fixture, or using the mission does not call the model.
- Only reviewed records returned by retrieval can be cited as reported evidence.
- Provider unconfigured, provider timeout, invalid output, and insufficient evidence all have useful outcomes.
- Core mission/library paths remain available if Express or provider fails.
- Standard logs and metrics contain none of the excluded content.

## Handoff

Proceed to [Step 5](step-05-local-containers-and-observability.md) with health, metrics, log-field, and configuration requirements. For Vertex AI setup, see [Step 7](step-07-cloud-model-and-operations.md).
