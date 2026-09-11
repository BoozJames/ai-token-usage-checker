import { randomBytes } from "node:crypto";
import * as vscode from "vscode";
import { activeQuotaWindows, selectGauge } from "./model";
import type { ControllerState, ProviderController } from "./controller";

export class GaugeViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private view: vscode.WebviewView | undefined;
  private readonly subscription: vscode.Disposable;

  constructor(private readonly context: vscode.ExtensionContext, private readonly controller: ProviderController) {
    this.subscription = controller.onDidChange((state) => this.postState(state));
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, "media")]
    };
    view.webview.html = this.html(view.webview);
    view.onDidChangeVisibility(() => void this.controller.setVisible(view.visible));
    void this.controller.setVisible(view.visible);
    this.postState(this.controller.state);
  }

  dispose(): void { this.subscription.dispose(); }

  private postState(state: ControllerState): void {
    const snapshot = state.snapshot;
    const gauge = selectGauge(snapshot);
    const quotaDetails = activeQuotaWindows(snapshot).map((window) => ({
      label: window.label,
      usedPercent: window.usedPercent,
      remainingPercent: 100 - window.usedPercent,
      resetsAt: window.resetsAt
    }));
    void this.view?.webview.postMessage({
      type: "state", selectedProvider: state.selectedProvider, connected: state.connected,
      snapshot, gauge, quotaDetails, resetAt: gauge.determinate ? gauge.resetsAt : undefined
    });
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
<div class="provider-name" id="provider-name"></div>
<div class="summary"><strong id="value">—</strong><span id="label">Usage unavailable</span></div>
<p id="reset" class="reset"></p>
<div class="meter" id="meter" role="progressbar" aria-label="Usage" aria-valuemin="0" aria-valuemax="100"><div class="meter-fill" id="meter-fill"></div></div>
</section>
<section class="details" aria-labelledby="details-heading"><h2 id="details-heading">Usage details</h2><ul id="quota-details" class="quota-details"></ul><p id="tokens" class="tokens"></p></section>
<p id="source" class="muted"></p><p id="message" class="message"></p>
</main><script nonce="${nonce}" src="${script}"></script></body></html>`;
  }
}
