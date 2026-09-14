import { randomBytes } from "node:crypto";
import * as vscode from "vscode";
import { activeQuotaWindows, selectGauge } from "./model";
import type { ControllerState, ProviderController } from "./controller";

const PROVIDER_NAMES = {
  claude: "Claude Code",
  codex: "Codex",
  copilot: "GitHub Copilot"
} as const;

export class UsageDetailsPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private panelSubscriptions: vscode.Disposable[] = [];
  private readonly subscription: vscode.Disposable;

  constructor(private readonly context: vscode.ExtensionContext, private readonly controller: ProviderController) {
    this.subscription = controller.onDidChange((state) => this.update(state));
  }

  show(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Active);
      this.update(this.controller.state);
      void this.controller.setVisible(this.panel.visible);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "aiTokenChecker.usageDetails",
      this.title(this.controller.state),
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: false,
        localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, "media")]
      }
    );
    panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, "media", "icon.png");
    panel.webview.html = this.html(panel.webview);
    this.panel = panel;
    this.panelSubscriptions = [
      panel.onDidChangeViewState((event) => void this.controller.setVisible(event.webviewPanel.visible)),
      panel.onDidDispose(() => {
        this.panel = undefined;
        this.disposePanelSubscriptions();
        void this.controller.setVisible(false);
      })
    ];
    void this.controller.setVisible(panel.visible);
    this.update(this.controller.state);
  }

  dispose(): void {
    this.subscription.dispose();
    this.panel?.dispose();
    this.panel = undefined;
    this.disposePanelSubscriptions();
  }

  private update(state: ControllerState): void {
    if (!this.panel) return;
    this.panel.title = this.title(state);
    const snapshot = state.snapshot;
    const gauge = selectGauge(snapshot);
    const quotaDetails = activeQuotaWindows(snapshot).map((window) => ({
      label: window.label,
      usedPercent: window.usedPercent,
      remainingPercent: 100 - window.usedPercent,
      resetsAt: window.resetsAt
    }));
    void this.panel.webview.postMessage({
      type: "state", selectedProvider: state.selectedProvider, connected: state.connected,
      snapshot, gauge, quotaDetails, resetAt: gauge.determinate ? gauge.resetsAt : undefined
    });
  }

  private title(state: ControllerState): string {
    return `AI Token Checker - ${PROVIDER_NAMES[state.selectedProvider]}`;
  }

  private disposePanelSubscriptions(): void {
    for (const subscription of this.panelSubscriptions) subscription.dispose();
    this.panelSubscriptions = [];
  }

  private html(webview: vscode.Webview): string {
    const nonce = randomBytes(16).toString("base64");
    const script = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "media", "main.js"));
    const styles = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "media", "styles.css"));
    return `<!doctype html><html lang="en"><head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${styles}"><title>AI Token Checker</title></head><body>
<main class="gauge-card">
<section class="usage-pill" aria-live="polite">
<h1 class="provider-name" id="provider-name"></h1>
<div class="summary"><strong id="value">—</strong><span id="label">Usage unavailable</span></div>
<p id="reset" class="reset"></p>
<div class="meter" id="meter" role="progressbar" aria-label="Usage" aria-valuemin="0" aria-valuemax="100"><div class="meter-fill" id="meter-fill"></div></div>
</section>
<section class="details" aria-labelledby="details-heading"><h2 id="details-heading">Usage details</h2><ul id="quota-details" class="quota-details"></ul><p id="tokens" class="tokens"></p></section>
<p id="source" class="muted"></p><p id="message" class="message"></p>
</main><script nonce="${nonce}" src="${script}"></script></body></html>`;
  }
}
