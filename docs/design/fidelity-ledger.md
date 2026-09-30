# Visual implementation ledger

Concept: [impact-drive-concept.png](./impact-drive-concept.png), generated for the accepted desktop direction at 1505 × 1000. Implementation was captured at the same 1505 × 1000 viewport with Playwright Chromium; mobile was captured at 390 × 844.

| Comparison point | Concept | Implementation | Result |
|---|---|---|---|
| Brand and navigation | Original wordmark, World / Freight mission / Evidence library | Same wordmark and navigation; local/no-account status added to make prototype boundary visible | Matched, with useful prototype status |
| Hero copy and actions | “Come for the drive. Discover the impact.” and enter / mission actions | Same headline and action labels; supporting sentence preserves the freight-and-evidence promise | Matched |
| Main scene | Miniature racing logistics circuit dominates the page | Generated freight circuit image fills the hero and is reused as the world scene | Matched in subject and palette; implementation provides a separate interactive world route |
| Freight selector | Air, Sea, Road choices in a panel on the right | Same choices and right-side panel; selection reveals fictional game feedback | Matched and interactive |
| Evidence trust boundary | Empty state says reviewed evidence will appear here | Same empty state; library entries and detail view are explicitly marked illustrative samples | Expanded for clarity |
| Typography and palette | Editorial serif heading, restrained sans/mono UI, dark green and yellow | Locally bundled Playfair Display, DM Sans, and DM Mono with the same palette | Matched; no runtime font network dependency |
| Responsive behavior | Desktop concept only | Navigation, mission controls, selector, evidence, and footer stack at 390px | Intentional responsive continuation |

Above-the-fold copy check: the product name, main headline, freight choices, route labels, fictional-value label, primary actions, and evidence empty state match the accepted direction. No environmental statistics, claims of formal source approval, extra product sections, or promotional proof were added.

Intentional differences: the prototype status in the header and the explicit `Illustrative sample` labels are additional trust cues; the concept's small decorative slogan is omitted. The concept image is retained under `docs/design` and is not served as a product asset.

## R1 design and accessibility acceptance contract

The original comparison above records the existing visual prototype. It is retained as a historical baseline; the following points are requirements for the next implementation and are not claims that R1 is already present.

| R1 surface | Required behavior | Trust and accessibility check |
|---|---|---|
| Entry | User can start the freight mission or open the evidence library directly | No sign-in; plain-language entry; works at desktop and mobile widths |
| Freight mission | Exactly one deterministic fictional route scenario with retry/completion | Outcomes remain labeled fictional and independent of telemetry/evidence |
| Live-style panel | User advances a finite fixture through reproducible simulated states | Show signal, unit, simulated timestamp, updating/delayed/stale/unavailable; no wall-clock wait needed |
| Impact placeholders | Sample card can demonstrate a future metric interface | Display the exact illustrative-data label beside each value; never imply an outcome |
| Reported evidence | Limited Environment, Belong, and Community subset | Show source, reporting period, review status, and limitations; do not imply complete coverage |
| Race Engineer | Optional concise-first explanation with user-selected detail | Call provider only on submit; validate source citations; disclose demo data and limits; fallback/no-answer available |
| Inclusive access | All core actions available without driving or motion | Keyboard/touch, visible focus, reduced motion, untimed route, no age-based personalization |

### R1 visual review checks

At desktop and mobile sizes, check that users can tell these apart at a glance: simulated session values, published report claims, illustrative impact placeholders, and fictional mission results. Confirm simulated timestamps and feed states are not styled as a live AMF1 connection. Confirm placeholder labels stay next to their sample values at narrow widths. Check direct library entry, reading order, focus visibility, readable text, and the reduced-motion path.

