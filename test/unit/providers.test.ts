import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { ClaudeAdapter, mergeClaudeSnapshot, parseClaudeSnapshot } from "../../src/providers/claude";
import { normalizeCodex } from "../../src/providers/codex";
import { bundledCopilotRuntimePath, normalizeCopilot } from "../../src/providers/copilot";

describe("Claude normalization", () => {
  it("accepts missing rate limits and bounded context", () => {
    const snapshot = parseClaudeSnapshot({
      schemaVersion: 1,
      observedAt: "2026-09-10T00:00:00.000Z",
      context: { totalTokens: 1_200, limit: 10_000 }
    });
    assert.equal(snapshot.state, "ready");
    assert.deepEqual(snapshot.quotaWindows, []);
    assert.deepEqual(snapshot.tokenUsage, { scope: "context", total: 1_200, limit: 10_000 });
  });

  it("rejects unknown bridge schemas", () => {
    assert.throws(() => parseClaudeSnapshot({ schemaVersion: 9 }), /Unsupported/);
  });
});

describe("Claude source merge", () => {
  it("prefers the status line's context usage over telemetry", () => {
    const statusLine = parseClaudeSnapshot({
      schemaVersion: 1,
      observedAt: "2026-09-10T00:00:00.000Z",
      context: { totalTokens: 500, limit: 10_000 }
    });
    const merged = mergeClaudeSnapshot(statusLine, { total: 99_999, observedAt: "2026-09-10T00:05:00.000Z" });
    assert.deepEqual(merged.tokenUsage, { scope: "context", total: 500, limit: 10_000 });
    assert.equal(merged.source.label, "Claude Code status line");
  });

  it("keeps status line quota windows and adds telemetry token usage when there is no context usage", () => {
    const statusLine = parseClaudeSnapshot({
      schemaVersion: 1,
      observedAt: "2026-09-10T00:00:00.000Z",
      rateLimits: { fiveHour: { usedPercent: 40, resetsAt: "2026-09-10T05:00:00.000Z" } }
    });
    const merged = mergeClaudeSnapshot(statusLine, { total: 1_234, observedAt: "2026-09-10T00:05:00.000Z" });
    assert.equal(merged.quotaWindows.length, 1);
    assert.deepEqual(merged.tokenUsage, { scope: "session", total: 1_234 });
    assert.equal(merged.source.label, "Claude Code status line + telemetry");
    assert.equal(merged.observedAt, "2026-09-10T00:05:00.000Z");
  });

  it("uses telemetry alone as an indeterminate session total", () => {
    const merged = mergeClaudeSnapshot(undefined, { total: 42, observedAt: "2026-09-10T00:05:00.000Z" });
    assert.equal(merged.state, "ready");
    assert.equal(merged.quotaWindows.length, 0);
    assert.deepEqual(merged.tokenUsage, { scope: "session", total: 42 });
    assert.equal(merged.source.label, "Claude Code telemetry");
  });

  it("reports unavailable without fabricating a value when neither source has data", () => {
    const merged = mergeClaudeSnapshot(undefined, undefined);
    assert.equal(merged.state, "unavailable");
    assert.equal(merged.tokenUsage, undefined);
    assert.equal(merged.quotaWindows.length, 0);
  });
});

describe("ClaudeAdapter.connect", () => {
  it("does not throw when telemetry is enabled but global storage has never been created (first-ever run)", async () => {
    const directory = await mkdtemp(join(tmpdir(), "ai-token-checker-claude-adapter-"));
    const missingStorageDir = join(directory, "not-created-yet");
    try {
      const adapter = new ClaudeAdapter({
        snapshotPath: join(missingStorageDir, "claude-metrics.json"),
        bridgePath: join(missingStorageDir, "claude-bridge.cjs"),
        telemetrySnapshotPath: join(missingStorageDir, "claude-otel-metrics.json"),
        telemetryEnabled: () => true,
        createReceiver: () => undefined,
        onChanged: () => undefined
      });
      const result = await adapter.connect();
      assert.equal(result.connected, true);
      assert.ok(existsSync(missingStorageDir), "connect() must create the watched directory instead of throwing ENOENT");
      await adapter.disconnect();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("shares a telemetry total across windows via the mirrored file, even when this window's own receiver loses the port-bind race", async () => {
    // Simulates a second concurrently open VS Code window: its own ClaudeOtelReceiver
    // failed to bind (another window already owns the port, createReceiver returns
    // undefined here to model that), yet refresh() must still reflect the total the
    // OTHER window's receiver already wrote to the shared global-storage file.
    const directory = await mkdtemp(join(tmpdir(), "ai-token-checker-claude-adapter-shared-"));
    try {
      const telemetrySnapshotPath = join(directory, "claude-otel-metrics.json");
      await mkdir(directory, { recursive: true });
      await writeFile(
        telemetrySnapshotPath,
        JSON.stringify({ schemaVersion: 1, observedAt: "2026-09-16T02:17:50.730Z", totalTokens: 44_004 }),
        "utf8"
      );

      const adapter = new ClaudeAdapter({
        snapshotPath: join(directory, "claude-metrics.json"),
        bridgePath: join(directory, "claude-bridge.cjs"),
        telemetrySnapshotPath,
        telemetryEnabled: () => true,
        createReceiver: () => undefined, // this window's receiver never started (port already owned elsewhere)
        onChanged: () => undefined
      });
      const connectResult = await adapter.connect();
      assert.equal(connectResult.connected, true);

      const snapshot = await adapter.refresh(new AbortController().signal);
      assert.equal(snapshot.state, "ready");
      assert.deepEqual(snapshot.tokenUsage, { scope: "session", total: 44_004 });
      assert.equal(snapshot.source.label, "Claude Code telemetry");

      await adapter.disconnect();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe("Codex normalization", () => {
  it("handles multiple quota buckets and lifetime usage", () => {
    const snapshot = normalizeCodex({
      rateLimitsByLimitId: {
        codex: { limitId: "codex", primary: { usedPercent: 20, windowDurationMins: 300, resetsAt: 1_800_000_000 } },
        review: { limitName: "Reviews", primary: { usedPercent: 70 } }
      }
    }, { summary: { lifetimeTokens: 42_000 } });
    assert.equal(snapshot.quotaWindows.length, 2);
    assert.equal(snapshot.quotaWindows[0]?.label, "5-hour limit");
    assert.equal(snapshot.quotaWindows[1]?.label, "Reviews primary");
    assert.deepEqual(snapshot.tokenUsage, { scope: "lifetime", total: 42_000 });
  });

  it("fails closed for malformed payloads", () => {
    const snapshot = normalizeCodex({ rateLimits: { primary: { usedPercent: "50" } } }, null);
    assert.equal(snapshot.state, "unavailable");
    assert.equal(snapshot.quotaWindows.length, 0);
  });
});

describe("Copilot normalization", () => {
  it("selects the runtime bundled for the current operating system", () => {
    assert.match(
      bundledCopilotRuntimePath("/extension", "linux", "x64"),
      /resources[\\/]copilot-runtimes[\\/]linux-x64[\\/]prebuilds[\\/]linux-x64[\\/]copilot-runtime$/
    );
    assert.match(
      bundledCopilotRuntimePath("C:\\extension", "win32", "x64"),
      /resources[\\/]copilot-runtimes[\\/]win32-x64[\\/]prebuilds[\\/]win32-x64[\\/]copilot-runtime\.exe$/
    );
    assert.throws(
      () => bundledCopilotRuntimePath("/extension", "darwin", "arm64"),
      /does not support darwin-arm64/
    );
  });

  it("skips unlimited quotas and accepts runtime quota keys", () => {
    const snapshot = normalizeCopilot({
      chat: { isUnlimitedEntitlement: true, remainingPercentage: 100 },
      premium_interactions: { isUnlimitedEntitlement: false, remainingPercentage: 35, resetDate: "2026-10-01T00:00:00Z" }
    });
    assert.equal(snapshot.state, "ready");
    assert.equal(snapshot.quotaWindows.length, 1);
    assert.equal(snapshot.quotaWindows[0]?.usedPercent, 65);
  });

  it("reports unavailable when all entitlements are unlimited", () => {
    const snapshot = normalizeCopilot({ chat: { isUnlimitedEntitlement: true, remainingPercentage: 100 } });
    assert.equal(snapshot.state, "unavailable");
  });

  it("still shows a quota window when its resetDate has already passed", () => {
    // The SDK has been observed reporting resetDate as the moment of the request itself
    // rather than a real period boundary, so a past resetDate must not hide real usage data.
    const snapshot = normalizeCopilot({
      premium_interactions: {
        isUnlimitedEntitlement: false,
        remainingPercentage: 0,
        resetDate: "2026-09-10T12:00:00Z"
      },
      completions: {
        isUnlimitedEntitlement: false,
        remainingPercentage: 96,
        resetDate: "2026-10-01T00:00:00Z"
      }
    }, new Date("2026-09-10T13:00:00Z"));
    assert.equal(snapshot.quotaWindows.length, 2);
    const premium = snapshot.quotaWindows.find((window) => window.id === "premium_interactions");
    assert.equal(premium?.usedPercent, 100);
    assert.equal(premium?.resetsAt, undefined);
    const completions = snapshot.quotaWindows.find((window) => window.id === "completions");
    assert.equal(completions?.label, "Inline Suggestions");
    assert.equal(completions?.usedPercent, 4);
    assert.equal(completions?.resetsAt, "2026-10-01T00:00:00.000Z");
  });

  it("skips buckets the account has no entitlement for", () => {
    const snapshot = normalizeCopilot({
      premium_interactions: {
        isUnlimitedEntitlement: false,
        remainingPercentage: 0,
        entitlementRequests: 0,
        resetDate: "2026-09-10T13:00:00Z"
      }
    }, new Date("2026-09-10T13:00:00Z"));
    assert.equal(snapshot.state, "unavailable");
    assert.equal(snapshot.quotaWindows.length, 0);
  });

  it("does not skip a bucket just because entitlementRequests is absent", () => {
    // entitlementRequests is only known to be reliably present since SDK 1.0.13; an
    // older or partial response omitting it must not be treated as "no entitlement" -
    // that would hide real usage data the account actually has.
    const snapshot = normalizeCopilot({
      chat: { isUnlimitedEntitlement: false, remainingPercentage: 40 }
    });
    assert.equal(snapshot.state, "ready");
    assert.equal(snapshot.quotaWindows.length, 1);
    assert.equal(snapshot.quotaWindows[0]?.usedPercent, 60);
  });

  it("normalizes a real Free-plan getQuota response", () => {
    const snapshot = normalizeCopilot({
      chat: {
        isUnlimitedEntitlement: false, entitlementRequests: 200, usedRequests: 0,
        remainingPercentage: 100, resetDate: "2026-09-10T16:59:26.754Z"
      },
      completions: {
        isUnlimitedEntitlement: false, entitlementRequests: 2000, usedRequests: 90,
        remainingPercentage: 95.5, resetDate: "2026-09-10T16:59:26.754Z"
      },
      premium_interactions: {
        isUnlimitedEntitlement: false, entitlementRequests: 0, usedRequests: 0,
        remainingPercentage: 0, resetDate: "2026-09-10T16:59:26.754Z"
      }
    }, new Date("2026-09-10T16:59:26.380Z"));
    assert.equal(snapshot.state, "ready");
    assert.equal(snapshot.quotaWindows.length, 2);
    assert.equal(snapshot.quotaWindows.find((window) => window.id === "completions")?.usedPercent, 4.5);
    assert.equal(snapshot.quotaWindows.find((window) => window.id === "completions")?.deprioritized, true);
    assert.equal(snapshot.quotaWindows.find((window) => window.id === "chat")?.deprioritized, undefined);
    assert.equal(snapshot.quotaWindows.some((window) => window.id === "premium_interactions"), false);
  });
});
