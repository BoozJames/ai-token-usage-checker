import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseClaudeSnapshot } from "../../src/providers/claude";
import { normalizeCodex } from "../../src/providers/codex";
import { normalizeCopilot } from "../../src/providers/copilot";

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
        hasQuota: false,
        resetDate: "2026-09-10T13:00:00Z"
      }
    }, new Date("2026-09-10T13:00:00Z"));
    assert.equal(snapshot.state, "unavailable");
    assert.equal(snapshot.quotaWindows.length, 0);
  });

  it("normalizes a real Free-plan getQuota response", () => {
    const snapshot = normalizeCopilot({
      chat: {
        isUnlimitedEntitlement: false, entitlementRequests: 200, usedRequests: 0,
        remainingPercentage: 100, resetDate: "2026-09-10T16:59:26.754Z", hasQuota: true
      },
      completions: {
        isUnlimitedEntitlement: false, entitlementRequests: 2000, usedRequests: 90,
        remainingPercentage: 95.5, resetDate: "2026-09-10T16:59:26.754Z", hasQuota: true
      },
      premium_interactions: {
        isUnlimitedEntitlement: false, entitlementRequests: 0, usedRequests: 0,
        remainingPercentage: 0, resetDate: "2026-09-10T16:59:26.754Z", hasQuota: false
      }
    }, new Date("2026-09-10T16:59:26.380Z"));
    assert.equal(snapshot.state, "ready");
    assert.equal(snapshot.quotaWindows.length, 2);
    assert.equal(snapshot.quotaWindows.find((window) => window.id === "completions")?.usedPercent, 4.5);
    assert.equal(snapshot.quotaWindows.some((window) => window.id === "premium_interactions"), false);
  });
});
