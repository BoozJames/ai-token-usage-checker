import type { ConnectionResult, ProviderAdapter, ProviderAvailability, ProviderSnapshot, QuotaWindow } from "../model";

interface CopilotClientHandle {
  start(): Promise<void>;
  stop(): Promise<Error[]>;
  forceStop(): Promise<void>;
  readonly rpc: {
    account: {
      getQuota(params: Record<string, never>): Promise<{
        quotaSnapshots: Record<string, {
          isUnlimitedEntitlement: boolean;
          remainingPercentage: number;
          resetDate?: string;
        } | undefined>;
      }>;
    };
  };
}

export class CopilotAdapter implements ProviderAdapter {
  readonly id = "copilot" as const;
  private client: CopilotClientHandle | undefined;

  async detect(): Promise<ProviderAvailability> {
    return { available: true };
  }

  async connect(): Promise<ConnectionResult> {
    if (this.client) return { connected: true };
    const { CopilotClient } = await import("@github/copilot-sdk");
    const client: CopilotClientHandle = new CopilotClient({
      useLoggedInUser: true,
      logLevel: "none",
      enableRemoteSessions: false,
      clientInfo: { applicationName: "ai-token-checker", applicationVersion: "0.1.0" }
    });
    try {
      await client.start();
      this.client = client;
      return { connected: true };
    } catch (error) {
      await client.forceStop().catch(() => undefined);
      return {
        connected: false,
        message: error instanceof Error ? error.message : "Could not connect to GitHub Copilot."
      };
    }
  }

  async refresh(signal: AbortSignal): Promise<ProviderSnapshot> {
    if (!this.client) throw new Error("GitHub Copilot is disconnected");
    if (signal.aborted) throw new Error("Refresh cancelled");
    const result = await this.client.rpc.account.getQuota({});
    return normalizeCopilot(result.quotaSnapshots);
  }

  async disconnect(): Promise<void> {
    const client = this.client;
    this.client = undefined;
    if (client) {
      let timer: NodeJS.Timeout | undefined;
      try {
        await Promise.race([
          client.stop(),
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => reject(new Error("Copilot stop timed out")), 5_000);
          })
        ]);
      } catch {
        await client.forceStop().catch(() => undefined);
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
  }

  dispose(): void {
    void this.disconnect();
  }
}

interface CopilotQuota {
  isUnlimitedEntitlement: boolean;
  remainingPercentage: number;
  resetDate?: string;
}

export function normalizeCopilot(quotaSnapshots: Record<string, CopilotQuota | undefined>): ProviderSnapshot {
    const quotaWindows: QuotaWindow[] = [];
    for (const [id, quota] of Object.entries(quotaSnapshots)) {
      if (!quota || quota.isUnlimitedEntitlement) continue;
      const usedPercent = 100 - quota.remainingPercentage;
      if (!Number.isFinite(usedPercent)) continue;
      quotaWindows.push({
        id,
        label: humanize(id).slice(0, 80),
        usedPercent,
        ...(quota.resetDate && !Number.isNaN(Date.parse(quota.resetDate)) ? { resetsAt: quota.resetDate } : {})
      });
    }
    return {
      providerId: "copilot",
      state: quotaWindows.length ? "ready" : "unavailable",
      observedAt: new Date().toISOString(),
      source: { label: "GitHub Copilot SDK", accuracy: "provider-reported" },
      quotaWindows,
      ...(quotaWindows.length ? {} : { message: "No bounded Copilot quota was reported; session tokens are unavailable." })
    };
}

function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
