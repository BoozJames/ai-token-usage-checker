import { stat } from "node:fs/promises";
import { basename } from "node:path";
import { spawnSync } from "node:child_process";

const path = process.argv[2];
if (!path) throw new Error("Pass a VSIX path to verify");

const maximumBytes = 10 * 1024 * 1024;
const { size } = await stat(path);
if (size > maximumBytes) {
  throw new Error(`${basename(path)} is ${(size / 1024 / 1024).toFixed(2)} MB; maximum allowed is 10 MB`);
}

const entries = archiveText(["-tf", path]).split(/\r?\n/).filter(Boolean);
const forbidden = entries.filter((entry) =>
  /(^|\/)(node_modules|src|test|tests|\.github|scripts)(\/|$)|\.map$|(^|\/)\.env|auth\.json/i.test(entry)
);
if (forbidden.length) {
  throw new Error(`Forbidden files found in ${basename(path)}: ${forbidden.join(", ")}`);
}
if (!entries.includes("extension/dist/extension.js")) {
  throw new Error(`${basename(path)} does not contain the compiled extension`);
}

const manifest = archiveText(["-xOf", path, "extension.vsixmanifest"]);
if (/Microsoft\.VisualStudio\.Code\.PreRelease/i.test(manifest)) {
  throw new Error(`${basename(path)} is unexpectedly marked as a pre-release`);
}

const packageJson = JSON.parse(archiveText(["-xOf", path, "extension/package.json"]));
if (Object.hasOwn(packageJson, "preview") || Object.hasOwn(packageJson, "dependencies")) {
  throw new Error(`${basename(path)} contains preview or runtime-dependency metadata`);
}
if (packageJson.contributes?.menus?.["editor/title"] || packageJson.contributes?.menus?.["view/title"]) {
  throw new Error(`${basename(path)} contains a removed title-menu contribution`);
}

console.log(`Verified ${basename(path)}: ${(size / 1024 / 1024).toFixed(2)} MB, ${entries.length} files, stable manifest, compact contents`);

function archiveText(args) {
  const result = spawnSync("tar", args, { encoding: "utf8", windowsHide: true, maxBuffer: 2 * 1024 * 1024 });
  if (result.status !== 0) {
    throw new Error(`Could not inspect VSIX archive: ${(result.stderr || "tar failed").trim()}`);
  }
  return result.stdout;
}
