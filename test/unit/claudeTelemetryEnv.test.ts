import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildTelemetryEnvironment,
  hasForeignTelemetryEntries,
  mergeEnvironmentEntries,
  normalizeTelemetryPort,
  stripEnvironmentEntries,
  telemetryEndpoint,
  TELEMETRY_VAR_NAMES
} from "../../src/claudeTelemetryEnv";

describe("buildTelemetryEnvironment", () => {
  it("includes every privacy-minimizing variable and the correct endpoint/header", () => {
    const entries = buildTelemetryEnvironment(41787, "tok");
    const byName = new Map(entries.map((entry) => [entry.name, entry.value]));
    assert.equal(byName.get("CLAUDE_CODE_ENABLE_TELEMETRY"), "1");
    assert.equal(byName.get("OTEL_METRICS_EXPORTER"), "otlp");
    assert.equal(byName.get("OTEL_EXPORTER_OTLP_METRICS_ENDPOINT"), "http://127.0.0.1:41787/v1/metrics");
    assert.equal(byName.get("OTEL_EXPORTER_OTLP_HEADERS"), "x-ai-token-checker=tok");
    for (const name of ["OTEL_METRICS_INCLUDE_SESSION_ID", "OTEL_METRICS_INCLUDE_ACCOUNT_UUID", "OTEL_METRICS_INCLUDE_REPOSITORY", "OTEL_METRICS_INCLUDE_VERSION"]) {
      assert.equal(byName.get(name), "false", `${name} must disable identifying attributes`);
    }
    assert.deepEqual(entries.map((entry) => entry.name).sort(), [...TELEMETRY_VAR_NAMES].sort());
  });
});

describe("telemetryEndpoint", () => {
  it("builds the metrics path for the given port", () => {
    assert.equal(telemetryEndpoint(9999), "http://127.0.0.1:9999/v1/metrics");
  });
});

describe("mergeEnvironmentEntries", () => {
  it("preserves unrelated entries and replaces only managed ones", () => {
    const existing = [{ name: "MY_VAR", value: "keep" }, { name: "CLAUDE_CODE_ENABLE_TELEMETRY", value: "old" }];
    const merged = mergeEnvironmentEntries(existing, buildTelemetryEnvironment(1234, "tok2"));
    assert.deepEqual(merged.find((entry) => entry.name === "MY_VAR"), { name: "MY_VAR", value: "keep" });
    assert.deepEqual(merged.find((entry) => entry.name === "CLAUDE_CODE_ENABLE_TELEMETRY"), { name: "CLAUDE_CODE_ENABLE_TELEMETRY", value: "1" });
  });

  it("ignores malformed existing entries instead of throwing", () => {
    const merged = mergeEnvironmentEntries("not-an-array", buildTelemetryEnvironment(1234, "tok"));
    assert.equal(merged.length, TELEMETRY_VAR_NAMES.length);
  });
});

describe("stripEnvironmentEntries", () => {
  it("removes only the managed names", () => {
    const existing = [{ name: "MY_VAR", value: "keep" }, ...buildTelemetryEnvironment(1234, "tok")];
    assert.deepEqual(stripEnvironmentEntries(existing), [{ name: "MY_VAR", value: "keep" }]);
  });
});

describe("hasForeignTelemetryEntries", () => {
  it("detects a pre-existing managed name", () => {
    assert.equal(hasForeignTelemetryEntries([{ name: "OTEL_METRICS_EXPORTER", value: "console" }]), true);
  });

  it("ignores unrelated entries and malformed input", () => {
    assert.equal(hasForeignTelemetryEntries([{ name: "MY_VAR", value: "x" }]), false);
    assert.equal(hasForeignTelemetryEntries(undefined), false);
    assert.equal(hasForeignTelemetryEntries("not-an-array"), false);
  });
});

describe("normalizeTelemetryPort", () => {
  it("accepts a valid port", () => {
    assert.equal(normalizeTelemetryPort(5000), 5000);
  });

  it("falls back to the default for out-of-range or invalid values", () => {
    assert.equal(normalizeTelemetryPort(80), 41787);
    assert.equal(normalizeTelemetryPort(70000), 41787);
    assert.equal(normalizeTelemetryPort(Number.NaN), 41787);
    assert.equal(normalizeTelemetryPort("not-a-number"), 41787);
  });
});
