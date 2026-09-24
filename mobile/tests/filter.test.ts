import { filterAndSortPairs } from '../src/components/watchlist/filterUtils';
import { PairMetadata } from '@pulsecrypto/shared';

const mockPairs: PairMetadata[] = [
  {
    symbol: 'BTCUSDT',
    displayName: 'BTC / USDT',
    baseAsset: 'BTC',
    quoteAsset: 'USDT',
    tradingStatus: 'TRADING',
    priceDecimals: 2,
    qtyDecimals: 5,
    high24h: 65200,
    low24h: 62800,
    volume24h: 28400,
    lastPrice: 64238,
    change24h: 2.45,
  },
  {
    symbol: 'ETHUSDT',
    displayName: 'ETH / USDT',
    baseAsset: 'ETH',
    quoteAsset: 'USDT',
    tradingStatus: 'TRADING',
    priceDecimals: 2,
    qtyDecimals: 4,
    high24h: 3550,
    low24h: 3380,
    volume24h: 154000,
    lastPrice: 3485,
    change24h: -1.2,
  },
  {
    symbol: 'SOLUSDT',
    displayName: 'SOL / USDT',
    baseAsset: 'SOL',
    quoteAsset: 'USDT',
    tradingStatus: 'TRADING',
    priceDecimals: 2,
    qtyDecimals: 3,
    high24h: 158,
    low24h: 142,
    volume24h: 895000,
    lastPrice: 152,
    change24h: 5.8,
  },
  {
    symbol: 'DOGEUSDT',
    displayName: 'DOGE / USDT',
    baseAsset: 'DOGE',
    quoteAsset: 'USDT',
    tradingStatus: 'TRADING',
    priceDecimals: 5,
    qtyDecimals: 1,
    high24h: 0.13,
    low24h: 0.11,
    volume24h: 42000000,
    lastPrice: 0.12,
    change24h: -3.5,
  },
  {
    symbol: 'XRPUSDT',
    displayName: 'XRP / USDT',
    baseAsset: 'XRP',
    quoteAsset: 'USDT',
    tradingStatus: 'TRADING',
    priceDecimals: 4,
    qtyDecimals: 2,
    high24h: 0.62,
    low24h: 0.56,
    volume24h: 19800000,
    lastPrice: 0.58,
    change24h: 0.1,
  },
];

describe('Search and Filter Utilities (Task T4.2)', () => {
  const favorites = ['BTCUSDT', 'SOLUSDT'];

  it('should return all pairs when query is empty and tab is ALL', () => {
    const result = filterAndSortPairs(mockPairs, '', 'ALL', favorites);
    expect(result).toHaveLength(5);
    expect(result.map((p) => p.symbol)).toEqual([
      'BTCUSDT',
      'ETHUSDT',
      'SOLUSDT',
      'DOGEUSDT',
      'XRPUSDT',
    ]);
  });

  it('should filter pairs by symbol case-insensitively', () => {
    const result = filterAndSortPairs(mockPairs, 'btc', 'ALL', favorites);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('BTCUSDT');

    const solResult = filterAndSortPairs(mockPairs, 'SOL', 'ALL', favorites);
    expect(solResult).toHaveLength(1);
    expect(solResult[0].symbol).toBe('SOLUSDT');
  });

  it('should filter pairs by base asset', () => {
    const result = filterAndSortPairs(mockPairs, 'doge', 'ALL', favorites);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('DOGEUSDT');
  });

  it('should filter by FAVORITES tab', () => {
    const result = filterAndSortPairs(mockPairs, '', 'FAVORITES', favorites);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.symbol)).toEqual(['BTCUSDT', 'SOLUSDT']);
  });

  it('should filter and sort by GAINERS (change24h >= 0 desc)', () => {
    const result = filterAndSortPairs(mockPairs, '', 'GAINERS', favorites);
    expect(result).toHaveLength(3); // SOL (5.8), BTC (2.45), XRP (0.1)
    expect(result.map((p) => p.symbol)).toEqual(['SOLUSDT', 'BTCUSDT', 'XRPUSDT']);
    expect(result[0].change24h).toBe(5.8);
    expect(result[2].change24h).toBe(0.1);
  });

  it('should filter and sort by LOSERS (change24h < 0 asc)', () => {
    const result = filterAndSortPairs(mockPairs, '', 'LOSERS', favorites);
    expect(result).toHaveLength(2); // DOGE (-3.5), ETH (-1.2)
    expect(result.map((p) => p.symbol)).toEqual(['DOGEUSDT', 'ETHUSDT']);
    expect(result[0].change24h).toBe(-3.5);
    expect(result[1].change24h).toBe(-1.2);
  });

  it('should combine search query and filter tab', () => {
    // In favorites (BTC, SOL), search for 'sol'
    const result = filterAndSortPairs(mockPairs, 'sol', 'FAVORITES', favorites);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('SOLUSDT');

    // In losers (DOGE, ETH), search for 'btc' -> returns 0
    const emptyResult = filterAndSortPairs(mockPairs, 'btc', 'LOSERS', favorites);
    expect(emptyResult).toHaveLength(0);
  });
});
