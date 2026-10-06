export type ImpactExchangeKind = "tree" | "water";
export type ImpactTotals = { trees: number; waterDollars: number };

export function parseImpactTotals(value: unknown): ImpactTotals | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (![record.trees, record.waterDollars].every((count) =>
    typeof count === "number" && Number.isSafeInteger(count) && count >= 0 && count <= 1_000_000)) return null;
  return { trees: record.trees as number, waterDollars: record.waterDollars as number };
}
