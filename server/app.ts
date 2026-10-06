import express, { type Express } from "express";
import { readFileSync } from "node:fs";
import { evidenceTopicTags, lookupEvidence, parseEvidenceDataset, type EvidenceRecord, type EvidenceTopicTag } from "../shared/contracts/evidence.js";
import { createMissionOutcome, parseMissionDefinition } from "../shared/contracts/mission.js";
import { parseTelemetryDataset } from "../shared/contracts/telemetry.js";
import { missionScenario } from "../shared/mission.js";
import { createEngineerResponse, type EngineerProvider } from "./engineer.js";
import type { ServiceLogWriter } from "./logging.js";
import { localMetrics } from "./observability/metrics.js";
import { ImpactStore } from "./impact-store.js";
import { PilotStore, type PilotAction } from "./pilot-store.js";
import type { ImpactExchangeKind } from "../shared/contracts/impact-totals.js";

const evidenceDataset = parseEvidenceDataset(JSON.parse(
  readFileSync(new URL("../shared/data/evidence.r1.v2.json", import.meta.url), "utf8"),
));
const telemetryDataset = parseTelemetryDataset(JSON.parse(
  readFileSync(new URL("../shared/data/telemetry.r1.v2.json", import.meta.url), "utf8"),
));

export function createApp(options: { provider?: EngineerProvider; engineerRecords?: EvidenceRecord[]; logger?: ServiceLogWriter; impactStore?: ImpactStore; pilotStore?: PilotStore } = {}): Express {
  const app = express();
  const impactStore = options.impactStore ?? new ImpactStore();
  const pilotStore = options.pilotStore ?? new PilotStore();

  app.use((request, response, next) => {
    const startedAt = process.hrtime.bigint();
    response.once("finish", () => {
      const routePath = typeof request.route?.path === "string" ? request.route.path : request.path;
      const route = ["/api/health", "/api/mission", "/api/mission/outcome", "/api/evidence", "/api/telemetry", "/api/engineer", "/api/impact-totals", "/api/impact-exchanges", "/api/pilot", "/api/pilot/metrics", "/metrics"].includes(routePath) ? routePath : "other";
      const method = request.method === "GET" || request.method === "POST" ? request.method : "OTHER";
      const statusClass = Math.floor(response.statusCode / 100) + "xx";
      const severity = response.statusCode >= 500 ? "error" : response.statusCode >= 400 ? "warn" : "info";
      const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
      localMetrics.recordRequest({ method, route, statusClass }, durationSeconds);
      if (route === "/api/engineer" && response.locals.engineerMode) {
        localMetrics.recordEngineerMode(response.locals.engineerMode);
        if (response.locals.providerError) localMetrics.recordProviderError(response.locals.providerError);
      }
      const entry = {
        severity, method, route, status: statusClass,
        duration_ms: Math.round(durationSeconds * 1000),
        ...(response.locals.engineerMode && { response_mode: response.locals.engineerMode }),
        ...(response.locals.providerError && { dependency_error_category: response.locals.providerError }),
      };
      if (options.logger) options.logger.write(entry);
      else process.stdout.write(JSON.stringify({ service: "api", environment: process.env.APP_ENV ?? "local", ...entry }) + "\n");
    });
    next();
  });

  app.use(express.json({ limit: "16kb" }));

  app.get("/metrics", (_request, response) => {
    response.type("text/plain; version=0.0.4; charset=utf-8").send(localMetrics.renderPrometheus());
  });

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok", mode: "prototype", evidence: "source-reviewed" });
  });

  app.get("/api/impact-totals", (_request, response) => {
    const totals = impactStore.totals();
    if (!totals) { response.status(503).json({ error: "Demo exchange totals are unavailable." }); return; }
    response.json(totals);
  });

  app.post("/api/impact-exchanges", (request, response) => {
    const { kind, eventId } = request.body ?? {};
    if ((kind !== "tree" && kind !== "water") || typeof eventId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId)) {
      localMetrics.recordValidationFailure("/api/impact-exchanges");
      response.status(400).json({ error: "Invalid demo exchange." }); return;
    }
    const totals = impactStore.record(kind as ImpactExchangeKind, eventId);
    if (!totals) { response.status(503).json({ error: "Could not record the demo exchange." }); return; }
    response.json(totals);
  });

  const isId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  app.get("/api/pilot/metrics", (_request, response) => {
    const metrics = pilotStore.metrics();
    if (!metrics) { response.status(503).json({ error: "Pilot metrics are unavailable." }); return; }
    response.json(metrics);
  });
  app.get("/api/pilot", (request, response) => {
    if (!isId(request.query.id)) { response.status(400).json({ error: "Invalid participant ID." }); return; }
    response.json({ participant: pilotStore.participant(request.query.id) });
  });
  app.post("/api/pilot", (request, response) => {
    const { id, action, referralCode, recall, interest } = request.body ?? {};
    const validAction = ["start", "complete", "share", "offer_use", "feedback"].includes(action);
    if (!isId(id) || !validAction || (referralCode !== undefined && !isId(referralCode)) ||
      (recall !== undefined && recall !== "yes" && recall !== "no") ||
      (interest !== undefined && !["more", "same", "less"].includes(interest)) ||
      (action === "feedback" && (!recall || !interest))) {
      localMetrics.recordValidationFailure("/api/pilot");
      response.status(400).json({ error: "Invalid pilot event." }); return;
    }
    const participant = pilotStore.record(id, action as PilotAction, { referralCode, recall, interest });
    if (!participant) { response.status(409).json({ error: "Complete the preceding pilot step or try again later." }); return; }
    response.json({ participant, metrics: pilotStore.metrics() });
  });

  app.get("/api/mission", (_request, response) => {
    const mission = parseMissionDefinition(missionScenario);
    if (!mission) {
      response.status(500).json({ error: "Mission scenario is unavailable." });
      return;
    }
    response.json(mission);
  });

  app.post("/api/mission/outcome", (request, response) => {
    const outcome = createMissionOutcome(missionScenario, request.body);
    if (!outcome) {
      localMetrics.recordValidationFailure("/api/mission/outcome");
      response.status(400).json({ error: "Mission outcome request is invalid." });
      return;
    }
    response.json(outcome);
  });

  app.get("/api/evidence", (request, response) => {
    if (!evidenceDataset) {
      response.status(500).json({ error: "Evidence records are unavailable." });
      return;
    }
    const { q: rawQuery, pillar, topic: topicTag, period } = request.query;
    const query = typeof rawQuery === "string" ? rawQuery.trim() : "";
    if (
      (rawQuery !== undefined && typeof rawQuery !== "string") || (pillar !== undefined && typeof pillar !== "string") ||
      (topicTag !== undefined && typeof topicTag !== "string") || (period !== undefined && typeof period !== "string") ||
      query.length > 200 || (pillar && !["Environment", "Belong", "Community"].includes(pillar)) ||
      (topicTag && !evidenceTopicTags.includes(topicTag as EvidenceTopicTag)) || (period && period.length > 80)
    ) {
      response.status(400).json({ error: "Evidence lookup filters are invalid." });
      return;
    }
    const records = lookupEvidence(evidenceDataset.records, {
      query,
      ...(pillar && { pillar: pillar as "Environment" | "Belong" | "Community" }),
      ...(topicTag && { topicTag: topicTag as EvidenceTopicTag }),
      ...(period && { period }),
      limit: 10,
    });
    response.json({
      version: evidenceDataset.version,
      status: records.length ? "matched" : "not_enough_evidence",
      message: records.length ? undefined : "Not enough evidence in the reviewed records to support this query.",
      records,
    });
  });

  app.get("/api/telemetry", (_request, response) => {
    if (!telemetryDataset) {
      response.status(500).json({ error: "The simulated telemetry fixture is unavailable." });
      return;
    }
    response.json(telemetryDataset);
  });

  app.post("/api/engineer", async (request, response) => {
    if (!evidenceDataset || !telemetryDataset) {
      response.status(500).json({ error: "The Engineer source context is unavailable." });
      return;
    }
    const result = await createEngineerResponse(request.body, {
      records: options.engineerRecords ?? evidenceDataset.records,
      mission: missionScenario,
      telemetry: telemetryDataset,
      ...(options.provider && { provider: options.provider }),
    });
    if (!result) {
      localMetrics.recordValidationFailure("/api/engineer");
      response.status(400).json({ error: "Enter a valid question and optional context." });
      return;
    }
    response.locals.engineerMode = result.mode;
    if (result.dependencyErrorCategory) response.locals.providerError = result.dependencyErrorCategory;
    const { dependencyErrorCategory: _dependencyErrorCategory, ...publicResult } = result;
    response.json(publicResult);
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, next: express.NextFunction) => {
    if (response.headersSent) { next(error); return; }
    const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
    if (status === 413) {
      response.status(413).json({ error: "Engineer request body exceeds the 16KB limit." });
      return;
    }
    if (error instanceof SyntaxError) {
      response.status(400).json({ error: "Engineer request JSON is invalid." });
      return;
    }
    next(error);
  });

  app.use(express.static("dist"));
  app.get("*", (_request, response, next) => {
    response.sendFile("index.html", { root: "dist" }, (error) => error && next());
  });
  return app;
}
