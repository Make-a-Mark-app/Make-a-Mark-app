export const PILOT_RECALL_ANSWER = "AMF1 reports travel and logistics emissions were 14% lower";
export const PILOT_INTEREST_ANSWERS = [
  "Much less interested", "A little less interested", "No change",
  "A little more interested", "Much more interested",
] as const;

export type PilotEvent =
  | { type: "joined"; participantId: string; referralCode: string; referredBy: string | null }
  | { type: "completed" | "shared" | "offer_used"; participantId: string }
  | { type: "survey_submitted"; participantId: string; recallAnswer: string; interestAnswer: string };

export type PilotMetrics = {
  joined: number;
  completed: number;
  sharers: number;
  shareActions: number;
  referredJoins: number;
  demoOfferUses: number;
  surveyResponses: number;
  correctRecall: number;
  increasedInterest: number;
};

export function parsePilotMetrics(value: unknown): PilotMetrics | null {
  if (typeof value !== "object" || value === null) return null;
  const item = value as Record<string, unknown>;
  const keys: Array<keyof PilotMetrics> = ["joined", "completed", "sharers", "shareActions", "referredJoins", "demoOfferUses", "surveyResponses", "correctRecall", "increasedInterest"];
  if (!keys.every((key) => Number.isSafeInteger(item[key]) && (item[key] as number) >= 0)) return null;
  return Object.fromEntries(keys.map((key) => [key, item[key]])) as PilotMetrics;
}
