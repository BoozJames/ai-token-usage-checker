"use strict";

const fs = require("node:fs");
const path = require("node:path");
const target = process.argv[2];
if (!target || /[\r\n\0]/.test(target)) process.exit(2);

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
  if (Buffer.byteLength(input) > 1024 * 1024) process.exit(3);
});
process.stdin.on("end", () => {
  try {
    const data = JSON.parse(input);
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
  } catch {
    process.exitCode = 4;
  }
});

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
function number(value) { return optionalNumber(value) ?? 0; }
