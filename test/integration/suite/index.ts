import assert from "node:assert/strict";
import { resolve } from "node:path";
import * as vscode from "vscode";

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension("jamesbooz.ai-token-checker");
  assert.ok(extension, "extension should be discoverable");
  await extension.activate();
  const commands = await vscode.commands.getCommands(true);
  assert.ok(commands.includes("aiTokenChecker.refresh"));
  assert.ok(commands.includes("aiTokenChecker.connect"));
  assert.ok(commands.includes("aiTokenChecker.showGauge"));
  assert.ok(commands.includes("aiTokenChecker.pickProvider"));
  assert.ok(commands.includes("aiTokenChecker.setupClaude"));
  console.log(`Integration smoke test passed from ${resolve(__dirname, "../../..")} .`);
}
