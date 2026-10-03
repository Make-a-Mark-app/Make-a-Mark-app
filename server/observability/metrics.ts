const durationBuckets = [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];

type RequestMetric = { method: string; route: string; statusClass: string };
type EngineerMode = "grounded_ai" | "prepared_fallback" | "no_answer";
type ProviderError = "request_failed" | "invalid_response";
type DurationSummary = { count: number; sum: number; buckets: number[] };

const requestCounts = new Map<string, number>();
const requestDurations = new Map<string, DurationSummary>();
const engineerModes = new Map<EngineerMode, number>([["grounded_ai", 0], ["prepared_fallback", 0], ["no_answer", 0]]);
const validationFailures = new Map<string, number>();
const providerErrors = new Map<ProviderError, number>([["request_failed", 0], ["invalid_response", 0]]);

function key(values: string[]): string {
  return values.join("\u0000");
}

export const localMetrics = {
  recordRequest(metric: RequestMetric, durationSeconds: number) {
    const labels = [metric.method, metric.route, metric.statusClass];
    const requestKey = key(labels);
    requestCounts.set(requestKey, (requestCounts.get(requestKey) ?? 0) + 1);
    const durationKey = key(labels.slice(0, 2));
    const summary = requestDurations.get(durationKey) ?? { count: 0, sum: 0, buckets: durationBuckets.map(() => 0) };
    summary.count += 1;
    summary.sum += durationSeconds;
    durationBuckets.forEach((bucket, index) => {
      if (durationSeconds <= bucket) summary.buckets[index] += 1;
    });
    requestDurations.set(durationKey, summary);
  },
  recordValidationFailure(route: string) {
    validationFailures.set(route, (validationFailures.get(route) ?? 0) + 1);
  },
  recordEngineerMode(mode: EngineerMode) {
    engineerModes.set(mode, (engineerModes.get(mode) ?? 0) + 1);
  },
  recordProviderError(error: ProviderError) {
    providerErrors.set(error, (providerErrors.get(error) ?? 0) + 1);
  },
  renderPrometheus(): string {
    const lines = [
      "# HELP impact_drive_http_requests_total Completed HTTP requests by method, route, and status class.",
      "# TYPE impact_drive_http_requests_total counter",
    ];
    for (const [labels, count] of requestCounts) {
      const [method, route, statusClass] = labels.split("\u0000");
      lines.push(`impact_drive_http_requests_total{method="${method}",route="${route}",status_class="${statusClass}"} ${count}`);
    }
    lines.push("# HELP impact_drive_http_request_duration_seconds API request latency.", "# TYPE impact_drive_http_request_duration_seconds histogram");
    for (const [labels, summary] of requestDurations) {
      const [method, route] = labels.split("\u0000");
      durationBuckets.forEach((bucket, index) => lines.push(`impact_drive_http_request_duration_seconds_bucket{method="${method}",route="${route}",le="${bucket}"} ${summary.buckets[index]}`));
      lines.push(`impact_drive_http_request_duration_seconds_bucket{method="${method}",route="${route}",le="+Inf"} ${summary.count}`);
      lines.push(`impact_drive_http_request_duration_seconds_sum{method="${method}",route="${route}"} ${summary.sum}`);
      lines.push(`impact_drive_http_request_duration_seconds_count{method="${method}",route="${route}"} ${summary.count}`);
    }
    lines.push("# HELP impact_drive_engineer_responses_total Engineer responses by response mode.", "# TYPE impact_drive_engineer_responses_total counter");
    for (const [mode, count] of engineerModes) lines.push(`impact_drive_engineer_responses_total{mode="${mode}"} ${count}`);
    lines.push("# HELP impact_drive_validation_failures_total Rejected request payloads by route.", "# TYPE impact_drive_validation_failures_total counter");
    for (const [route, count] of validationFailures) lines.push(`impact_drive_validation_failures_total{route="${route}"} ${count}`);
    lines.push("# HELP impact_drive_engineer_provider_errors_total Optional provider failure classes.", "# TYPE impact_drive_engineer_provider_errors_total counter");
    for (const [category, count] of providerErrors) lines.push(`impact_drive_engineer_provider_errors_total{category="${category}"} ${count}`);
    return lines.join("\n") + "\n";
  },
};
