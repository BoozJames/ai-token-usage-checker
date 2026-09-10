"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const MAX_INPUT_BYTES = 1024 * 1024;
const MAX_FORWARD_BYTES = 64 * 1024;
const FORWARD_TIMEOUT_MS = 10_000;
const target = process.argv[2];
const forwardConfig = process.argv[3];
if (!target || /[\r\n\0]/.test(target)) process.exit(2);

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
  if (Buffer.byteLength(input) > MAX_INPUT_BYTES) process.exit(3);
});
process.stdin.on("end", async () => {
  let snapshotFailed = false;
  try {
    writeSnapshot(JSON.parse(input));
  } catch {
    snapshotFailed = true;
  }

  if (forwardConfig) {
    const exitCode = await runExistingStatusLine(forwardConfig, input);
    process.exitCode = exitCode;
  } else if (snapshotFailed) {
    process.exitCode = 4;
  }
});

function writeSnapshot(data) {
  const context = data && data.context_window;
  const limits = data && data.rate_limits;
  const inputTokens = number(context && context.total_input_tokens);
  const outputTokens = number(context && context.total_output_tokens);
  const snapshot = {
    schemaVersion: 1,
    observedAt: new Date().toISOString(),
    rateLimits: {
      fiveHour: limit(limits && limits.five_hour),
      sevenDay: limit(limits && limits.seven_day),
      spendLimit: limit(limits && limits.spend_limit)
    },
    context: {
      totalTokens: inputTokens + outputTokens,
      limit: optionalNumber(context && context.context_window_size)
    }
  };
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(snapshot)}\n`, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temporary, target);
}

function runExistingStatusLine(configPath, stdin) {
  return new Promise((resolve) => {
    try {
      const stat = fs.statSync(configPath);
      if (!stat.isFile() || stat.size > MAX_FORWARD_BYTES) return resolve(5);
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (config.schemaVersion !== 1 || typeof config.command !== "string" || !config.command || /[\r\n\0]/.test(config.command)) {
        return resolve(5);
      }

      const child = spawn(config.command, [], {
        shell: true,
        windowsHide: true,
        stdio: ["pipe", "pipe", "ignore"]
      });
      let output = "";
      let outputBytes = 0;
      let settled = false;
      const finish = (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (output) process.stdout.write(output);
        resolve(typeof code === "number" ? code : 5);
      };
      const timer = setTimeout(() => {
        child.kill();
        finish(5);
      }, FORWARD_TIMEOUT_MS);
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        outputBytes += Buffer.byteLength(chunk);
        if (outputBytes > MAX_FORWARD_BYTES) {
          child.kill();
          return;
        }
        output += chunk;
      });
      child.once("error", () => finish(5));
      child.once("exit", (code) => finish(code));
      child.stdin.end(stdin);
    } catch {
      resolve(5);
    }
  });
}

function limit(value) {
  if (!value) return undefined;
  const usedPercent = optionalNumber(value.used_percentage);
  if (usedPercent === undefined) return undefined;
  const resets = optionalNumber(value.resets_at);
  return { usedPercent, ...(resets !== undefined ? { resetsAt: new Date(resets * 1000).toISOString() } : {}) };
}

function optionalNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function number(value) {
  return optionalNumber(value) ?? 0;
}
