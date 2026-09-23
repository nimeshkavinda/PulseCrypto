import { PairMetadata, SupportedPairSymbol } from '@pulsecrypto/shared';
import { applyTab, buildRows, matchesQuery } from '../src/components/watchlist/filterUtils';

const meta = (symbol: SupportedPairSymbol, change24h: number): PairMetadata => ({
  symbol, displayName: `${symbol.replace('USDT', '')} / USDT`, baseAsset: symbol.replace('USDT', ''), quoteAsset: 'USDT',
  tradingStatus: 'TRADING', priceDecimals: 2, qtyDecimals: 2, high24h: 2, low24h: 1, volume24h: 1, lastPrice: 1.5, change24h,
});

describe('buildRows', () => {
  it('creates a row for every supported pair even without metadata', () => {
    const rows = buildRows(undefined);
    expect(rows.map((r) => r.symbol)).toEqual(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'XRPUSDT']);
    expect(rows.every((r) => r.snapshot === null && r.tradingStatus === null)).toBe(true);
  });

  it('enriches rows with exchange metadata when available', () => {
    const rows = buildRows([{ ...meta('DOGEUSDT', -1), priceDecimals: 5, tradingStatus: 'HALTED' }]);
    const doge = rows.find((r) => r.symbol === 'DOGEUSDT')!;
    expect(doge).toMatchObject({ priceDecimals: 5, tradingStatus: 'HALTED', snapshot: { change24h: -1 } });
  });
});

describe('matchesQuery', () => {
  const btc = buildRows(undefined)[0];
  it.each(['btc', 'BTC', ' btc ', 'BTC / USDT', 'btcusdt', ''])('matches %p', (q) => {
    expect(matchesQuery(btc, q)).toBe(true);
  });
  it('rejects non-matching queries', () => {
    expect(matchesQuery(btc, 'eth')).toBe(false);
  });
});

describe('applyTab', () => {
  const symbols: SupportedPairSymbol[] = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'XRPUSDT'];
  const changes: Partial<Record<SupportedPairSymbol, number>> = { BTCUSDT: 1.8, ETHUSDT: -0.4, SOLUSDT: 4.1, DOGEUSDT: 0, XRPUSDT: -1.2 };
  const changeOf = (s: SupportedPairSymbol) => changes[s];

  it('keeps natural order for ALL', () => {
    expect(applyTab(symbols, 'ALL', [], changeOf)).toEqual(symbols);
  });

  it('filters favourites', () => {
    expect(applyTab(symbols, 'FAVORITES', ['XRPUSDT', 'BTCUSDT'], changeOf)).toEqual(['BTCUSDT', 'XRPUSDT']);
  });

  it('sorts gainers (including flat) descending and losers ascending by live change', () => {
    expect(applyTab(symbols, 'GAINERS', [], changeOf)).toEqual(['SOLUSDT', 'BTCUSDT', 'DOGEUSDT']);
    expect(applyTab(symbols, 'LOSERS', [], changeOf)).toEqual(['XRPUSDT', 'ETHUSDT']);
  });

  it('excludes pairs without data from gainers and losers', () => {
    expect(applyTab(['BTCUSDT', 'ETHUSDT'], 'GAINERS', [], (s) => (s === 'BTCUSDT' ? 1 : undefined))).toEqual(['BTCUSDT']);
  });
});
