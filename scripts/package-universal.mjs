import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const sdkVersion = "1.0.13";
const targets = ["win32-x64", "linux-x64", "darwin-x64"];
const output = join(root, "ai-token-checker-universal-x64.vsix");
const temporaryRoot = await mkdtemp(join(tmpdir(), "ai-token-checker-universal-"));
const stage = join(temporaryRoot, "stage");
const downloads = join(temporaryRoot, "downloads");
const vsce = join(root, "node_modules", "@vscode", "vsce", "vsce");

try {
  await rm(output, { force: true });
  await mkdir(stage, { recursive: true });
  await mkdir(downloads, { recursive: true });

  const packagedFiles = run(process.execPath, [vsce, "ls", "--no-dependencies"], root)
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean);
  for (const relativePath of packagedFiles) {
    const source = join(root, relativePath);
    const destination = join(stage, relativePath);
    await mkdir(dirname(destination), { recursive: true });
    const sourceStat = await stat(source);
    await copyFile(source, destination);
    await chmod(destination, sourceStat.mode);
  }
  await copyFile(join(root, ".vscodeignore"), join(stage, ".vscodeignore"));

  const stagedManifestPath = join(stage, "package.json");
  const stagedManifest = JSON.parse(await readFile(stagedManifestPath, "utf8"));
  delete stagedManifest.scripts?.["vscode:prepublish"];
  await writeFile(stagedManifestPath, `${JSON.stringify(stagedManifest, null, 2)}\n`, "utf8");

  for (const target of targets) {
    const packResult = JSON.parse(run(npmCommand(), [
      "pack",
      `@github/copilot-sdk-${target}@${sdkVersion}`,
      "--pack-destination",
      downloads,
      "--json"
    ], root));
    const archiveName = packResult[0]?.filename;
    if (typeof archiveName !== "string") throw new Error(`npm pack did not return an archive for ${target}`);

    const destination = join(stage, "resources", "copilot-runtimes", target);
    await mkdir(destination, { recursive: true });
    run("tar", ["-xzf", join(downloads, basename(archiveName)), "-C", destination, "--strip-components=1"], root);
  }

  run(process.execPath, [vsce, "package", "--no-dependencies", "--out", output], stage, true);
  run(process.execPath, [join(root, "scripts", "verify-vsix-size.mjs"), output, "universal-x64"], root, true);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function run(command, args, cwd, inherit = false) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 20 * 1024 * 1024,
    ...(inherit ? { stdio: "inherit" } : {})
  });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${(result.stderr || result.error?.message || `exit ${result.status}`).trim()}`);
  }
  return result.stdout ?? "";
}
