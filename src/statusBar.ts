import * as vscode from "vscode";
import type { ControllerState, ProviderController } from "./controller";
import { activeQuotaWindows, selectGauge } from "./model";

const PROVIDER_NAMES = {
  claude: "Claude",
  codex: "Codex",
  copilot: "Copilot"
} as const;

export class UsageStatusBar implements vscode.Disposable {
  private readonly item = vscode.window.createStatusBarItem(
    "aiTokenChecker.status",
    vscode.StatusBarAlignment.Right,
    -10_000
  );
  private readonly subscriptions: vscode.Disposable[];

  constructor(private readonly controller: ProviderController) {
    this.item.name = "AI Token Checker Usage";
    this.item.command = "aiTokenChecker.pickProvider";
    this.subscriptions = [
      controller.onDidChange((state) => this.render(state)),
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("aiTokenChecker.statusBar.enabled")) void this.syncEnabled();
      })
    ];
    this.render(controller.state);
    void this.syncEnabled();
  }

  dispose(): void {
    for (const subscription of this.subscriptions) subscription.dispose();
    this.item.dispose();
    void this.controller.setStatusBarActive(false);
  }

  private async syncEnabled(): Promise<void> {
    const enabled = vscode.workspace.getConfiguration("aiTokenChecker.statusBar").get<boolean>("enabled", true);
    if (enabled) this.item.show();
    else this.item.hide();
    await this.controller.setStatusBarActive(enabled);
  }

  private render(state: ControllerState): void {
    const provider = PROVIDER_NAMES[state.selectedProvider];
    const gauge = selectGauge(state.snapshot);
    if (gauge.determinate) {
      const used = Math.round(Math.max(0, Math.min(100, gauge.value)));
      const remaining = 100 - used;
      this.item.text = `$(dashboard) ${provider} ${remaining}% left`;
      this.item.accessibilityInformation = {
        label: `${provider}, ${used} percent used, ${remaining} percent remaining. Open AI Token Checker.`
      };
    } else {
      this.item.text = `$(dashboard) ${provider} —`;
      this.item.accessibilityInformation = { label: `${provider} usage unavailable. Open AI Token Checker.` };
    }
    this.item.tooltip = usageTooltip(provider, state);
  }
}

function usageTooltip(provider: string, state: ControllerState): vscode.MarkdownString {
  const tooltip = new vscode.MarkdownString();
  const gauge = selectGauge(state.snapshot);
  tooltip.appendMarkdown("### ");
  tooltip.appendText(`${provider} usage`);
  tooltip.appendMarkdown("\n\n");

  if (gauge.determinate) {
    const used = Math.round(Math.max(0, Math.min(100, gauge.value)));
    tooltip.appendMarkdown("**");
    tooltip.appendText(`${used}% used | ${100 - used}% remaining`);
    tooltip.appendMarkdown("**\n\n");
    tooltip.appendText(gauge.label);
    if (gauge.resetsAt) tooltip.appendText(` | resets ${formatDate(gauge.resetsAt)}`);
    tooltip.appendMarkdown("\n\n");
  } else {
    tooltip.appendText(gauge.label);
    tooltip.appendMarkdown("\n\n");
  }

  const windows = activeQuotaWindows(state.snapshot);
  if (windows.length > 0) {
    tooltip.appendMarkdown("**Quota windows**\n\n");
    for (const window of windows) {
      const used = Math.round(window.usedPercent);
      tooltip.appendMarkdown("- ");
      tooltip.appendText(`${window.label}: ${used}% used | ${100 - used}% remaining`);
      if (window.resetsAt) tooltip.appendText(` | resets ${formatDate(window.resetsAt)}`);
      tooltip.appendMarkdown("\n");
    }
    tooltip.appendMarkdown("\n");
  }

  if (state.snapshot.tokenUsage) {
    const usage = state.snapshot.tokenUsage;
    tooltip.appendMarkdown("**Tokens:** ");
    tooltip.appendText(`${capitalize(usage.scope)} ${new Intl.NumberFormat().format(usage.total)}`);
    if (usage.limit) tooltip.appendText(` / ${new Intl.NumberFormat().format(usage.limit)}`);
    tooltip.appendMarkdown("\n\n");
  }

  tooltip.appendText(`${capitalize(state.snapshot.state)} | ${state.snapshot.source.label} | ${relativeTime(state.snapshot.observedAt)}`);
  if (state.snapshot.message) {
    tooltip.appendMarkdown("\n\n");
    tooltip.appendText(state.snapshot.message);
  }
  tooltip.appendMarkdown("\n\n_Click for providers and actions._");
  return tooltip;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "unknown";
}

function relativeTime(observedAt: string): string {
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - Date.parse(observedAt)) / 1000));
  if (!Number.isFinite(elapsedSeconds)) return "update time unavailable";
  if (elapsedSeconds < 5) return "updated just now";
  if (elapsedSeconds < 60) return `updated ${elapsedSeconds}s ago`;
  return `updated ${Math.floor(elapsedSeconds / 60)}m ago`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
