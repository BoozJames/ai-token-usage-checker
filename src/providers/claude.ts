import { existsSync, mkdirSync, watch, type FSWatcher } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { basename, dirname } from "node:path";
import type { ConnectionResult, ProviderAdapter, ProviderAvailability, ProviderSnapshot, QuotaWindow, TokenUsage } from "../model";
import { MAX_TELEMETRY_SNAPSHOT_BYTES, parseTelemetrySnapshot, type TelemetrySnapshotFile } from "./claudeOtel";
import type { ClaudeOtelReceiver } from "./claudeOtelReceiver";

const MAX_SNAPSHOT_BYTES = 64 * 1024;

interface ClaudeAdapterOptions {
  snapshotPath: string;
  bridgePath: string;
  telemetrySnapshotPath: string;
  telemetryEnabled: () => boolean;
  createReceiver: () => ClaudeOtelReceiver | undefined;
  onChanged: () => void;
}

export class ClaudeAdapter implements ProviderAdapter {
  readonly id = "claude" as const;
  private watcher: FSWatcher | undefined;
  private receiver: ClaudeOtelReceiver | undefined;

  constructor(private readonly options: ClaudeAdapterOptions) {}

  async detect(): Promise<ProviderAvailability> {
    if (existsSync(this.options.bridgePath) || existsSync(this.options.snapshotPath) || this.options.telemetryEnabled()) {
      return { available: true };
    }
    return { available: false, reason: "Run ‘Set Up Claude Code Bridge’ or ‘Enable Claude Code Telemetry’ first." };
  }

  async connect(): Promise<ConnectionResult> {
    const bridgeConfigured = existsSync(this.options.bridgePath) || existsSync(this.options.snapshotPath);
    const telemetryConfigured = this.options.telemetryEnabled();
    if (!bridgeConfigured && !telemetryConfigured) {
      return { connected: false, message: "Claude bridge and telemetry are not set up yet." };
    }
    this.startWatcher();
    if (telemetryConfigured) await this.startReceiver();
    return { connected: true };
  }

  async refresh(signal: AbortSignal): Promise<ProviderSnapshot> {
    if (signal.aborted) {
      throw new Error("Refresh cancelled");
    }

    const [statusLine, telemetry] = await Promise.all([
      readStatusLineSnapshot(this.options.snapshotPath),
      readTelemetrySnapshot(this.options.telemetrySnapshotPath)
    ]);
    const merged = mergeClaudeSnapshot(statusLine, telemetry);
    if (merged.state === "ready") return merged;
    return { ...merged, message: unavailableMessage(this.options.telemetryEnabled()) };
  }

  async disconnect(): Promise<void> {
    this.stopWatcher();
    await this.stopReceiver();
  }

  dispose(): void {
    this.stopWatcher();
    void this.stopReceiver();
  }

  private startWatcher(): void {
    if (this.watcher) return;
    const watchedDirectory = dirname(this.options.snapshotPath);
    const watchedNames = new Set([basename(this.options.snapshotPath), basename(this.options.telemetrySnapshotPath)]);
    try {
      // fs.watch throws synchronously (ENOENT) if the directory does not exist yet, which is
      // expected on a first-ever "Enable Claude Code Telemetry" with no prior bridge setup:
      // nothing else creates this directory before connect() runs.
      mkdirSync(watchedDirectory, { recursive: true });
      let timer: NodeJS.Timeout | undefined;
      this.watcher = watch(watchedDirectory, (_event, filename) => {
        if (filename && !watchedNames.has(filename.toString())) return;
        if (timer) clearTimeout(timer);
        timer = setTimeout(this.options.onChanged, 400);
      });
      this.watcher.on("error", () => this.stopWatcher());
    } catch {
      // Refresh still works on the periodic timer without instant updates on file change.
    }
  }

  private stopWatcher(): void {
    this.watcher?.close();
    this.watcher = undefined;
  }

  private async startReceiver(): Promise<void> {
    if (this.receiver) return;
    const receiver = this.options.createReceiver();
    if (!receiver) return;
    const result = await receiver.start();
    if (result.bound) this.receiver = receiver;
  }

  private async stopReceiver(): Promise<void> {
    const receiver = this.receiver;
    this.receiver = undefined;
    await receiver?.stop();
  }
}

async function readStatusLineSnapshot(snapshotPath: string): Promise<ProviderSnapshot | undefined> {
  if (!existsSync(snapshotPath)) return undefined;
  const stats = await stat(snapshotPath);
  if (stats.size > MAX_SNAPSHOT_BYTES) {
    throw new Error("Claude metric snapshot is larger than the allowed limit");
  }
  const raw: unknown = JSON.parse(await readFile(snapshotPath, "utf8"));
  return parseClaudeSnapshot(raw);
}

async function readTelemetrySnapshot(telemetrySnapshotPath: string): Promise<TelemetrySnapshotFile | undefined> {
  if (!existsSync(telemetrySnapshotPath)) return undefined;
  try {
    const stats = await stat(telemetrySnapshotPath);
    if (stats.size > MAX_TELEMETRY_SNAPSHOT_BYTES) return undefined;
    const raw: unknown = JSON.parse(await readFile(telemetrySnapshotPath, "utf8"));
    return parseTelemetrySnapshot(raw);
  } catch {
    return undefined;
  }
}

function unavailableMessage(telemetryEnabled: boolean): string {
  const base = "No Claude Code terminal status-line event received yet. Start or restart the Claude Code CLI, then send a message. Claude Code 2.1.251 or newer is required for 5-hour and 7-day quota fields.";
  if (!telemetryEnabled) return base;
  return `${base} Claude Code telemetry is enabled but no metrics have arrived yet; reopen the Claude Code panel and send a message — data appears within about a minute.`;
}

/**
 * Combines the two independent Claude Code data sources into one snapshot.
 * The status line's quota windows and token usage always win when present
 * (it is provider-reported and often bounded); the telemetry token total is
 * a strict fallback for panel-mode sessions where the status line never
 * fires. The two are never summed — they measure different things.
 */
export function mergeClaudeSnapshot(
  statusLine: ProviderSnapshot | undefined,
  telemetry: TelemetrySnapshotFile | undefined
): ProviderSnapshot {
  const quotaWindows = statusLine?.quotaWindows ?? [];
  const statusLineUsage = statusLine?.tokenUsage;
  const usedStatusLine = quotaWindows.length > 0 || statusLineUsage !== undefined;
  const usedTelemetry = statusLineUsage === undefined && telemetry !== undefined;
  const usage: TokenUsage | undefined = statusLineUsage ?? (telemetry ? { scope: "session", total: telemetry.total } : undefined);

  const label = usedStatusLine && usedTelemetry
    ? "Claude Code status line + telemetry"
    : usedTelemetry
      ? "Claude Code telemetry"
      : usedStatusLine
        ? "Claude Code status line"
        : "Claude Code";

  const timestamps = [
    ...(usedStatusLine && statusLine ? [statusLine.observedAt] : []),
    ...(usedTelemetry && telemetry ? [telemetry.observedAt] : [])
  ];
  const observedAt = timestamps.length
    ? timestamps.reduce((latest, value) => (Date.parse(value) > Date.parse(latest) ? value : latest))
    : new Date().toISOString();

  return {
    providerId: "claude",
    state: quotaWindows.length || usage ? "ready" : "unavailable",
    observedAt,
    source: { label, accuracy: "provider-reported" },
    quotaWindows,
    ...(usage !== undefined ? { tokenUsage: usage } : {})
  };
}

export function parseClaudeSnapshot(value: unknown): ProviderSnapshot {
  const object = asRecord(value);
  if (object.schemaVersion !== 1) {
    throw new Error("Unsupported Claude bridge snapshot version");
  }

  const quotaWindows: QuotaWindow[] = [];
  const limits = asOptionalRecord(object.rateLimits);
  addLimit(quotaWindows, limits?.fiveHour, "five-hour", "5-hour limit");
  addLimit(quotaWindows, limits?.sevenDay, "seven-day", "7-day limit");
  addLimit(quotaWindows, limits?.spendLimit, "spend", "Spend limit");

  const context = asOptionalRecord(object.context);
  const total = finiteNumber(context?.totalTokens);
  const limit = finiteNumber(context?.limit);
  const observedAt = typeof object.observedAt === "string" && !Number.isNaN(Date.parse(object.observedAt))
    ? object.observedAt
    : new Date().toISOString();

  return {
    providerId: "claude",
    state: quotaWindows.length || total !== undefined ? "ready" : "unavailable",
    observedAt,
    source: { label: "Claude Code status line", accuracy: "provider-reported" },
    quotaWindows,
    ...(total !== undefined
      ? { tokenUsage: { scope: "context" as const, total, ...(limit !== undefined ? { limit } : {}) } }
      : {}),
    ...(quotaWindows.length || total !== undefined ? {} : {
      message: "The Claude status line responded without usage metrics. Claude Code 2.1.251 or newer is required for 5-hour and 7-day quota fields."
    })
  };
}

function addLimit(target: QuotaWindow[], value: unknown, id: string, label: string): void {
  const object = asOptionalRecord(value);
  const usedPercent = finiteNumber(object?.usedPercent);
  if (usedPercent === undefined) return;
  const resetsAt = typeof object?.resetsAt === "string" && !Number.isNaN(Date.parse(object.resetsAt))
    ? object.resetsAt
    : undefined;
  target.push({ id, label, usedPercent, ...(resetsAt ? { resetsAt } : {}) });
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid Claude bridge snapshot");
  }
  return value as Record<string, unknown>;
}

function asOptionalRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}
