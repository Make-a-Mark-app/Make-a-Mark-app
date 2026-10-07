export type CampaignPilotState = {
  participantId: string;
  referralCode: string;
  referredBy: string | null;
  started: boolean;
  completed: boolean;
  completedAt: number | null;
  shareActions: number;
  offerViews: number;
  offerUsed: boolean;
  recallAnswer: string | null;
  interestAnswer: string | null;
};

const STORAGE_KEY = "impact-drive-campaign-pilot-v1";
const referralPattern = /^MM-[A-F0-9]{10}$/;

function newReferralCode(): string {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return `MM-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

export function readCampaignPilot(): CampaignPilotState {
  const incoming = new URLSearchParams(window.location.search).get("ref")?.toUpperCase() ?? null;
  let saved: Partial<CampaignPilotState> = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) saved = parsed as Partial<CampaignPilotState>;
    }
  } catch { /* The prototype still works without storage. */ }
  const referralCode = typeof saved.referralCode === "string" && referralPattern.test(saved.referralCode)
    ? saved.referralCode : newReferralCode();
  return {
    participantId: typeof saved.participantId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(saved.participantId) ? saved.participantId : crypto.randomUUID(),
    referralCode,
    referredBy: typeof saved.referredBy === "string" && referralPattern.test(saved.referredBy) && saved.referredBy !== referralCode
      ? saved.referredBy : incoming && referralPattern.test(incoming) && incoming !== referralCode ? incoming : null,
    started: saved.started === true,
    completed: saved.completed === true,
    completedAt: saved.completed === true && typeof saved.completedAt === "number" && Number.isFinite(saved.completedAt) && saved.completedAt > 0
      ? saved.completedAt : saved.completed === true ? Date.now() : null,
    shareActions: Number.isSafeInteger(saved.shareActions) && (saved.shareActions ?? 0) >= 0 ? saved.shareActions! : 0,
    offerViews: Number.isSafeInteger(saved.offerViews) && (saved.offerViews ?? 0) >= 0 ? saved.offerViews! : 0,
    offerUsed: saved.offerUsed === true,
    recallAnswer: typeof saved.recallAnswer === "string" ? saved.recallAnswer : null,
    interestAnswer: typeof saved.interestAnswer === "string" ? saved.interestAnswer : null,
  };
}

export function saveCampaignPilot(state: CampaignPilotState): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch { /* Local state remains available for this visit. */ }
}
