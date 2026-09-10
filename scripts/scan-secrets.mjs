import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const root = process.cwd();
const ignored = new Set([".git", ".vscode-test", "node_modules", "dist", "dist-test", "coverage"]);
const patterns = [
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/
];
const findings = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) await walk(fullPath);
    else if (entry.isFile() && !entry.name.endsWith(".vsix")) {
      const contents = await readFile(fullPath, "utf8").catch(() => "");
      if (patterns.some((pattern) => pattern.test(contents))) findings.push(relative(root, fullPath));
    }
  }
}

await walk(root);
if (findings.length) {
  console.error(`Potential secrets found in: ${findings.join(", ")}`);
  process.exit(1);
}
console.log("No credential-shaped secrets found.");
