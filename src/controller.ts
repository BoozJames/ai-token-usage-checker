import * as vscode from "vscode";
import type { ProviderAdapter, ProviderId, ProviderSnapshot } from "./model";
import { sanitizeError } from "./sanitize";

const SELECTED_KEY = "selectedProvider";
const CONSENT_PREFIX = "providerConsent.";

export interface ControllerState {
  selectedProvider: ProviderId;
  connected: boolean;
  snapshot: ProviderSnapshot;
}

export class ProviderController implements vscode.Disposable {
  private selectedProvider: ProviderId;
  private connected = false;
  private visible = false;
  private statusBarActive = false;
  private activeRefresh: AbortController | undefined;
  private lastSuccessful = new Map<ProviderId, ProviderSnapshot>();
  private currentSnapshot: ProviderSnapshot;
  private timer: NodeJS.Timeout | undefined;
  private readonly changeEmitter = new vscode.EventEmitter<ControllerState>();
  readonly onDidChange = this.changeEmitter.event;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly adapters: Map<ProviderId, ProviderAdapter>
  ) {
    this.selectedProvider = validProvider(context.globalState.get(SELECTED_KEY)) ?? "claude";
    this.currentSnapshot = placeholder(this.selectedProvider, false);
  }

  get state(): ControllerState {
    return { selectedProvider: this.selectedProvider, connected: this.connected, snapshot: this.currentSnapshot };
  }

  async setVisible(visible: boolean): Promise<void> {
    this.visible = visible;
    if (!this.isActive()) {
      this.stopTimer();
      await this.disconnectAdapters();
      return;
    }
    if (this.hasConsent(this.selectedProvider)) await this.connect(false);
    else this.emit();
  }

  async setStatusBarActive(active: boolean): Promise<void> {
    this.statusBarActive = active;
    if (!this.isActive()) {
      this.stopTimer();
      await this.disconnectAdapters();
      return;
    }
    if (this.hasConsent(this.selectedProvider)) await this.connect(false);
    else this.emit();
  }

  async select(provider: ProviderId): Promise<void> {
    if (provider === this.selectedProvider) return;
    this.activeRefresh?.abort();
    await this.adapters.get(this.selectedProvider)?.disconnect();
    this.connected = false;
    this.selectedProvider = provider;
    this.currentSnapshot = this.lastSuccessful.get(provider) ?? placeholder(provider, false);
    await this.context.globalState.update(SELECTED_KEY, provider);
    this.emit();
    if (this.isActive() && this.hasConsent(provider)) await this.connect(false);
  }

  async connect(prompt = true): Promise<void> {
    const provider = this.selectedProvider;
    if (!this.hasConsent(provider)) {
      if (!prompt) return;
      const answer = await vscode.window.showWarningMessage(consentMessage(provider), { modal: true }, "Allow");
      if (answer !== "Allow") return;
      await this.context.globalState.update(`${CONSENT_PREFIX}${provider}`, true);
    }

    const adapter = this.adapters.get(provider);
    if (!adapter) return;
    this.setSnapshot({ ...placeholder(provider, true), state: "loading", message: "Connecting…" });
    const availability = await adapter.detect();
    if (!availability.available) {
      this.connected = false;
      this.setSnapshot({
        ...placeholder(provider, false),
        state: "unavailable",
        ...(availability.reason ? { message: availability.reason } : {})
      });
      return;
    }
    const result = await adapter.connect();
    if (!this.isActive() || provider !== this.selectedProvider) {
      await adapter.disconnect();
      return;
    }
    this.connected = result.connected;
    if (!result.connected) {
      this.setSnapshot({ ...placeholder(provider, false), state: "error", message: sanitizeError(result.message ?? "Connection failed") });
      return;
    }
    this.startTimer();
    await this.refresh();
  }

  async disconnect(revokeConsent = true): Promise<void> {
    this.activeRefresh?.abort();
    await this.adapters.get(this.selectedProvider)?.disconnect();
    this.connected = false;
    this.stopTimer();
    if (revokeConsent) await this.context.globalState.update(`${CONSENT_PREFIX}${this.selectedProvider}`, undefined);
    this.currentSnapshot = placeholder(this.selectedProvider, false);
    this.emit();
  }

  async refresh(): Promise<void> {
    if (!this.isActive() || !this.connected) return;
    const provider = this.selectedProvider;
    const adapter = this.adapters.get(provider);
    if (!adapter) return;
    this.activeRefresh?.abort();
    const abort = new AbortController();
    this.activeRefresh = abort;
    try {
      const snapshot = await adapter.refresh(abort.signal);
      if (abort.signal.aborted || provider !== this.selectedProvider) return;
      this.setSnapshot(snapshot);
    } catch (error) {
      if (abort.signal.aborted) return;
      const previous = this.lastSuccessful.get(provider);
      this.setSnapshot(previous
        ? { ...previous, state: "stale", message: sanitizeError(error) }
        : { ...placeholder(provider, true), state: "error", message: sanitizeError(error) });
    }
  }

  dispose(): void {
    this.stopTimer();
    this.activeRefresh?.abort();
    for (const adapter of this.adapters.values()) adapter.dispose();
    this.changeEmitter.dispose();
  }

  private hasConsent(provider: ProviderId): boolean {
    return this.context.globalState.get<boolean>(`${CONSENT_PREFIX}${provider}`) === true;
  }
  private isActive(): boolean {
    return this.visible || this.statusBarActive;
  }
  private startTimer(): void {
    this.stopTimer();
    const seconds = Math.max(60, vscode.workspace.getConfiguration("aiTokenChecker").get<number>("refreshIntervalSeconds", 60));
    this.timer = setInterval(() => void this.refresh(), seconds * 1000);
  }
  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }
  private async disconnectAdapters(): Promise<void> {
    this.activeRefresh?.abort();
    await Promise.all([...this.adapters.values()].map((adapter) => adapter.disconnect()));
    this.connected = false;
    this.emit();
  }
  private setSnapshot(snapshot: ProviderSnapshot): void {
    this.currentSnapshot = snapshot;
    if (snapshot.state === "ready") this.lastSuccessful.set(snapshot.providerId, snapshot);
    this.emit();
  }
  private emit(): void { this.changeEmitter.fire(this.state); }
}

function placeholder(providerId: ProviderId, connected: boolean): ProviderSnapshot {
  return {
    providerId,
    state: connected ? "loading" : "unavailable",
    observedAt: new Date().toISOString(),
    source: { label: "No data", accuracy: "provider-reported" },
    quotaWindows: [],
    message: connected ? "Loading…" : "Select Connect to enable this provider."
  };
}
function validProvider(value: unknown): ProviderId | undefined {
  return value === "claude" || value === "codex" || value === "copilot" ? value : undefined;
}
function consentMessage(provider: ProviderId): string {
  if (provider === "claude") return "Allow AI Token Checker to read the allowlisted local snapshot created by its Claude status-line bridge?";
  if (provider === "codex") return "Allow AI Token Checker to start the local Codex app-server and request account quota and token summaries? Codex may contact OpenAI using its own login.";
  return "Allow AI Token Checker to request a GitHub sign-in, start the official Copilot SDK runtime, and request account quota? The token stays in memory and is never logged or stored by this extension.";
}
