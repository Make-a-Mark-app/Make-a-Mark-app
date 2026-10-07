import express from "express";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createMissionOutcome, parseMissionDefinition } from "../shared/contracts/mission.js";
import { isReportedImpact, parseEvidenceDataset } from "../shared/contracts/evidence.js";
import { parseTelemetryDataset } from "../shared/contracts/telemetry.js";
import { missionScenario } from "../shared/mission.js";
import { createEngineerResponse, createHttpEngineerProvider, createKiraEngineerProvider } from "./engineer.js";
import { createPilotStore } from "./pilot.js";
import { ImpactStore } from "./impact-store.js";

const app = express();
const port = Number(process.env.PORT ?? 4180);
const pilotStore = createPilotStore(resolve(process.env.PILOT_DATA_FILE ?? "data/pilot-demo.json"));
const impactStore = new ImpactStore();
const evidenceDataset = parseEvidenceDataset(JSON.parse(
  readFileSync(new URL("../shared/data/evidence.r1.v2.json", import.meta.url), "utf8"),
));
const telemetryDataset = parseTelemetryDataset(JSON.parse(
  readFileSync(new URL("../shared/data/telemetry.r1.v2.json", import.meta.url), "utf8"),
));
const engineerProvider = configuredEngineerProvider();

app.use(express.json({ limit: "8kb" }));

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", mode: "prototype", evidence: "source-reviewed" });
});

app.get("/api/pilot/metrics", (_request, response) => {
  const metrics = pilotStore.metrics();
  if (!metrics) { response.status(503).json({ error: "Demo pilot metrics are unavailable." }); return; }
  response.json({ ...metrics, mode: "prototype" });
});

app.post("/api/pilot/events", (request, response) => {
  const result = pilotStore.record(request.body);
  if (result.status !== 200) { response.status(result.status).json({ error: "Demo pilot event was not recorded." }); return; }
  response.json({ ...result.metrics, mode: "prototype" });
});

app.get("/api/impact-totals", (_request, response) => {
  const totals = impactStore.totals();
  if (!totals) { response.status(503).json({ error: "Impact exchange totals are unavailable." }); return; }
  response.json(totals);
});

app.post("/api/prototype/reset-impact", (request, response) => {
  if ((process.env.NODE_ENV === "production" && process.env.APP_ENV !== "local") || request.get("sec-fetch-site") === "cross-site") {
    response.status(403).json({ error: "Prototype reset is unavailable." }); return;
  }
  const totals = impactStore.reset();
  if (!totals) { response.status(503).json({ error: "Prototype totals could not be reset." }); return; }
  response.json(totals);
});

app.post("/api/impact-exchanges", (request, response) => {
  const { kind, eventId } = request.body ?? {};
  if ((kind !== "tree" && kind !== "water") || typeof eventId !== "string" || !/^[0-9a-f-]{36}$/i.test(eventId)) {
    response.status(400).json({ error: "Invalid impact exchange." }); return;
  }
  const totals = impactStore.record(kind, eventId);
  if (!totals) { response.status(503).json({ error: "Impact exchange could not be recorded." }); return; }
  response.json(totals);
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
    ...(engineerProvider && { provider: engineerProvider }),
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

createServer(app).listen(port, "0.0.0.0", () => {
  console.log(`Impact Drive API listening on http://0.0.0.0:${port}`);
});

function configuredEngineerProvider() {
  const kiraKey = process.env.KIRA_API_KEY?.trim();
  if (kiraKey) {
    const model = process.env.KIRA_MODEL?.trim() || "gpt-oss-120b";
    if (/^[a-zA-Z0-9._-]{1,100}$/.test(model)) return createKiraEngineerProvider(kiraKey, model);
  }
  const endpoint = process.env.ENGINEER_PROVIDER_URL;
  if (endpoint) {
    try {
      const parsed = new URL(endpoint);
      if (parsed.protocol === "https:" && !parsed.username && !parsed.password) {
        return createHttpEngineerProvider(parsed.href, process.env.ENGINEER_PROVIDER_API_KEY);
      }
    } catch {
      // Fall through to the no-provider response path.
    }
  }
  return undefined;
}
