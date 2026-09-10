import * as vscode from "vscode";
import { existsSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { claudeSnapshotPath, removeClaudeBridge, setupClaudeBridge } from "./claudeSetup";
import { ProviderController } from "./controller";
import type { ProviderAdapter, ProviderId } from "./model";
import { ClaudeAdapter } from "./providers/claude";
import { CodexAdapter } from "./providers/codex";
import { CopilotAdapter } from "./providers/copilot";
import { sanitizeError } from "./sanitize";
import { UsageStatusBar } from "./statusBar";
import { GaugeViewProvider } from "./webview";

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("AI Token Checker");
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
  }, (message) => output.appendLine(message)));
  const controller = new ProviderController(context, adapters);
  const viewProvider = new GaugeViewProvider(context, controller);
  const statusBar = new UsageStatusBar(controller);

  context.subscriptions.push(
    controller, viewProvider, statusBar, output,
    vscode.window.registerWebviewViewProvider("aiTokenChecker.gauge", viewProvider, { webviewOptions: { retainContextWhenHidden: false } }),
    vscode.commands.registerCommand("aiTokenChecker.refresh", () => controller.refresh()),
    vscode.commands.registerCommand("aiTokenChecker.connect", () => controller.connect()),
    vscode.commands.registerCommand("aiTokenChecker.disconnect", () => controller.disconnect()),
    vscode.commands.registerCommand("aiTokenChecker.pickProvider", () => showProviderPicker(controller)),
    vscode.commands.registerCommand("aiTokenChecker.showGauge", async () => {
      await vscode.commands.executeCommand("workbench.view.extension.aiTokenChecker");
      await vscode.commands.executeCommand("aiTokenChecker.gauge.focus");
    }),
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

type ProviderPickerItem = vscode.QuickPickItem & {
  provider?: ProviderId;
  action?: "refresh" | "details";
};

async function showProviderPicker(controller: ProviderController): Promise<void> {
  const selected = controller.state.selectedProvider;
  const items: ProviderPickerItem[] = [
    {
      label: "Claude Code",
      iconPath: providerIcon("Anthropic.claude-code", new vscode.ThemeIcon("sparkle")),
      description: selected === "claude" ? "Selected" : "",
      provider: "claude"
    },
    {
      label: "Codex",
      iconPath: providerIcon("openai.chatgpt", new vscode.ThemeIcon("code")),
      description: selected === "codex" ? "Selected" : "",
      provider: "codex"
    },
    {
      label: "GitHub Copilot",
      iconPath: providerIcon("GitHub.copilot-chat", new vscode.ThemeIcon("github")),
      description: selected === "copilot" ? "Selected" : "",
      provider: "copilot"
    },
    { label: "Actions", kind: vscode.QuickPickItemKind.Separator },
    { label: "$(refresh) Refresh selected provider", action: "refresh" },
    { label: "$(open-preview) Open detailed gauge", action: "details" }
  ];
  const choice = await vscode.window.showQuickPick(items, {
    title: "AI Token Checker",
    placeHolder: "Choose a provider or action",
    matchOnDescription: true
  });
  if (!choice || choice.kind === vscode.QuickPickItemKind.Separator) return;
  if (choice.provider) {
    await controller.select(choice.provider);
    if (!controller.state.connected) await controller.connect();
    return;
  }
  if (choice.action === "refresh") await controller.refresh();
  else if (choice.action === "details") await vscode.commands.executeCommand("aiTokenChecker.showGauge");
}

function providerIcon(extensionId: string, fallback: vscode.ThemeIcon): vscode.Uri | vscode.ThemeIcon {
  const providerExtension = vscode.extensions.getExtension(extensionId);
  const packageJson: unknown = providerExtension?.packageJSON;
  if (!providerExtension || !packageJson || typeof packageJson !== "object" || Array.isArray(packageJson)) return fallback;
  const icon = (packageJson as Record<string, unknown>).icon;
  if (typeof icon !== "string" || !icon.trim()) return fallback;

  const candidate = resolve(providerExtension.extensionPath, icon);
  const childPath = relative(providerExtension.extensionPath, candidate);
  if (!childPath || childPath.startsWith("..") || isAbsolute(childPath)) return fallback;
  try {
    return statSync(candidate).isFile() ? vscode.Uri.file(candidate) : fallback;
  } catch {
    return fallback;
  }
}

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
