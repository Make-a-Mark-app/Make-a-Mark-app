import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

export type PilotParticipant = {
  started: boolean;
  shareCode: string;
  completed: boolean;
  completedAt: string | null;
  shared: boolean;
  offerUsed: boolean;
  referredBy: string | null;
  recall: "yes" | "no" | null;
  interest: "more" | "same" | "less" | null;
};

export type PilotMetrics = {
  started: number;
  completed: number;
  shared: number;
  referralStarts: number;
  offerUsed: number;
  feedbackResponses: number;
  messageRemembered: number;
  greaterInterest: number;
};

type StoredPilot = { version: 1; participants: Record<string, PilotParticipant> };
export type PilotAction = "start" | "complete" | "share" | "offer_use" | "feedback";

const emptyParticipant = (referredBy: string | null): PilotParticipant => ({
  started: true, shareCode: randomUUID(), completed: false, completedAt: null, shared: false, offerUsed: false,
  referredBy, recall: null, interest: null,
});

function validParticipant(value: unknown): value is PilotParticipant {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<PilotParticipant>;
  return entry.started === true && typeof entry.shareCode === "string" && typeof entry.completed === "boolean" &&
    (entry.completedAt === null || (typeof entry.completedAt === "string" && !Number.isNaN(Date.parse(entry.completedAt)))) &&
    typeof entry.shared === "boolean" && typeof entry.offerUsed === "boolean" &&
    (entry.referredBy === null || typeof entry.referredBy === "string") &&
    (entry.recall === null || entry.recall === "yes" || entry.recall === "no") &&
    (entry.interest === null || entry.interest === "more" || entry.interest === "same" || entry.interest === "less");
}

export class PilotStore {
  private readonly file: string;
  private state: StoredPilot | null;

  constructor(file = process.env.PILOT_DATA_FILE ?? "data/pilot-demo.json") {
    this.file = resolve(file);
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.file, "utf8"));
      if (!parsed || typeof parsed !== "object" || (parsed as StoredPilot).version !== 1 ||
        !((parsed as StoredPilot).participants && typeof (parsed as StoredPilot).participants === "object") ||
        !Object.values((parsed as StoredPilot).participants ?? {}).every(validParticipant)) throw new Error("Invalid pilot data");
      this.state = parsed as StoredPilot;
    } catch (error) {
      this.state = (error as NodeJS.ErrnoException).code === "ENOENT" ? { version: 1, participants: {} } : null;
    }
  }

  participant(id: string): PilotParticipant | null {
    return this.state?.participants[id] ?? null;
  }

  metrics(): PilotMetrics | null {
    if (!this.state) return null;
    const participants = Object.values(this.state.participants);
    return {
      started: participants.length,
      completed: participants.filter((p) => p.completed).length,
      shared: participants.filter((p) => p.shared).length,
      referralStarts: participants.filter((p) => p.referredBy !== null).length,
      offerUsed: participants.filter((p) => p.offerUsed).length,
      feedbackResponses: participants.filter((p) => p.recall !== null && p.interest !== null).length,
      messageRemembered: participants.filter((p) => p.recall === "yes").length,
      greaterInterest: participants.filter((p) => p.interest === "more").length,
    };
  }

  record(id: string, action: PilotAction, input: { referralCode?: string; recall?: "yes" | "no"; interest?: "more" | "same" | "less" } = {}): PilotParticipant | null {
    if (!this.state) return null;
    const current = this.state.participants[id];
    if (action !== "start" && !current) return null;
    if (action !== "start" && !current?.completed && action !== "complete") return null;
    if (action === "feedback" && (!input.recall || !input.interest)) return null;
    if (action === "offer_use" && (!current?.completedAt || Date.now() >= Date.parse(current.completedAt) + 14 * 24 * 60 * 60 * 1000)) return null;
    const referrer = input.referralCode ? Object.entries(this.state.participants).find(([, participant]) => participant.shareCode === input.referralCode && participant.completed) : null;
    const referredBy = referrer && referrer[0] !== id ? referrer[0] : null;
    const next: PilotParticipant = action === "start" ? current ?? emptyParticipant(referredBy) : {
      ...current!,
      completed: current!.completed || action === "complete",
      completedAt: action === "complete" ? current!.completedAt ?? new Date().toISOString() : current!.completedAt,
      shared: current!.shared || action === "share",
      offerUsed: current!.offerUsed || action === "offer_use",
      recall: action === "feedback" ? current!.recall ?? input.recall! : current!.recall,
      interest: action === "feedback" ? current!.interest ?? input.interest! : current!.interest,
    };
    const updated: StoredPilot = { version: 1, participants: { ...this.state.participants, [id]: next } };
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      const temporaryFile = `${this.file}.${process.pid}.tmp`;
      writeFileSync(temporaryFile, JSON.stringify(updated), { mode: 0o600 });
      renameSync(temporaryFile, this.file);
      this.state = updated;
      return next;
    } catch { return null; }
  }
}
