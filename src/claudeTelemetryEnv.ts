export interface EnvironmentEntry {
  name: string;
  value: string;
}

export const DEFAULT_TELEMETRY_PORT = 41787;
export const AUTH_HEADER_NAME = "x-ai-token-checker";
export const METRICS_PATH = "/v1/metrics";

export const TELEMETRY_VAR_NAMES: readonly string[] = [
  "CLAUDE_CODE_ENABLE_TELEMETRY",
  "OTEL_METRICS_EXPORTER",
  "OTEL_EXPORTER_OTLP_PROTOCOL",
  "OTEL_EXPORTER_OTLP_METRICS_ENDPOINT",
  "OTEL_EXPORTER_OTLP_HEADERS",
  "OTEL_METRIC_EXPORT_INTERVAL",
  "OTEL_METRICS_INCLUDE_SESSION_ID",
  "OTEL_METRICS_INCLUDE_ACCOUNT_UUID",
  "OTEL_METRICS_INCLUDE_REPOSITORY",
  "OTEL_METRICS_INCLUDE_VERSION"
];

export function telemetryEndpoint(port: number): string {
  return `http://127.0.0.1:${port}${METRICS_PATH}`;
}

/**
 * The four `*_INCLUDE_*=false` entries reduce what Claude Code's exporter
 * attaches, but live testing against Claude Code CLI 2.1.273 (2026-09-16)
 * showed it always attaches `user.email`, `user.id`, and `organization.id`
 * regardless — there is no documented flag to suppress those three. This
 * project therefore does not rely on the exporter's flags for its privacy
 * invariant; `src/providers/claudeOtel.ts`'s `seriesKey()` allowlists only
 * the `type` and `model` attributes when parsing and discards everything
 * else unread. These four vars are still set because they are free and
 * harmless, not because they are load-bearing.
 */
export function buildTelemetryEnvironment(port: number, authToken: string): EnvironmentEntry[] {
  return [
    { name: "CLAUDE_CODE_ENABLE_TELEMETRY", value: "1" },
    { name: "OTEL_METRICS_EXPORTER", value: "otlp" },
    { name: "OTEL_EXPORTER_OTLP_PROTOCOL", value: "http/json" },
    { name: "OTEL_EXPORTER_OTLP_METRICS_ENDPOINT", value: telemetryEndpoint(port) },
    { name: "OTEL_EXPORTER_OTLP_HEADERS", value: `${AUTH_HEADER_NAME}=${authToken}` },
    { name: "OTEL_METRIC_EXPORT_INTERVAL", value: "60000" },
    { name: "OTEL_METRICS_INCLUDE_SESSION_ID", value: "false" },
    { name: "OTEL_METRICS_INCLUDE_ACCOUNT_UUID", value: "false" },
    { name: "OTEL_METRICS_INCLUDE_REPOSITORY", value: "false" },
    { name: "OTEL_METRICS_INCLUDE_VERSION", value: "false" }
  ];
}

export function normalizeTelemetryPort(value: unknown): number {
  const port = typeof value === "number" ? value : Number(value);
  return Number.isInteger(port) && port >= 1024 && port <= 65535 ? port : DEFAULT_TELEMETRY_PORT;
}

/** Replaces only the entries this extension manages; every other entry the user or an organization set is preserved untouched. */
export function mergeEnvironmentEntries(existing: unknown, managed: EnvironmentEntry[]): EnvironmentEntry[] {
  const managedNames = new Set(managed.map((entry) => entry.name));
  const preserved = validEntries(existing).filter((entry) => !managedNames.has(entry.name));
  return [...preserved, ...managed];
}

export function stripEnvironmentEntries(existing: unknown): EnvironmentEntry[] {
  const managedNames = new Set(TELEMETRY_VAR_NAMES);
  return validEntries(existing).filter((entry) => !managedNames.has(entry.name));
}

/** True when one of the names this feature manages is already present and was not put there by this extension (checked by the caller before first setup only). */
export function hasForeignTelemetryEntries(existing: unknown): boolean {
  const managedNames = new Set(TELEMETRY_VAR_NAMES);
  return validEntries(existing).some((entry) => managedNames.has(entry.name));
}

function validEntries(value: unknown): EnvironmentEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: EnvironmentEntry[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const name = (item as Record<string, unknown>).name;
    const entryValue = (item as Record<string, unknown>).value;
    if (typeof name === "string" && typeof entryValue === "string") entries.push({ name, value: entryValue });
  }
  return entries;
}
