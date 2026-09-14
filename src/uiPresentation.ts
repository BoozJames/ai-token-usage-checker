import { selectGauge, type ProviderId, type ProviderSnapshot } from "./model";

const PROVIDER_IDS: readonly ProviderId[] = ["claude", "codex", "copilot"];

export function orderedProviderIds(selected: ProviderId): [ProviderId, ...ProviderId[]] {
  return [selected, ...PROVIDER_IDS.filter((provider) => provider !== selected)];
}

export function pickerUsageDetail(snapshot: ProviderSnapshot): string {
  const gauge = selectGauge(snapshot);
  if (!gauge.determinate) return gauge.label;
  const used = Math.round(Math.max(0, Math.min(100, gauge.value)));
  return `${used}% used | ${100 - used}% remaining | ${gauge.label}`;
}
