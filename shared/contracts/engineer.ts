import type { RouteId } from "./mission.js";

export type EngineerDetailLevel = "concise" | "detailed";
export type EngineerCategory = "evidence" | "mission" | "telemetry";

export type EngineerRequest = {
  category: EngineerCategory;
  question: string;
  detailLevel: EngineerDetailLevel;
  context?: {
    mission?: { missionId: string; configId: string; choiceId: RouteId };
    telemetry?: { stepId: string };
  };
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const hasOnlyKeys = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).every((key) => keys.includes(key));

export function parseEngineerRequest(value: unknown): EngineerRequest | null {
  if (!isObject(value) || !hasOnlyKeys(value, ["category", "question", "detailLevel", "context"])) return null;
  if (typeof value.question !== "string") return null;
  const question = value.question.trim();
  if (question.length < 1 || question.length > 500) return null;
  const detailLevel = value.detailLevel === undefined ? "concise" : value.detailLevel;
  if (detailLevel !== "concise" && detailLevel !== "detailed") return null;

  if (value.category !== undefined && value.category !== "evidence" && value.category !== "mission" && value.category !== "telemetry") return null;
  if (value.context === undefined) {
    return value.category === undefined || value.category === "evidence"
      ? { category: "evidence", question, detailLevel }
      : null;
  }
  if (!isObject(value.context) || !hasOnlyKeys(value.context, ["mission", "telemetry"])) return null;
  const context: NonNullable<EngineerRequest["context"]> = {};

  if (value.context.mission !== undefined) {
    const mission = value.context.mission;
    if (!isObject(mission) || !hasOnlyKeys(mission, ["missionId", "configId", "choiceId"])) return null;
    if (typeof mission.missionId !== "string" || typeof mission.configId !== "string" || !["air", "sea", "road"].includes(String(mission.choiceId))) return null;
    context.mission = { missionId: mission.missionId, configId: mission.configId, choiceId: mission.choiceId as RouteId };
  }

  if (value.context.telemetry !== undefined) {
    const telemetry = value.context.telemetry;
    if (!isObject(telemetry) || !hasOnlyKeys(telemetry, ["stepId"]) || typeof telemetry.stepId !== "string" || !/^step-\d{2}$/.test(telemetry.stepId)) return null;
    context.telemetry = { stepId: telemetry.stepId };
  }

  const category = value.category ?? (context.mission ? "mission" : context.telemetry ? "telemetry" : "evidence");
  if (
    (category === "evidence" && (context.mission || context.telemetry)) ||
    (category === "mission" && !context.mission) ||
    (category === "telemetry" && !context.telemetry)
  ) return null;
  return { category, question, detailLevel, context };
}
