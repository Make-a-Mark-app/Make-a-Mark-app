import type { EvidenceRecord } from "../shared/contracts/evidence.js";
import { isReportedImpact } from "../shared/contracts/evidence.js";
import { createMissionOutcome, type MissionDefinition } from "../shared/contracts/mission.js";
import type { TelemetryDataset, TelemetrySnapshot } from "../shared/contracts/telemetry.js";
import { parseEngineerRequest, type EngineerRequest } from "../shared/contracts/engineer.js";

type EngineerCitation = {
  recordId: string;
  title: string;
  sourceTitle: string;
  sourceUrl: string;
  reportingPeriod: string | null;
  sourceLocation: string | null;
};

export type EngineerResponse = {
  answer: string;
  whatSourceStates: string;
  whatItMeans: string;
  limitations: string[];
  citations: EngineerCitation[];
  relatedRecordIds: string[];
  mode: "grounded_ai" | "prepared_fallback" | "no_answer";
};

export type EngineerProviderInput = {
  question: string;
  detailLevel: "concise" | "detailed";
  records: EvidenceRecord[];
  missionSummary?: { title: string; selectedRoute: string; feedback: string };
  telemetrySnapshot?: TelemetrySnapshot;
};

export type EngineerProvider = (input: EngineerProviderInput) => Promise<unknown>;

export type EngineerDependencies = {
  records: EvidenceRecord[];
  mission: MissionDefinition;
  telemetry: TelemetryDataset;
  provider?: EngineerProvider;
};

const stopWords = new Set(["a", "an", "and", "are", "about", "can", "carbon", "does", "do", "figure", "footprint", "for", "how", "i", "in", "is", "it", "lifetime", "me", "my", "of", "on", "or", "please", "report", "say", "team", "the", "this", "to", "total", "what", "with"]);

function tokens(value: string): string[] {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").match(/[a-z0-9]+/g) ?? [];
}

function retrieveRecords(question: string, records: EvidenceRecord[]): EvidenceRecord[] {
  const terms = [...new Set(tokens(question).filter((term) => !stopWords.has(term)))];
  if (!terms.length) return [];
  return records.filter(isReportedImpact).map((record) => {
    const words = new Set(tokens(record.id + " " + record.title + " " + record.topic + " " + record.claim));
    const score = terms.reduce((count, term) => count + (words.has(term) ? 1 : 0), 0);
    const exact = tokens(record.id).join(" ") === tokens(question).join(" ") || tokens(record.title).join(" ") === tokens(question).join(" ");
    return { record, score: exact ? terms.length + 1 : score };
  }).filter(({ score }) => score > 0).sort((left, right) => right.score - left.score)
    .slice(0, 3).map(({ record }) => record);
}

function selectedContextSupportsQuestion(question: string, mission?: EngineerProviderInput["missionSummary"], telemetry?: TelemetrySnapshot): boolean {
  const words = new Set(tokens(question));
  const missionTerms = ["air", "choice", "deliver", "delivery", "freight", "game", "mission", "road", "route", "sea", "scenario"];
  const telemetryTerms = ["battery", "energy", "feed", "pressure", "signal", "snapshot", "stale", "status", "temperature", "telemetry", "tyre", "value", "updating", "delayed", "unavailable"];
  return Boolean(
    (mission && missionTerms.some((term) => words.has(term)))
    || (telemetry && telemetryTerms.some((term) => words.has(term))),
  );
}

function resolveContext(request: EngineerRequest, dependencies: EngineerDependencies) {
  let missionSummary: EngineerProviderInput["missionSummary"];
  if (request.context?.mission) {
    const selection = request.context.mission;
    if (selection.missionId !== dependencies.mission.missionId || selection.configId !== dependencies.mission.configId) return null;
    const choice = dependencies.mission.choices.find((item) => item.id === selection.choiceId);
    const outcome = createMissionOutcome(dependencies.mission, selection);
    if (!choice || !outcome) return null;
    missionSummary = { title: dependencies.mission.title, selectedRoute: choice.name, feedback: outcome.feedback };
  }

  let telemetrySnapshot: TelemetrySnapshot | undefined;
  if (request.context?.telemetry) {
    telemetrySnapshot = dependencies.telemetry.snapshots.find(({ stepId }) => stepId === request.context?.telemetry?.stepId);
    if (!telemetrySnapshot) return null;
  }
  return { missionSummary, telemetrySnapshot };
}

function citationsFor(records: EvidenceRecord[]): EngineerCitation[] {
  return records.map((record) => ({
    recordId: record.id,
    title: record.title,
    sourceTitle: record.source.title,
    sourceUrl: record.source.url,
    reportingPeriod: record.reportingPeriod,
    sourceLocation: record.source.location,
  }));
}

function describeGrounding(records: EvidenceRecord[], mission?: EngineerProviderInput["missionSummary"], telemetry?: TelemetrySnapshot) {
  const sourceText = records.map(({ claim }) => claim).join(" ");
  const contextText = [
    mission && "Fictional mission: " + mission.selectedRoute + " route. " + mission.feedback,
    telemetry && "Simulated snapshot " + telemetry.stepId + " (" + telemetry.status + ") at " + telemetry.timestamp + ". Prepared signals: " + telemetry.signals.map((signal) => signal.name + ": " + (signal.value === null ? "Unavailable" : signal.value + " " + signal.unit)).join("; ") + ".",
  ].filter(Boolean).join(" ");
  const limitations = [...new Set(records.flatMap(({ limitations: notes }) => notes))];
  if (mission) limitations.push("Mission route and outcome are fictional game content, not AMF1 operations.");
  if (telemetry) limitations.push("Telemetry values are simulated fixture data, not a live AMF1 feed.");
  return { sourceText: sourceText || "No report record was retrieved for this question.", contextText, limitations };
}

function preparedResponse(records: EvidenceRecord[], mission?: EngineerProviderInput["missionSummary"], telemetry?: TelemetrySnapshot, providerUnavailable = false, detailLevel: "concise" | "detailed" = "concise"): EngineerResponse {
  const grounding = describeGrounding(records, mission, telemetry);
  const explanation = [
    records.map(({ claim }) => claim).join(" "),
    mission && mission.selectedRoute + ": " + mission.feedback,
    telemetry && "Snapshot " + telemetry.stepId + " is " + telemetry.status + ". " + telemetry.signals.map((signal) => signal.name + ": " + (signal.value === null ? "Unavailable" : signal.value + " " + signal.unit)).join("; ") + ".",
  ].filter(Boolean).join(" ");
  const detail = detailLevel === "detailed" ? records.map((record) => {
    return " Source: " + record.source.title + " (" + (record.reportingPeriod ?? "reporting period not stated") + ")" + (record.source.location ? ", " + record.source.location : "") + ". " + record.limitations.join(" ");
  }).join(" ") : "";
  return {
    answer: explanation + detail,
    whatSourceStates: [grounding.sourceText, grounding.contextText].filter(Boolean).join(" "),
    whatItMeans: records.flatMap(({ limitations }) => limitations).join(" ") || grounding.contextText || "This answer uses only the selected fictional context.",
    limitations: [...grounding.limitations, ...(providerUnavailable ? ["The optional explanation provider is unavailable; this prepared response uses only the selected context and reviewed records."] : [])],
    citations: citationsFor(records),
    relatedRecordIds: records.map(({ id }) => id),
    mode: "prepared_fallback",
  };
}

function noAnswer(): EngineerResponse {
  return {
    answer: "I can’t support an answer from the reviewed records or context supplied for this question.",
    whatSourceStates: "No matching reviewed record or selected context was available.",
    whatItMeans: "Try asking about a source-reviewed record, or choose mission or simulated snapshot context to include.",
    limitations: ["This prototype does not answer from general model knowledge."],
    citations: [], relatedRecordIds: [], mode: "no_answer",
  };
}

function parseProviderOutput(value: unknown, allowedIds: Set<string>): { answer: string; recordIds: string[] } | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some((key) => !["answer", "recordIds"].includes(key))) return null;
  if (typeof result.answer !== "string" || !result.answer.trim() || result.answer.length > 1500 || !Array.isArray(result.recordIds) || result.recordIds.length > 3 || !result.recordIds.every((id) => typeof id === "string" && id.length <= 100)) return null;
  return { answer: result.answer.trim(), recordIds: [...new Set(result.recordIds.filter((id): id is string => typeof id === "string" && allowedIds.has(id)))] };
}

export async function createEngineerResponse(input: unknown, dependencies: EngineerDependencies): Promise<EngineerResponse | null> {
  const request = parseEngineerRequest(input);
  if (!request) return null;
  const context = resolveContext(request, dependencies);
  if (!context) return null;
  const records = retrieveRecords(request.question, dependencies.records);
  if (!records.length && !selectedContextSupportsQuestion(request.question, context.missionSummary, context.telemetrySnapshot)) return noAnswer();

  if (dependencies.provider) {
    try {
      const providerInput: EngineerProviderInput = {
        question: request.question,
        detailLevel: request.detailLevel,
        records,
        ...(context.missionSummary && { missionSummary: context.missionSummary }),
        ...(context.telemetrySnapshot && { telemetrySnapshot: context.telemetrySnapshot }),
      };
      const result = parseProviderOutput(await dependencies.provider(providerInput), new Set(records.map(({ id }) => id)));
      if (result && (records.length === 0 || result.recordIds.length > 0)) {
        const citedRecords = records.filter(({ id }) => result.recordIds.includes(id));
        const grounding = describeGrounding(citedRecords, context.missionSummary, context.telemetrySnapshot);
        return {
          answer: result.answer, whatSourceStates: [grounding.sourceText, grounding.contextText].filter(Boolean).join(" "),
          whatItMeans: result.answer, limitations: grounding.limitations, citations: citationsFor(citedRecords),
          relatedRecordIds: citedRecords.map(({ id }) => id), mode: "grounded_ai",
        };
      }
    } catch { /* Use the bounded prepared response when the optional provider fails. */ }
    return preparedResponse(records, context.missionSummary, context.telemetrySnapshot, true, request.detailLevel);
  }
  return preparedResponse(records, context.missionSummary, context.telemetrySnapshot, false, request.detailLevel);
}

export function createHttpEngineerProvider(endpoint: string, apiKey?: string): EngineerProvider {
  return async (input) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(apiKey && { Authorization: "Bearer " + apiKey }) },
        body: JSON.stringify(input),
        signal: controller.signal,
        redirect: "error",
      });
      if (!response.ok) throw new Error("Provider request failed");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Provider returned no response body");
      const chunks: Uint8Array[] = [];
      let byteLength = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        byteLength += value.byteLength;
        if (byteLength > 16_384) {
          await reader.cancel();
          throw new Error("Provider response exceeded its size limit");
        }
        chunks.push(value);
      }
      const responseText = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8");
      return JSON.parse(responseText) as unknown;
    } finally { clearTimeout(timeout); }
  };
}
