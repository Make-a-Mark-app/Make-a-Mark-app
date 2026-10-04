# Step 8 Verify Inclusive Acceptance and Rehearse the Demo

**Depends on:** Steps 1–5 for local use; Steps 6–7 if sharing through the private Tailscale profile.
**Outcome:** The prototype can be presented consistently, its trust boundaries are understood, and accessibility and reset behavior are checked.

## Function

Run the acceptance matrix for the chosen run profile. This is a practical product/usability check, not evidence of production readiness or a statistically representative market study. Rehearse failures as well as the happy path.

## Services and tools

- Browser at desktop and mobile widths; keyboard and touch input.
- Local profile: Docker Compose, Grafana, Prometheus, Loki, and Alloy.
- Private shared profile: Tailscale Serve over the tailnet, local Grafana dashboards, and the KiraAI wallet page. Public Cloud Run operations apply only if a separate public-cloud profile is selected.
- Hosted model credentials are optional. Test the app with provider disabled and enabled.
- No AMF1 account, live feed, or private AMF1 system access is required.

## Actions

1. **Check both entry routes.** Start from the freight mission and separately enter the evidence library without playing.
2. **Rehearse the mission.** Complete a choice, inspect fictional feedback, retry, and verify deterministic outcome. Confirm that telemetry and evidence never alter the mission result.
3. **Rehearse all telemetry states.** Manually reach updating, delayed, stale, and unavailable. Confirm unit, simulated timestamp, status, and simulated-data label remain visible. Reload/reset and repeat the same sequence.
4. **Trace a factual claim.** Open an Environment, Belong, and Community record. Check source URL, edition/publication date, reporting period, review status, location where available, and limitations.
5. **Check illustrative data.** Confirm the exact illustrative-data sentence stays adjacent to each placeholder at desktop and mobile widths.
6. **Ask supported and unsupported questions.** Confirm a supported answer cites retrieved records. Confirm absent/weak evidence returns a limitation or no-answer response rather than a general model guess.
7. **Exercise answer modes.** Test provider disabled, provider success, timeout, permission/quota failure, malformed output, prepared fallback, and no-answer. Verify only user submission triggers provider calls and concise/detailed depth is user-selected.
8. **Check accessibility paths.** Use keyboard only, touch, visible focus, screen zoom, reduced motion, and the untimed non-driving route. Confirm reading order and control labels are understandable.
9. **Inspect privacy and operations.** Review representative API logs and metrics. Confirm no question, prompt, source passage, demo values, secret, profile, or user-controlled ID is present. Review latency and errors in local Grafana; use cloud monitoring only for a separately selected public-cloud profile.
10. **Test resets.** Reset browser discovery state separately. Run Compose `down` and full volume reset only where expected. For Tailscale, confirm `tailnet:down` removes only the app route and dedicated Compose project. If a separate GCP profile is selected, verify its rollback/delete instructions and that source files are not stored only in resettable service state.
11. **Run a directional desirability check.** Use a small convenience sample across newer/long-time fans and concept age ranges (18–35, 36–54, 55+). Ask participants to interpret one simulated indicator, complete or bypass the mission, and find a claim’s source. Record sample size and limitations; do not generalize results to the whole audience.
12. **Rehearse a short demo script.** Show direct entry, mission, all feed states, one source record, one supported and one unsupported question, and fallback behavior. State plainly that the feed is scripted, not live.

## Evidence to retain

- Acceptance checklist with pass/fail and issues.
- Screenshots or notes showing labels at desktop/mobile widths.
- A short rehearsal script and reset instructions.
- Directional user-check notes with sample size, consent/privacy handling, and limitations.
- For the Tailscale profile: private service URL, Serve/Funnel status, Grafana health/alert view, and cleanup notes (no secrets). For a separately selected public-cloud profile, retain image digests and resource teardown notes.

## Release criteria

- Every core mission and library flow works without a model credential.
- All simulated, reported, illustrative, and fictional categories are visibly distinct.
- Keyboard/touch, reduced motion, untimed non-driving route, and readable responsive layout are usable.
- Citations, fallbacks, no-answer, logs, privacy boundaries, and resets behave as planned.
- Presenter can reproduce the same demo without implying an AMF1 live feed or measured impact.
- Unresolved defects and limits are stated honestly before the prototype is shared.

## Handoff

After acceptance, collect defects and decide separately whether to implement fixes, add another mission, connect a real data feed, collect accounts, or move beyond the R1 prototype. None of those changes is implied by passing this rehearsal.
