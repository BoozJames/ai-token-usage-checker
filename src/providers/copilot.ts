import type { ConnectionResult, ProviderAdapter, ProviderAvailability, ProviderSnapshot, QuotaWindow } from "../model";
import { chmodSync, existsSync } from "node:fs";
import { join } from "node:path";

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

  constructor(
    private readonly getGitHubToken: () => Promise<string>,
    private readonly extensionPath: string
  ) {}

  async detect(): Promise<ProviderAvailability> {
    try {
      return resolveCopilotRuntimePath(this.extensionPath)
        ? { available: true }
        : { available: false, reason: "Reinstall the universal VSIX to restore the bundled Copilot runtime." };
    } catch (error) {
      return { available: false, reason: error instanceof Error ? error.message : "This platform is unsupported." };
    }
  }

  async connect(): Promise<ConnectionResult> {
    if (this.client) return { connected: true };
    const { CopilotClient, RuntimeConnection } = await import("@github/copilot-sdk");
    const runtimePath = resolveCopilotRuntimePath(this.extensionPath);
    if (!runtimePath) {
      return { connected: false, message: "The bundled GitHub Copilot runtime is missing. Reinstall the universal VSIX." };
    }
    let gitHubToken: string;
    try {
      gitHubToken = await this.getGitHubToken();
    } catch {
      return { connected: false, message: "GitHub sign-in was cancelled or unavailable." };
    }
    prepareRuntimeExecutables(runtimePath);

    const client: CopilotClientHandle = new CopilotClient({
      gitHubToken,
      useLoggedInUser: false,
      logLevel: "none",
      enableRemoteSessions: false,
      connection: RuntimeConnection.forStdio({ path: runtimePath }),
      clientInfo: { applicationName: "ai-token-checker", applicationVersion: "1.0.3" }
    });
    try {
      await client.start();
      this.client = client;
      return { connected: true };
    } catch (error) {
      await client.forceStop().catch(() => undefined);
      return {
        connected: false,
        message: copilotConnectionMessage(error)
      };
    }
  }

  async refresh(signal: AbortSignal): Promise<ProviderSnapshot> {
    if (!this.client) throw new Error("GitHub Copilot is disconnected");
    if (signal.aborted) throw new Error("Refresh cancelled");
    try {
      const result = await this.client.rpc.account.getQuota({});
      return normalizeCopilot(result.quotaSnapshots);
    } catch (error) {
      if (error instanceof Error && /not authenticated/i.test(error.message)) {
        throw new Error("GitHub authentication expired. Disconnect and connect again to sign in.", { cause: error });
      }
      throw error;
    }
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

function copilotConnectionMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Could not connect to GitHub Copilot.";
  return /ENOENT|not found|cannot find|could not resolve|missing required/i.test(message)
    ? "The packaged GitHub Copilot runtime could not be started. Reinstall the universal VSIX."
    : message;
}

export function bundledCopilotRuntimePath(
  extensionPath: string,
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch
): string {
  if (arch !== "x64" || (platform !== "win32" && platform !== "linux" && platform !== "darwin")) {
    throw new Error(`The bundled GitHub Copilot runtime does not support ${platform}-${arch}.`);
  }
  const target = `${platform}-x64`;
  const executable = platform === "win32" ? "copilot-runtime.exe" : "copilot-runtime";
  return join(extensionPath, "resources", "copilot-runtimes", target, "prebuilds", target, executable);
}

function resolveCopilotRuntimePath(extensionPath: string): string | undefined {
  const bundledPath = bundledCopilotRuntimePath(extensionPath);
  if (existsSync(bundledPath)) return bundledPath;

  const target = `${process.platform}-x64`;
  const developmentPath = join(
    extensionPath,
    "node_modules",
    "@github",
    `copilot-sdk-${target}`,
    "prebuilds",
    target,
    process.platform === "win32" ? "copilot-runtime.exe" : "copilot-runtime"
  );
  return existsSync(developmentPath) ? developmentPath : undefined;
}

function prepareRuntimeExecutables(runtimePath: string): void {
  if (process.platform === "win32") return;
  const target = `${process.platform}-x64`;
  const packageRoot = join(runtimePath, "..", "..", "..");
  const executablePaths = [
    runtimePath,
    join(packageRoot, "ripgrep", "bin", target, "rg"),
    join(packageRoot, "tgrep", "bin", target, "tgrep"),
    ...(process.platform === "darwin" ? [
      join(packageRoot, "plugins", "computer-use", "computer-use-mcp"),
      join(packageRoot, "plugins", "computer-use", "Copilot Computer Use.app", "Contents", "MacOS", "Copilot Computer Use")
    ] : [])
  ];
  for (const executablePath of executablePaths) {
    if (existsSync(executablePath)) chmodSync(executablePath, 0o755);
  }
}

interface CopilotQuota {
  isUnlimitedEntitlement: boolean;
  remainingPercentage: number;
  entitlementRequests?: number;
  usedRequests?: number;
  resetDate?: string;
  hasQuota?: boolean;
}

export function normalizeCopilot(
  quotaSnapshots: Record<string, CopilotQuota | undefined>,
  observedAt = new Date()
): ProviderSnapshot {
    const quotaWindows: QuotaWindow[] = [];
    for (const [id, quota] of Object.entries(quotaSnapshots)) {
      if (!quota || quota.isUnlimitedEntitlement || quota.hasQuota === false) continue;
      const usedPercent = 100 - quota.remainingPercentage;
      if (!Number.isFinite(usedPercent)) continue;
      // The SDK's resetDate is only trustworthy when it is actually in the future;
      // some accounts report it as the moment of the request itself, which is not a real period boundary.
      const resetTime = quota.resetDate ? Date.parse(quota.resetDate) : undefined;
      const resetsAt = resetTime !== undefined && Number.isFinite(resetTime) && resetTime > observedAt.getTime()
        ? new Date(resetTime).toISOString()
        : undefined;
      quotaWindows.push({
        id,
        label: quotaLabel(id),
        usedPercent,
        ...(resetsAt ? { resetsAt } : {}),
        // Inline-suggestion counts churn constantly and are rarely what a user is watching;
        // let chat/premium-request quotas win the primary gauge whenever they're also active.
        ...(id === "completions" ? { deprioritized: true } : {})
      });
    }
    return {
      providerId: "copilot",
      state: quotaWindows.length ? "ready" : "unavailable",
      observedAt: observedAt.toISOString(),
      source: { label: "GitHub Copilot SDK + packaged runtime", accuracy: "provider-reported" },
      quotaWindows,
      ...(quotaWindows.length ? {} : {
        message: "The official Copilot SDK reported no active bounded quota. Its response may not include the newer Copilot Free Credits and Inline Suggestions dashboard metrics."
      })
    };
}

function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function quotaLabel(value: string): string {
  if (value === "completions") return "Inline Suggestions";
  if (value === "premium_interactions") return "Premium Interactions";
  return humanize(value).slice(0, 80);
}
