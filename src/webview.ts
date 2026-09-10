import { randomBytes } from "node:crypto";
import * as vscode from "vscode";
import type { ProviderId } from "./model";
import { selectGauge } from "./model";
import type { ControllerState, ProviderController } from "./controller";

type InboundMessage =
  | { type: "selectProvider"; provider: ProviderId }
  | { type: "connect" | "disconnect" | "refresh" | "setupClaude" };

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
    view.webview.onDidReceiveMessage((message: unknown) => void this.handleMessage(message));
    view.onDidChangeVisibility(() => void this.controller.setVisible(view.visible));
    void this.controller.setVisible(view.visible);
    this.postState(this.controller.state);
  }

  dispose(): void { this.subscription.dispose(); }

  private async handleMessage(value: unknown): Promise<void> {
    const message = parseMessage(value);
    if (!message) return;
    switch (message.type) {
      case "selectProvider": await this.controller.select(message.provider); break;
      case "connect": await this.controller.connect(); break;
      case "disconnect": await this.controller.disconnect(); break;
      case "refresh": await this.controller.refresh(); break;
      case "setupClaude": await vscode.commands.executeCommand("aiTokenChecker.setupClaude"); break;
    }
  }

  private postState(state: ControllerState): void {
    const snapshot = state.snapshot;
    const gauge = selectGauge(snapshot);
    void this.view?.webview.postMessage({
      type: "state", selectedProvider: state.selectedProvider, connected: state.connected,
      snapshot, gauge, resetAt: gauge.determinate ? gauge.resetsAt : undefined
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
<div class="provider-row"><label class="provider-label" for="provider">Assistant</label>
<select id="provider" aria-label="Selected AI assistant"><option value="claude">Claude Code</option><option value="codex">Codex</option><option value="copilot">GitHub Copilot</option></select></div>
<section class="usage-pill" aria-live="polite">
<div class="summary"><strong id="value">—</strong><span id="label">Usage unavailable</span></div>
<p id="reset" class="reset"></p>
<div class="meter" id="meter" role="progressbar" aria-label="Usage" aria-valuemin="0" aria-valuemax="100"><div class="meter-fill" id="meter-fill"></div></div>
</section>
<p id="tokens" class="tokens"></p><p id="source" class="muted"></p><p id="message" class="message"></p>
<div class="actions"><button id="connect" type="button">Connect</button><button id="refresh" type="button" class="secondary">Refresh</button><button id="setup-claude" type="button" class="secondary">Set up Claude</button></div>
</main><script nonce="${nonce}" src="${script}"></script></body></html>`;
  }
}

function parseMessage(value: unknown): InboundMessage | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (record.type === "selectProvider" && (record.provider === "claude" || record.provider === "codex" || record.provider === "copilot")) {
    return { type: "selectProvider", provider: record.provider };
  }
  if (record.type === "connect" || record.type === "disconnect" || record.type === "refresh" || record.type === "setupClaude") return { type: record.type };
  return undefined;
}
