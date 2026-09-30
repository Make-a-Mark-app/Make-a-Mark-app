import { parseMissionDefinition } from "./contracts/mission.js";

const validatedScenario = parseMissionDefinition({
  missionId: "freight",
  configId: "freight-r1-v1",
  title: "Deliver the parts.",
  fictionalContext: "A fictional shipment is waiting at the freight hub.",
  choices: [
    { id: "air", name: "Air", mode: "Quick connection", character: "The direct route", feedback: "Your game scenario prioritizes a tight delivery window." },
    { id: "sea", name: "Sea", mode: "Steady passage", character: "The measured route", feedback: "Your game scenario trades immediacy for a steadier journey." },
    { id: "road", name: "Road", mode: "Flexible link", character: "The adaptable route", feedback: "Your game scenario keeps the final connection flexible." },
  ],
});

if (!validatedScenario) throw new Error("The freight Mission scenario does not satisfy its shared contract.");

export const missionScenario = validatedScenario;
