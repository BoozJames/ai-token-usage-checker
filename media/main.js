(function () {
  "use strict";
  const providerName = document.getElementById("provider-name");
  const meter = document.getElementById("meter");
  const fill = document.getElementById("meter-fill");
  const value = document.getElementById("value");
  const label = document.getElementById("label");
  const tokens = document.getElementById("tokens");
  const quotaDetails = document.getElementById("quota-details");
  const reset = document.getElementById("reset");
  const source = document.getElementById("source");
  const message = document.getElementById("message");
  const providerNames = { claude: "Claude Code", codex: "Codex", copilot: "GitHub Copilot" };

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.type !== "state") return;
    providerName.textContent = providerNames[data.selectedProvider] || "AI assistant";
    meter.classList.toggle("indeterminate", !data.gauge.determinate);
    meter.classList.toggle("warning", data.gauge.determinate && data.gauge.value >= 70 && data.gauge.value < 90);
    meter.classList.toggle("danger", data.gauge.determinate && data.gauge.value >= 90);
    if (data.gauge.determinate) {
      const pct = Math.max(0, Math.min(100, data.gauge.value));
      const roundedUsed = Math.round(pct);
      const roundedRemaining = 100 - roundedUsed;
      fill.style.setProperty("--usage", `${pct}%`);
      meter.setAttribute("aria-valuenow", String(roundedUsed));
      meter.setAttribute("aria-valuetext", `${roundedUsed} percent used and ${roundedRemaining} percent remaining for ${data.gauge.label}`);
      value.textContent = `${roundedUsed}% used · ${roundedRemaining}% remaining`;
    } else {
      fill.style.removeProperty("--usage");
      meter.removeAttribute("aria-valuenow");
      meter.setAttribute("aria-valuetext", data.gauge.label);
      value.textContent = "—";
    }
    label.textContent = data.gauge.label;
    renderQuotaDetails(data.quotaDetails);
    tokens.textContent = formatTokens(data.snapshot.tokenUsage);
    reset.textContent = data.resetAt ? `Resets ${new Date(data.resetAt).toLocaleString()}` : "";
    source.textContent = `${data.snapshot.state} · ${data.snapshot.source.label} · ${data.snapshot.source.accuracy} · ${relativeTime(data.snapshot.observedAt)}`;
    message.textContent = data.snapshot.message || "";
    message.dataset.state = data.snapshot.state;
  });

  function renderQuotaDetails(windows) {
    quotaDetails.replaceChildren();
    if (!Array.isArray(windows) || windows.length === 0) {
      const item = document.createElement("li");
      item.textContent = "No active quota windows reported.";
      quotaDetails.append(item);
      return;
    }
    for (const window of windows) {
      const item = document.createElement("li");
      const roundedUsed = Math.round(window.usedPercent);
      const roundedRemaining = 100 - roundedUsed;
      const resetText = window.resetsAt ? ` · resets ${new Date(window.resetsAt).toLocaleString()}` : "";
      item.textContent = `${window.label}: ${roundedUsed}% used · ${roundedRemaining}% left${resetText}`;
      quotaDetails.append(item);
    }
  }
  function formatTokens(usage) {
    if (!usage) return "Token totals not reported.";
    const total = new Intl.NumberFormat().format(usage.total);
    const limit = usage.limit ? ` / ${new Intl.NumberFormat().format(usage.limit)}` : "";
    return `${capitalize(usage.scope)} tokens: ${total}${limit}`;
  }
  function relativeTime(observedAt) {
    const seconds = Math.max(0, Math.round((Date.now() - Date.parse(observedAt)) / 1000));
    if (seconds < 5) return "just now";
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.floor(seconds / 60)}m ago`;
  }
  function capitalize(text) { return text.charAt(0).toUpperCase() + text.slice(1); }
}());
