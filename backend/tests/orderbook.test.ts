import { describe, it, expect } from 'vitest';
import { OrderBookManager } from '../src/orderbook.js';
import { MetadataService } from '../src/metadata.js';
import { MarketUpdatePayloadSchema } from '@pulsecrypto/shared';

describe('OrderBookManager & Analytics Engine (Task T2.3)', () => {
  it('should initialize all 5 supported pair books with valid schema snapshots', () => {
    const obm = new OrderBookManager();
    const snapshots = obm.getAllSnapshots();

    expect(snapshots).toHaveLength(5);
    for (const snap of snapshots) {
      const parsed = MarketUpdatePayloadSchema.safeParse(snap);
      expect(parsed.success).toBe(true);
      expect(snap.buyPressure + snap.sellPressure).toBeCloseTo(100, 2);
    }
  });

  it('should correctly calculate cumulative totals on bids and asks', () => {
    const metadataService = new MetadataService();
    metadataService.updateFromMiniTicker('BTCUSDT', 60000.0, 61000.0, 59000.0, 1000.0);
    const obm = new OrderBookManager(metadataService);

    const mockBids: [number, number][] = [
      [60000.0, 1.0], // total: 60000
      [59900.0, 2.0], // step: 119800, cum: 179800
    ];

    const mockAsks: [number, number][] = [
      [60100.0, 1.0], // total: 60100
      [60200.0, 3.0], // step: 180600, cum: 240700
    ];

    obm.updateDepth('BTCUSDT', mockBids, mockAsks);
    const snap = obm.getSnapshot('BTCUSDT');

    expect(snap.bids[0]).toEqual([60000.0, 1.0, 60000.0]);
    expect(snap.bids[1]).toEqual([59900.0, 2.0, 179800.0]);

    expect(snap.asks[0]).toEqual([60100.0, 1.0, 60100.0]);
    expect(snap.asks[1]).toEqual([60200.0, 3.0, 240700.0]);
  });

  it('should compute accurate spread and buy/sell pressure ratios', () => {
    const obm = new OrderBookManager();
    obm.updateDepth(
      'ETHUSDT',
      [[3000.0, 3.0]], // 3 ETH bids
      [[3010.0, 1.0]]  // 1 ETH ask
    );

    const snap = obm.getSnapshot('ETHUSDT');
    expect(snap.spread).toBe(10.0);
    expect(snap.spreadPct).toBeCloseTo((10 / 3000) * 100, 4);

    // Total volume: 4 ETH (3 bid, 1 ask) -> 75% buy, 25% sell
    expect(snap.buyPressure).toBe(75.0);
    expect(snap.sellPressure).toBe(25.0);
  });

  it('should strictly limit order book depth to 20 levels (depth20)', () => {
    const obm = new OrderBookManager();
    const lotsOfBids: [number, number][] = Array.from({ length: 35 }, (_, i) => [
      60000 - i * 10,
      1.0,
    ]);
    const lotsOfAsks: [number, number][] = Array.from({ length: 35 }, (_, i) => [
      60010 + i * 10,
      1.0,
    ]);

    obm.updateDepth('SOLUSDT', lotsOfBids, lotsOfAsks);
    const snap = obm.getSnapshot('SOLUSDT');

    expect(snap.bids).toHaveLength(20);
    expect(snap.asks).toHaveLength(20);
    expect(snap.bids[0][0]).toBeGreaterThan(snap.bids[19][0]); // Bids descending
    expect(snap.asks[0][0]).toBeLessThan(snap.asks[19][0]);    // Asks ascending
  });
});
