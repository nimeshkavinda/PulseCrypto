/**
 * Financial price and volume formatting utilities.
 */

export function formatPrice(price: number, decimals: number): string {
  if (isNaN(price)) return '0.00';
  return price.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatVolume(volume: number): string {
  if (isNaN(volume)) return '0.00';
  if (volume >= 1_000_000_000) {
    return `${(volume / 1_000_000_000).toFixed(2)}B`;
  }
  if (volume >= 1_000_000) {
    return `${(volume / 1_000_000).toFixed(2)}M`;
  }
  if (volume >= 1_000) {
    return `${(volume / 1_000).toFixed(2)}K`;
  }
  return volume.toFixed(2);
}

/**
 * Standard circulating supplies across supported pairs for realistic,
 * institutional-grade market cap calculations matching Mockup 3 (e.g. 1.2T for BTC).
 */
const CIRCULATING_SUPPLY: Record<string, number> = {
  BTCUSDT: 19_700_000,
  ETHUSDT: 120_400_000,
  SOLUSDT: 468_000_000,
  DOGEUSDT: 146_000_000_000,
  XRPUSDT: 56_000_000_000,
};

export function formatMarketCap(pair: string, price: number): string {
  if (isNaN(price) || price <= 0) return '0.00';
  const supply = CIRCULATING_SUPPLY[pair] ?? 19_700_000;
  const mcap = supply * price;
  if (mcap >= 1_000_000_000_000) {
    return `${(mcap / 1_000_000_000_000).toFixed(1)}T`;
  }
  if (mcap >= 1_000_000_000) {
    return `${(mcap / 1_000_000_000).toFixed(1)}B`;
  }
  if (mcap >= 1_000_000) {
    return `${(mcap / 1_000_000).toFixed(1)}M`;
  }
  return mcap.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

