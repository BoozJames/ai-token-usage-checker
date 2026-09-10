import { homedir } from "node:os";
import { existsSync, statSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { copyFile, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import * as vscode from "vscode";

const COMMAND_STATE_KEY = "claude.bridgeCommand";
const ORIGINAL_STATUS_LINE_KEY = "claude.originalStatusLine";

export function claudeSettingsPath(): string {
  const configured = process.env.CLAUDE_CONFIG_DIR;
  return join(configured && configured.trim() ? configured : join(homedir(), ".claude"), "settings.json");
}

export function claudeSnapshotPath(context: vscode.ExtensionContext): string {
  return join(context.globalStorageUri.fsPath, "claude-metrics.json");
}

export async function setupClaudeBridge(context: vscode.ExtensionContext): Promise<boolean> {
  const settingsPath = claudeSettingsPath();
  const settings = await readSettings(settingsPath);
  const existingStatusLine = settings.statusLine;
  const statusLineRecord = asRecord(existingStatusLine);
  const existingCommand = typeof statusLineRecord.command === "string" ? statusLineRecord.command : undefined;
  const installedCommand = context.globalState.get<string>(COMMAND_STATE_KEY);
  const bridgePath = join(context.globalStorageUri.fsPath, "claude-bridge.cjs");
  const snapshotPath = claudeSnapshotPath(context);
  const forwardPath = join(context.globalStorageUri.fsPath, "claude-forward.json");
  const nodeExecutable = resolveNodeExecutable();
  if ([nodeExecutable, bridgePath, snapshotPath, forwardPath].some((path) => path.includes('"'))) {
    throw new Error("Claude bridge paths cannot contain quotation marks");
  }

  if (installedCommand && existingCommand === installedCommand) {
    const choice = await vscode.window.showInformationMessage(
      "The Claude Code bridge is installed, but it can be repaired by copying the latest bridge again. Afterward, start or restart a Claude Code terminal session and send a message.",
      "Repair Bridge"
    );
    if (choice === "Repair Bridge") {
      await mkdir(context.globalStorageUri.fsPath, { recursive: true });
      await copyFile(join(context.extensionPath, "resources", "claude-bridge.cjs"), bridgePath);
      const originalStatusLine = asRecord(context.globalState.get<unknown>(ORIGINAL_STATUS_LINE_KEY));
      const hasForwardCommand = typeof originalStatusLine.command === "string";
      const repairedCommand = bridgeCommand(nodeExecutable, bridgePath, snapshotPath, hasForwardCommand ? forwardPath : undefined);
      await atomicWrite(settingsPath, `${JSON.stringify({
        ...settings,
        statusLine: { ...statusLineRecord, type: "command", command: repairedCommand, refreshInterval: 60 }
      }, null, 2)}\n`);
      await context.globalState.update(COMMAND_STATE_KEY, repairedCommand);
      void vscode.window.showInformationMessage("Claude Code bridge repaired. Restart the Claude Code CLI and send a message to produce a fresh snapshot.");
    }
    return true;
  }
  if (existingStatusLine !== undefined && (!existingCommand || statusLineRecord.type !== "command")) {
    void vscode.window.showWarningMessage("Claude Code has an unsupported status-line configuration. It was left unchanged.");
    return false;
  }

  const action = existingCommand ? "Compose" : "Install";
  const explanation = existingCommand
    ? "Claude Code already has a status-line command. Compose it with AI Token Checker? The existing command and its output will be preserved, and removal will restore it."
    : "Install a local Claude Code status-line bridge? It writes only quota, reset, and context-token metrics to VS Code global storage. It never writes prompts or credentials.";
  const choice = await vscode.window.showWarningMessage(explanation, { modal: true }, action);
  if (choice !== action) return false;

  await mkdir(context.globalStorageUri.fsPath, { recursive: true });
  if (existingCommand && /[\r\n\0]/.test(existingCommand)) {
    throw new Error("Existing Claude status-line command is invalid");
  }

  await copyFile(join(context.extensionPath, "resources", "claude-bridge.cjs"), bridgePath);
  if (existingCommand) {
    await atomicWrite(forwardPath, `${JSON.stringify({ schemaVersion: 1, command: existingCommand })}\n`);
  } else {
    await unlink(forwardPath).catch(() => undefined);
  }
  const command = bridgeCommand(nodeExecutable, bridgePath, snapshotPath, existingCommand ? forwardPath : undefined);
  await atomicWrite(settingsPath, `${JSON.stringify({
    ...settings,
    statusLine: { type: "command", command, refreshInterval: 60 }
  }, null, 2)}\n`);
  await context.globalState.update(COMMAND_STATE_KEY, command);
  await context.globalState.update(ORIGINAL_STATUS_LINE_KEY, existingStatusLine);
  void vscode.window.showInformationMessage(`Claude Code bridge ${existingCommand ? "composed" : "installed"}. It will report metrics after Claude's next response.`);
  return true;
}

function bridgeCommand(nodeExecutable: string, bridgePath: string, snapshotPath: string, forwardPath?: string): string {
  return `"${nodeExecutable}" "${bridgePath}" "${snapshotPath}"${forwardPath ? ` "${forwardPath}"` : ""}`;
}

function resolveNodeExecutable(): string {
  const executableName = process.platform === "win32" ? "node.exe" : "node";
  for (const entry of (process.env.PATH ?? "").split(delimiter)) {
    const directory = entry.trim().replace(/^"|"$/g, "");
    if (!directory) continue;
    const candidate = join(directory, executableName);
    try {
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
    } catch {
      // Ignore inaccessible PATH entries and continue looking.
    }
  }
  throw new Error("A system Node.js executable is required for the Claude status-line bridge");
}

export async function removeClaudeBridge(context: vscode.ExtensionContext): Promise<boolean> {
  const installedCommand = context.globalState.get<string>(COMMAND_STATE_KEY);
  if (!installedCommand) {
    void vscode.window.showInformationMessage("AI Token Checker did not install a Claude bridge in this profile.");
    return false;
  }
  const settingsPath = claudeSettingsPath();
  const settings = await readSettings(settingsPath);
  if (asRecord(settings.statusLine).command !== installedCommand) {
    void vscode.window.showWarningMessage("Claude's status-line setting changed after setup, so it was left untouched.");
    return false;
  }
  const choice = await vscode.window.showWarningMessage("Remove the AI Token Checker Claude bridge?", { modal: true }, "Remove");
  if (choice !== "Remove") return false;

  const remaining = { ...settings };
  const originalStatusLine = context.globalState.get<unknown>(ORIGINAL_STATUS_LINE_KEY);
  if (originalStatusLine === undefined) delete remaining.statusLine;
  else remaining.statusLine = originalStatusLine;
  await atomicWrite(settingsPath, `${JSON.stringify(remaining, null, 2)}\n`);
  await Promise.all([
    unlink(join(context.globalStorageUri.fsPath, "claude-bridge.cjs")).catch(() => undefined),
    unlink(join(context.globalStorageUri.fsPath, "claude-forward.json")).catch(() => undefined),
    unlink(claudeSnapshotPath(context)).catch(() => undefined)
  ]);
  await context.globalState.update(COMMAND_STATE_KEY, undefined);
  await context.globalState.update(ORIGINAL_STATUS_LINE_KEY, undefined);
  void vscode.window.showInformationMessage(`Claude Code bridge removed${originalStatusLine === undefined ? "" : " and the previous status line restored"}.`);
  return true;
}

async function readSettings(path: string): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("root must be an object");
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (isMissing(error)) return {};
    throw new Error("Claude settings.json must contain valid JSON before the bridge can be installed", { cause: error });
  }
}

async function atomicWrite(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, contents, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, path);
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
