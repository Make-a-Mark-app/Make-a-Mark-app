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
  mode: "grounded_ai" | "general_explanation" | "prepared_fallback" | "no_answer";
};

export type EngineerProviderInput = {
  instructions: string;
  question: string;
  detailLevel: "concise" | "detailed";
  records: EvidenceRecord[];
  max_tokens: 10_000;
  reasoning_effort: "medium";
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

const stopWords = new Set(["a", "an", "and", "are", "at", "about", "can", "carbon", "describe", "did", "does", "do", "explain", "figure", "footprint", "for", "happen", "happens", "has", "have", "how", "i", "include", "includes", "in", "is", "it", "lifetime", "many", "me", "mean", "means", "my", "of", "on", "or", "please", "report", "say", "show", "shows", "summarize", "team", "tell", "the", "this", "to", "total", "was", "were", "what", "when", "with", "work", "s"]);
const groundingInstructions = "You are AMF1's sustainability assistant. Answer the user's actual question directly and naturally. For general knowledge and concept questions, explain the concept in your own words; the reviewed records are optional examples and context, not a required script or definition. Use supplied records to support AMF1-specific actions, figures, programmes, comparisons, and report claims, and list the recordIds that support them. Do not invent AMF1 claims. For broad questions, synthesize only the most relevant findings in 1–3 short sentences (aim for 100 words); never concatenate record claims. Keep estimates, participant-reported results, and measurement boundaries precise when relevant. Only decline questions unrelated to sustainability or selected context. Return JSON with only answer and recordIds. Do not create citations or URLs. Use medium reasoning effort and a maximum output budget of 10,000 tokens.";

const sustainabilityTerms = /\b(esg|sustainab\w*|environment\w*|climate|carbon|emission\w*|footprint|decarbon\w*|net zero|renewable|energy|fuel|saf|solar|waste|recycl\w*|biodivers\w*|nature|water|logistics|aviation|community|belong|inclusion|diversity|education|students?|aleto|social impact)\b/i;
const environmentalTerms = /\b(environment\w*|climate|carbon|emission\w*|footprint|decarbon\w*|net zero|renewable|energy|fuel|saf|solar|waste|recycl\w*|biodivers\w*|nature|water|logistics|aviation|travel)\b/i;
const specificMetricTerms = /\b(14%|1188|1,188|percent|percentage|how much|how many|reduction|avoided|freight|carbon|emission\w*|footprint|climate|travel|logistics|students?|schools?|ale[to]|network|leadership|confidence|skills)\b/i;
const sustainabilityDefinitionTerms = /\b(?:what\s+is|define|meaning\s+of)\s+(?:the\s+)?sustainability\b/i;
const esgDefinitionTerms = /\b(?:what\s+is\s+(?:esg|e\s*s\s*g)|what\s+does\s+e\s*s\s*g\s+(?:stand\s+for|mean)|define\s+e\s*s\s*g|meaning\s+of\s+e\s*s\s*g)\b/i;
const generalEnvironmentBenefitTerms = /\bhow\s+(?:can|does|do)\s+sustainab\w*\s+(?:help|benefit|protect|support)\s+(?:the\s+)?environment\b/i;
const estimateComparisonTerms = /\bestimat\w*\b/i;

function isGeneralSustainabilityDefinition(question: string): boolean {
  return sustainabilityDefinitionTerms.test(question) || esgDefinitionTerms.test(question);
}

function isGeneralSustainabilityConcept(question: string): boolean {
  return isGeneralSustainabilityDefinition(question) || generalEnvironmentBenefitTerms.test(question);
}

function isEstimateComparisonQuestion(question: string): boolean {
  return estimateComparisonTerms.test(question) && /\b(?:measur\w*|reduction|avoided)\b/i.test(question);
}

function isSustainabilityQuestion(question: string): boolean {
  return sustainabilityTerms.test(question);
}

function isBroadSustainabilityQuestion(question: string): boolean {
  return isSustainabilityQuestion(question) && !specificMetricTerms.test(question);
}

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
  if (isEstimateComparisonQuestion(question)) {
    return records.filter(({ id }) => id === "env-2025-travel-logistics-avoided" || id === "env-2025-travel-logistics-reduction");
  }
  if (generalEnvironmentBenefitTerms.test(question)) return [];
  if (isGeneralSustainabilityDefinition(question)) {
    if (esgDefinitionTerms.test(question)) return [];
    return records.filter(({ id }) => id === "env-2025-travel-logistics-reduction" || id === "env-2025-travel-logistics-avoided");
  }
  const sustainabilityFallback = () => {
    const fallbackRecords = environmentalTerms.test(question)
      ? records.filter(({ topic }) => topic === "Environment")
      : lookupEvidence(records, { limit: 10 });
    return fallbackRecords.slice(0, 6);
  };
  if (isBroadSustainabilityQuestion(question)) {
    if (environmentalTerms.test(question)) {
      return records.filter(({ topic }) => topic === "Environment").slice(0, 6);
    }
    return lookupEvidence(records, { limit: 10 }).slice(0, 6);
  }
  const terms = [...new Set(normalizeLiteralSearchText(question).split(" ").filter((term) => term && !stopWords.has(term)))];
  if (!terms.length) return isSustainabilityQuestion(question) ? sustainabilityFallback() : [];
  const exactTitleMatches = lookupEvidence(records, { query: terms.join(" "), limit: 10 })
    .filter((record) => normalizeLiteralSearchText(record.title).split(" ").filter((term) => !stopWords.has(term)).join(" ") === terms.join(" "));
  if (exactTitleMatches.length) return exactTitleMatches.slice(0, 3);
  const exactMatches = lookupEvidence(records, { query: terms.join(" "), limit: 10 });
  if (exactMatches.length) return exactMatches.slice(0, 3);
  const scores = new Map<string, { record: EvidenceRecord; score: number }>();
  for (const term of terms) {
    for (const record of lookupEvidence(records, { query: term, limit: 10 })) {
      const current = scores.get(record.id) ?? { record, score: 0 };
      current.score += 1;
      scores.set(record.id, current);
    }
  }
  const matchedRecords = [...scores.values()]
    .filter(({ score }) => hasSufficientKeywordCoverage(terms.length, score))
    .sort((left, right) => right.score - left.score || left.record.id.localeCompare(right.record.id, "en"))
    .slice(0, 3)
    .map(({ record }) => record);
  if (matchedRecords.length || !isSustainabilityQuestion(question)) return matchedRecords;
  return sustainabilityFallback();
}

function selectedContextSupportsQuestion(question: string, mission?: EngineerProviderInput["missionSummary"], telemetry?: TelemetrySnapshot): boolean {
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
    telemetry && "Simulated snapshot " + telemetry.stepId + " (" + telemetry.status + ") at " + telemetry.timestamp + ". Prepared signals: " + describeTelemetrySignals(telemetry) + ".",
  ].filter(Boolean).join(" ");
  const limitations = [...new Set(records.flatMap(({ limitations: notes }) => notes))];
  if (mission) limitations.push("Mission route and outcome are fictional game content, not AMF1 operations.");
  if (telemetry) limitations.push("Telemetry values are simulated fixture data, not a live AMF1 feed.");
  return { sourceText: sourceText || "No report record was retrieved for this question.", contextText, limitations };
}

function relevantLimitations(question: string, records: EvidenceRecord[], contextLimitations: string[] = []): string[] {
  const environmentalRecords = isBroadSustainabilityQuestion(question) ? records.filter(({ topic }) => topic === "Environment") : [];
  const relevantRecords = environmentalRecords.length ? environmentalRecords : records;
  const recordLimitations = relevantRecords.flatMap(({ limitations }) => limitations.slice(0, 1));
  return [...new Set([...recordLimitations, ...contextLimitations])].slice(0, 4);
}

function broadSustainabilitySummary(records: EvidenceRecord[]): string {
  const byId = new Map(records.map((record) => [record.id, record]));
  const statements: string[] = [];
  for (const id of ["env-2025-travel-logistics-reduction", "env-2025-travel-logistics-avoided"]) {
    const record = byId.get(id);
    if (record) statements.push(record.claim);
  }

  const schoolReach = byId.get("com-2025-make-a-mark-week-organisations");
  const studentWorkshops = byId.get("com-2025-make-a-mark-week-students");
  if (schoolReach && studentWorkshops) {
    statements.push("The fourth annual Make A Mark Week engaged 257 students in STEM and career development workshops across 14 schools and community groups.");
  } else {
    statements.push(...records.filter(({ topic }) => topic === "Community").map(({ claim }) => claim));
  }

  const network = byId.get("bel-2025-aleto-network");
  const skills = byId.get("bel-2025-aleto-skills-confidence");
  if (network && skills) {
    statements.push("93% of the 2025 Aleto group felt they grew their professional network; 90% felt they grew leadership skills, public speaking and confidence.");
  } else {
    statements.push(...records.filter(({ topic }) => topic === "Belong").map(({ claim }) => claim));
  }

  return statements.join(" ") || records.map(({ claim }) => claim).join(" ");
}

function describeTelemetrySignals(telemetry: TelemetrySnapshot): string {
  return telemetry.signals.map((signal) => signal.name + ": " + (signal.value === null ? "Unavailable" : signal.value + " " + signal.unit)).join("; ");
}

function preparedResponse(question: string, records: EvidenceRecord[], mission?: EngineerProviderInput["missionSummary"], telemetry?: TelemetrySnapshot, providerIssue?: "unavailable" | "invalid", detailLevel: "concise" | "detailed" = "concise"): EngineerResponse {
  const grounding = describeGrounding(records, mission, telemetry);
  if (isEstimateComparisonQuestion(question)) {
    const avoided = records.find(({ id }) => id === "env-2025-travel-logistics-avoided");
    const reduction = records.find(({ id }) => id === "env-2025-travel-logistics-reduction");
    const relevantRecords = [avoided, reduction].filter((record): record is EvidenceRecord => Boolean(record));
    return {
      answer: "The 1,188 tCO₂e figure is an estimate of emissions avoided, not a measured drop in AMF1’s total emissions. The 14% figure is a reported reduction in travel and logistics emissions; the report does not state the comparison period or full calculation boundary, so it should not be treated as a reduction across all team emissions.",
      whatSourceStates: relevantRecords.map(({ claim }) => claim).join(" "),
      whatItMeans: relevantRecords.flatMap(({ limitations }) => limitations.slice(0, 1)).join(" "),
      limitations: [...new Set(relevantRecords.flatMap(({ limitations }) => limitations))],
      citations: citationsFor(relevantRecords), relatedRecordIds: relevantRecords.map(({ id }) => id), mode: "prepared_fallback",
    };
  }
  if (isGeneralSustainabilityDefinition(question)) {
    if (esgDefinitionTerms.test(question)) {
      return {
        answer: "ESG stands for Environmental, Social and Governance. It is a way organizations describe their environmental impact, responsibilities to people, and how they are governed. It overlaps with sustainability and gives a broader view than environmental performance alone.",
        whatSourceStates: "This is a general explanation of ESG, not a claim about AMF1's own performance.",
        whatItMeans: "ESG brings environmental, social, and governance topics together when discussing an organization’s sustainability.",
        limitations: [], citations: [], relatedRecordIds: [], mode: "general_explanation",
      };
    }
    const citedRecords = records.filter(({ id }) => id === "env-2025-travel-logistics-reduction" || id === "env-2025-travel-logistics-avoided");
    return {
      answer: "Sustainability means meeting people's needs today while protecting the environment and resources that people will depend on in the future. In AMF1's 2025 report, examples include changes to travel and logistics and an estimate of emissions avoided through air-freight changes. These are examples of reported work, not a complete measure of the team's overall sustainability.",
      whatSourceStates: citedRecords.map(({ claim }) => claim).join(" "),
      whatItMeans: "The report describes specific actions and estimates; it does not provide a single measure of overall sustainability.",
      limitations: [...new Set(citedRecords.flatMap(({ limitations }) => limitations.slice(0, 1)))],
      citations: citationsFor(citedRecords), relatedRecordIds: citedRecords.map(({ id }) => id), mode: "general_explanation",
    };
  }
  if (generalEnvironmentBenefitTerms.test(question)) {
    return {
      answer: "Sustainability can help the environment by using energy and materials more efficiently, reducing pollution and waste, shifting to lower-carbon energy and transport, and protecting ecosystems. The benefit depends on choosing actions that fit the local problem and measuring their effects over time.",
      whatSourceStates: "This is a general explanation; it does not make a claim about AMF1 or rely on the team's report.",
      whatItMeans: "Environmental sustainability focuses on reducing harm and using natural resources within limits that can be maintained over time.",
      limitations: [], citations: [], relatedRecordIds: [], mode: "general_explanation",
    };
  }
  const explanation = [
    isBroadSustainabilityQuestion(question) ? broadSustainabilitySummary(records) : records.map(({ claim }) => claim).join(" "),
    mission && mission.selectedRoute + ": " + mission.feedback,
    telemetry && "Snapshot " + telemetry.stepId + " is " + telemetry.status + ". " + describeTelemetrySignals(telemetry) + ".",
  ].filter(Boolean).join(" ");
  const detail = detailLevel === "detailed" ? records.map((record) => {
    return " Source: " + record.source.title + " (" + (record.reportingPeriod ?? "reporting period not stated") + ")" + (record.source.location ? ", " + record.source.location : "") + ". " + record.limitations.join(" ");
  }).join(" ") : "";
  return {
    answer: explanation + detail,
    whatSourceStates: [grounding.sourceText, grounding.contextText].filter(Boolean).join(" "),
    whatItMeans: relevantLimitations(question, records, [...(mission ? ["Mission route and outcome are fictional game content, not AMF1 operations."] : []), ...(telemetry ? ["Telemetry values are simulated demo data, not a live AMF1 feed or measured impact."] : [])]).slice(0, 2).join(" ") || grounding.contextText || "This answer uses only the selected fictional context.",
    limitations: [...relevantLimitations(question, records, grounding.limitations.filter((limitation) => limitation.startsWith("Mission ") || limitation.startsWith("Telemetry "))), ...(providerIssue === "unavailable" ? ["The optional explanation provider is unavailable; this prepared response uses only the selected context and reviewed records."] : []), ...(providerIssue === "invalid" ? ["The provider response could not be grounded in the selected records and context, so it was not used."] : [])],
    citations: citationsFor(records),
    relatedRecordIds: records.map(({ id }) => id),
    mode: "prepared_fallback",
  };
}

function noAnswer(): EngineerResponse {
  return {
    answer: "I can help with AMF1's sustainability, environmental, community, and people-related work. Try asking about emissions, logistics, fuel, or one of the team's programmes.",
    whatSourceStates: "This question is outside the sustainability and selected-context topics covered by the Race Engineer.",
    whatItMeans: "Ask about AMF1's sustainability work or include a selected fictional Mission or simulated telemetry context.",
    limitations: ["The Race Engineer is focused on sustainability-related topics and explicitly selected app context."],
    citations: [], relatedRecordIds: [], mode: "no_answer",
  };
}

function parseProviderOutput(value: unknown, allowedIds: Set<string>): { answer: string; recordIds: string[] } | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some((key) => !["answer", "recordIds"].includes(key))) return null;
  if (typeof result.answer !== "string" || !result.answer.trim() || result.answer.length > 40_000 || !Array.isArray(result.recordIds) || result.recordIds.length > 6 || !result.recordIds.every((id) => typeof id === "string" && id.length <= 100)) return null;
  return { answer: result.answer.trim(), recordIds: [...new Set(result.recordIds.filter((id): id is string => typeof id === "string" && allowedIds.has(id)))] };
}

export async function createEngineerResponse(input: unknown, dependencies: EngineerDependencies): Promise<EngineerResponse | null> {
  const request = parseEngineerRequest(input);
  if (!request) return null;
  const context = resolveContext(request, dependencies);
  if (!context) return null;
  const records = retrieveRecords(request.question, dependencies.records);
  const isGeneralConcept = isGeneralSustainabilityConcept(request.question);
  if (!records.length && !isGeneralConcept && !selectedContextSupportsQuestion(request.question, context.missionSummary, context.telemetrySnapshot)) return noAnswer();

  if (dependencies.provider) {
    let providerIssue: "unavailable" | "invalid" = "invalid";
    try {
      const providerInput: EngineerProviderInput = {
        instructions: groundingInstructions,
        question: request.question,
        detailLevel: request.detailLevel,
        records,
        max_tokens: 10_000,
        reasoning_effort: "medium",
        ...(context.missionSummary && { missionSummary: context.missionSummary }),
        ...(context.telemetrySnapshot && { telemetrySnapshot: context.telemetrySnapshot }),
      };
      const result = parseProviderOutput(await dependencies.provider(providerInput), new Set(records.map(({ id }) => id)));
      if (result && (records.length === 0 || result.recordIds.length > 0 || isGeneralConcept)) {
        const citedRecords = records.filter(({ id }) => result.recordIds.includes(id));
        const containsTeamSpecificClaims = /\b(?:AMF1|the team|the report|\d[\d,.]*\s*(?:%|tCO₂e|tonnes?))\b/i.test(result.answer);
        const generalAnswerIsSafe = !containsTeamSpecificClaims || citedRecords.length > 0;
        if (isGeneralConcept && !generalAnswerIsSafe) {
          return preparedResponse(request.question, records, context.missionSummary, context.telemetrySnapshot, "invalid", request.detailLevel);
        }
        const grounding = describeGrounding(citedRecords, context.missionSummary, context.telemetrySnapshot);
        const limitations = relevantLimitations(request.question, citedRecords, grounding.limitations.filter((limitation) => limitation.startsWith("Mission ") || limitation.startsWith("Telemetry ")));
        return {
          answer: result.answer, whatSourceStates: [grounding.sourceText, grounding.contextText].filter(Boolean).join(" "),
          whatItMeans: limitations.slice(0, 2).join(" ") || grounding.contextText || "This answer uses only the selected reviewed records.", limitations, citations: citationsFor(citedRecords),
          relatedRecordIds: citedRecords.map(({ id }) => id), mode: isGeneralConcept ? "general_explanation" : "grounded_ai",
        };
      }
    } catch {
      providerIssue = "unavailable";
    }
    return preparedResponse(request.question, records, context.missionSummary, context.telemetrySnapshot, providerIssue, request.detailLevel);
  }
  return preparedResponse(request.question, records, context.missionSummary, context.telemetrySnapshot, undefined, request.detailLevel);
}

export function createHttpEngineerProvider(endpoint: string, apiKey?: string): EngineerProvider {
  return async (input) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
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

/** Kira's OpenAI-compatible Chat Completions API. The key is supplied server-side only. */
export function createKiraEngineerProvider(apiKey: string, model = "gpt-oss-120b"): EngineerProvider {
  return async (input) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch("https://kiraai.vn/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: input.instructions },
            { role: "user", content: JSON.stringify({
              question: input.question,
              detailLevel: input.detailLevel,
              records: input.records,
              missionSummary: input.missionSummary,
              telemetrySnapshot: input.telemetrySnapshot,
            }) },
          ],
          max_tokens: input.max_tokens,
          reasoning_effort: input.reasoning_effort,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
        redirect: "error",
      });
      if (!response.ok) throw new Error("Kira response request failed");
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Kira returned no response body");
      const chunks: Uint8Array[] = [];
      let byteLength = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        byteLength += value.byteLength;
        if (byteLength > 32_768) {
          await reader.cancel();
          throw new Error("Kira response exceeded its size limit");
        }
        chunks.push(value);
      }
      const payload = JSON.parse(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf8")) as {
        choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      const outputText = typeof content === "string" ? content : content?.map((item) => item.text ?? "").join("");
      if (!outputText) throw new Error("Kira returned no structured answer");
      return JSON.parse(outputText) as unknown;
    } finally {
      clearTimeout(timeout);
    }
  };
}
