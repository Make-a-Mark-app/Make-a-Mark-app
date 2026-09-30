import type { RouteId } from "./mission.js";

export type DiscoveryRecap = {
  missionComplete: boolean;
  routeChoice: RouteId | null;
  foundToken: boolean;
  openedRecords: string[];
  topics: string[];
};

export const EMPTY_DISCOVERY: DiscoveryRecap = {
  missionComplete: false,
  routeChoice: null,
  foundToken: false,
  openedRecords: [],
  topics: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRouteId(value: unknown): value is RouteId {
  return value === "air" || value === "sea" || value === "road";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function parseDiscoveryRecap(value: unknown): DiscoveryRecap | null {
  if (!isRecord(value)) return null;
  const expectedKeys = ["missionComplete", "routeChoice", "foundToken", "openedRecords", "topics"];
  const keys = Object.keys(value);
  if (keys.length !== expectedKeys.length || !expectedKeys.every((key) => Object.hasOwn(value, key))) return null;
  if (typeof value.missionComplete !== "boolean" || typeof value.foundToken !== "boolean") return null;
  if (value.routeChoice !== null && !isRouteId(value.routeChoice)) return null;
  if (!isStringArray(value.openedRecords) || !isStringArray(value.topics)) return null;

  return {
    missionComplete: value.missionComplete,
    routeChoice: value.routeChoice,
    foundToken: value.foundToken,
    openedRecords: value.openedRecords,
    topics: value.topics,
  };
}

export function hasDiscovery(recap: DiscoveryRecap): boolean {
  return recap.missionComplete || recap.routeChoice !== null || recap.foundToken || recap.openedRecords.length > 0 || recap.topics.length > 0;
}
