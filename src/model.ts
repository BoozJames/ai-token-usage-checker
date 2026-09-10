export type ProviderId = "claude" | "codex" | "copilot";
export type SnapshotState = "ready" | "loading" | "stale" | "unavailable" | "unsupported" | "error";

export interface ProviderAvailability {
  available: boolean;
  reason?: string;
}

export interface ConnectionResult {
  connected: boolean;
  message?: string;
}

export interface QuotaWindow {
  id: string;
  label: string;
  usedPercent: number;
  resetsAt?: string;
  durationMinutes?: number;
}

export interface TokenUsage {
  scope: "context" | "daily" | "lifetime" | "session";
  total: number;
  limit?: number;
}

export interface ProviderSnapshot {
  providerId: ProviderId;
  state: SnapshotState;
  observedAt: string;
  source: {
    label: string;
    accuracy: "provider-reported" | "local-derived";
  };
  quotaWindows: QuotaWindow[];
  tokenUsage?: TokenUsage;
  message?: string;
}

export interface ProviderAdapter {
  readonly id: ProviderId;
  detect(): Promise<ProviderAvailability>;
  connect(): Promise<ConnectionResult>;
  refresh(signal: AbortSignal): Promise<ProviderSnapshot>;
  disconnect(): Promise<void>;
  dispose(): void;
}

export type GaugeSelection =
  | { determinate: true; value: number; label: string; resetsAt?: string }
  | { determinate: false; value?: never; label: string };

export function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, value));
}

export function selectGauge(snapshot: ProviderSnapshot, now = Date.now()): GaugeSelection {
  const validWindows = snapshot.quotaWindows
    .filter((window) => Number.isFinite(window.usedPercent) && isActive(window.resetsAt, now))
    .map((window) => ({ ...window, usedPercent: clampPercentage(window.usedPercent) }))
    .sort((a, b) => b.usedPercent - a.usedPercent);

  const quota = validWindows[0];
  if (quota) {
    return {
      determinate: true,
      value: quota.usedPercent,
      label: quota.label,
      ...(quota.resetsAt ? { resetsAt: quota.resetsAt } : {})
    };
  }

  const usage = snapshot.tokenUsage;
  if (usage?.limit && usage.limit > 0) {
    return {
      determinate: true,
      value: clampPercentage((usage.total / usage.limit) * 100),
      label: usage.scope === "context" ? "Context window" : `${capitalize(usage.scope)} usage`
    };
  }

  return {
    determinate: false,
    label: usage ? `${capitalize(usage.scope)} tokens` : "Usage unavailable"
  };
}

function isActive(resetsAt: string | undefined, now: number): boolean {
  if (!resetsAt) return true;
  const resetTime = Date.parse(resetsAt);
  return Number.isFinite(resetTime) && resetTime > now;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
