import express from "express";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { createMissionOutcome, parseMissionDefinition } from "../shared/contracts/mission.js";
import { isReportedImpact, parseEvidenceDataset } from "../shared/contracts/evidence.js";
import { parseTelemetryDataset } from "../shared/contracts/telemetry.js";
import { missionScenario } from "../shared/mission.js";

const app = express();
const port = Number(process.env.PORT ?? 4178);
const evidenceDataset = parseEvidenceDataset(JSON.parse(
  readFileSync(new URL("../shared/data/evidence.r1.v1.json", import.meta.url), "utf8"),
));
const telemetryDataset = parseTelemetryDataset(JSON.parse(
  readFileSync(new URL("../shared/data/telemetry.r1.v1.json", import.meta.url), "utf8"),
));

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

app.post("/api/engineer", (request, response) => {
  const question = typeof request.body?.question === "string" ? request.body.question.trim() : "";
  if (!question || question.length > 500) {
    response.status(400).json({ error: "Enter a question of 1–500 characters." });
    return;
  }

  response.json({
    answer: "I can explain the mission choices. The evidence library contains a small source-reviewed set, but this prepared response does not retrieve or interpret those records yet.",
    whatSourceStates: "The library is available to browse; this response has not retrieved a source record.",
    whatItMeans: "The route outcome is a fictional game scenario. It does not represent AMF1 operations or an environmental result.",
    limitations: ["Prepared response; live AI and evidence retrieval are not connected."],
    citations: [],
    relatedRecordIds: [],
    mode: "prepared_fallback",
  });
});

app.use(express.static("dist"));
app.get("*", (_request, response, next) => {
  response.sendFile("index.html", { root: "dist" }, (error) => error && next());
});

createServer(app).listen(port, "0.0.0.0", () => {
  console.log(`Impact Drive API listening on http://0.0.0.0:${port}`);
});
