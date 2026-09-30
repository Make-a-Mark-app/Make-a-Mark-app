import express from "express";
import { createServer } from "node:http";
import { createMissionOutcome, parseMissionDefinition } from "../shared/contracts/mission.js";
import { missionScenario } from "../shared/mission.js";

const app = express();
const port = Number(process.env.PORT ?? 4178);

app.use(express.json({ limit: "8kb" }));

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", mode: "prototype", evidence: "illustrative-only" });
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

app.post("/api/engineer", (request, response) => {
  const question = typeof request.body?.question === "string" ? request.body.question.trim() : "";
  if (!question || question.length > 500) {
    response.status(400).json({ error: "Enter a question of 1–500 characters." });
    return;
  }

  response.json({
    answer: "I can explain the mission choices, but this prototype does not yet contain approved report evidence. Add reviewed records to get a sourced explanation here.",
    whatSourceStates: "No approved source records are connected in this prototype build.",
    whatItMeans: "The route outcome is a fictional game scenario. It does not represent AMF1 operations or an environmental result.",
    limitations: ["Prepared response; live AI is not connected.", "No source evidence has been approved for this prototype."],
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
