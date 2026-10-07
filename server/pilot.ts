import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { PILOT_INTEREST_ANSWERS, PILOT_RECALL_ANSWER, type PilotEvent, type PilotMetrics } from "../shared/contracts/pilot.js";

type Participant = {
  referralCode: string;
  referredBy: string | null;
  joined: boolean;
  completed: boolean;
  completedAt: number | null;
  shareActions: number;
  offerUsed: boolean;
  recallAnswer: string | null;
  interestAnswer: string | null;
};
type Store = { version: 1; participants: Record<string, Participant> };
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const referralPattern = /^MM-[A-F0-9]{10}$/;
const recallChoices = new Set([PILOT_RECALL_ANSWER, "My game choices measured real emissions savings", "A tree was planted when I finished"]);

function loadStore(file: string): Store | null {
  try {
    const value: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (typeof value !== "object" || value === null || !Object.hasOwn(value, "participants")) return null;
    const store = value as Store;
    if (store.version !== 1 || typeof store.participants !== "object" || store.participants === null || Array.isArray(store.participants)) return null;
    if (!Object.entries(store.participants).every(([id, p]) => idPattern.test(id) && p && referralPattern.test(p.referralCode) &&
      (p.referredBy === null || referralPattern.test(p.referredBy)) && typeof p.joined === "boolean" && typeof p.completed === "boolean" &&
      (p.completedAt === null || p.completedAt === undefined || typeof p.completedAt === "number" && Number.isFinite(p.completedAt) && p.completedAt > 0) &&
      Number.isSafeInteger(p.shareActions) && p.shareActions >= 0 && typeof p.offerUsed === "boolean" &&
      (p.recallAnswer === null || recallChoices.has(p.recallAnswer)) &&
      (p.interestAnswer === null || PILOT_INTEREST_ANSWERS.includes(p.interestAnswer as typeof PILOT_INTEREST_ANSWERS[number])))) return null;
    return store;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: 1, participants: {} };
    return null;
  }
}

function parseEvent(value: unknown): PilotEvent | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.participantId !== "string" || !idPattern.test(item.participantId)) return null;
  if (item.type === "joined") {
    if (typeof item.referralCode !== "string" || !referralPattern.test(item.referralCode) ||
      !(item.referredBy === null || typeof item.referredBy === "string" && referralPattern.test(item.referredBy)) ||
      Object.keys(item).sort().join(",") !== "participantId,referralCode,referredBy,type") return null;
    return item as PilotEvent;
  }
  if (item.type === "survey_submitted") {
    if (typeof item.recallAnswer !== "string" || !recallChoices.has(item.recallAnswer) ||
      typeof item.interestAnswer !== "string" || !PILOT_INTEREST_ANSWERS.includes(item.interestAnswer as typeof PILOT_INTEREST_ANSWERS[number]) ||
      Object.keys(item).sort().join(",") !== "interestAnswer,participantId,recallAnswer,type") return null;
    return item as PilotEvent;
  }
  if ((item.type === "completed" || item.type === "shared" || item.type === "offer_used") && Object.keys(item).sort().join(",") === "participantId,type") return item as PilotEvent;
  return null;
}

function aggregate(store: Store): PilotMetrics {
  const participants = Object.values(store.participants);
  return {
    joined: participants.filter((p) => p.joined).length,
    completed: participants.filter((p) => p.completed).length,
    sharers: participants.filter((p) => p.shareActions > 0).length,
    shareActions: participants.reduce((sum, p) => sum + p.shareActions, 0),
    referredJoins: participants.filter((p) => p.referredBy !== null).length,
    demoOfferUses: participants.filter((p) => p.offerUsed).length,
    surveyResponses: participants.filter((p) => p.recallAnswer !== null && p.interestAnswer !== null).length,
    correctRecall: participants.filter((p) => p.recallAnswer === PILOT_RECALL_ANSWER).length,
    increasedInterest: participants.filter((p) => p.interestAnswer === "A little more interested" || p.interestAnswer === "Much more interested").length,
  };
}

export function createPilotStore(file: string, now: () => number = Date.now) {
  let store = loadStore(file);
  return {
    metrics: (): PilotMetrics | null => store ? aggregate(store) : null,
    record(value: unknown): { status: 200 | 400 | 409 | 503; metrics?: PilotMetrics } {
      if (!store) return { status: 503 };
      const event = parseEvent(value);
      if (!event) return { status: 400 };
      const participants = { ...store.participants };
      const current = participants[event.participantId];
      if (event.type === "joined") {
        if (current) {
          if (current.referralCode !== event.referralCode) return { status: 409 };
          return { status: 200, metrics: aggregate(store) };
        }
        if (Object.keys(participants).length >= 10_000) return { status: 409 };
        if (Object.values(participants).some((p) => p.referralCode === event.referralCode)) return { status: 409 };
        const referrer = Object.values(participants).find((p) => p.referralCode === event.referredBy && p.completed);
        participants[event.participantId] = {
          referralCode: event.referralCode,
          referredBy: referrer ? event.referredBy : null,
          joined: true, completed: false, completedAt: null, shareActions: 0, offerUsed: false, recallAnswer: null, interestAnswer: null,
        };
      } else {
        if (!current?.joined) return { status: 409 };
        if (event.type !== "completed" && !current.completed) return { status: 409 };
        participants[event.participantId] = { ...current };
        if (event.type === "completed") {
          participants[event.participantId].completed = true;
          participants[event.participantId].completedAt = current.completedAt ?? now();
        }
        if (event.type === "shared") {
          if (current.shareActions >= 1_000) return { status: 409 };
          participants[event.participantId].shareActions += 1;
        }
        if (event.type === "offer_used") {
          if (!current.offerUsed && (!current.completedAt || now() >= current.completedAt + 14 * 24 * 60 * 60 * 1000)) return { status: 409 };
          participants[event.participantId].offerUsed = true;
        }
        if (event.type === "survey_submitted") {
          participants[event.participantId].recallAnswer = event.recallAnswer;
          participants[event.participantId].interestAnswer = event.interestAnswer;
        }
      }
      const next: Store = { version: 1, participants };
      try {
        mkdirSync(dirname(file), { recursive: true });
        const temporaryFile = `${file}.${process.pid}.tmp`;
        writeFileSync(temporaryFile, JSON.stringify(next), { mode: 0o600 });
        renameSync(temporaryFile, file);
        store = next;
        return { status: 200, metrics: aggregate(next) };
      } catch { return { status: 503 }; }
    },
  };
}
