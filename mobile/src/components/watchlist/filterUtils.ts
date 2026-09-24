import { PairMetadata, SUPPORTED_PAIRS, SupportedPairSymbol } from '@pulsecrypto/shared';

export type MarketFilterTab = 'ALL' | 'FAVORITES' | 'GAINERS' | 'LOSERS';

export const FILTER_TABS: { id: MarketFilterTab; label: string }[] = [
  { id: 'ALL', label: 'All Pairs' },
  { id: 'FAVORITES', label: 'Favourites' },
  { id: 'GAINERS', label: 'Gainers' },
  { id: 'LOSERS', label: 'Losers' },
];

/** One watchlist row: static pair info, enriched with exchange metadata when it has loaded. */
export interface WatchRow {
  symbol: SupportedPairSymbol;
  displayName: string;
  baseAsset: string;
  priceDecimals: number;
  tradingStatus: PairMetadata['tradingStatus'] | null;
  /** Values from GET /pairs/meta, shown until the first live ticker arrives. */
  snapshot: Pick<PairMetadata, 'lastPrice' | 'change24h' | 'high24h' | 'low24h' | 'volume24h'> | null;
}

/** Rows for every supported pair; works without metadata (e.g. REST unavailable). */
export function buildRows(metadata: PairMetadata[] | undefined): WatchRow[] {
  const bySymbol = new Map((metadata ?? []).map((m) => [m.symbol, m]));
  return (Object.keys(SUPPORTED_PAIRS) as SupportedPairSymbol[]).map((symbol) => {
    const base = SUPPORTED_PAIRS[symbol];
    const meta = bySymbol.get(symbol);
    return {
      symbol,
      displayName: meta?.displayName ?? base.displayName,
      baseAsset: meta?.baseAsset ?? base.baseAsset,
      priceDecimals: meta?.priceDecimals ?? base.priceDecimals,
      tradingStatus: meta?.tradingStatus ?? null,
      snapshot: meta
        ? { lastPrice: meta.lastPrice, change24h: meta.change24h, high24h: meta.high24h, low24h: meta.low24h, volume24h: meta.volume24h }
        : null,
    };
  });
}

/** Case-insensitive match on symbol, display name or base asset ("btc" → BTC / USDT). */
export function matchesQuery(row: Pick<WatchRow, 'symbol' | 'displayName' | 'baseAsset'>, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    row.symbol.toLowerCase().includes(q) ||
    row.displayName.toLowerCase().includes(q) ||
    row.baseAsset.toLowerCase().includes(q)
  );
}

/**
 * Applies the tab to already query-filtered symbols. Gainers/losers use the live 24h change when
 * available (`changeOf` returns undefined for pairs with no data, which are then excluded).
 */
export function applyTab(
  symbols: SupportedPairSymbol[],
  tab: MarketFilterTab,
  favorites: SupportedPairSymbol[],
  changeOf: (s: SupportedPairSymbol) => number | undefined
): SupportedPairSymbol[] {
  switch (tab) {
    case 'FAVORITES':
      return symbols.filter((s) => favorites.includes(s));
    case 'GAINERS':
      return symbols
        .filter((s) => (changeOf(s) ?? -Infinity) >= 0)
        .sort((a, b) => changeOf(b)! - changeOf(a)!);
    case 'LOSERS':
      return symbols
        .filter((s) => (changeOf(s) ?? Infinity) < 0)
        .sort((a, b) => changeOf(a)! - changeOf(b)!);
    default:
      return symbols;
  }
}
