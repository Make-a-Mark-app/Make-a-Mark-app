# Step 2 Build the Frontend and Fictional Mission

**Depends on:** Step 1 data and trust contracts.  
**Outcome:** A user can enter through the fictional freight mission or open the evidence library directly; the mission works without the API or model.

## Function

Build the React/Vite experience as a responsive, keyboard- and touch-operable interface. Keep the mission as a deterministic fictional interaction. Provide plain-language labels so users can distinguish simulated session values, published report claims, illustrative placeholders, and fictional mission results.

## Services and tools

- **React, TypeScript, and Vite:** existing browser app and development server.
- **Browser:** responsive layout, local-storage, keyboard/touch, and reduced-motion review.
- **Nginx:** production static-file server added at Step 5; it is not needed for Vite development.
- **Express API/model provider:** not required for mission start, selection, retry, or completion.

## Actions

1. **Create two clear entry routes.** Add a prominent path into the freight mission and a direct path into the evidence library. Keep navigation available after either choice.
2. **Build the app shell.** Add product purpose, concise trust/method copy, responsive navigation, visible focus states, headings, landmarks, and error/empty states. Use semantic controls and a logical reading order.
3. **Implement the mission from the approved config.** Render one freight scenario, its finite route choices, deterministic feedback, completion, and retry. Do not read fixture telemetry or evidence to calculate a score.
4. **Add local discovery only if useful.** Store minimal mission completion and record-open state in browser `localStorage`. Provide a clear reset action; store no name, age, profile, or question history.
5. **Build accessible interaction alternatives.** Use buttons/choices that work with keyboard and touch. Respect reduced-motion preferences. Provide an untimed non-driving route so no action requires reaction speed or driving skill.
6. **Design answer depth without personalization.** Add a concise default and an explicit detailed option. Let the user choose; do not infer reading level or behavior from age.
7. **Place trust labels at the value.** Mark mission results fictional. Reserve the exact illustrative placeholder phrase for illustrative impact values. Keep reported claims visibly connected to source details.
8. **Check narrow-screen layouts.** Ensure choice labels, sources, citations, and illustrative labels remain readable and attached to the correct values on mobile widths.

## Deliverables

- React routes/components for entry, mission, evidence-library shell, and trust/method content.
- Mission configuration and deterministic state transitions.
- Responsive styling, reduced-motion treatment, and browser-local reset behavior.

## Completion checks

- Mission start, choice, result, retry, and completion are deterministic.
- Evidence library can be opened without playing the mission.
- Core mission actions work if Express is stopped or no model credential exists.
- No value is presented as a live AMF1 feed or measured impact result.
- Focus, keyboard/touch operation, reduced motion, and untimed route are usable.

## Handoff

Proceed to [Step 3](step-03-telemetry-and-evidence.md). Keep mission state independent while adding demo and report data.
