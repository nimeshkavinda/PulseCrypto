import { describe, it, expect, vi, afterEach } from 'vitest';
import { SupportedPairSymbol } from '@pulsecrypto/shared';
import { MetadataService, PairStaticInfo, Ticker24h } from '../src/metadata.js';
import { BinanceRestClient, createBinanceRestClient, decimalsFromStep, mapTradingStatus } from '../src/market/binanceRest.js';
import { MetadataBootstrap } from '../src/market/bootstrap.js';
import { PAIRS, staticInfo, ticker24h } from './helpers/market.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('Binance REST client', () => {
  it('derives decimals from step sizes and maps trading status', () => {
    expect(decimalsFromStep('0.01000000')).toBe(2);
    expect(decimalsFromStep('0.00001000')).toBe(5);
    expect(decimalsFromStep('1.00000000')).toBe(0);
    expect(mapTradingStatus('TRADING')).toBe('TRADING');
    expect(mapTradingStatus('HALT')).toBe('HALTED');
    expect(mapTradingStatus('BREAK')).toBe('MAINTENANCE');
  });

  it('requests only the supported symbols and maps 24h tickers', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request) =>
      jsonResponse([
        { symbol: 'BTCUSDT', lastPrice: '86207.88', highPrice: '87278.54', lowPrice: '85207.73', volume: '20426.1', priceChangePercent: '1.143', closeTime: 1790149279013 },
        { symbol: 'OTHER', lastPrice: '1', highPrice: '1', lowPrice: '1', volume: '1', priceChangePercent: '0', closeTime: 1 },
      ])
    );
    const rest = createBinanceRestClient({ baseUrl: 'https://example.test/', fetch: fetchMock as unknown as typeof fetch });
    const out = await rest.fetchTickers24h(['BTCUSDT']);

    expect(String(fetchMock.mock.calls[0][0])).toBe(`https://example.test/api/v3/ticker/24hr?symbols=${encodeURIComponent('["BTCUSDT"]')}`);
    expect([...out.keys()]).toEqual(['BTCUSDT']);
    expect(out.get('BTCUSDT')).toEqual({ lastPrice: 86207.88, high24h: 87278.54, low24h: 85207.73, volume24h: 20426.1, changePct: 1.143, eventTs: 1790149279013 });
  });

  it('maps exchange info filters and status', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        symbols: [
          {
            symbol: 'DOGEUSDT', status: 'HALT', baseAsset: 'DOGE', quoteAsset: 'USDT',
            filters: [{ filterType: 'PRICE_FILTER', tickSize: '0.00001000' }, { filterType: 'LOT_SIZE', stepSize: '1.00000000' }],
          },
        ],
      })
    );
    const rest = createBinanceRestClient({ fetch: fetchMock as unknown as typeof fetch });
    const out = await rest.fetchExchangeInfo(['DOGEUSDT']);
    expect(out.get('DOGEUSDT')).toMatchObject({ displayName: 'DOGE / USDT', tradingStatus: 'HALTED', priceDecimals: 5, qtyDecimals: 0 });
  });

  it('rejects non-2xx responses and unexpected shapes', async () => {
    const rest = createBinanceRestClient({ fetch: (async () => jsonResponse({}, 451)) as unknown as typeof fetch });
    await expect(rest.fetchTickers24h(['BTCUSDT'])).rejects.toThrow(/451/);
    const bad = createBinanceRestClient({ fetch: (async () => jsonResponse({ nope: true })) as unknown as typeof fetch });
    await expect(bad.fetchExchangeInfo(['BTCUSDT'])).rejects.toThrow();
  });
});

describe('MetadataBootstrap', () => {
  afterEach(() => vi.useRealTimers());

  function fakeRest(failures: { tickers?: number; info?: number } = {}) {
    const calls = { tickers: 0, info: 0 };
    const rest: BinanceRestClient = {
      async fetchTickers24h(pairs) {
        calls.tickers++;
        if (calls.tickers <= (failures.tickers ?? 0)) throw new Error('down');
        return new Map<SupportedPairSymbol, Ticker24h>(pairs.map((p) => [p, ticker24h()]));
      },
      async fetchExchangeInfo(pairs) {
        calls.info++;
        if (calls.info <= (failures.info ?? 0)) throw new Error('down');
        return new Map<SupportedPairSymbol, PairStaticInfo>(pairs.map((p) => [p, staticInfo(p)]));
      },
    };
    return { rest, calls };
  }

  it('becomes ready when both REST calls succeed', async () => {
    const metadata = new MetadataService();
    const { rest } = fakeRest();
    const b = new MetadataBootstrap({ rest, metadata, pairs: PAIRS });
    b.start();
    await vi.waitFor(() => expect(metadata.isReady()).toBe(true));
    b.stop();
  });

  it('retries failures with backoff until success and stays not-ready meanwhile', async () => {
    vi.useFakeTimers();
    const metadata = new MetadataService();
    const { rest, calls } = fakeRest({ info: 3 });
    const b = new MetadataBootstrap({ rest, metadata, pairs: PAIRS, retryInitialMs: 100, retryMaxMs: 1000 });
    b.start();

    await vi.advanceTimersByTimeAsync(0);
    expect(metadata.isReady()).toBe(false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls.info).toBe(4);
    expect(calls.tickers).toBe(1);
    expect(metadata.isReady()).toBe(true);
    b.stop();
  });

  it('refreshes exchange info periodically and stops cleanly', async () => {
    vi.useFakeTimers();
    const { rest, calls } = fakeRest();
    const b = new MetadataBootstrap({ rest, metadata: new MetadataService(), pairs: PAIRS, exchangeInfoRefreshMs: 1000 });
    b.start();
    await vi.advanceTimersByTimeAsync(3500);
    expect(calls.info).toBe(4);
    b.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls.info).toBe(4);
  });

  it('treats exchange info missing a supported symbol as a failure', async () => {
    vi.useFakeTimers();
    const metadata = new MetadataService();
    let infoCalls = 0;
    const rest: BinanceRestClient = {
      fetchTickers24h: async (pairs) => new Map(pairs.map((p) => [p, ticker24h()])),
      fetchExchangeInfo: async (pairs) => {
        infoCalls++;
        const list = infoCalls === 1 ? pairs.slice(1) : pairs;
        return new Map(list.map((p) => [p, staticInfo(p)]));
      },
    };
    const b = new MetadataBootstrap({ rest, metadata, pairs: PAIRS, retryInitialMs: 10 });
    b.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(metadata.isReady()).toBe(false);
    await vi.advanceTimersByTimeAsync(100);
    expect(metadata.isReady()).toBe(true);
    b.stop();
  });
});
