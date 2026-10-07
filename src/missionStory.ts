export type GameLayer = 0 | 1 | 2;
export type GameChoice = {
  id: string;
  label: string;
  points: number;
  rating: "Good" | "Decent" | "Bad";
  outcome: string;
  reportContext: string;
  reportUrl: string;
  reportLabel: string;
  countsAgainst: boolean;
};

const report2024 = "https://downloads.astonmartinf1.com/MakeAMark_ESG_Report_2024.pdf#page=23";
const report2025 = "https://www.astonmartinf1.com/en-GB/make-a-mark";

export const gameLayers: Array<{ title: string; question: string; choices: GameChoice[] }> = [
  {
    title: "Transport",
    question: "How will you move the car and equipment to the next race?",
    choices: [
      { id: "sea", label: "Sea freight", points: 300, rating: "Good", outcome: "Moving suitable freight by sea reduces reliance on air freight, but takes more planning and time.", reportContext: "AMF1's 2024 ESG report says it is shifting freight from air to sea and road where feasible.", reportUrl: report2024, reportLabel: "2024 Make A Mark ESG report, p. 23", countsAgainst: false },
      { id: "road", label: "Road transport where feasible", points: 150, rating: "Decent", outcome: "Road transport can serve feasible routes and final connections. Its suitability depends on the origin and distance.", reportContext: "AMF1's 2024 ESG report says it is shifting freight from air to sea and road where feasible.", reportUrl: report2024, reportLabel: "2024 Make A Mark ESG report, p. 23", countsAgainst: false },
      { id: "air", label: "Air freight for everything", points: -100, rating: "Bad", outcome: "Flying the entire load prioritises speed and increases the freight impact in this fictional scenario.", reportContext: "AMF1's 2024 ESG report describes a shift away from air freight toward sea and road where feasible.", reportUrl: report2024, reportLabel: "2024 Make A Mark ESG report, p. 23", countsAgainst: true },
    ],
  },
  {
    title: "Freight load",
    question: "How will you prepare the shipment?",
    choices: [
      { id: "lighten", label: "Reduce and lighten the freight", points: 300, rating: "Good", outcome: "Removing unnecessary weight makes the shipment lighter and transport more efficient.", reportContext: "AMF1's 2024 ESG report says it focuses on reducing and lightweighting freight.", reportUrl: report2024, reportLabel: "2024 Make A Mark ESG report, p. 23", countsAgainst: false },
      { id: "usual", label: "Send the usual load", points: 150, rating: "Decent", outcome: "The shipment moves without an added reduction in freight weight.", reportContext: "AMF1's 2024 ESG report says it focuses on reducing and lightweighting freight.", reportUrl: report2024, reportLabel: "2024 Make A Mark ESG report, p. 23", countsAgainst: false },
      { id: "extra", label: "Pack extra unnecessary equipment", points: -100, rating: "Bad", outcome: "Unneeded cargo adds weight and makes transport less efficient.", reportContext: "AMF1's 2024 ESG report says it focuses on reducing and lightweighting freight.", reportUrl: report2024, reportLabel: "2024 Make A Mark ESG report, p. 23", countsAgainst: true },
    ],
  },
  {
    title: "Team travel",
    question: "How will you handle necessary flights for the crew?",
    choices: [
      { id: "saf", label: "Support Sustainable Aviation Fuel", points: 300, rating: "Good", outcome: "Supporting Sustainable Aviation Fuel can lower the travel impact; it does not make a flight emission-free.", reportContext: "AMF1's 2025 Make A Mark report describes investment in Sustainable Aviation Fuel for travel and logistics.", reportUrl: report2025, reportLabel: "2025 Make A Mark report", countsAgainst: false },
      { id: "direct", label: "Prioritise direct flights", points: 150, rating: "Decent", outcome: "Direct routes avoid an unnecessary connection where they are available.", reportContext: "AMF1's 2024 ESG report says it prioritises direct flight routes to reduce travel emissions.", reportUrl: report2024, reportLabel: "2024 Make A Mark ESG report, p. 23", countsAgainst: false },
      { id: "connecting", label: "Take connecting flights using conventional fuel", points: -100, rating: "Bad", outcome: "Additional flight legs and conventional fuel increase the travel footprint in this fictional scenario.", reportContext: "AMF1's 2024 ESG report says it prioritises direct flight routes and was exploring Sustainable Aviation Fuel.", reportUrl: report2024, reportLabel: "2024 Make A Mark ESG report, p. 23", countsAgainst: true },
    ],
  },
];

export function missionEnding(choices: GameChoice[]) {
  const score = choices.reduce((total, choice) => total + choice.points, 0);
  return {
    coins: Math.max(0, Math.min(3, Math.floor(score / 300))),
    score,
  };
}

export function sceneFor(layer: GameLayer, transport?: GameChoice) {
  if (layer === 0) return { file: "Scenario_1", location: "Race garage" };
  const branch = transport?.id === "sea" ? 1 : transport?.id === "road" ? 2 : 3;
  const location = branch === 1 ? "Ship dock" : branch === 2 ? "Road transport" : "Airport";
  return { file: `Scenario_${layer + 1}-${branch}`, location };
}

export const finalScene = { file: "Scenario_4", location: "Singapore Grand Prix" };
