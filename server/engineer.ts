import type { EvidenceRecord } from "../shared/contracts/evidence.js";
import { lookupEvidence, normalizeLiteralSearchText } from "../shared/contracts/evidence.js";
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
  modeLabel: "Grounded explanation · citations validated" | "Prepared answer" | "No answer";
};

export type EngineerProviderInput = {
  instructions: string;
  question: string;
  detailLevel: "concise" | "detailed";
  records: EvidenceRecord[];
  missionSummary?: MissionSummary;
  telemetrySnapshot?: TelemetrySnapshot;
};

export type EngineerProvider = (input: EngineerProviderInput) => Promise<unknown>;

type MissionSummary = { title: string; selectedRoute: string; feedback: string };

export type EngineerDependencies = {
  records: EvidenceRecord[];
  mission: MissionDefinition;
  telemetry: TelemetryDataset;
  provider?: EngineerProvider;
};

const stopWords = new Set(["a", "an", "and", "are", "at", "about", "can", "carbon", "describe", "did", "does", "do", "explain", "figure", "footprint", "for", "happen", "happens", "has", "have", "how", "i", "include", "includes", "in", "is", "it", "lifetime", "many", "me", "mean", "means", "my", "of", "on", "or", "please", "report", "say", "show", "shows", "summarize", "team", "tell", "the", "this", "to", "total", "was", "were", "what", "when", "with", "work", "s"]);
const safeExplanationTerms = new Set(["a", "about", "according", "an", "and", "are", "as", "at", "based", "by", "claim", "context", "data", "describes", "during", "evidence", "figure", "from", "has", "have", "in", "is", "it", "lists", "means", "measure", "measured", "of", "on", "only", "period", "record", "reported", "reports", "result", "route", "says", "selected", "shows", "simulated", "snapshot", "source", "states", "the", "their", "this", "to", "telemetry", "unavailable", "uses", "was", "were", "with", "year"]);
const groundingInstructions = "Explain only the supplied reviewed records and explicitly selected fictional context. Do not add facts, values, units, source metadata, mission outcomes, or telemetry details. Return JSON with only answer (a short explanation) and recordIds (IDs from the supplied records that support it). Do not create citations or URLs.";

function tokens(value: string): string[] {
  return (value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").match(/[a-z0-9]+/g) ?? []).map((word) => {
    if (word.length > 5 && word.endsWith("ies")) return word.slice(0, -3) + "y";
    if (word.length > 6 && word.endsWith("ing")) return word.slice(0, -3);
    if (word.length > 5 && word.endsWith("ed")) return word.slice(0, -2);
    if (word.length > 4 && word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("us") && !word.endsWith("is")) return word.slice(0, -1);
    return word;
  });
}

function hasSufficientKeywordCoverage(termCount: number, matchCount: number): boolean {
  return termCount === 1 ? matchCount === 1 : matchCount >= 2 && matchCount / termCount >= 0.6;
}

function retrieveRecords(question: string, records: EvidenceRecord[]): EvidenceRecord[] {
  const terms = [...new Set(normalizeLiteralSearchText(question).split(" ").filter((term) => term && !stopWords.has(term)))];
  if (!terms.length) return [];
  const exactTitleMatches = lookupEvidence(records, { query: terms.join(" "), limit: 10 })
    .filter((record) => normalizeLiteralSearchText(record.title).split(" ").filter((term) => !stopWords.has(term)).join(" ") === terms.join(" "));
  if (exactTitleMatches.length) return exactTitleMatches.slice(0, 5);
  const exactMatches = lookupEvidence(records, { query: terms.join(" "), limit: 10 });
  if (exactMatches.length) return exactMatches.slice(0, 5);
  const scores = new Map<string, { record: EvidenceRecord; score: number }>();
  for (const term of terms) {
    for (const record of lookupEvidence(records, { query: term, limit: 10 })) {
      const current = scores.get(record.id) ?? { record, score: 0 };
      current.score += 1;
      scores.set(record.id, current);
    }
  }
  return [...scores.values()]
    .filter(({ score }) => hasSufficientKeywordCoverage(terms.length, score))
    .sort((left, right) => right.score - left.score || left.record.id.localeCompare(right.record.id, "en"))
    .slice(0, 5)
    .map(({ record }) => record);
}

function selectedContextSupportsQuestion(question: string, mission?: MissionSummary, telemetry?: TelemetrySnapshot): boolean {
  const terms = [...new Set(tokens(question).filter((term) => !stopWords.has(term)))];
  if (!terms.length) return false;
  const matchesContext = (context: string): boolean => {
    const words = new Set(tokens(context));
    const overlap = terms.filter((term) => words.has(term)).length;
    return hasSufficientKeywordCoverage(terms.length, overlap);
  };
  const missionContext = mission && ["fictional freight mission route scenario choice delivery", mission.title, mission.selectedRoute, mission.feedback].join(" ");
  const telemetryContext = telemetry && ["simulated telemetry snapshot signals", telemetry.stepId, telemetry.timestamp, telemetry.status,
    ...telemetry.signals.flatMap((signal) => [signal.id, signal.name, signal.value === null ? "unavailable" : String(signal.value), signal.unit])].join(" ");
  return Boolean((missionContext && matchesContext(missionContext)) || (telemetryContext && matchesContext(telemetryContext)));
}

function resolveContext(request: EngineerRequest, dependencies: EngineerDependencies) {
  let missionSummary: MissionSummary | undefined;
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

function recordsConflict(records: EvidenceRecord[]): boolean {
  const claimsByScope = new Map<string, Set<string>>();
  for (const record of records) {
    const scope = [record.topicTag, record.reportingPeriod ?? ""].join("|");
    const claims = claimsByScope.get(scope) ?? new Set<string>();
    claims.add([
      normalizeLiteralSearchText(record.claim),
      String(record.value ?? ""),
      normalizeLiteralSearchText(record.unit ?? ""),
    ].join("|"));
    claimsByScope.set(scope, claims);
    if (claims.size > 1) return true;
  }
  return false;
}

function describeGrounding(records: EvidenceRecord[], mission?: MissionSummary, telemetry?: TelemetrySnapshot) {
  const sourceText = records.map(({ claim }) => claim).join(" ");
  const contextText = [
    mission && "Fictional mission: " + mission.selectedRoute + " route. " + mission.feedback,
    telemetry && "Simulated snapshot " + telemetry.stepId + " (" + telemetry.status + ") at " + telemetry.timestamp + ". Prepared signals: " + describeTelemetrySignals(telemetry) + ".",
  ].filter(Boolean).join(" ");
  const limitations = [...new Set(records.flatMap(({ limitations: notes }) => notes))];
  if (mission) limitations.push("Mission route and outcome are fictional game content, not AMF1 operations.");
  if (telemetry) limitations.push("Telemetry values are simulated fixture data, not a live AMF1 feed.");
  return { sourceText: sourceText || "No report record was retrieved for this question.", contextText, limitations };
}

function describeTelemetrySignals(telemetry: TelemetrySnapshot): string {
  return telemetry.signals.map((signal) => signal.name + ": " + (signal.value === null ? "Unavailable" : signal.value + " " + signal.unit)).join("; ");
}

function isProviderAnswerGrounded(answer: string, records: EvidenceRecord[], mission?: MissionSummary, telemetry?: TelemetrySnapshot): boolean {
  const sourceText = records.flatMap((record) => [
    record.id, record.title, record.topic, record.claim, record.reviewNote, String(record.value ?? ""), record.valueDisplay ?? "", record.unit ?? "",
    record.reportingPeriod ?? "", record.source.title, record.source.edition, record.source.location ?? "", ...record.limitations,
  ]).join(" ");
  const contextText = [
    mission && [mission.title, mission.selectedRoute, mission.feedback].join(" "),
    telemetry && [telemetry.stepId, telemetry.timestamp, telemetry.status, ...telemetry.signals.flatMap((signal) => [signal.id, signal.name, signal.value === null ? "Unavailable" : String(signal.value), signal.unit])].join(" "),
  ].filter(Boolean).join(" ");
  const allowedTerms = new Set([...tokens(sourceText), ...tokens(contextText), ...tokens([...safeExplanationTerms].join(" "))]);
  return tokens(answer).every((term) => allowedTerms.has(term));
}

function preparedResponse(records: EvidenceRecord[], mission?: MissionSummary, telemetry?: TelemetrySnapshot, providerIssue?: "unavailable" | "invalid", detailLevel: "concise" | "detailed" = "concise"): EngineerResponse {
  const grounding = describeGrounding(records, mission, telemetry);
  const explanation = [
    records.map(({ claim }) => claim).join(" "),
    mission && mission.selectedRoute + ": " + mission.feedback,
    telemetry && "Snapshot " + telemetry.stepId + " is " + telemetry.status + ". " + describeTelemetrySignals(telemetry) + ".",
  ].filter(Boolean).join(" ");
  const detail = detailLevel === "detailed" ? records.map((record) => {
    return " Source: " + record.source.title + " (" + (record.reportingPeriod ?? "reporting period not stated") + ")" + (record.source.location ? ", " + record.source.location : "") + ". " + record.limitations.join(" ");
  }).join(" ") : "";
  return {
    answer: limitWords(explanation + detail, detailLevel === "detailed" ? 400 : 150),
    whatSourceStates: [grounding.sourceText, grounding.contextText].filter(Boolean).join(" "),
    whatItMeans: records.flatMap(({ limitations }) => limitations).join(" ") || grounding.contextText || "This answer uses only the selected fictional context.",
    limitations: [...grounding.limitations, ...(providerIssue === "unavailable" ? ["The optional explanation provider is unavailable; this prepared response uses only the selected context and reviewed records."] : []), ...(providerIssue === "invalid" ? ["The provider response could not be grounded in the selected records and context, so it was not used."] : [])],
    citations: citationsFor(records),
    relatedRecordIds: records.map(({ id }) => id),
    mode: "prepared_fallback",
    modeLabel: "Prepared answer",
  };
}

function noAnswer(reason: "unsupported" | "conflict" | "category_mismatch" = "unsupported"): EngineerResponse {
  const conflict = reason === "conflict";
  const categoryMismatch = reason === "category_mismatch";
  return {
    answer: "Not enough evidence in the reviewed records or selected context to support an answer.",
    whatSourceStates: conflict
      ? "The retrieved records make different claims for the same topic and reporting period."
      : categoryMismatch
        ? "No matching claim was found within the selected category and context."
        : "No matching reviewed record or selected context was available.",
    whatItMeans: conflict
      ? "The available records do not resolve to one consistent claim, so this prototype cannot choose an answer."
      : categoryMismatch
        ? "This question is not supported by the selected category or context. Choose a matching question category and try again."
        : "Try asking about a source-reviewed record, or choose mission or simulated snapshot context to include.",
    limitations: ["This prototype does not answer from general model knowledge.", ...(conflict ? ["Conflicting reviewed records were not used to produce an answer."] : [])],
    citations: [], relatedRecordIds: [], mode: "no_answer", modeLabel: "No answer",
  };
}

function parseProviderOutput(value: unknown, allowedIds: Set<string>): { answer: string; recordIds: string[] } | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some((key) => !["answer", "recordIds"].includes(key))) return null;
  if (typeof result.answer !== "string" || !result.answer.trim() || result.answer.length > 1500 || !Array.isArray(result.recordIds) || result.recordIds.length > 5 || !result.recordIds.every((id) => typeof id === "string" && id.length <= 100)) return null;
  return { answer: result.answer.trim(), recordIds: [...new Set(result.recordIds.filter((id): id is string => typeof id === "string" && allowedIds.has(id)))] };
}

function limitWords(value: string, limit: number): string {
  const words = value.trim().split(/\s+/);
  return words.length > limit ? words.slice(0, limit).join(" ") : value;
}

export async function createEngineerResponse(input: unknown, dependencies: EngineerDependencies): Promise<EngineerResponse | null> {
  const request = parseEngineerRequest(input);
  if (!request) return null;
  const context = resolveContext(request, dependencies);
  if (!context) return null;
  const records = request.category === "evidence" ? retrieveRecords(request.question, dependencies.records) : [];
  if (recordsConflict(records)) return noAnswer("conflict");
  if (!records.length && !selectedContextSupportsQuestion(request.question, context.missionSummary, context.telemetrySnapshot)) {
    return noAnswer(request.category === "evidence" ? "unsupported" : "category_mismatch");
  }

  if (dependencies.provider) {
    let providerIssue: "unavailable" | "invalid" = "invalid";
    try {
      const providerInput: EngineerProviderInput = {
        instructions: groundingInstructions,
        question: request.question,
        detailLevel: request.detailLevel,
        records,
        ...(context.missionSummary && { missionSummary: context.missionSummary }),
        ...(context.telemetrySnapshot && { telemetrySnapshot: context.telemetrySnapshot }),
      };
      const result = parseProviderOutput(await dependencies.provider(providerInput), new Set(records.map(({ id }) => id)));
      if (result && (records.length === 0 || result.recordIds.length > 0)) {
        const citedRecords = records.filter(({ id }) => result.recordIds.includes(id));
        const answer = limitWords(result.answer, request.detailLevel === "detailed" ? 400 : 150);
        if (!isProviderAnswerGrounded(answer, citedRecords, context.missionSummary, context.telemetrySnapshot)) {
          return preparedResponse(records, context.missionSummary, context.telemetrySnapshot, "invalid", request.detailLevel);
        }
        const grounding = describeGrounding(citedRecords, context.missionSummary, context.telemetrySnapshot);
        return {
          answer, whatSourceStates: [grounding.sourceText, grounding.contextText].filter(Boolean).join(" "),
          whatItMeans: answer, limitations: grounding.limitations, citations: citationsFor(citedRecords),
          relatedRecordIds: citedRecords.map(({ id }) => id), mode: "grounded_ai", modeLabel: "Grounded explanation · citations validated",
        };
      }
    } catch {
      providerIssue = "unavailable";
    }
    return preparedResponse(records, context.missionSummary, context.telemetrySnapshot, providerIssue, request.detailLevel);
  }
  return preparedResponse(records, context.missionSummary, context.telemetrySnapshot, undefined, request.detailLevel);
}
