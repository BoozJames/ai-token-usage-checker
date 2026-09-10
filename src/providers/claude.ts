import { existsSync, watch, type FSWatcher } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, dirname } from "node:path";
import type { ConnectionResult, ProviderAdapter, ProviderAvailability, ProviderSnapshot, QuotaWindow } from "../model";

const MAX_SNAPSHOT_BYTES = 64 * 1024;

interface ClaudeAdapterOptions {
  snapshotPath: string;
  bridgePath: string;
  onChanged: () => void;
}

export class ClaudeAdapter implements ProviderAdapter {
  readonly id = "claude" as const;
  private watcher: FSWatcher | undefined;

  constructor(private readonly options: ClaudeAdapterOptions) {}

  async detect(): Promise<ProviderAvailability> {
    return existsSync(this.options.bridgePath) || existsSync(this.options.snapshotPath)
      ? { available: true }
      : { available: false, reason: "Run ‘Set Up Claude Code Bridge’ first." };
  }

  async connect(): Promise<ConnectionResult> {
    if (!existsSync(this.options.bridgePath) && !existsSync(this.options.snapshotPath)) {
      return { connected: false, message: "Claude bridge is not set up yet." };
    }
    this.startWatcher();
    return { connected: true };
  }

  async refresh(signal: AbortSignal): Promise<ProviderSnapshot> {
    if (signal.aborted) {
      throw new Error("Refresh cancelled");
    }

    if (!existsSync(this.options.snapshotPath)) {
      return {
        providerId: "claude",
        state: "unavailable",
        observedAt: new Date().toISOString(),
        source: { label: "Claude Code status line", accuracy: "provider-reported" },
        quotaWindows: [],
        message: "Waiting for Claude Code’s first response."
      };
    }
    const stat = await import("node:fs/promises").then(({ stat }) => stat(this.options.snapshotPath));
    if (stat.size > MAX_SNAPSHOT_BYTES) {
      throw new Error("Claude metric snapshot is larger than the allowed limit");
    }
    const raw: unknown = JSON.parse(await readFile(this.options.snapshotPath, "utf8"));
    return parseClaudeSnapshot(raw);
  }

  async disconnect(): Promise<void> {
    this.stopWatcher();
  }

  dispose(): void {
    this.stopWatcher();
  }

  private startWatcher(): void {
    if (this.watcher) return;
    let timer: NodeJS.Timeout | undefined;
    this.watcher = watch(dirname(this.options.snapshotPath), (_event, filename) => {
      if (filename && filename.toString() !== basename(this.options.snapshotPath)) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(this.options.onChanged, 400);
    });
    this.watcher.on("error", () => this.stopWatcher());
  }

  private stopWatcher(): void {
    this.watcher?.close();
    this.watcher = undefined;
  }
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
    ...(quotaWindows.length || total !== undefined ? {} : { message: "Waiting for Claude Code’s first response." })
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
