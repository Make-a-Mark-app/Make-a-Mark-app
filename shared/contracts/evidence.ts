export const evidenceTopics = ["Environment", "Belong", "Community", "Governance"] as const;
export type EvidenceTopic = typeof evidenceTopics[number];

export const claimTypes = ["report_result", "target", "method"] as const;
export type ClaimType = typeof claimTypes[number];

export const reviewStates = ["illustrative", "pending_review", "reviewed", "rejected"] as const;
export type ReviewState = typeof reviewStates[number];

export type EvidenceSource = {
  title: string;
  edition: string;
  publicationDate: string | null;
  url: string;
  location: string | null;
};

export type EvidenceRecord = {
  id: string;
  title: string;
  topic: EvidenceTopic;
  claim: string;
  claimType: ClaimType;
  value?: string | number;
  valueDisplay?: string;
  unit?: string;
  reportingPeriod: string | null;
  source: EvidenceSource;
  reviewState: ReviewState;
  reviewNote: string;
  limitations: string[];
};

export type EvidenceDataset = {
  version: string;
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
    "id", "title", "topic", "claim", "claimType", "value", "valueDisplay", "unit", "reportingPeriod",
    "source", "reviewState", "reviewNote", "limitations",
  ])) return null;

  const source = value.source;
  if (!isRecord(source) || !hasOnlyKeys(source, ["title", "edition", "publicationDate", "url", "location"])) return null;

  const validValue = value.value === undefined || typeof value.value === "string" || (typeof value.value === "number" && Number.isFinite(value.value));
  const validValueDisplay = value.valueDisplay === undefined || nonEmptyString(value.valueDisplay);
  const validUnit = value.unit === undefined || nonEmptyString(value.unit);
  const validDate = source.publicationDate === null || nonEmptyString(source.publicationDate);
  const validLocation = source.location === null || nonEmptyString(source.location);

  if (
    !nonEmptyString(value.id) || !/^[a-z0-9][a-z0-9-]*$/i.test(value.id) ||
    !nonEmptyString(value.title) || !includes(evidenceTopics, value.topic) ||
    !nonEmptyString(value.claim) || !includes(claimTypes, value.claimType) ||
    !validValue || !validValueDisplay || !validUnit ||
    (value.value !== undefined && value.unit === undefined) ||
    (value.valueDisplay !== undefined && value.value === undefined) ||
    !(value.reportingPeriod === null || nonEmptyString(value.reportingPeriod)) ||
    !includes(reviewStates, value.reviewState) || !nonEmptyString(value.reviewNote) ||
    !Array.isArray(value.limitations) || !value.limitations.every(nonEmptyString) ||
    !nonEmptyString(source.title) || !nonEmptyString(source.edition) || !validDate ||
    !isHttpsUrl(source.url) || !validLocation
  ) return null;

  if (value.topic === "Governance" ? value.claimType !== "method" : value.claimType === "method") return null;

  return value as EvidenceRecord;
}

export function parseEvidenceDataset(value: unknown): EvidenceDataset | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ["version", "records"])) return null;
  if (!nonEmptyString(value.version) || !Array.isArray(value.records)) return null;

  const records = value.records.map(parseEvidenceRecord);
  if (records.some((record) => record === null)) return null;
  const parsedRecords = records as EvidenceRecord[];
  if (new Set(parsedRecords.map((record) => record.id)).size !== parsedRecords.length) return null;

  return { version: value.version, records: parsedRecords };
}

export function isReportedImpact(record: EvidenceRecord): boolean {
  return record.reviewState === "reviewed" && record.claimType === "report_result" && record.topic !== "Governance";
}
