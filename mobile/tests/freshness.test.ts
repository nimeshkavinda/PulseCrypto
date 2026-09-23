import { pairFreshness, STALE_AFTER_MS } from '../src/data/freshness';

const now = 1_000_000;
const base = { pair: 'BTCUSDT' as const, connection: 'open' as const, upstream: { status: 'live' as const, stalePairs: [], since: 1 }, updatedAt: now - 100, origin: 'live' as const, now };

describe('pairFreshness', () => {
  it('is live when connected, upstream live, pair fresh and recent', () => {
    expect(pairFreshness(base)).toBe('live');
  });

  it('is none without data', () => {
    expect(pairFreshness({ ...base, updatedAt: undefined })).toBe('none');
  });

  it('is cached for data from an earlier session, even while connected', () => {
    expect(pairFreshness({ ...base, origin: 'cache' })).toBe('cached');
  });

  it('is offline whenever the socket is not open (last values kept)', () => {
    for (const connection of ['connecting', 'backoff', 'offline', 'paused'] as const) {
      expect(pairFreshness({ ...base, connection })).toBe('offline');
    }
  });

  it('is delayed when this pair is stale upstream, but not when another pair is', () => {
    expect(pairFreshness({ ...base, upstream: { status: 'stale', stalePairs: ['BTCUSDT'], since: 1 } })).toBe('delayed');
    expect(pairFreshness({ ...base, upstream: { status: 'stale', stalePairs: ['ETHUSDT'], since: 1 } })).toBe('live');
  });

  it('is delayed when the exchange feed is down or data is older than the threshold', () => {
    expect(pairFreshness({ ...base, upstream: { status: 'down', stalePairs: [], since: 1 } })).toBe('delayed');
    expect(pairFreshness({ ...base, updatedAt: now - STALE_AFTER_MS - 1 })).toBe('delayed');
  });
});
