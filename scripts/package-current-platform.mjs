import { spawnSync } from "node:child_process";
import { join } from "node:path";

const supportedTargets = new Map([
  ["win32-x64", "win32-x64"],
  ["linux-x64", "linux-x64"],
  ["darwin-x64", "darwin-x64"]
]);
const platformKey = `${process.platform}-${process.arch}`;
const target = supportedTargets.get(platformKey);
if (!target) {
  throw new Error(`Local packaging is not configured for ${platformKey}; supported targets are ${[...supportedTargets.keys()].join(", ")}`);
}

const output = `ai-token-checker-${target}.vsix`;
const vsce = join(process.cwd(), "node_modules", "@vscode", "vsce", "vsce");
run(process.execPath, [vsce, "package", "--target", target, "--out", output]);
run(process.execPath, [join(process.cwd(), "scripts", "verify-vsix-size.mjs"), output, target]);

console.log(`Manual Marketplace package ready: ${output}`);

function run(command, args) {
  const result = spawnSync(command, args, { cwd: process.cwd(), stdio: "inherit", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
