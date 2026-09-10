import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { copyFile, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import * as vscode from "vscode";

const COMMAND_STATE_KEY = "claude.bridgeCommand";

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
  if (settings.statusLine !== undefined) {
    void vscode.window.showWarningMessage(
      "Claude Code already has a status-line command. AI Token Checker will not overwrite it. See the README for manual composition guidance."
    );
    return false;
  }

  const choice = await vscode.window.showWarningMessage(
    "Install a local Claude Code status-line bridge? It writes only quota, reset, and context-token metrics to VS Code global storage. It never writes prompts or credentials.",
    { modal: true },
    "Install"
  );
  if (choice !== "Install") return false;

  await mkdir(context.globalStorageUri.fsPath, { recursive: true });
  const bridgePath = join(context.globalStorageUri.fsPath, "claude-bridge.cjs");
  await copyFile(join(context.extensionPath, "resources", "claude-bridge.cjs"), bridgePath);
  const snapshotPath = claudeSnapshotPath(context);
  if (bridgePath.includes('"') || snapshotPath.includes('"')) throw new Error("Claude bridge paths cannot contain quotation marks");
  const command = `node "${bridgePath}" "${snapshotPath}"`;
  await atomicWrite(settingsPath, `${JSON.stringify({ ...settings, statusLine: { type: "command", command } }, null, 2)}\n`);
  await context.globalState.update(COMMAND_STATE_KEY, command);
  void vscode.window.showInformationMessage("Claude Code bridge installed. It will report metrics after Claude’s next response.");
  return true;
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
    void vscode.window.showWarningMessage("Claude’s status-line setting changed after setup, so it was left untouched.");
    return false;
  }
  const choice = await vscode.window.showWarningMessage("Remove the AI Token Checker Claude bridge?", { modal: true }, "Remove");
  if (choice !== "Remove") return false;
  const remaining = { ...settings };
  delete remaining.statusLine;
  await atomicWrite(settingsPath, `${JSON.stringify(remaining, null, 2)}\n`);
  await Promise.all([
    unlink(join(context.globalStorageUri.fsPath, "claude-bridge.cjs")).catch(() => undefined),
    unlink(claudeSnapshotPath(context)).catch(() => undefined)
  ]);
  await context.globalState.update(COMMAND_STATE_KEY, undefined);
  void vscode.window.showInformationMessage("Claude Code bridge removed.");
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
