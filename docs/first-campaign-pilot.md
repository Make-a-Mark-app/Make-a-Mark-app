# First campaign pilot: freight mission → proposed rewards → referral

## Pilot scope

Use the existing three-decision freight learning mission as the single campaign activity. A participant starts it, finishes all three scenarios, answers a final source-versus-game learning check, and presses **Finish mission**. The prototype then shows two proposed completion benefits: one planting contribution and one 20% merchandise offer. The participant may copy one referral link. The two-question check asks what sustainability message they remember and whether their interest in AMF1's sustainability work changed. Sharing and the check are optional. Group challenges, social competitions, water exchanges, and extra earning mechanics are outside this first pilot.

The current app demonstrates this flow only. Browser storage holds progress, a random participant ID, the referral code, copy actions, offer-detail views, demo offer use, and survey answers. A local Express API aggregates demo joins, completions, link copies, referred starts, simulated offer uses, and optional survey answers across browsers at `/pilot/metrics`. It stores only random IDs, referral codes, and these actions in `data/pilot-demo.json`; no name or email is sent. The demo API does not verify a person, merchant order, partner planting, or actual share delivery. Its local file is not a production analytics store and may be reset with the demo environment. The retired tree-exchange flow is not part of this pilot.

## Proposed reward agreement to settle before launch

| Item | Proposed rule | Party and proof needed |
| --- | --- | --- |
| Planting contribution | One contribution for a unique, verified course completion; no extra contribution for replay. | AMF1 campaign budget funds the agreed amount. A named planting partner must state what each amount funds, acknowledge funds received, and report actual planting by period and location. Contribution, planting, survival, and carbon claims must remain distinct. |
| Merchandise discount | One 20% code for one reusable bottle from a merchant-approved pilot SKU list; no minimum spend; 14 days after verified completion; single use; no stacking with other promotions. Shipping and taxes excluded from the discounted amount. Other merchandise is ineligible. The prototype uses an illustrative £30 bottle and £6 discount. | The participating AMF1 merchandise merchant funds the price reduction through its campaign/retail budget and supplies the eligible SKU list, regional terms, code issuance, and order-level redemption data. The exact SKUs, prices, and any discount cap need commercial approval. |

Completion is the intended trigger for both benefits, subject to one eligible completion per participant in a live pilot. The prototype unlocks only a preview. A live implementation must verify completion server-side, prevent duplicate claims, and have a clear cancellation/refund policy for merchandise use. Do not publish launch terms or promise a tree until AMF1, the merchant, and the planting partner agree.

## Measurement contract for a live pilot

Use pseudonymous participant and referral IDs with a published privacy notice, appropriate consent, retention limits, and deduplication. Aggregate only validated events. A copy action means an attempted share; a referral join means a person arrived with a code and started the mission. Likes and impressions are not joins.

| Event | When to record | Pilot measure |
| --- | --- | --- |
| `mission_joined` | First eligible mission start for a participant, with optional `referral_code` | Unique joins; referred joins |
| `mission_completed` | Server verifies all three scenarios and final completion, once per participant | Unique completions; completion rate = completions / joins |
| `share_link_copied` | Participant copies the assigned link | Unique sharers and copy actions; clearly a share intent proxy |
| `referral_joined` | A new participant starts after arriving with a valid referral code | Referred starts per sharer; exclude self-referrals and duplicate participants |
| `offer_issued` | Merchant creates a single-use code after verified completion | Offers issued and issue failures |
| `offer_redeemed` | Merchant confirms an eligible paid order using that code | Unique users of the offer; redemption rate = redemptions / issued offers; discount amount and net sales |
| `planting_funded` / `planting_confirmed` | Finance confirms transfer / partner confirms planting | Contributions funded versus trees actually planted; never merge these counts |
| `survey_submitted` | Participant opts in to the two-question check | Correct message recall and self-reported increased interest, each with response denominator |

The demo API accepts only `joined`, `completed`, `shared`, `offer_used`, and `survey_submitted` events tied to random browser IDs. It deduplicates joins, completions, and offer uses; it accepts a referred join only when the code belongs to a prior demo finisher. The demo offer can be simulated once within 14 days of recorded completion. The `completed` event still comes from browser gameplay and is not independently verified. A `shared` event means a successful copy action, and `offer_used` means the participant pressed **Simulate offer use**; neither proves a social post or paid order. `offerViews` is browser-local and **not** `offer_redeemed`. A real pilot dashboard needs verified events, consented identity and attribution, merchant reconciliation, partner fulfillment status, and retention controls before its numbers can support campaign claims.

## Commercial and learning decision

Before launch, estimate maximum discount liability from eligible SKU prices and expected redemptions, the planting budget per verified completion, campaign operation costs, and the merchant's gross margin:

- **Planting budget:** verified completions × agreed contribution per completion, plus partner and reporting fees.
- **Discount liability:** sum of 20% of each eligible bottle's selling price across expected redemptions, subject to any approved cap. Exclude shipping and taxes. The demo's £30 bottle yields £6 per simulated use; this is a cost illustration, not a store price.
- **Commercial result:** incremental merchandise gross profit against an agreed comparison group or baseline, minus discount liability, planting budget, and campaign operation costs. Offer-attributed sales alone cannot establish incremental sales.

Report results by referral source and cohort without claiming that survey respondents represent all participants. Decide on group challenges or additional rewards only after reviewing completion, referred joins, confirmed redemptions, correct recall, increased interest, total campaign cost, and partner-verified planting.
