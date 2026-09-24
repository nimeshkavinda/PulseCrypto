import { fetchPairsMetadata, MetadataUnavailableError } from '../src/api/marketApi';
import { metadataRetryDelay, shouldRetryMetadata } from '../src/hooks/usePairsMetadata';

const meta = {
  symbol: 'BTCUSDT', displayName: 'BTC / USDT', baseAsset: 'BTC', quoteAsset: 'USDT', tradingStatus: 'TRADING',
  priceDecimals: 2, qtyDecimals: 5, high24h: 2, low24h: 1, volume24h: 3, lastPrice: 1.5, change24h: 0.1,
};

function mockFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  global.fetch = jest.fn(async () => new Response(JSON.stringify(body), { status, headers })) as unknown as typeof fetch;
}

describe('fetchPairsMetadata', () => {
  it('returns validated metadata from /pairs/meta', async () => {
    mockFetch(200, [meta]);
    await expect(fetchPairsMetadata('http://gw')).resolves.toEqual([meta]);
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toBe('http://gw/pairs/meta');
  });

  it('surfaces 503 as MetadataUnavailableError with Retry-After', async () => {
    mockFetch(503, { error: 'METADATA_UNAVAILABLE' }, { 'Retry-After': '2' });
    const err = await fetchPairsMetadata('http://gw').catch((e) => e);
    expect(err).toBeInstanceOf(MetadataUnavailableError);
    expect(err.retryAfterS).toBe(2);
  });

  it('reports an unknown retry time (null, not 0) when Retry-After is missing', async () => {
    mockFetch(503, { error: 'METADATA_UNAVAILABLE' });
    const err = await fetchPairsMetadata('http://gw').catch((e) => e);
    expect(err).toBeInstanceOf(MetadataUnavailableError);
    expect(err.retryAfterS).toBeNull();
  });

  it('rejects malformed responses instead of substituting values', async () => {
    mockFetch(200, [{ ...meta, lastPrice: -1 }]);
    await expect(fetchPairsMetadata('http://gw')).rejects.toThrow();
    mockFetch(500, {});
    await expect(fetchPairsMetadata('http://gw')).rejects.toThrow(/HTTP 500/);
  });
});

describe('usePairsMetadata retry policy', () => {
  it('keeps retrying a warming-up gateway, paced by Retry-After and capped at 10 s', () => {
    const warming = new MetadataUnavailableError('loading', 2);
    expect(shouldRetryMetadata(50, warming)).toBe(true);
    expect(metadataRetryDelay(50, warming)).toBe(2000);
    expect(metadataRetryDelay(1, new MetadataUnavailableError('loading', 60))).toBe(10_000);
    // Retry-After: 0 is floored at 1 s: warm-up retries are unlimited, so no tight loop.
    expect(metadataRetryDelay(50, new MetadataUnavailableError('loading', 0))).toBe(1000);
    // No Retry-After: exponential, still capped.
    expect(metadataRetryDelay(1, new MetadataUnavailableError('loading', null))).toBe(2000);
    expect(metadataRetryDelay(8, new MetadataUnavailableError('loading', null))).toBe(10_000);
  });

  it('gives up on other errors after 3 retries', () => {
    const other = new Error('HTTP 500');
    expect([0, 1, 2, 3].map((n) => shouldRetryMetadata(n, other))).toEqual([true, true, true, false]);
  });
});
