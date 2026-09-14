import assert from "node:assert/strict";
import { resolve } from "node:path";
import * as vscode from "vscode";

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension("jamesbooz.ai-token-checker");
  assert.ok(extension, "extension should be discoverable");
  const manifest = extension.packageJSON as {
    version?: unknown;
    dependencies?: Record<string, unknown>;
    activationEvents?: unknown[];
    contributes?: {
      menus?: Record<string, unknown>;
      views?: Record<string, unknown>;
      viewsContainers?: Record<string, unknown>;
      configuration?: { properties?: Record<string, unknown> };
    };
  };
  assert.equal(manifest.version, "1.0.3");
  assert.equal(manifest.contributes?.menus?.["editor/title"], undefined, "editor-title action should be removed");
  assert.equal(manifest.contributes?.menus?.["view/title"], undefined, "sidebar title actions should be removed");
  assert.equal(manifest.contributes?.views, undefined, "sidebar views should be removed");
  assert.equal(manifest.contributes?.viewsContainers, undefined, "Activity Bar container should be removed");
  assert.ok(!manifest.activationEvents?.includes("onView:aiTokenChecker.gauge"), "removed sidebar should not activate the extension");
  assert.equal(manifest.contributes?.configuration?.properties?.["aiTokenChecker.copilot.executable"], undefined);
  assert.equal(manifest.dependencies?.["@github/copilot-sdk"], "1.0.13");
  await extension.activate();
  const commands = await vscode.commands.getCommands(true);
  assert.ok(commands.includes("aiTokenChecker.refresh"));
  assert.ok(commands.includes("aiTokenChecker.connect"));
  assert.ok(commands.includes("aiTokenChecker.showGauge"));
  assert.ok(commands.includes("aiTokenChecker.pickProvider"));
  assert.ok(commands.includes("aiTokenChecker.setupClaude"));
  await assert.doesNotReject(async () => vscode.commands.executeCommand("aiTokenChecker.showGauge"));
  console.log(`Integration smoke test passed from ${resolve(__dirname, "../../..")} .`);
}
