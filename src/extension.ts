import * as vscode from "vscode";
import { join } from "node:path";
import { claudeSnapshotPath, removeClaudeBridge, setupClaudeBridge } from "./claudeSetup";
import { ProviderController } from "./controller";
import type { ProviderAdapter, ProviderId } from "./model";
import { ClaudeAdapter } from "./providers/claude";
import { CodexAdapter } from "./providers/codex";
import { CopilotAdapter } from "./providers/copilot";
import { sanitizeError } from "./sanitize";
import { GaugeViewProvider } from "./webview";

export function activate(context: vscode.ExtensionContext): void {
  const adapters = new Map<ProviderId, ProviderAdapter>();
  adapters.set("claude", new ClaudeAdapter({
    snapshotPath: claudeSnapshotPath(context),
    bridgePath: join(context.globalStorageUri.fsPath, "claude-bridge.cjs"),
    onChanged: () => void controller.refresh()
  }));
  adapters.set("codex", new CodexAdapter(() => vscode.workspace.getConfiguration("aiTokenChecker.codex").get<string>("executable", "codex")));
  adapters.set("copilot", new CopilotAdapter());
  const controller = new ProviderController(context, adapters);
  const viewProvider = new GaugeViewProvider(context, controller);

  context.subscriptions.push(
    controller, viewProvider,
    vscode.window.registerWebviewViewProvider("aiTokenChecker.gauge", viewProvider, { webviewOptions: { retainContextWhenHidden: false } }),
    vscode.commands.registerCommand("aiTokenChecker.refresh", () => controller.refresh()),
    vscode.commands.registerCommand("aiTokenChecker.connect", () => controller.connect()),
    vscode.commands.registerCommand("aiTokenChecker.disconnect", () => controller.disconnect()),
    vscode.commands.registerCommand("aiTokenChecker.setupClaude", async () => {
      try { if (await setupClaudeBridge(context)) await controller.connect(); }
      catch (error) { void vscode.window.showErrorMessage(`Claude bridge setup failed: ${sanitizeError(error)}`); }
    }),
    vscode.commands.registerCommand("aiTokenChecker.removeClaudeBridge", async () => {
      try { await removeClaudeBridge(context); }
      catch (error) { void vscode.window.showErrorMessage(`Claude bridge removal failed: ${sanitizeError(error)}`); }
    })
  );
}

export function deactivate(): void {}
