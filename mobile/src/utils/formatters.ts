/** Price, volume, change and time formatting for market data. */

export function formatPrice(price: number, decimals: number): string {
  if (!Number.isFinite(price)) return '—';
  return price.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatVolume(volume: number): string {
  if (!Number.isFinite(volume)) return '—';
  if (volume >= 1_000_000_000) return `${(volume / 1_000_000_000).toFixed(2)}B`;
  if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(2)}M`;
  if (volume >= 1_000) return `${(volume / 1_000).toFixed(2)}K`;
  return volume.toFixed(2);
}

export interface FormattedChange {
  arrow: '▲' | '▼';
  text: string;
  positive: boolean;
}

/** 24h change as shown in the brief's watchlist: "▲ 1.82%" / "▼ 0.41%". Zero counts as up. */
export function formatChange(pct: number): FormattedChange {
  const positive = pct >= 0;
  return { arrow: positive ? '▲' : '▼', text: `${Math.abs(pct).toFixed(2)}%`, positive };
}

/**
 * A percentage to `sig` significant figures without exponent notation, for values that can be
 * tiny (a BTC spread is ~0.000012%). The caller adds the "%" sign. "0" for zero.
 */
export function formatPercentSig(pct: number, sig = 2): string {
  if (!Number.isFinite(pct)) return '—';
  if (pct === 0) return '0';
  // Decimals come from the rounded value, so a round-up across a power of ten (0.0000996 -> 0.00010,
  // 9.96 -> 10) still shows `sig` figures.
  const rounded = Number(pct.toPrecision(sig));
  const decimals = Math.max(0, sig - 1 - Math.floor(Math.log10(Math.abs(rounded))));
  return rounded.toFixed(Math.min(decimals, 20));
}

/** Local wall-clock time, HH:MM:SS (24h). */
export function formatTimeOfDay(epochMs: number): string {
  const d = new Date(epochMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Compact age: "4s", "12m", "3h", "2d". */
export function formatAge(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
