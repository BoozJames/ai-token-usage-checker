import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { ConnectionResult, ProviderAdapter, ProviderAvailability, ProviderSnapshot, QuotaWindow } from "../model";

const MAX_LINE_BYTES = 1024 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

export class CodexAdapter implements ProviderAdapter {
  readonly id = "codex" as const;
  private process: ChildProcessWithoutNullStreams | undefined;
  private stdoutBuffer = "";
  private pending = new Map<number, PendingRequest>();
  private nextId = 1;
  private connected = false;

  constructor(private readonly executable: () => string) {}

  async detect(): Promise<ProviderAvailability> {
    const executable = this.executable().trim();
    return executable
      ? { available: true }
      : { available: false, reason: "Configure a Codex executable first." };
  }

  async connect(): Promise<ConnectionResult> {
    if (this.connected) return { connected: true };
    try {
      await this.start();
      return { connected: true };
    } catch (error) {
      await this.disconnect();
      return { connected: false, message: codexConnectionMessage(error) };
    }
  }

  async refresh(signal: AbortSignal): Promise<ProviderSnapshot> {
    if (!this.connected) throw new Error("Codex is disconnected");
    if (signal.aborted) throw new Error("Refresh cancelled");

    const [limitsValue, usageValue] = await Promise.all([
      this.request("account/rateLimits/read", {}, signal),
      this.request("account/usage/read", {}, signal).catch(() => undefined)
    ]);
    return normalizeCodex(limitsValue, usageValue);
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.stdoutBuffer = "";
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error("Codex connection closed"));
    }
    this.pending.clear();
    this.process?.kill();
    this.process = undefined;
  }

  dispose(): void {
    void this.disconnect();
  }

  private async start(): Promise<void> {
    const executable = this.executable().trim();
    if (!executable || /[\r\n\0]/.test(executable)) {
      throw new Error("Invalid Codex executable setting");
    }

    this.process = spawn(executable, ["app-server"], {
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"]
    });
    this.process.stderr.setEncoding("utf8");
    let stderrBytes = 0;
    this.process.stderr.on("data", (chunk: string) => {
      stderrBytes += Buffer.byteLength(chunk);
      if (stderrBytes > MAX_LINE_BYTES) this.process?.kill();
    });
    this.process.once("error", (error) => this.failAll(error));
    this.process.once("exit", () => this.failAll(new Error("Codex app-server exited")));

    this.process.stdout.setEncoding("utf8");
    this.process.stdout.on("data", (chunk: string) => this.handleChunk(chunk));

    await this.request("initialize", {
      clientInfo: { name: "ai_token_checker", title: "AI Token Checker", version: "1.0.0" },
      capabilities: { optOutNotificationMethods: ["thread/started", "item/agentMessage/delta"] }
    });
    this.send({ method: "initialized", params: {} });
    this.connected = true;
  }

  private request(method: string, params: Record<string, unknown>, signal?: AbortSignal): Promise<unknown> {
    if (!this.process?.stdin.writable) return Promise.reject(new Error("Codex app-server is not running"));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Codex request timed out"));
      }, REQUEST_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      if (signal) {
        signal.addEventListener("abort", () => {
          const pending = this.pending.get(id);
          if (!pending) return;
          clearTimeout(pending.timer);
          this.pending.delete(id);
          pending.reject(new Error("Refresh cancelled"));
        }, { once: true });
      }
      this.send({ method, id, params });
    });
  }

  private send(message: unknown): void {
    this.process?.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private handleChunk(chunk: string): void {
    this.stdoutBuffer += chunk;
    if (Buffer.byteLength(this.stdoutBuffer) > MAX_LINE_BYTES) {
      this.failAll(new Error("Codex response exceeded the size limit"));
      this.process?.kill();
      return;
    }
    let newline = this.stdoutBuffer.indexOf("\n");
    while (newline >= 0) {
      const line = this.stdoutBuffer.slice(0, newline).replace(/\r$/, "");
      this.stdoutBuffer = this.stdoutBuffer.slice(newline + 1);
      if (line) this.handleLine(line);
      newline = this.stdoutBuffer.indexOf("\n");
    }
  }

  private handleLine(line: string): void {
    try {
      const message = JSON.parse(line) as { id?: unknown; result?: unknown; error?: { message?: unknown } };
      if (typeof message.id !== "number") return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(typeof message.error.message === "string" ? message.error.message : "Codex request failed"));
      } else {
        pending.resolve(message.result);
      }
    } catch {
      // Ignore malformed notifications; pending requests still time out safely.
    }
  }

  private failAll(error: Error): void {
    this.connected = false;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
}

function codexConnectionMessage(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
    return "Codex executable was not found. Install Codex or set AI Token Checker: Codex Executable to its absolute path.";
  }
  return error instanceof Error ? error.message : "Could not start Codex.";
}

export function normalizeCodex(limitsValue: unknown, usageValue: unknown): ProviderSnapshot {
  const limitsResult = record(limitsValue);
  const buckets = record(limitsResult.rateLimitsByLimitId);
  const fallback = record(limitsResult.rateLimits);
  const quotaWindows: QuotaWindow[] = [];

  if (Object.keys(buckets).length) {
    for (const [bucketId, bucketValue] of Object.entries(buckets)) addBucket(quotaWindows, bucketId, bucketValue);
  } else if (Object.keys(fallback).length) {
    addBucket(quotaWindows, stringValue(fallback.limitId) ?? "codex", fallback);
  }

  const usage = record(usageValue);
  const summary = record(usage.summary);
  const lifetimeTokens = nonNegativeNumber(summary.lifetimeTokens);
  return {
    providerId: "codex",
    state: quotaWindows.length || lifetimeTokens !== undefined ? "ready" : "unavailable",
    observedAt: new Date().toISOString(),
    source: { label: "Codex app-server", accuracy: "provider-reported" },
    quotaWindows,
    ...(lifetimeTokens !== undefined ? { tokenUsage: { scope: "lifetime" as const, total: lifetimeTokens } } : {}),
    ...(quotaWindows.length || lifetimeTokens !== undefined ? {} : { message: "Codex did not report supported usage data for this account." })
  };
}

function addBucket(target: QuotaWindow[], fallbackId: string, value: unknown): void {
  const bucket = record(value);
  const bucketName = stringValue(bucket.limitName) ?? stringValue(bucket.limitId) ?? fallbackId;
  addWindow(target, `${fallbackId}:primary`, `${bucketName} primary`, bucket.primary);
  addWindow(target, `${fallbackId}:secondary`, `${bucketName} secondary`, bucket.secondary);
}

function addWindow(target: QuotaWindow[], id: string, label: string, value: unknown): void {
  const window = record(value);
  const usedPercent = nonNegativeNumber(window.usedPercent);
  if (usedPercent === undefined) return;
  const resetsAtSeconds = nonNegativeNumber(window.resetsAt);
  const durationMinutes = nonNegativeNumber(window.windowDurationMins);
  target.push({
    id,
    label: quotaWindowLabel(durationMinutes, label),
    usedPercent,
    ...(resetsAtSeconds !== undefined ? { resetsAt: new Date(resetsAtSeconds * 1000).toISOString() } : {}),
    ...(durationMinutes !== undefined ? { durationMinutes } : {})
  });
}

function quotaWindowLabel(durationMinutes: number | undefined, fallback: string): string {
  if (durationMinutes === 300) return "5-hour limit";
  if (durationMinutes === 10_080) return "Weekly limit";
  return fallback;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function nonNegativeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}
function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}
