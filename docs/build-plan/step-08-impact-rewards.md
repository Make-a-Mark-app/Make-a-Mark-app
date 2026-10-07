# Step 8 Build the Impact Rewards Prototype

**Depends on:** Step 1 reward rules and trust labels, plus the Step 2 frontend shell and navigation.
**Can run alongside:** Steps 3–7. Rewards do not depend on telemetry, evidence retrieval, the Race Engineer, Docker, or Google Cloud.
**Outcome:** Users can earn browser-local demo credits from three explicit actions and redeem credits for a clearly simulated tree contribution.

## Function

Demonstrate a possible fan engagement loop without implementing a real loyalty, commerce, fundraising, or environmental contribution service. The feature is a self-contained page in the existing React app. Its only persistent state is a small, validated record in the current browser's `localStorage`.

The prototype shows that completing the freight mission, recording a demo video-view completion, and simulating an eligible sustainable-merchandise purchase each earn one Impact Credit. Ten credits can be exchanged for one demo tree contribution. The experience must say clearly that it does not verify a view or purchase, collect payment, fund or confirm planting, or create a carbon credit or offset.

## Services and tools

| Service/tool | Function | Needed? |
|---|---|---|
| React and TypeScript | Rewards page, counters, action controls, and local state | Yes; existing frontend |
| Browser `localStorage` | Save demo credits and redemption totals on this device | Yes; no account or server storage |
| Shared rewards contract and deterministic helpers | Validate saved state, award credits, handle year changes, and redeem at a fixed threshold | Yes; keep logic independent from UI |
| Express API, database, Redis, payment provider, video analytics, planting registry | Would support real services or shared state | No; explicitly outside R1 |
| Docker/Grafana or GCP services | Run/observe or host the wider application | Inherited from the chosen app run profile; no rewards-specific service |

## Actions

1. **Define the reward rules.** Use one credit per completed freight mission, one per user-recorded demo video completion, and one per simulated eligible purchase. Ten credits redeem for one demo tree contribution. Document that these are fixed prototype rules, not official AMF1 program terms.
2. **Validate browser state.** Define a versioned, minimal local state for current year, remaining credits, current-year demo contributions, and all-time demo contributions. Reject malformed or out-of-range saved values and recover to an empty state. Do not save account, age, identity, order, video history, or question data.
3. **Connect mission completion once per completion.** Award one credit when the mission reaches its completion action. Do not award on route selection or page visits. A user can deliberately retry and complete the mission again for the demo; prevent duplicate awards from repeated renders or clicks for the same completion.
4. **Add the two explicit demo earning actions.** Provide controls to record a demo video-view completion and simulate an eligible sustainable-merchandise purchase. State beside each control that the action is simulated. Bamboo-based merchandise and lower-impact shipping are examples of a hypothetical eligibility rule, not claims about current products.
5. **Implement redemption.** Enable redemption only when the balance reaches ten credits. Atomically subtract ten credits and increment current-year and all-time demo contribution counts. Prevent negative balances and repeated redemption without sufficient credits.
6. **Show totals with clear labels.** Distinguish credits and contributions stored in this browser from the separate illustrative campaign-total placeholder. Identify sample leaderboard names and ranks as fictional. Describe any race-pass mention as a prize hypothesis only; do not imply that a prize or contest exists.
7. **Place limitations at the action and result.** Explain that credits and contributions are local demo state; no tree is planted, payment transferred, order/view validated, offset issued, or impact measured. Label campaign totals as illustrative and unverified. Do not imply that gameplay caused real-world impact.
8. **Support inclusive use.** Use semantic buttons, keyboard access, visible focus, touch-sized controls, responsive layout, clear balance feedback, and reduced-motion behavior. Do not require driving, fast reactions, an account, or a provider.
9. **Add a simple reset path.** Reset only the rewards key in browser storage from a clearly labeled control if a reset is included. Keep this separate from mission discoveries and from Docker observability-volume resets.

## Deliverables

- Rewards page reachable from the app navigation.
- Validated browser-local rewards state and deterministic earn/redeem functions.
- Explicit mission, video-demo, and merchandise-demo earning actions.
- Demo contribution totals, illustrative campaign placeholder, and fictional annual leaderboard.
- Point-of-action copy describing the simulation and its limits.

## Completion checks

- Each of the three explicit demo actions awards exactly one local credit per activation/completion rule.
- Completing the mission awards a credit once for that completion; re-rendering or revisiting the page does not add another credit.
- Ten credits redeem for one demo tree contribution; fewer than ten cannot redeem.
- Current-year and all-time contributions persist only in the current browser and reset independently of other local or container state.
- Illustrative campaign totals and fictional leaderboard entries cannot be mistaken for verified planting or shared user totals.
- The interface does not claim a real purchase, video view, donation, planted tree, offset, prize, or environmental outcome.
- All controls work with keyboard and touch and remain usable on a narrow screen and with reduced motion enabled.
- The core rewards flow works without the API, model credentials, database, external analytics, or network access.

## Handoff

Proceed to [Step 9](step-09-acceptance-and-rehearsal.md). Include earning, redemption, local persistence, and misleading-claim checks in the final acceptance pass.
