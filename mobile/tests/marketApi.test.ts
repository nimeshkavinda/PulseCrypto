import { fetchPairsMetadata, MetadataUnavailableError } from '../src/api/marketApi';

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

  it('rejects malformed responses instead of substituting values', async () => {
    mockFetch(200, [{ ...meta, lastPrice: -1 }]);
    await expect(fetchPairsMetadata('http://gw')).rejects.toThrow();
    mockFetch(500, {});
    await expect(fetchPairsMetadata('http://gw')).rejects.toThrow(/HTTP 500/);
  });
});
