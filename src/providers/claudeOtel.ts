import type { TokenUsage } from "../model";

export const CLAUDE_TOKEN_METRIC = "claude_code.token.usage";
export const MAX_TELEMETRY_SNAPSHOT_BYTES = 64 * 1024;

const MAX_SERIES = 256;
const MAX_ATTRIBUTE_LENGTH = 128;

export interface TelemetryTotals {
  readonly series: ReadonlyMap<string, number>;
  readonly total: number;
  readonly hasData: boolean;
}

export interface TelemetrySnapshotFile {
  readonly total: number;
  readonly observedAt: string;
}

export function emptyTelemetryTotals(): TelemetryTotals {
  return { series: new Map(), total: 0, hasData: false };
}

/**
 * Accumulates `claude_code.token.usage` data points from an OTLP/HTTP JSON
 * ExportMetricsServiceRequest body. Every other metric is ignored. A data
 * point's `aggregationTemporality` decides whether its value is added to the
 * running total for that attribute set (DELTA) or replaces it (CUMULATIVE).
 * Unspecified/unknown temporality is treated as CUMULATIVE: replacing can
 * only under-report a total, never inflate it, matching this project's
 * fail-conservative posture on numbers it did not itself define.
 */
export function applyOtelMetricsPayload(previous: TelemetryTotals, payload: unknown): TelemetryTotals {
  const series = new Map(previous.series);
  let received = false;

  for (const resourceMetric of arrayOf(record(payload).resourceMetrics)) {
    for (const scopeMetric of arrayOf(record(resourceMetric).scopeMetrics)) {
      for (const metric of arrayOf(record(scopeMetric).metrics)) {
        const metricRecord = record(metric);
        if (metricRecord.name !== CLAUDE_TOKEN_METRIC) continue;
        const sum = record(metricRecord.sum);
        if (!Array.isArray(sum.dataPoints)) continue;
        const cumulative = isCumulative(sum.aggregationTemporality);
        for (const point of sum.dataPoints) {
          const value = pointValue(point);
          if (value === undefined) continue;
          const key = seriesKey(record(point).attributes);
          if (!series.has(key) && series.size >= MAX_SERIES) continue;
          series.set(key, cumulative ? value : (series.get(key) ?? 0) + value);
          received = true;
        }
      }
    }
  }

  const total = clampNonNegative([...series.values()].reduce((sum, value) => sum + value, 0));
  return { series, total, hasData: previous.hasData || received };
}

export function telemetryTokenUsage(totals: TelemetryTotals): TokenUsage | undefined {
  return totals.hasData ? { scope: "session", total: totals.total } : undefined;
}

export function serializeTelemetrySnapshot(total: number, observedAt: string): string {
  return `${JSON.stringify({ schemaVersion: 1, observedAt, totalTokens: total })}\n`;
}

export function parseTelemetrySnapshot(value: unknown): TelemetrySnapshotFile | undefined {
  const object = record(value);
  if (object.schemaVersion !== 1) return undefined;
  const total = object.totalTokens;
  const observedAt = object.observedAt;
  if (typeof total !== "number" || !Number.isFinite(total) || total < 0) return undefined;
  if (typeof observedAt !== "string" || Number.isNaN(Date.parse(observedAt))) return undefined;
  return { total, observedAt };
}

function isCumulative(value: unknown): boolean {
  return value !== 1 && value !== "AGGREGATION_TEMPORALITY_DELTA";
}

function pointValue(point: unknown): number | undefined {
  const pointRecord = record(point);
  if ("asInt" in pointRecord) {
    const value = Number(pointRecord.asInt);
    return Number.isFinite(value) && value >= 0 ? value : undefined;
  }
  if (typeof pointRecord.asDouble === "number" && Number.isFinite(pointRecord.asDouble) && pointRecord.asDouble >= 0) {
    return pointRecord.asDouble;
  }
  return undefined;
}

/**
 * Live testing against the real Claude Code CLI (2026-09-16) showed it
 * always attaches `user.email`, `user.id`, and `organization.id` to every
 * data point, with no documented OTEL_METRICS_INCLUDE_* flag able to
 * suppress them — contrary to what the exporter-side privacy flags this
 * extension sets are documented to do. Rather than trust the exporter to
 * withhold identifying attributes, this parser allowlists only the two
 * attribute names it actually needs to bucket data points correctly
 * (`type` and `model`, neither of which identifies a person or account)
 * and never reads, stores, or keys by anything else — no email, user id,
 * organization id, or terminal type ever enters this process's memory.
 */
const ALLOWED_ATTRIBUTE_KEYS = new Set(["type", "model"]);

function seriesKey(attributes: unknown): string {
  const pairs: string[] = [];
  for (const attribute of arrayOf(attributes)) {
    const attributeRecord = record(attribute);
    const key = typeof attributeRecord.key === "string" ? attributeRecord.key : undefined;
    if (!key || !ALLOWED_ATTRIBUTE_KEYS.has(key)) continue;
    const value = attributeValue(attributeRecord.value);
    if (value !== undefined) pairs.push(`${key}=${value.slice(0, MAX_ATTRIBUTE_LENGTH)}`);
  }
  return pairs.sort().join("|");
}

function attributeValue(value: unknown): string | undefined {
  const valueRecord = record(value);
  if (typeof valueRecord.stringValue === "string") return valueRecord.stringValue;
  if (typeof valueRecord.intValue === "string" || typeof valueRecord.intValue === "number") return String(valueRecord.intValue);
  if (typeof valueRecord.boolValue === "boolean") return String(valueRecord.boolValue);
  return undefined;
}

function clampNonNegative(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
