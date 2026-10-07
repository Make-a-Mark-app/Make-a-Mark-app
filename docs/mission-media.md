# Game scenario media

The supplied MP4 files are installed in `public/assets/mission/`. The first number is the scenario. For Scenarios 2 and 3, the suffix chooses the location set by the Scenario 1 transport answer:

| Video | When it plays |
| --- | --- |
| `Scenario_1.mp4` | Opening and transport decision |
| `Scenario_2-1.mp4` | Freight load at the ship dock after sea freight |
| `Scenario_2-2.mp4` | Freight load on the road after road transport |
| `Scenario_2-3.mp4` | Freight load at the airport after air freight |
| `Scenario_3-1.mp4` | Team travel at the ship dock |
| `Scenario_3-2.mp4` | Team travel on the road |
| `Scenario_3-3.mp4` | Team travel at the airport |
| `Scenario_4.mp4` | Shared Singapore ending, copied from the supplied `Scenario_4-1.mp4` |

The question and three choices appear over a bottom-half banner fading from transparent to 95%-opaque black on each of the first three clips when one second remains. The banner rises over two seconds, then remains until the player chooses; the question and choices appear one by one. A full-screen 75%-opaque black result overlay fades in over two seconds and shows the choice rating, outcome, score, and a linked AMF1 report statement in sequence. After a choice or navigation button click, hold the current screen for one second before showing the next part, with no exit animation. Scenario 4 plays after the third result for every route. Its finished frame receives a full-screen 75%-opaque black scoreboard that fades in over two seconds and reveals the player's actual choices, totals, and controls in sequence.

The supplied Scenario 4 depicts the one-bad-choice version intended for the demo. Other combinations remain selectable and their scoreboard reflects those selections. A matching JPG still can be placed beside any MP4 as a fallback, using the same filename stem.
