import { expect, test } from "@playwright/test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createPilotStore } from "../server/pilot";
import { PILOT_RECALL_ANSWER } from "../shared/contracts/pilot";

test("demo pilot store deduplicates starts and completions, attributes referrals, and counts offer use", () => {
  const directory = mkdtempSync(join(tmpdir(), "impact-pilot-"));
  const file = join(directory, "pilot.json");
  try {
    const store = createPilotStore(file);
    const firstId = "11111111-1111-4111-8111-111111111111";
    const secondId = "22222222-2222-4222-8222-222222222222";
    const firstJoin = { type: "joined", participantId: firstId, referralCode: "MM-1111111111", referredBy: null };
    expect(store.record({ type: "completed", participantId: firstId }).status).toBe(409);
    expect(store.record(firstJoin).status).toBe(200);
    expect(store.record(firstJoin).status).toBe(200);
    expect(store.record({ type: "completed", participantId: firstId }).status).toBe(200);
    expect(store.record({ type: "completed", participantId: firstId }).status).toBe(200);
    expect(store.record({ type: "shared", participantId: firstId }).status).toBe(200);
    expect(store.record({ type: "offer_used", participantId: firstId }).status).toBe(200);
    expect(store.record({ type: "offer_used", participantId: firstId }).status).toBe(200);
    expect(store.record({ type: "survey_submitted", participantId: firstId, recallAnswer: PILOT_RECALL_ANSWER, interestAnswer: "A little more interested" }).status).toBe(200);
    expect(store.record({ type: "joined", participantId: secondId, referralCode: "MM-2222222222", referredBy: "MM-1111111111" }).status).toBe(200);
    expect(store.record({ type: "shared", participantId: secondId }).status).toBe(409);
    expect(store.record({ type: "joined", participantId: "33333333-3333-4333-8333-333333333333", referralCode: "MM-1111111111", referredBy: null }).status).toBe(409);
    expect(store.record({ type: "offer_used", participantId: firstId, amount: 100 }).status).toBe(400);
    expect(createPilotStore(file).metrics()).toEqual({
      joined: 2, completed: 1, sharers: 1, shareActions: 1, referredJoins: 1,
      demoOfferUses: 1, surveyResponses: 1, correctRecall: 1, increasedInterest: 1,
    });
    let clock = 1_800_000_000_000;
    const expiring = createPilotStore(join(directory, "expiry.json"), () => clock);
    expect(expiring.record({ type: "joined", participantId: firstId, referralCode: "MM-1111111111", referredBy: null }).status).toBe(200);
    expect(expiring.record({ type: "completed", participantId: firstId }).status).toBe(200);
    clock += 15 * 24 * 60 * 60 * 1000;
    expect(expiring.record({ type: "offer_used", participantId: firstId }).status).toBe(409);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
