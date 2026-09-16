import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { ClaudeOtelReceiver } from "../../src/providers/claudeOtelReceiver";

function metricsBody(total: number): string {
  return JSON.stringify({
    resourceMetrics: [{
      scopeMetrics: [{
        metrics: [{
          name: "claude_code.token.usage",
          sum: {
            aggregationTemporality: 2,
            dataPoints: [{ attributes: [{ key: "type", value: { stringValue: "input" } }], asInt: String(total) }]
          }
        }]
      }]
    }]
  });
}

async function post(port: number, path: string, body: string, headers: Record<string, string>): Promise<Response> {
  return fetch(`http://127.0.0.1:${port}${path}`, { method: "POST", headers, body });
}

describe("ClaudeOtelReceiver", () => {
  let directory: string;

  before(async () => { directory = await mkdtemp(join(tmpdir(), "ai-token-checker-otel-")); });
  after(async () => { await rm(directory, { recursive: true, force: true }); });

  it("accepts a valid OTLP POST, updates totals, and mirrors a snapshot file", async () => {
    const snapshotPath = join(directory, "valid", "claude-otel-metrics.json");
    const receiver = new ClaudeOtelReceiver({ port: 0, authToken: "tok", snapshotPath });
    try {
      const started = await receiver.start();
      assert.equal(started.bound, true);
      if (!started.bound) return;

      const response = await post(started.port, "/v1/metrics", metricsBody(42), {
        "content-type": "application/json",
        "x-ai-token-checker": "tok"
      });
      assert.equal(response.status, 200);

      await new Promise((resolve) => setTimeout(resolve, 2_200));
      const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
      assert.equal(snapshot.totalTokens, 42);
      assert.equal(snapshot.schemaVersion, 1);
    } finally {
      await receiver.stop();
    }
  });

  it("rejects requests that fail path, method, auth, size, or JSON validity", async () => {
    const snapshotPath = join(directory, "rejects", "claude-otel-metrics.json");
    const receiver = new ClaudeOtelReceiver({ port: 0, authToken: "tok", snapshotPath });
    try {
      const started = await receiver.start();
      assert.equal(started.bound, true);
      if (!started.bound) return;
      const port = started.port;

      const wrongPath = await post(port, "/not-metrics", metricsBody(1), { "x-ai-token-checker": "tok" });
      assert.equal(wrongPath.status, 404);

      const wrongMethod = await fetch(`http://127.0.0.1:${port}/v1/metrics`, { method: "GET" });
      assert.equal(wrongMethod.status, 404);

      const noAuth = await post(port, "/v1/metrics", metricsBody(1), {});
      assert.equal(noAuth.status, 403);

      const wrongAuth = await post(port, "/v1/metrics", metricsBody(1), { "x-ai-token-checker": "nope" });
      assert.equal(wrongAuth.status, 403);

      const malformed = await post(port, "/v1/metrics", "{not json", { "x-ai-token-checker": "tok" });
      assert.equal(malformed.status, 400);

      const oversized = await post(port, "/v1/metrics", "x".repeat(300 * 1024), { "x-ai-token-checker": "tok" });
      assert.equal(oversized.status, 413);
    } finally {
      await receiver.stop();
    }
  });

  it("reports a bind conflict when the port is already in use", async () => {
    const snapshotPath = join(directory, "conflict", "claude-otel-metrics.json");
    const first = new ClaudeOtelReceiver({ port: 0, authToken: "tok", snapshotPath });
    try {
      const started = await first.start();
      assert.equal(started.bound, true);
      if (!started.bound) return;

      const second = new ClaudeOtelReceiver({ port: started.port, authToken: "tok", snapshotPath });
      const conflict = await second.start();
      assert.deepEqual(conflict, { bound: false, reason: "in-use" });
      await second.stop();
    } finally {
      await first.stop();
    }
  });
});
