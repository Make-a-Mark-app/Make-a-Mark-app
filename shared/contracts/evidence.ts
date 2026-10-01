export const evidenceTopics = ["Environment", "Belong", "Community", "Governance"] as const;
export type EvidenceTopic = typeof evidenceTopics[number];
export const evidenceTopicTags = ["travel-logistics-reduction", "travel-logistics-avoided", "aleto-network", "aleto-skills-confidence", "student-reach", "education-community-organisations", "renewable-generation", "workforce-diversity", "education-reach"] as const;
export type EvidenceTopicTag = typeof evidenceTopicTags[number];

export const claimTypes = ["report_result", "target", "method"] as const;
export type ClaimType = typeof claimTypes[number];

export const reviewStates = ["illustrative", "pending_review", "reviewed", "rejected", "corrected", "withdrawn"] as const;
export type ReviewState = typeof reviewStates[number];

export type EvidenceSource = {
  title: string;
  edition: string;
  publicationDate: string;
  url: string;
  location: string | null;
};

export type EvidenceRecord = {
  id: string;
  title: string;
  topic: EvidenceTopic;
  topicTag: EvidenceTopicTag;
  claim: string;
  claimType: ClaimType;
  value?: string | number;
  valueDisplay?: string;
  unit?: string;
  reportingPeriod: string | null;
  source: EvidenceSource;
  reviewState: ReviewState;
  reviewNote: string;
  reviewer: string;
  reviewDate: string;
  history: Array<{ state: ReviewState; date: string; note: string }>;
  limitations: string[];
};

export type EvidenceDataset = {
  version: "evidence-r1-v2";
  records: EvidenceRecord[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function includes<const T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === "string" && values.some((candidate) => candidate === value);
}

function isHttpsUrl(value: unknown): value is string {
  if (!nonEmptyString(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export function parseEvidenceRecord(value: unknown): EvidenceRecord | null {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    "id", "title", "topic", "topicTag", "claim", "claimType", "value", "valueDisplay", "unit", "reportingPeriod",
    "source", "reviewState", "reviewNote", "reviewer", "reviewDate", "history", "limitations",
  ])) return null;

  const source = value.source;
  if (!isRecord(source) || !hasOnlyKeys(source, ["title", "edition", "publicationDate", "url", "location"])) return null;

  const validValue = value.value === undefined || typeof value.value === "string" || (typeof value.value === "number" && Number.isFinite(value.value));
  const validValueDisplay = value.valueDisplay === undefined || nonEmptyString(value.valueDisplay);
  const validUnit = value.unit === undefined || nonEmptyString(value.unit);
  const validDate = nonEmptyString(source.publicationDate);
  const validLocation = source.location === null || nonEmptyString(source.location);

  if (
    !nonEmptyString(value.id) || !/^[a-z0-9][a-z0-9-]*$/i.test(value.id) ||
    !nonEmptyString(value.title) || !includes(evidenceTopics, value.topic) || !includes(evidenceTopicTags, value.topicTag) ||
    !nonEmptyString(value.claim) || !includes(claimTypes, value.claimType) ||
    !validValue || !validValueDisplay || !validUnit ||
    (value.value !== undefined && value.unit === undefined) ||
    (value.valueDisplay !== undefined && value.value === undefined) ||
    !(value.reportingPeriod === null || nonEmptyString(value.reportingPeriod)) ||
    !includes(reviewStates, value.reviewState) || !nonEmptyString(value.reviewNote) || !nonEmptyString(value.reviewer) || !nonEmptyString(value.reviewDate) ||
    !Array.isArray(value.history) || !value.history.every((entry) => isRecord(entry) && hasOnlyKeys(entry, ["state", "date", "note"]) && includes(reviewStates, entry.state) && nonEmptyString(entry.date) && nonEmptyString(entry.note)) ||
    !Array.isArray(value.limitations) || !value.limitations.every(nonEmptyString) ||
    !nonEmptyString(source.title) || !nonEmptyString(source.edition) || !validDate ||
    !isHttpsUrl(source.url) || !validLocation
  ) return null;

  if (value.topic === "Governance" ? value.claimType !== "method" : value.claimType === "method") return null;

  return value as EvidenceRecord;
}

export function parseEvidenceDataset(value: unknown): EvidenceDataset | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ["version", "records"])) return null;
  if (value.version !== "evidence-r1-v2" || !Array.isArray(value.records)) return null;

  const records = value.records.map(parseEvidenceRecord);
  if (records.some((record) => record === null)) return null;
  const parsedRecords = records as EvidenceRecord[];
  if (new Set(parsedRecords.map((record) => record.id)).size !== parsedRecords.length) return null;

  return { version: "evidence-r1-v2", records: parsedRecords };
}

export function isReportedImpact(record: EvidenceRecord): boolean {
  return record.reviewState === "reviewed" && record.claimType === "report_result" && record.topic !== "Governance";
}

function normalizeLiteral(value: string): string {
  return value.toLocaleLowerCase("en").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export type EvidenceLookupOptions = { query?: string; pillar?: EvidenceTopic; topicTag?: EvidenceTopicTag; period?: string; limit?: number };

export function lookupEvidence(records: EvidenceRecord[], options: EvidenceLookupOptions = {}): EvidenceRecord[] {
  const query = normalizeLiteral(options.query ?? "");
  const queryWords = query ? query.split(" ") : [];
  const limit = Math.max(0, Math.min(10, Number.isInteger(options.limit) ? options.limit! : 10));
  return records.filter(isReportedImpact)
    .filter((record) => !options.pillar || record.topic === options.pillar)
    .filter((record) => !options.topicTag || record.topicTag === options.topicTag)
    .filter((record) => !options.period || normalizeLiteral(record.reportingPeriod ?? "not stated").includes(normalizeLiteral(options.period!)))
    .map((record) => {
      const fields = [record.id, record.title, record.topic, record.topicTag, record.claim, record.source.title, record.source.edition, record.reportingPeriod ?? "not stated", record.source.location ?? "not stated", ...record.limitations];
      const normalizedFields = fields.map(normalizeLiteral);
      const exact = query.length > 0 && normalizedFields.some((field) => field === query || field.startsWith(query + " ") || field.includes(" " + query + " ") || field.endsWith(" " + query));
      const words = new Set(normalizedFields.join(" ").split(" "));
      const matches = queryWords.filter((word) => words.has(word)).length;
      return { record, rank: query.length === 0 ? 1 : exact ? 2 : matches === queryWords.length ? 1 : 0 };
    })
    .filter(({ rank }) => rank > 0)
    .sort((a, b) => b.rank - a.rank || a.record.id.localeCompare(b.record.id, "en"))
    .slice(0, limit)
    .map(({ record }) => record);
}
