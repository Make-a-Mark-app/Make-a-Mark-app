export type RouteId = "air" | "sea" | "road";

export type MissionChoice = {
  id: RouteId;
  name: string;
  mode: string;
  character: string;
  feedback: string;
};

export type MissionDefinition = {
  missionId: string;
  configId: string;
  title: string;
  fictionalContext: string;
  choices: MissionChoice[];
};

export type MissionChoiceRequest = {
  missionId: string;
  configId: string;
  choiceId: RouteId;
};

export type MissionOutcome = {
  missionId: string;
  configId: string;
  choiceId: RouteId;
  outcomeLabel: "Fictional mission result";
  feedback: string;
};

const ROUTE_IDS: readonly RouteId[] = ["air", "sea", "road"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => Object.hasOwn(value, key));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRouteId(value: unknown): value is RouteId {
  return typeof value === "string" && ROUTE_IDS.includes(value as RouteId);
}

export function parseMissionDefinition(value: unknown): MissionDefinition | null {
  if (!isRecord(value) || !hasExactKeys(value, ["missionId", "configId", "title", "fictionalContext", "choices"])) return null;
  if (!isNonEmptyString(value.missionId) || !isNonEmptyString(value.configId) || !isNonEmptyString(value.title) || !isNonEmptyString(value.fictionalContext)) return null;
  if (!Array.isArray(value.choices) || value.choices.length !== ROUTE_IDS.length) return null;

  const seen = new Set<RouteId>();
  const choices: MissionChoice[] = [];
  for (const candidate of value.choices) {
    if (!isRecord(candidate) || !hasExactKeys(candidate, ["id", "name", "mode", "character", "feedback"])) return null;
    if (!isRouteId(candidate.id) || seen.has(candidate.id)) return null;
    if (!isNonEmptyString(candidate.name) || !isNonEmptyString(candidate.mode) || !isNonEmptyString(candidate.character) || !isNonEmptyString(candidate.feedback)) return null;
    seen.add(candidate.id);
    choices.push({
      id: candidate.id,
      name: candidate.name,
      mode: candidate.mode,
      character: candidate.character,
      feedback: candidate.feedback,
    });
  }

  return {
    missionId: value.missionId,
    configId: value.configId,
    title: value.title,
    fictionalContext: value.fictionalContext,
    choices,
  };
}

export function parseMissionChoiceRequest(value: unknown): MissionChoiceRequest | null {
  if (!isRecord(value) || !hasExactKeys(value, ["missionId", "configId", "choiceId"])) return null;
  if (!isNonEmptyString(value.missionId) || !isNonEmptyString(value.configId) || !isRouteId(value.choiceId)) return null;
  return { missionId: value.missionId, configId: value.configId, choiceId: value.choiceId };
}

export function parseMissionOutcome(value: unknown): MissionOutcome | null {
  if (!isRecord(value) || !hasExactKeys(value, ["missionId", "configId", "choiceId", "outcomeLabel", "feedback"])) return null;
  if (!isNonEmptyString(value.missionId) || !isNonEmptyString(value.configId) || !isRouteId(value.choiceId)) return null;
  if (value.outcomeLabel !== "Fictional mission result" || !isNonEmptyString(value.feedback)) return null;
  return {
    missionId: value.missionId,
    configId: value.configId,
    choiceId: value.choiceId,
    outcomeLabel: value.outcomeLabel,
    feedback: value.feedback,
  };
}

export function createMissionOutcome(scenario: MissionDefinition, input: unknown): MissionOutcome | null {
  const request = parseMissionChoiceRequest(input);
  if (!request || request.missionId !== scenario.missionId || request.configId !== scenario.configId) return null;
  const choice = scenario.choices.find((candidate) => candidate.id === request.choiceId);
  if (!choice) return null;
  return parseMissionOutcome({
    missionId: scenario.missionId,
    configId: scenario.configId,
    choiceId: choice.id,
    outcomeLabel: "Fictional mission result",
    feedback: choice.feedback,
  });
}
