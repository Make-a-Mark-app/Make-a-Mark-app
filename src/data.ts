export type EvidenceRecord = {
  id: string;
  title: string;
  topic: "Environment" | "Belong" | "Community" | "Governance";
  claimType: "Report result" | "Target" | "Method";
  summary: string;
  period: string;
  source: string;
  page: string;
  limitations: string[];
  review: "Illustrative sample";
};

// These records demonstrate the library structure only; they are not factual evidence.
export const evidenceRecords: EvidenceRecord[] = [
  {
    id: "sample-freight",
    title: "Freight and logistics evidence",
    topic: "Environment",
    claimType: "Report result",
    summary: "An approved record will show the report statement, its boundary, and how to interpret it.",
    period: "Sample period",
    source: "Source report to be supplied",
    page: "Page pending",
    limitations: ["Illustrative content only", "Not a real reported result"],
    review: "Illustrative sample",
  },
  {
    id: "sample-method",
    title: "How a claim is reviewed",
    topic: "Governance",
    claimType: "Method",
    summary: "Records keep the reporting period, source location, review state, and limitations together.",
    period: "Not applicable",
    source: "Review method preview",
    page: "—",
    limitations: ["Prototype content model preview"],
    review: "Illustrative sample",
  },
  {
    id: "sample-target",
    title: "Target and result are different claim types",
    topic: "Environment",
    claimType: "Target",
    summary: "The evidence view will preserve the source's claim type so a future goal is not presented as an achieved result.",
    period: "Not specified",
    source: "Editorial guidance preview",
    page: "—",
    limitations: ["Illustrative content only"],
    review: "Illustrative sample",
  },
];

export const routeOptions = missionScenario.choices;
import { missionScenario } from "../shared/mission";
import type { RouteId } from "../shared/contracts/mission";

export { missionScenario };
export type { RouteId };
