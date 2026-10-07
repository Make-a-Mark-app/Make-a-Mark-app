# Gameplay mission layers

**Mission:** Get the car, equipment, and team to the race weekend.

| Layer | Question | Options |
| --- | --- | --- |
| **1. Transport** | How will you move the car and equipment? | **Sea freight**; **road transport where feasible**; **air freight for everything**. |
| **2. Freight load** | How will you prepare the shipment? | **Reduce and lighten the freight**; **send the usual load**; **pack extra unnecessary equipment**. |
| **3. Team travel** | How will you handle necessary flights? | **Support Sustainable Aviation Fuel**; **prioritise direct flights**; **take connecting flights using conventional fuel**. |

The AMF1 initiatives are described in the [2024 Make A Mark ESG report](https://downloads.astonmartinf1.com/MakeAMark_ESG_Report_2024.pdf) (printed pages 23–25) and the [2025 Make A Mark report page](https://www.astonmartinf1.com/en-GB/make-a-mark).

## Story flow

The first pillar is one choice-driven Game. It combines the former driving entry and scenario within the mission; there is no open world or free driving. The player is an F1 Manager in a third-person, GTA V-like cinematic view. A race engineer NPC guides the player through three decisions about moving the car, equipment, and crew to the next race in Singapore. Each supplied scene fills the viewport. During the final second of Scenarios 1–3, a black banner fades from transparent at the top to 95% opacity at the bottom across the lower half and shows the question and options until the player chooses. See [mission media slots](mission-media.md) for the clip names and branches.

### Opening scene

1. **0–5 seconds:** The player walks up to the AMF1 race engineer, who is looking at and working on a tablet.
2. **5–15 seconds:** The player's character greets the engineer. The engineer asks the manager to prepare the car and race crew for the next race in Singapore, making transport decisions with sustainability and ESG in mind.
3. During the last second, the Layer 1 question and options rise into the bottom-half banner and remain until selection.

### Layer 1: Transport

**Question:** How will you move the car and equipment to the next race?

| Choice | Game rating | Points | Outcome text |
| --- | --- | ---: | --- |
| Sea freight | Good | +300 | Moving suitable freight by sea reflects AMF1's reported shift away from air freight. It takes more planning and time. |
| Road transport where feasible | Decent | +150 | Road transport can serve feasible routes and final connections. Its suitability depends on the origin and distance. |
| Air freight for everything | Bad | -100 | Flying the entire load prioritizes speed and increases the freight impact. AMF1 reports reducing its reliance on air freight. |

After a selection, fade in a **full-screen 75%-opaque black overlay** with white mission-complete text and show:

- **H1:** Scenario 1 complete
- **Text:** The selected choice's Good, Decent, or Bad rating, outcome and effect, plus a linked line about AMF1's reported practice
- **Score:** The points awarded for that choice
- **Button:** Continue to Scenario 2

The continue button moves the player to a location based on the Layer 1 choice:

| Layer 1 choice | Next location |
| --- | --- |
| Sea freight | Dock with a cargo ship |
| Road transport | Empty road outside the garage with specialized semi-trucks for race-car transport |
| Air freight | Airport with a cargo plane |

At the new location, a **5–10 second** scene plays. The race engineer walks toward the player and says, “Well done! Let's continue with the freight load.” During its last second, Layer 2 rises into the bottom-half banner and stays until selection.

### Layer 2: Freight load

**Question:** How will you prepare the shipment?

| Choice | Game rating | Points | Outcome text |
| --- | --- | ---: | --- |
| Reduce and lighten the freight | Good | +300 | Removing unnecessary weight follows AMF1's reported focus on reducing and lightweighting freight. |
| Send the usual load | Decent | +150 | The shipment moves without an added reduction in freight weight. |
| Pack extra unnecessary equipment | Bad | -100 | Unneeded cargo adds weight and makes transport less efficient. |

After a selection, keep the player at the same location and fade in a **full-screen 75%-opaque black overlay** with white text:

- **H1:** Scenario 2 complete
- **Text:** The selected choice's rating, outcome and effect, plus a linked line about AMF1's reported practice
- **Score:** The points awarded for that choice
- **Button:** Continue to Scenario 3

After the player continues, a **5–10 second** scene plays at the same location. The race engineer asks how the crew will travel. During its last second, Layer 3 rises into the bottom-half banner and stays until selection.

### Layer 3: Team travel

**Question:** How will you handle necessary flights for the crew?

| Choice | Game rating | Points | Outcome text |
| --- | --- | ---: | --- |
| Support Sustainable Aviation Fuel | Good | +300 | This reflects AMF1's reported investment in Sustainable Aviation Fuel for travel and logistics. It does not make a flight emission-free. |
| Prioritise direct flights | Decent | +150 | Direct routes reflect AMF1's reported travel practice and avoid an unnecessary connection. |
| Take connecting flights using conventional fuel | Bad | -100 | Additional flight legs and conventional fuel are the least sustainable option here. |

After a selection, fade in a **full-screen 75%-opaque black overlay** with white text:

- **H1:** Scenario 3 complete
- **Text:** The selected choice's rating, outcome and effect, plus a linked line about AMF1's reported practice
- **Score:** The points awarded for that choice
- **Button:** Continue to Scenario 4

### Ending at the Singapore Grand Prix

All paths join the supplied Scenario 4 video at the Singapore Grand Prix. This clip is the one-bad-choice version filmed for the demo. After the clip finishes, fade in a **full-screen 75%-opaque black overlay** with white text. The scoreboard always reflects the actual choices, even when another combination leads to the shared ending clip.

| Bad choices | Carbon coins |
| ---: | ---: |
| 3 | 0 |
| 2 | +1 |
| 1 | +2 |
| 0 | +3 |

- **H1:** Scoreboard
- **Text:** A recap of the three selected options and their game outcomes
- **Score:** Total of all three layer scores (range: **-300 to +900**)
- **Carbon coins:** Award according to the number of bad choices
- **Button:** End mission and return to the main page
