export const TELEMETRY_STATUSES = ["updating", "delayed", "stale", "unavailable"] as const;
export type TelemetryStatus = typeof TELEMETRY_STATUSES[number];

export type TelemetrySignal = {
  id: string;
  name: string;
  valueType: "number" | "integer";
  value: number | null;
  unit: string;
  interpretation: string;
};

export type TelemetrySnapshot = {
  stepId: string;
  timestamp: string;
  status: TelemetryStatus;
  signals: TelemetrySignal[];
};

export type TelemetryDataset = {
  version: "telemetry-r1-v2";
  snapshots: TelemetrySnapshot[];
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const hasOnlyKeys = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).every((key) => keys.includes(key));

function isExplicitTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!parts) return false;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, zone, , offsetHourText, offsetMinuteText] = parts;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = Number(offsetHourText ?? 0);
  const offsetMinute = Number(offsetMinuteText ?? 0);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysPerMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const validOffset = zone === "Z" || (offsetHour <= 14 && offsetMinute <= 59 && (offsetHour < 14 || offsetMinute === 0));

  return month >= 1 && month <= 12
    && day >= 1 && day <= daysPerMonth[month - 1]
    && hour <= 23 && minute <= 59 && second <= 59
    && validOffset
    && Number.isFinite(Date.parse(value));
}

export function parseTelemetryDataset(value: unknown): TelemetryDataset | null {
  if (!isObject(value) || !hasOnlyKeys(value, ["version", "snapshots"]) || value.version !== "telemetry-r1-v2") return null;
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
      if (!isObject(signal) || !hasOnlyKeys(signal, ["id", "name", "valueType", "value", "unit", "interpretation"])) return null;
      if (typeof signal.id !== "string" || !signal.id.trim() || signalIds.has(signal.id)) return null;
      if (typeof signal.name !== "string" || !signal.name.trim() || typeof signal.unit !== "string" || !signal.unit.trim()) return null;
      if (signal.valueType !== "number" && signal.valueType !== "integer") return null;
      if (typeof signal.interpretation !== "string" || !signal.interpretation.trim()) return null;
      if (signal.value !== null && (typeof signal.value !== "number" || !Number.isFinite(signal.value))) return null;
      if (signal.value !== null && signal.valueType === "integer" && !Number.isInteger(signal.value)) return null;
      signalIds.add(signal.id);
      parsedSignals.push({ id: signal.id, name: signal.name, valueType: signal.valueType, value: signal.value as number | null, unit: signal.unit, interpretation: signal.interpretation });
    }
    stepIds.add(stepId);
    snapshots.push({ stepId, timestamp, status: status as TelemetryStatus, signals: parsedSignals });
  }

  return snapshots.every((snapshot, index) => snapshot.stepId === `step-${String(index + 1).padStart(2, "0")}`)
    ? { version: "telemetry-r1-v2", snapshots }
    : null;
}
