import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseImpactTotals, type ImpactExchangeKind, type ImpactTotals } from "../shared/contracts/impact-totals.js";

type StoredTotals = ImpactTotals & { eventIds: string[] };

export class ImpactStore {
  private readonly file: string;
  private state: StoredTotals | null;

  constructor(file = process.env.IMPACT_TOTALS_FILE ?? "data/impact-totals.json") {
    this.file = resolve(file);
    this.state = this.load();
  }

  private load(): StoredTotals | null {
    try {
      const value: unknown = JSON.parse(readFileSync(this.file, "utf8"));
      const totals = parseImpactTotals(value);
      if (!totals || typeof value !== "object" || value === null || !("eventIds" in value) ||
        !Array.isArray(value.eventIds) || !value.eventIds.every((id: unknown) => typeof id === "string")) return null;
      return { ...totals, eventIds: value.eventIds };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { trees: 0, waterDollars: 0, eventIds: [] };
      return null;
    }
  }

  totals(): ImpactTotals | null {
    if (!this.state) return null;
    return { trees: this.state.trees, waterDollars: this.state.waterDollars };
  }

  record(kind: ImpactExchangeKind, eventId: string): ImpactTotals | null {
    if (!this.state) return null;
    if (this.state.eventIds.includes(eventId)) return this.totals();
    const next: StoredTotals = {
      trees: this.state.trees + (kind === "tree" ? 1 : 0),
      waterDollars: this.state.waterDollars + (kind === "water" ? 1 : 0),
      eventIds: [...this.state.eventIds.slice(-9999), eventId],
    };
    if (!parseImpactTotals(next)) return null;
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      const temporaryFile = `${this.file}.${process.pid}.tmp`;
      writeFileSync(temporaryFile, JSON.stringify(next), { mode: 0o600 });
      renameSync(temporaryFile, this.file);
      this.state = next;
      return this.totals();
    } catch { return null; }
  }
}
