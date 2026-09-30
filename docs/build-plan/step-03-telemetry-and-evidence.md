# Step 3 Add the Telemetry Fixture and Evidence Library

**Depends on:** Steps 1 and 2.  
**Outcome:** Users can manually reproduce every demo feed state and inspect a small, traceable set of public source-reviewed records.

## Function

Create a finite, deterministic local telemetry fixture that demonstrates a live-style session panel without connecting to AMF1. Provide a source-reviewed evidence library and deterministic exact/keyword lookup over versioned files. These are separate datasets and views.

## Services and tools

- React/Vite and browser for the session panel, fixture step controls, and library.
- Version-controlled fixture and evidence files; no runtime ingestion service.
- Express API is needed for server-side evidence search used by Race Engineer at Step 4. The library itself can display bundled public record metadata.
- No PostgreSQL, Redis, vector database, embedding service, OCR, polling worker, or external telemetry connection.

## Actions

1. **Create a short fixture sequence.** Include deterministic examples of `updating`, `delayed`, `stale`, and `unavailable`. Make each state reachable with one explicit user action; do not wait on a clock or autoplay.
2. **Define signal metadata.** For each displayed signal, specify a plain-language name, value type, unit, and short interpretation. Include a simulated timestamp and make clear that it is demo time.
3. **Implement safe missing-value handling.** A missing, invalid, or unavailable signal must show unavailable with no fabricated replacement. A delayed/stale value may remain visible only with its state and simulated time clearly shown.
4. **Add simulation labels in context.** Use “simulated” near the panel and the timestamp. Do not imitate connection status in a way that suggests an AMF1 API is connected.
5. **Curate the first record subset.** Choose only a manageable number of Environment, Belong, and Community report claims that can be checked by a human. Prefer clear, accessible public source locations.
6. **Record source details.** For every factual record, capture report title, edition/publication date, reporting period, claim text, page/section/location when available, URL, review status, and limitations. Keep publication date distinct from reporting period.
7. **Build record browsing and search.** Add pillar/topic and optional period filters. Use exact/keyword matching with bounded results. Exclude records not marked source-reviewed. Return “not enough evidence” when no record supports the query.
8. **Keep placeholder values separate.** If an illustrative impact value is shown, mark it beside the value with: “Illustrative demo data — not live AMF1 data or a measured impact result.” Never index it as reported evidence.
9. **Keep mission state independent.** The mission result must not read the telemetry fixture, evidence values, or AI response.

## Deliverables

- Finite fixture with timestamps, states, signal definitions, and deterministic step order.
- Small versioned evidence record set with source review notes and limitations.
- Library/list/detail experience and search contract suitable for the API.

## Completion checks

- Presenter can reach all four feed states on demand, repeatedly, without network or elapsed-time waits.
- Every telemetry timestamp and value is visibly simulated.
- A user can open the source from each factual record and understand its period and limitation.
- Unsupported questions have an explicit no-answer path; no general model knowledge is needed for lookup.
- Mission result and illustrative examples cannot be confused with published AMF1 evidence.

## Handoff

Proceed to [Step 4](step-04-api-and-race-engineer.md) with the evidence record schema, exact/keyword search behavior, fixture summary shape, and citation fields.
