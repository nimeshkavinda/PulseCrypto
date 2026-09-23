import { describe, it, expect, beforeEach } from 'vitest';
import { SupportedPairSymbol } from '@pulsecrypto/shared';
import { FreshnessMonitor } from '../src/market/freshness.js';
import { StatusTracker } from '../src/market/marketSource.js';

describe('FreshnessMonitor', () => {
  let clock: number;
  let updates: Partial<Record<SupportedPairSymbol, number>>;
  let status: StatusTracker;
  let monitor: FreshnessMonitor;

  beforeEach(() => {
    clock = 10_000;
    updates = {};
    status = new StatusTracker();
    monitor = new FreshnessMonitor({
      status,
      pairs: ['BTCUSDT', 'ETHUSDT'],
      lastUpdateAt: (p) => updates[p] ?? 0,
      staleAfterMs: 3000,
      now: () => clock,
    });
  });

  it('reports connecting before the first connection', () => {
    monitor.evaluate();
    expect(status.get().status.upstream).toBe('connecting');
  });

  it('is live right after connecting (grace from the connect time)', () => {
    monitor.setConnected(true);
    expect(status.get().status).toMatchObject({ upstream: 'live', stalePairs: [] });
  });

  it('marks individual pairs stale and recovers when updates resume', () => {
    monitor.setConnected(true);
    clock += 2000;
    updates.BTCUSDT = clock;
    updates.ETHUSDT = clock;
    clock += 3500;
    updates.BTCUSDT = clock;
    monitor.evaluate();
    expect(status.get().status).toMatchObject({ upstream: 'stale', stalePairs: ['ETHUSDT'] });

    updates.ETHUSDT = clock;
    monitor.evaluate();
    expect(status.get().status).toMatchObject({ upstream: 'live', stalePairs: [] });
  });

  it('reports down after a disconnect', () => {
    monitor.setConnected(true);
    monitor.setConnected(false);
    expect(status.get().status.upstream).toBe('down');
  });

  it('only bumps the status version on actual changes', () => {
    monitor.setConnected(true);
    const v = status.get().version;
    monitor.evaluate();
    monitor.evaluate();
    expect(status.get().version).toBe(v);
  });
});
