import { stat } from "node:fs/promises";
import { basename } from "node:path";
import { spawnSync } from "node:child_process";

const path = process.argv[2];
if (!path) throw new Error("Pass a VSIX path to verify");
const expectedTarget = process.argv[3];

const maximumBytes = 150 * 1024 * 1024;
const { size } = await stat(path);
if (size > maximumBytes) {
  throw new Error(`${basename(path)} is ${(size / 1024 / 1024).toFixed(2)} MB; maximum allowed is 150 MB`);
}

const entries = listArchive(path).split(/\r?\n/).filter(Boolean);
const allowedRuntimeDependency = /^extension\/node_modules\/(?:@github\/copilot-sdk(?:\/|-(?:win32|linux|darwin)(?:musl)?-(?:x64|arm64)\/)|@koromix\/koffi-(?:win32|linux|darwin)-(?:x64|arm64)\/|koffi\/|vscode-jsonrpc\/|zod\/)/;
const forbidden = entries.filter((entry) => {
  if (/(^|\/)node_modules(\/|$)/i.test(entry)) return !allowedRuntimeDependency.test(entry);
  return /(^|\/)(src|test|tests|\.github|scripts)(\/|$)|\.map$|(^|\/)\.env|auth\.json/i.test(entry);
});
if (forbidden.length) {
  throw new Error(`Forbidden files found in ${basename(path)}: ${forbidden.join(", ")}`);
}
if (!entries.includes("extension/dist/extension.js")) {
  throw new Error(`${basename(path)} does not contain the compiled extension`);
}

const manifest = readArchive(path, "extension.vsixmanifest");
if (/Microsoft\.VisualStudio\.Code\.PreRelease/i.test(manifest)) {
  throw new Error(`${basename(path)} is unexpectedly marked as a pre-release`);
}
const isUniversal = expectedTarget === "universal-x64";
if (isUniversal && /TargetPlatform=/i.test(manifest)) {
  throw new Error(`${basename(path)} is unexpectedly marked as platform-specific`);
}
if (expectedTarget && !isUniversal && !new RegExp(`TargetPlatform="${escapeRegExp(expectedTarget)}"`, "i").test(manifest)) {
  throw new Error(`${basename(path)} is not marked for target ${expectedTarget}`);
}

const packageJson = JSON.parse(readArchive(path, "extension/package.json"));
const dependencies = packageJson.dependencies ?? {};
if (Object.hasOwn(packageJson, "preview") || dependencies["@github/copilot-sdk"] !== "1.0.13" || Object.keys(dependencies).length !== 1) {
  throw new Error(`${basename(path)} has unexpected preview or runtime-dependency metadata`);
}
if (packageJson.contributes?.menus?.["editor/title"] || packageJson.contributes?.menus?.["view/title"]) {
  throw new Error(`${basename(path)} contains a removed title-menu contribution`);
}
if (packageJson.contributes?.views || packageJson.contributes?.viewsContainers || packageJson.activationEvents?.includes("onView:aiTokenChecker.gauge")) {
  throw new Error(`${basename(path)} contains the removed Activity Bar or sidebar contribution`);
}

const runtimePackage = expectedTarget ? `extension/node_modules/@github/copilot-sdk-${expectedTarget}/` : undefined;
if (runtimePackage && !isUniversal && !entries.some((entry) => entry.startsWith(runtimePackage))) {
  throw new Error(`${basename(path)} does not contain the packaged runtime ${runtimePackage}`);
}

if (isUniversal) {
  for (const target of ["win32-x64", "linux-x64", "darwin-x64"]) {
    const runtimeRoot = `extension/resources/copilot-runtimes/${target}/`;
    if (!entries.some((entry) => entry.startsWith(runtimeRoot))) {
      throw new Error(`${basename(path)} does not contain the bundled ${target} runtime`);
    }
    const runtimeManifest = JSON.parse(readArchive(path, `${runtimeRoot}package.json`));
    if (runtimeManifest.name !== `@github/copilot-sdk-${target}` || runtimeManifest.version !== "1.0.13") {
      throw new Error(`${basename(path)} contains unexpected ${target} runtime metadata`);
    }
  }
  if (entries.some((entry) => entry.startsWith("extension/node_modules/"))) {
    throw new Error(`${basename(path)} unexpectedly contains node_modules in addition to the bundled runtimes`);
  }
}

console.log(`Verified ${basename(path)}: ${(size / 1024 / 1024).toFixed(2)} MB, ${entries.length} files, stable manifest, bundled ${expectedTarget ?? "Copilot"} runtime`);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function listArchive(archivePath) {
  return runArchiveCommand(
    ["tar", ["-tf", archivePath]],
    ["unzip", ["-Z1", archivePath]]
  );
}

function readArchive(archivePath, entry) {
  return runArchiveCommand(
    ["tar", ["-xOf", archivePath, entry]],
    ["unzip", ["-p", archivePath, entry]]
  );
}

function runArchiveCommand(...commands) {
  const errors = [];
  for (const [command, args] of commands) {
    const result = spawnSync(command, args, { encoding: "utf8", windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
    if (result.status === 0) return result.stdout;
    errors.push(`${command}: ${(result.stderr || result.error?.message || "failed").trim()}`);
  }
  throw new Error(`Could not inspect VSIX archive: ${errors.join("; ")}`);
}
