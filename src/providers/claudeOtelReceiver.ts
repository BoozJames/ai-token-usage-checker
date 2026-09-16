import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { AUTH_HEADER_NAME, METRICS_PATH } from "../claudeTelemetryEnv";
import { applyOtelMetricsPayload, emptyTelemetryTotals, serializeTelemetrySnapshot, telemetryTokenUsage, type TelemetryTotals } from "./claudeOtel";

const MAX_BODY_BYTES = 256 * 1024;
const WRITE_DEBOUNCE_MS = 2_000;
const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

export type BindResult = { bound: true; port: number } | { bound: false; reason: "in-use" | "error" };

export interface ClaudeOtelReceiverOptions {
  port: number;
  authToken: string;
  snapshotPath: string;
}

/**
 * A loopback-only OTLP/HTTP JSON metrics receiver. It never makes an
 * outbound request; it only accepts POSTs from Claude Code processes that
 * were configured (via consent-gated setup) to export to it.
 */
export class ClaudeOtelReceiver {
  private server: Server | undefined;
  private boundPort: number | undefined;
  private totals: TelemetryTotals = emptyTelemetryTotals();
  private writeTimer: NodeJS.Timeout | undefined;

  constructor(private readonly options: ClaudeOtelReceiverOptions) {}

  async start(): Promise<BindResult> {
    if (this.server && this.boundPort !== undefined) return { bound: true, port: this.boundPort };
    const server = createServer((request, response) => this.handleRequest(request, response));
    server.requestTimeout = 10_000;
    server.headersTimeout = 5_000;
    server.keepAliveTimeout = 5_000;
    server.maxConnections = 4;

    const result = await new Promise<BindResult>((resolve) => {
      server.once("error", (error: NodeJS.ErrnoException) => {
        resolve({ bound: false, reason: error.code === "EADDRINUSE" ? "in-use" : "error" });
      });
      server.listen(this.options.port, "127.0.0.1", () => {
        const address = server.address();
        resolve({ bound: true, port: typeof address === "object" && address ? address.port : this.options.port });
      });
    });

    if (result.bound) {
      server.removeAllListeners("error");
      server.on("error", () => void this.stop());
      this.server = server;
      this.boundPort = result.port;
    } else {
      server.removeAllListeners("error");
      server.close();
    }
    return result;
  }

  async stop(): Promise<void> {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = undefined;
    }
    const server = this.server;
    this.server = undefined;
    this.boundPort = undefined;
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  dispose(): void {
    void this.stop();
  }

  private handleRequest(request: IncomingMessage, response: ServerResponse): void {
    const remoteAddress = request.socket.remoteAddress;
    if (!remoteAddress || !LOOPBACK_ADDRESSES.has(remoteAddress)) {
      respond(response, 403, "forbidden");
      return;
    }
    if (request.method !== "POST" || (request.url ?? "").split("?")[0] !== METRICS_PATH) {
      respond(response, 404, "not found");
      return;
    }
    if (request.headers[AUTH_HEADER_NAME] !== this.options.authToken) {
      respond(response, 403, "forbidden");
      return;
    }

    let body = "";
    let overLimit = false;
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      if (overLimit) return;
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        overLimit = true;
        body = "";
        respond(response, 413, "payload too large");
      }
    });
    request.on("end", () => {
      if (overLimit) return;
      let payload: unknown;
      try {
        payload = JSON.parse(body);
      } catch {
        respond(response, 400, "invalid json");
        return;
      }
      this.totals = applyOtelMetricsPayload(this.totals, payload);
      respond(response, 200, JSON.stringify({ partialSuccess: {} }), "application/json");
      this.scheduleWrite();
    });
    request.on("error", () => respond(response, 400, "request error"));
  }

  private scheduleWrite(): void {
    if (this.writeTimer) return;
    this.writeTimer = setTimeout(() => {
      this.writeTimer = undefined;
      void this.writeSnapshot();
    }, WRITE_DEBOUNCE_MS);
  }

  private async writeSnapshot(): Promise<void> {
    const usage = telemetryTokenUsage(this.totals);
    if (!usage) return;
    const contents = serializeTelemetrySnapshot(usage.total, new Date().toISOString());
    const target = this.options.snapshotPath;
    await mkdir(dirname(target), { recursive: true });
    const temporary = `${target}.${process.pid}.tmp`;
    await writeFile(temporary, contents, { encoding: "utf8", mode: 0o600 });
    await rename(temporary, target);
  }
}

function respond(response: ServerResponse, status: number, body: string, contentType = "text/plain"): void {
  if (response.writableEnded) return;
  response.writeHead(status, { "content-type": contentType, connection: "close" });
  response.end(body);
}
