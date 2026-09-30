export const TELEMETRY_STATUSES = ["updating", "delayed", "stale", "unavailable"] as const;
export type TelemetryStatus = typeof TELEMETRY_STATUSES[number];

export type TelemetrySignal = {
  id: string;
  name: string;
  value: number | null;
  unit: string;
};

export type TelemetrySnapshot = {
  stepId: string;
  timestamp: string;
  status: TelemetryStatus;
  signals: TelemetrySignal[];
};

export type TelemetryDataset = {
  version: "telemetry-r1-v1";
  snapshots: TelemetrySnapshot[];
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const hasOnlyKeys = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).every((key) => keys.includes(key));

function isExplicitTimestamp(value: unknown): value is string {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));
}

export function parseTelemetryDataset(value: unknown): TelemetryDataset | null {
  if (!isObject(value) || !hasOnlyKeys(value, ["version", "snapshots"]) || value.version !== "telemetry-r1-v1") return null;
  if (!Array.isArray(value.snapshots) || value.snapshots.length === 0) return null;

  const snapshots: TelemetrySnapshot[] = [];
  const stepIds = new Set<string>();
  for (const item of value.snapshots) {
    if (!isObject(item) || !hasOnlyKeys(item, ["stepId", "timestamp", "status", "signals"])) return null;
    const { stepId, timestamp, status, signals } = item;
    if (typeof stepId !== "string" || !/^step-\d{2}$/.test(stepId) || stepIds.has(stepId)) return null;
    if (!isExplicitTimestamp(timestamp) || !TELEMETRY_STATUSES.includes(status as TelemetryStatus)) return null;
    if (!Array.isArray(signals)) return null;

    const parsedSignals: TelemetrySignal[] = [];
    const signalIds = new Set<string>();
    for (const signal of signals) {
      if (!isObject(signal) || !hasOnlyKeys(signal, ["id", "name", "value", "unit"])) return null;
      if (typeof signal.id !== "string" || !signal.id.trim() || signalIds.has(signal.id)) return null;
      if (typeof signal.name !== "string" || !signal.name.trim() || typeof signal.unit !== "string" || !signal.unit.trim()) return null;
      if (signal.value !== null && (typeof signal.value !== "number" || !Number.isFinite(signal.value))) return null;
      signalIds.add(signal.id);
      parsedSignals.push({ id: signal.id, name: signal.name, value: signal.value as number | null, unit: signal.unit });
    }
    stepIds.add(stepId);
    snapshots.push({ stepId, timestamp, status: status as TelemetryStatus, signals: parsedSignals });
  }

  return snapshots.every((snapshot, index) => snapshot.stepId === `step-${String(index + 1).padStart(2, "0")}`)
    ? { version: "telemetry-r1-v1", snapshots }
    : null;
}
