import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ProviderSnapshot } from "../../src/model";
import { orderedProviderIds, pickerUsageDetail } from "../../src/uiPresentation";

describe("UI presentation", () => {
  it("puts the selected provider first without dropping the others", () => {
    assert.deepEqual(orderedProviderIds("codex"), ["codex", "claude", "copilot"]);
    assert.deepEqual(orderedProviderIds("copilot"), ["copilot", "claude", "codex"]);
  });

  it("summarizes selected-provider usage for the picker", () => {
    const snapshot: ProviderSnapshot = {
      providerId: "codex",
      state: "ready",
      observedAt: "2026-09-14T00:00:00.000Z",
      source: { label: "Codex app-server", accuracy: "provider-reported" },
      quotaWindows: [{ id: "primary", label: "5-hour limit", usedPercent: 68 }]
    };
    assert.equal(pickerUsageDetail(snapshot), "68% used | 32% remaining | 5-hour limit");
  });
});
