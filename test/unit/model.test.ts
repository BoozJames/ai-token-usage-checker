import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clampPercentage, selectGauge, type ProviderSnapshot } from "../../src/model";

const base: ProviderSnapshot = {
  providerId: "claude",
  state: "ready",
  observedAt: "2026-09-10T00:00:00.000Z",
  source: { label: "test", accuracy: "provider-reported" },
  quotaWindows: []
};

describe("gauge selection", () => {
  it("uses the most-consumed quota window", () => {
    const selected = selectGauge({ ...base, quotaWindows: [
      { id: "short", label: "5-hour", usedPercent: 35 },
      { id: "week", label: "7-day", usedPercent: 82 }
    ] });
    assert.deepEqual(selected, { determinate: true, value: 82, label: "7-day" });
  });

  it("uses bounded context when quota is absent", () => {
    assert.deepEqual(selectGauge({ ...base, tokenUsage: { scope: "context", total: 50, limit: 200 } }), {
      determinate: true, value: 25, label: "Context window"
    });
  });

  it("does not invent a percentage for unbounded totals", () => {
    assert.deepEqual(selectGauge({ ...base, tokenUsage: { scope: "lifetime", total: 12_000 } }), {
      determinate: false, label: "Lifetime tokens"
    });
  });

  it("clamps percentages", () => {
    assert.equal(clampPercentage(-2), 0);
    assert.equal(clampPercentage(140), 100);
    assert.equal(clampPercentage(Number.NaN), 0);
  });
});
