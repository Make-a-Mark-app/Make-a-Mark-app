import express, { type Express } from "express";
import { readFileSync } from "node:fs";
import { evidenceTopicTags, lookupEvidence, parseEvidenceDataset, type EvidenceRecord, type EvidenceTopicTag } from "../shared/contracts/evidence.js";
import { createMissionOutcome, parseMissionDefinition } from "../shared/contracts/mission.js";
import { parseTelemetryDataset } from "../shared/contracts/telemetry.js";
import { missionScenario } from "../shared/mission.js";
import { createEngineerResponse, type EngineerProvider } from "./engineer.js";
import { localMetrics } from "./observability/metrics.js";

const evidenceDataset = parseEvidenceDataset(JSON.parse(
  readFileSync(new URL("../shared/data/evidence.r1.v2.json", import.meta.url), "utf8"),
));
const telemetryDataset = parseTelemetryDataset(JSON.parse(
  readFileSync(new URL("../shared/data/telemetry.r1.v2.json", import.meta.url), "utf8"),
));

export function createApp(options: { provider?: EngineerProvider; engineerRecords?: EvidenceRecord[] } = {}): Express {
  const app = express();

  app.use((request, response, next) => {
    const startedAt = process.hrtime.bigint();
    response.once("finish", () => {
      const routePath = typeof request.route?.path === "string" ? request.route.path : "other";
      const route = ["/api/health", "/api/mission", "/api/mission/outcome", "/api/evidence", "/api/telemetry", "/api/engineer", "/metrics"].includes(routePath) ? routePath : "other";
      const method = request.method === "GET" || request.method === "POST" ? request.method : "OTHER";
      const statusClass = Math.floor(response.statusCode / 100) + "xx";
      const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
      localMetrics.recordRequest({ method, route, statusClass }, durationSeconds);
      if (route === "/api/engineer" && response.locals.engineerMode) {
        localMetrics.recordEngineerMode(response.locals.engineerMode);
        if (response.locals.providerError) localMetrics.recordProviderError(response.locals.providerError);
      }
      const entry = {
        timestamp: new Date().toISOString(), service: "api", environment: process.env.APP_ENV ?? "local",
        severity: response.statusCode >= 500 ? "error" : "info", method, route, status_class: statusClass,
        duration_ms: Math.round(durationSeconds * 1000),
        ...(response.locals.engineerMode && { response_mode: response.locals.engineerMode }),
        ...(response.locals.providerError && { dependency_error_category: response.locals.providerError }),
      };
      process.stdout.write(JSON.stringify(entry) + "\n");
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
    response.json(result);
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
