import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { it } from "node:test";

it("Claude bridge writes only allowlisted metrics", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ai-token-checker-"));
  const target = join(directory, "snapshot.json");
  try {
    const child = spawn(process.execPath, [resolve("resources/claude-bridge.cjs"), target], { stdio: ["pipe", "ignore", "ignore"] });
    child.stdin.end(JSON.stringify({
      session_id: "must-not-leak",
      prompt: "private prompt",
      rate_limits: { five_hour: { used_percentage: 42, resets_at: 1_800_000_000 } },
      context_window: { total_input_tokens: 100, total_output_tokens: 20, context_window_size: 1_000 }
    }));
    const exitCode = await new Promise<number | null>((resolveExit) => child.once("exit", resolveExit));
    assert.equal(exitCode, 0);
    const snapshot = await readFile(target, "utf8");
    assert.doesNotMatch(snapshot, /must-not-leak|private prompt|session_id|prompt/);
    assert.deepEqual(JSON.parse(snapshot).context, { totalTokens: 120, limit: 1_000 });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
