export const IMPACT_REWARDS_VERSION = 1 as const;
export const MAX_IMPACT_REWARDS_COUNT = 1_000_000;
export const MAX_MISSION_COMPLETION_IDS = 500;
export const IMPACT_CONTRIBUTION_REDEMPTION_COST = 10;

export type ImpactRewardsState = {
  version: typeof IMPACT_REWARDS_VERSION;
  year: number;
  credits: number;
  treesThisYear: number;
  treesAllTime: number;
  missionCompletionIds: string[];
};

export type MissionCompletionAward =
  | { kind: "awarded"; state: ImpactRewardsState }
  | { kind: "duplicate"; state: ImpactRewardsState }
  | { kind: "limit"; state: ImpactRewardsState };

export type ImpactContributionRedemption =
  | { kind: "redeemed"; state: ImpactRewardsState }
  | { kind: "insufficient"; state: ImpactRewardsState }
  | { kind: "limit"; state: ImpactRewardsState };

export const EMPTY_IMPACT_REWARDS: ImpactRewardsState = {
  version: IMPACT_REWARDS_VERSION,
  year: new Date().getFullYear(),
  credits: 0,
  treesThisYear: 0,
  treesAllTime: 0,
  missionCompletionIds: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCounter(value: unknown): value is number {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= 0
    && value <= MAX_IMPACT_REWARDS_COUNT;
}

function isYear(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 2020 && value <= 9999;
}

function isCompletionId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 128;
}

export function parseImpactRewardsState(value: unknown): ImpactRewardsState | null {
  if (!isRecord(value)) return null;
  const expectedKeys = ["version", "year", "credits", "treesThisYear", "treesAllTime", "missionCompletionIds"];
  const keys = Object.keys(value);
  if (keys.length !== expectedKeys.length || !expectedKeys.every((key) => Object.hasOwn(value, key))) return null;
  if (value.version !== IMPACT_REWARDS_VERSION || !isYear(value.year)) return null;
  if (!isCounter(value.credits) || !isCounter(value.treesThisYear) || !isCounter(value.treesAllTime)) return null;
  if (!Array.isArray(value.missionCompletionIds) || value.missionCompletionIds.length > MAX_MISSION_COMPLETION_IDS) return null;
  if (!value.missionCompletionIds.every(isCompletionId) || new Set(value.missionCompletionIds).size !== value.missionCompletionIds.length) return null;

  return {
    version: IMPACT_REWARDS_VERSION,
    year: value.year,
    credits: value.credits,
    treesThisYear: value.treesThisYear,
    treesAllTime: value.treesAllTime,
    missionCompletionIds: [...value.missionCompletionIds],
  };
}

export function awardMissionCompletion(state: ImpactRewardsState, completionId: string): MissionCompletionAward {
  if (state.missionCompletionIds.includes(completionId)) return { kind: "duplicate", state };
  if (!isCompletionId(completionId) || state.credits >= MAX_IMPACT_REWARDS_COUNT) return { kind: "limit", state };

  return {
    kind: "awarded",
    state: {
      ...state,
      credits: state.credits + 1,
      missionCompletionIds: [...state.missionCompletionIds, completionId].slice(-MAX_MISSION_COMPLETION_IDS),
    },
  };
}

export function rolloverImpactRewardsYear(state: ImpactRewardsState, deviceYear = new Date().getFullYear()): ImpactRewardsState {
  if (!isYear(deviceYear) || deviceYear <= state.year) return state;
  return { ...state, year: deviceYear, treesThisYear: 0 };
}

export function redeemImpactContribution(state: ImpactRewardsState): ImpactContributionRedemption {
  if (state.credits < IMPACT_CONTRIBUTION_REDEMPTION_COST) return { kind: "insufficient", state };
  if (state.treesThisYear >= MAX_IMPACT_REWARDS_COUNT || state.treesAllTime >= MAX_IMPACT_REWARDS_COUNT) {
    return { kind: "limit", state };
  }

  return {
    kind: "redeemed",
    state: {
      ...state,
      credits: state.credits - IMPACT_CONTRIBUTION_REDEMPTION_COST,
      treesThisYear: state.treesThisYear + 1,
      treesAllTime: state.treesAllTime + 1,
    },
  };
}
