import * as vscode from "vscode";
import { existsSync, readdirSync, statSync } from "node:fs";
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
  adapters.set("codex", new CodexAdapter(resolveCodexExecutable));
  adapters.set("copilot", new CopilotAdapter(async () => {
    const session = await vscode.authentication.getSession("github", ["read:user"], { createIfNone: true });
    return session.accessToken;
  }));
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

function resolveCodexExecutable(): string {
  const configured = vscode.workspace.getConfiguration("aiTokenChecker.codex").get<string>("executable", "codex").trim();
  if (configured !== "codex") return configured;

  const openAiExtension = vscode.extensions.getExtension("openai.chatgpt");
  const binDirectory = openAiExtension ? join(openAiExtension.extensionPath, "bin") : undefined;
  if (!binDirectory || !existsSync(binDirectory)) return configured;

  const executableName = process.platform === "win32" ? "codex.exe" : "codex";
  for (const entry of readdirSync(binDirectory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = join(binDirectory, entry.name, executableName);
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      // A concurrently updated OpenAI extension may replace its bin directory.
    }
  }
  return configured;
}
