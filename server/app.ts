import express, { type Express } from "express";
import { readFileSync } from "node:fs";
import { isReportedImpact, parseEvidenceDataset } from "../shared/contracts/evidence.js";
import { createMissionOutcome, parseMissionDefinition } from "../shared/contracts/mission.js";
import { parseTelemetryDataset } from "../shared/contracts/telemetry.js";
import { missionScenario } from "../shared/mission.js";
import { createHttpEngineerProvider, createEngineerResponse, type EngineerProvider } from "./engineer.js";

const evidenceDataset = parseEvidenceDataset(JSON.parse(
  readFileSync(new URL("../shared/data/evidence.r1.v1.json", import.meta.url), "utf8"),
));
const telemetryDataset = parseTelemetryDataset(JSON.parse(
  readFileSync(new URL("../shared/data/telemetry.r1.v2.json", import.meta.url), "utf8"),
));

export function createApp(options: { provider?: EngineerProvider } = {}): Express {
  const app = express();
  const provider = options.provider ?? configuredProvider();

  app.use(express.json({ limit: "8kb" }));

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
      response.status(400).json({ error: "Mission outcome request is invalid." });
      return;
    }
    response.json(outcome);
  });

  app.get("/api/evidence", (_request, response) => {
    if (!evidenceDataset) {
      response.status(500).json({ error: "Evidence records are unavailable." });
      return;
    }
    response.json({ version: evidenceDataset.version, records: evidenceDataset.records.filter(isReportedImpact) });
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
      records: evidenceDataset.records,
      mission: missionScenario,
      telemetry: telemetryDataset,
      ...(provider && { provider }),
    });
    if (!result) {
      response.status(400).json({ error: "Enter a valid question and optional context." });
      return;
    }
    response.json(result);
  });

  app.use(express.static("dist"));
  app.get("*", (_request, response, next) => {
    response.sendFile("index.html", { root: "dist" }, (error) => error && next());
  });
  return app;
}

function configuredProvider(): EngineerProvider | undefined {
  const endpoint = process.env.ENGINEER_PROVIDER_URL;
  if (!endpoint) return undefined;
  try {
    const parsed = new URL(endpoint);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return undefined;
    return createHttpEngineerProvider(parsed.href, process.env.ENGINEER_PROVIDER_API_KEY);
  } catch {
    return undefined;
  }
}
