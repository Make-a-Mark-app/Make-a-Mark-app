import { isReportedImpact, type EvidenceRecord, type EvidenceTopic } from "./contracts/evidence.js";

export const MAX_EVIDENCE_SEARCH_RESULTS = 3;

const ignoredSearchTerms = new Set([
  "a", "an", "and", "are", "at", "about", "can", "carbon", "did", "does", "do", "figure", "footprint",
  "for", "has", "have", "how", "i", "in", "is", "it", "lifetime", "many", "me", "my", "of", "on", "or",
  "please", "report", "say", "team", "tell", "the", "this", "to", "total", "what", "was", "were", "when", "with",
]);

export type EvidenceSearchFilters = {
  topic?: EvidenceTopic;
  reportingPeriod?: string | null;
  /** Caller may request fewer records; the deterministic hard cap remains three. */
  maxResults?: number;
};

export function normalizeEvidenceTokens(value: string): string[] {
  return (value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").match(/[a-z0-9]+/g) ?? []).map((word) => {
    if (word.length > 5 && word.endsWith("ies")) return word.slice(0, -3) + "y";
    if (word.length > 6 && word.endsWith("ing")) return word.slice(0, -3);
    if (word.length > 5 && word.endsWith("ed")) return word.slice(0, -2);
    if (word.length > 4 && word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("us") && !word.endsWith("is")) return word.slice(0, -1);
    return word;
  });
}

function searchText(record: EvidenceRecord): string {
  return [
    record.id, record.title, record.topic, record.claim, record.claimType, record.value, record.unit,
    record.reportingPeriod, record.source.title, record.source.edition, record.source.location,
  ].filter((value) => value !== undefined && value !== null).join(" ");
}

export function searchEvidenceRecords(
  records: readonly EvidenceRecord[],
  query: string,
  filters: EvidenceSearchFilters = {},
): EvidenceRecord[] {
  const maximum = filters.maxResults === undefined || !Number.isFinite(filters.maxResults)
    ? MAX_EVIDENCE_SEARCH_RESULTS
    : Math.min(MAX_EVIDENCE_SEARCH_RESULTS, Math.max(0, Math.floor(filters.maxResults)));
  if (maximum === 0) return [];

  const queryTokens = normalizeEvidenceTokens(query);
  const queryText = queryTokens.join(" ");
  const terms = [...new Set(queryTokens.filter((term) => !ignoredSearchTerms.has(term)))];
  const candidates = records.filter((record) => isReportedImpact(record)
    && (filters.topic === undefined || record.topic === filters.topic)
    && (filters.reportingPeriod === undefined || record.reportingPeriod === filters.reportingPeriod));

  if (terms.length === 0) return query.trim() === "" ? candidates.slice(0, maximum) : [];

  return candidates.map((record, index) => {
    const words = new Set(normalizeEvidenceTokens(searchText(record)));
    const score = terms.reduce((count, term) => count + (words.has(term) ? 1 : 0), 0);
    const exactMatch = [record.id, record.title, record.claim]
      .some((value) => normalizeEvidenceTokens(value).join(" ") === queryText);
    const minimumMatches = Math.min(2, terms.length);
    const supported = exactMatch || (score >= minimumMatches && score / terms.length >= 0.6);
    return { record, index, score: supported ? score : 0, exactMatch };
  }).filter((result) => result.score > 0 || result.exactMatch)
    .sort((left, right) => Number(right.exactMatch) - Number(left.exactMatch) || right.score - left.score || left.index - right.index)
    .slice(0, maximum)
    .map(({ record }) => record);
}
