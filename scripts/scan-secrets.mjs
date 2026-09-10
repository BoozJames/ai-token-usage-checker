import { readdir, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join, relative } from "node:path";

const root = process.cwd();
const ignored = new Set([".git", ".vscode-test", "node_modules", "dist", "dist-test", "coverage"]);
const sensitiveFileNames = new Set([".credentials.json", "auth.json", "claude-metrics.json"]);
const patterns = [
  ["OpenAI-style API key", /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ["GitHub token", /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/],
  ["AWS access key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ["JWT", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
  ["Bearer credential", /Authorization\s*[:=]\s*["']?Bearer\s+[A-Za-z0-9._~-]{16,}/i],
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["Windows user path", /C:\\Users\\[^\\\s"']+/i],
  ["Unix user path", /\/(?:Users|home)\/[^/\s"']+/]
];
const findings = [];
const execFileAsync = promisify(execFile);

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) await walk(fullPath);
    else if (entry.isFile() && !entry.name.endsWith(".vsix")) {
      if (sensitiveFileNames.has(entry.name) || /\.(?:pem|pfx|p12|key)$/i.test(entry.name)) {
        findings.push(`sensitive filename: ${relative(root, fullPath)}`);
        continue;
      }
      const contents = await readFile(fullPath, "utf8").catch(() => "");
      for (const [label, pattern] of patterns) {
        if (pattern.test(contents)) findings.push(`${label}: ${relative(root, fullPath)}`);
      }
    }
  }
}

await walk(root);
try {
  const { stdout: history } = await execFileAsync("git", ["log", "-p", "--all", "--no-color", "--", "."], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024
  });
  for (const [label, pattern] of patterns) {
    if (pattern.test(history)) findings.push(`${label}: Git history`);
  }
} catch (error) {
  console.error("Could not scan Git history for secrets.");
  process.exitCode = 1;
  throw error;
}

if (findings.length) {
  console.error(`Potential sensitive data found in: ${[...new Set(findings)].join(", ")}`);
  process.exit(1);
}
console.log("No credential-shaped secrets, private user paths, or sensitive provider files found in the workspace or Git history.");
