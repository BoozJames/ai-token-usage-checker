import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyOtelMetricsPayload, emptyTelemetryTotals, parseTelemetrySnapshot, telemetryTokenUsage } from "../../src/providers/claudeOtel";

function metricPayload(aggregationTemporality: unknown, dataPoints: unknown[]): unknown {
  return {
    resourceMetrics: [{
      scopeMetrics: [{
        metrics: [{
          name: "claude_code.token.usage",
          sum: { aggregationTemporality, dataPoints }
        }]
      }]
    }]
  };
}

function point(type: string, value: number): unknown {
  return { attributes: [{ key: "type", value: { stringValue: type } }], asInt: String(value) };
}

describe("applyOtelMetricsPayload", () => {
  it("adds delta values across payloads", () => {
    let totals = applyOtelMetricsPayload(emptyTelemetryTotals(), metricPayload(1, [point("input", 100)]));
    totals = applyOtelMetricsPayload(totals, metricPayload(1, [point("input", 50)]));
    assert.equal(totals.total, 150);
    assert.equal(totals.hasData, true);
  });

  it("replaces cumulative values instead of summing them", () => {
    let totals = applyOtelMetricsPayload(emptyTelemetryTotals(), metricPayload(2, [point("input", 100)]));
    totals = applyOtelMetricsPayload(totals, metricPayload(2, [point("input", 150)]));
    assert.equal(totals.total, 150, "cumulative export must replace, not add (150 not 250)");
  });

  it("treats unspecified aggregation temporality as cumulative", () => {
    let totals = applyOtelMetricsPayload(emptyTelemetryTotals(), metricPayload(undefined, [point("input", 100)]));
    totals = applyOtelMetricsPayload(totals, metricPayload(undefined, [point("input", 40)]));
    assert.equal(totals.total, 40);
  });

  it("accepts the string enum name for delta", () => {
    let totals = applyOtelMetricsPayload(emptyTelemetryTotals(), metricPayload("AGGREGATION_TEMPORALITY_DELTA", [point("input", 10)]));
    totals = applyOtelMetricsPayload(totals, metricPayload("AGGREGATION_TEMPORALITY_DELTA", [point("input", 5)]));
    assert.equal(totals.total, 15);
  });

  it("tracks distinct attribute sets independently", () => {
    const totals = applyOtelMetricsPayload(emptyTelemetryTotals(), metricPayload(2, [
      point("input", 100),
      point("output", 40),
      point("cacheRead", 10)
    ]));
    assert.equal(totals.total, 150);
  });

  it("accepts asDouble and rejects negative or non-finite values", () => {
    const totals = applyOtelMetricsPayload(emptyTelemetryTotals(), metricPayload(2, [
      { attributes: [{ key: "type", value: { stringValue: "input" } }], asDouble: 12.5 },
      { attributes: [{ key: "type", value: { stringValue: "bad" } }], asInt: "-5" },
      { attributes: [{ key: "type", value: { stringValue: "worse" } }], asDouble: Number.NaN }
    ]));
    assert.equal(totals.total, 12.5);
  });

  it("never keys or leaks identifying attributes, even though the real Claude Code CLI always attaches them", () => {
    // Live testing against Claude Code CLI 2.1.273 on 2026-09-16 showed it always attaches
    // user.email, user.id, and organization.id to every data point, with no
    // OTEL_METRICS_INCLUDE_* flag able to suppress them. This is a regression guard for the
    // allowlist in seriesKey() that protects the privacy invariant regardless of exporter behavior.
    const payload = metricPayload(1, [{
      attributes: [
        { key: "type", value: { stringValue: "input" } },
        { key: "model", value: { stringValue: "claude-haiku-4-5-20251001" } },
        { key: "user.email", value: { stringValue: "someone@example.com" } },
        { key: "user.id", value: { stringValue: "fake-user-id-0000000000000000000000000000000000000000000000000000" } },
        { key: "organization.id", value: { stringValue: "00000000-0000-0000-0000-000000000000" } },
        { key: "terminal.type", value: { stringValue: "vscode" } }
      ],
      asInt: "42"
    }]);
    const totals = applyOtelMetricsPayload(emptyTelemetryTotals(), payload);
    assert.equal(totals.total, 42);
    const serialized = JSON.stringify(totals, (_key, value) => (value instanceof Map ? [...value.entries()] : value));
    assert.ok(!serialized.includes("example.com"), "email must never enter the accumulated totals");
    assert.ok(!serialized.includes("fake-user-id"), "user id must never enter the accumulated totals");
    assert.ok(!serialized.includes("00000000-0000-0000-0000-000000000000"), "organization id must never enter the accumulated totals");
    assert.ok(!serialized.includes("vscode"), "terminal type must never enter the accumulated totals");
    assert.deepEqual([...totals.series.keys()], ["model=claude-haiku-4-5-20251001|type=input"]);
  });

  it("ignores metrics with a different name", () => {
    const payload = {
      resourceMetrics: [{
        scopeMetrics: [{
          metrics: [{
            name: "claude_code.cost.usage",
            sum: { aggregationTemporality: 2, dataPoints: [{ attributes: [], asInt: "5" }] }
          }]
        }]
      }]
    };
    const totals = applyOtelMetricsPayload(emptyTelemetryTotals(), payload);
    assert.equal(totals.hasData, false);
    assert.equal(totals.total, 0);
  });

  it("never throws on garbage input and leaves totals unchanged", () => {
    const empty = emptyTelemetryTotals();
    assert.doesNotThrow(() => applyOtelMetricsPayload(empty, null));
    assert.doesNotThrow(() => applyOtelMetricsPayload(empty, []));
    const result = applyOtelMetricsPayload(empty, { resourceMetrics: "not-an-array" });
    assert.deepEqual(result, empty);
  });

  it("caps the number of distinct attribute series it tracks", () => {
    const points = Array.from({ length: 300 }, (_, index) => point(`type-${index}`, 1));
    const totals = applyOtelMetricsPayload(emptyTelemetryTotals(), metricPayload(2, points));
    assert.ok(totals.series.size <= 256);
  });
});

describe("telemetryTokenUsage", () => {
  it("returns undefined before any data point arrives — never fabricates a zero", () => {
    assert.equal(telemetryTokenUsage(emptyTelemetryTotals()), undefined);
  });

  it("returns a session-scoped usage once data exists", () => {
    const totals = applyOtelMetricsPayload(emptyTelemetryTotals(), metricPayload(2, [point("input", 7)]));
    assert.deepEqual(telemetryTokenUsage(totals), { scope: "session", total: 7 });
  });
});

describe("parseTelemetrySnapshot", () => {
  it("rejects unknown schema versions", () => {
    assert.equal(parseTelemetrySnapshot({ schemaVersion: 2, observedAt: "2026-09-10T00:00:00.000Z", totalTokens: 5 }), undefined);
  });

  it("rejects a malformed body", () => {
    assert.equal(parseTelemetrySnapshot({ schemaVersion: 1, observedAt: "not-a-date", totalTokens: 5 }), undefined);
    assert.equal(parseTelemetrySnapshot({ schemaVersion: 1, observedAt: "2026-09-10T00:00:00.000Z", totalTokens: -1 }), undefined);
    assert.equal(parseTelemetrySnapshot(null), undefined);
  });

  it("parses a valid snapshot", () => {
    assert.deepEqual(
      parseTelemetrySnapshot({ schemaVersion: 1, observedAt: "2026-09-10T00:00:00.000Z", totalTokens: 5 }),
      { total: 5, observedAt: "2026-09-10T00:00:00.000Z" }
    );
  });
});
