import { randomBytes } from "node:crypto";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import * as vscode from "vscode";
import {
  buildTelemetryEnvironment,
  DEFAULT_TELEMETRY_PORT,
  hasForeignTelemetryEntries,
  mergeEnvironmentEntries,
  normalizeTelemetryPort,
  stripEnvironmentEntries,
  type EnvironmentEntry
} from "./claudeTelemetryEnv";

const CLAUDE_EXTENSION_ID = "Anthropic.claude-code";
const ENABLED_KEY = "claude.telemetryEnabled";
const VARS_KEY = "claude.telemetryEnvVars";
const TOKEN_KEY = "claude.telemetryAuthToken";

export function claudeTelemetrySnapshotPath(context: vscode.ExtensionContext): string {
  return join(context.globalStorageUri.fsPath, "claude-otel-metrics.json");
}

export function telemetryEnabled(context: vscode.ExtensionContext): boolean {
  return context.globalState.get<boolean>(ENABLED_KEY) === true;
}

export function telemetryAuthToken(context: vscode.ExtensionContext): string | undefined {
  return telemetryEnabled(context) ? context.globalState.get<string>(TOKEN_KEY) : undefined;
}

export function configuredTelemetryPort(): number {
  return normalizeTelemetryPort(
    vscode.workspace.getConfiguration("aiTokenChecker.claude").get<number>("telemetryPort", DEFAULT_TELEMETRY_PORT)
  );
}

export async function setupClaudeTelemetry(context: vscode.ExtensionContext): Promise<boolean> {
  if (!vscode.extensions.getExtension(CLAUDE_EXTENSION_ID)) {
    void vscode.window.showWarningMessage("Install the official Claude Code extension before enabling telemetry.");
    return false;
  }

  const config = vscode.workspace.getConfiguration("claudeCode");
  const existing = config.get<unknown>("environmentVariables", []);
  if (!telemetryEnabled(context) && hasForeignTelemetryEntries(existing)) {
    void vscode.window.showWarningMessage(
      "Claude Code already has telemetry-related environment variables configured. Remove them from “Claude Code › Environment Variables” first, then try again."
    );
    return false;
  }

  const port = configuredTelemetryPort();
  const explanation =
    "Enable Claude Code telemetry? This sets Claude Code's “Environment Variables” setting so it exports token-count " +
    `metrics to a local, loopback-only listener this extension runs on port ${port}. It reports token counts only — ` +
    "no rate-limit percentages, prompts, or credentials. Reopen the Claude Code panel afterward.";
  const choice = await vscode.window.showWarningMessage(explanation, { modal: true }, "Enable Telemetry");
  if (choice !== "Enable Telemetry") return false;

  const authToken = context.globalState.get<string>(TOKEN_KEY) ?? randomBytes(16).toString("hex");
  const managed = buildTelemetryEnvironment(port, authToken);
  const merged = mergeEnvironmentEntries(existing, managed);
  await config.update("environmentVariables", merged, vscode.ConfigurationTarget.Global);

  await context.globalState.update(ENABLED_KEY, true);
  await context.globalState.update(VARS_KEY, managed);
  await context.globalState.update(TOKEN_KEY, authToken);
  void vscode.window.showInformationMessage(
    "Claude Code telemetry enabled. Reopen the Claude Code panel and send a message; a session token total appears within about a minute."
  );
  return true;
}

export async function removeClaudeTelemetry(context: vscode.ExtensionContext): Promise<boolean> {
  if (!telemetryEnabled(context)) {
    void vscode.window.showInformationMessage("AI Token Checker did not enable Claude Code telemetry in this profile.");
    return false;
  }

  const config = vscode.workspace.getConfiguration("claudeCode");
  const existing = config.get<unknown>("environmentVariables", []);
  const installed = context.globalState.get<EnvironmentEntry[]>(VARS_KEY) ?? [];
  if (!sameManagedEntries(existing, installed)) {
    void vscode.window.showWarningMessage("Claude Code's environment variables changed after setup, so they were left untouched.");
    return false;
  }

  const choice = await vscode.window.showWarningMessage("Disable Claude Code telemetry?", { modal: true }, "Disable");
  if (choice !== "Disable") return false;

  await config.update("environmentVariables", stripEnvironmentEntries(existing), vscode.ConfigurationTarget.Global);
  await unlink(claudeTelemetrySnapshotPath(context)).catch(() => undefined);
  await context.globalState.update(ENABLED_KEY, undefined);
  await context.globalState.update(VARS_KEY, undefined);
  await context.globalState.update(TOKEN_KEY, undefined);
  void vscode.window.showInformationMessage("Claude Code telemetry disabled and its environment variables removed.");
  return true;
}

function sameManagedEntries(existing: unknown, installed: EnvironmentEntry[]): boolean {
  const managedNames = new Set(installed.map((entry) => entry.name));
  const currentManaged = Array.isArray(existing)
    ? existing.filter((entry): entry is EnvironmentEntry => {
        if (!entry || typeof entry !== "object") return false;
        const name = (entry as Record<string, unknown>).name;
        return typeof name === "string" && managedNames.has(name);
      })
    : [];
  if (currentManaged.length !== installed.length) return false;
  const currentByName = new Map(currentManaged.map((entry) => [entry.name, entry.value]));
  return installed.every((entry) => currentByName.get(entry.name) === entry.value);
}
