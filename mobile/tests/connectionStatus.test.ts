import { describeStatus } from '../src/data/connectionStatus';

describe('describeStatus', () => {
  it('is LIVE only when the socket is open and the exchange feed is live', () => {
    expect(describeStatus('open', { status: 'live', stalePairs: [], since: 1 })).toEqual({ label: 'LIVE', tone: 'live' });
    expect(describeStatus('open', { status: 'stale', stalePairs: ['BTCUSDT'], since: 1 }).label).toBe('DELAYED');
    expect(describeStatus('open', { status: 'down', stalePairs: [], since: 1 }).label).toBe('NO FEED');
  });

  it('describes each non-open socket state', () => {
    expect(describeStatus('idle', null).label).toBe('CONNECTING');
    expect(describeStatus('connecting', null).label).toBe('CONNECTING');
    expect(describeStatus('backoff', null).label).toBe('RECONNECTING');
    expect(describeStatus('offline', null)).toEqual({ label: 'OFFLINE', tone: 'down' });
    expect(describeStatus('paused', null).tone).toBe('muted');
  });
});
