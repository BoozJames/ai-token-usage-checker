import * as vscode from "vscode";
import type { ControllerState, ProviderController } from "./controller";
import { selectGauge } from "./model";

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
    const message = state.snapshot.message ? `\n${state.snapshot.message}` : "";
    this.item.tooltip = `${provider}: ${gauge.label}\n${state.snapshot.state} · ${state.snapshot.source.label}${message}`;
  }
}
