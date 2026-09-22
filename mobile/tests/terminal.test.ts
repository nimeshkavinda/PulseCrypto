import { describe, it, expect } from 'vitest';
import { MarketUpdatePayloadSchema, SupportedPairSymbol } from '@pulsecrypto/shared';
import { createFallbackPayload } from '../src/context/MarketStreamContext';

describe('Pro Terminal & Order Book Logic (Phase 5: Tasks T5.1 - T5.5)', () => {
  describe('Fallback Payload Generator (Cold Start & Offline Resilience)', () => {
    const pairs: SupportedPairSymbol[] = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'XRPUSDT'];

    pairs.forEach((pair) => {
      it(`should generate a schema-valid fallback payload for ${pair}`, () => {
        const payload = createFallbackPayload(pair);
        const parsed = MarketUpdatePayloadSchema.safeParse(payload);

        expect(parsed.success).toBe(true);
        expect(payload.pair).toBe(pair);
        expect(payload.price).toBeGreaterThan(0);
        expect(payload.bids.length).toBe(10);
        expect(payload.asks.length).toBe(10);
        expect(payload.buyPressure + payload.sellPressure).toBe(100);

        // Bids descending
        for (let i = 0; i < payload.bids.length - 1; i++) {
          expect(payload.bids[i][0]).toBeGreaterThanOrEqual(payload.bids[i + 1][0]);
        }

        // Asks ascending
        for (let i = 0; i < payload.asks.length - 1; i++) {
          expect(payload.asks[i][0]).toBeLessThanOrEqual(payload.asks[i + 1][0]);
        }
      });
    });
  });

  describe('Order Book Depth & Percentage Calculations (Task T5.2)', () => {
    it('should correctly scale depth bar ratios against max cumulative volume', () => {
      const bids: [number, number, number][] = [
        [64000, 1.0, 64000],
        [63900, 2.0, 191800],
      ];
      const asks: [number, number, number][] = [
        [64100, 0.5, 32050],
        [64200, 1.5, 128350],
      ];

      const maxBidTotal = bids[bids.length - 1][2]; // 191800
      const maxAskTotal = asks[asks.length - 1][2]; // 128350
      const maxCumulative = Math.max(maxBidTotal, maxAskTotal);

      expect(maxCumulative).toBe(191800);

      const bidRatio0 = bids[0][2] / maxCumulative;
      const bidRatio1 = bids[1][2] / maxCumulative;
      const askRatio0 = asks[0][2] / maxCumulative;
      const askRatio1 = asks[1][2] / maxCumulative;

      expect(bidRatio0).toBeCloseTo(64000 / 191800, 4);
      expect(bidRatio1).toBe(1.0);
      expect(askRatio0).toBeCloseTo(32050 / 191800, 4);
      expect(askRatio1).toBeCloseTo(128350 / 191800, 4);
    });

    it('should handle single-level order book without zero division', () => {
      const bids: [number, number, number][] = [[100, 1, 100]];
      const asks: [number, number, number][] = [[101, 1, 101]];

      const maxCumulative = Math.max(bids[0][2], asks[0][2], 1);
      expect(maxCumulative).toBe(101);
      expect(bids[0][2] / maxCumulative).toBeCloseTo(100 / 101, 4);
      expect(asks[0][2] / maxCumulative).toBe(1.0);
    });
  });

  describe('Dual-Mountain SVG Path Coordinates (Task T5.4)', () => {
    it('should build non-empty SVG path string for bids mountain', () => {
      const W = 360;
      const H = 160;
      const midX = W / 2;
      const baselineY = H - 8;
      const maxHeight = H - 32;

      const activeBids: [number, number, number][] = [
        [64000, 1, 64000],  // best bid
        [63900, 2, 191800], // lowest bid
      ];
      const maxCumulative = 191800;

      let bidPath = `M 0 ${baselineY}`;
      const n = activeBids.length;
      for (let i = n - 1; i >= 0; i--) {
        const ratio = (n - 1 - i) / Math.max(n - 1, 1);
        const x = Number((midX * ratio).toFixed(1));
        const cumTotal = activeBids[i][2];
        const y = Number((baselineY - (cumTotal / maxCumulative) * maxHeight).toFixed(1));
        bidPath += ` L ${x} ${y}`;
      }
      bidPath += ` L ${midX} ${baselineY} Z`;

      expect(bidPath).toContain(`M 0 ${baselineY}`);
      expect(bidPath).toContain(`L ${midX} ${baselineY} Z`);
      expect(bidPath.split(' ').length).toBeGreaterThan(6);
    });

    it('should build fallback SVG path when order book arrays are empty', () => {
      const W = 360;
      const H = 160;
      const midX = W / 2;
      const baselineY = H - 8;

      const emptyBidsPath = `M 0 ${baselineY} L ${midX} ${baselineY} Z`;
      const emptyAsksPath = `M ${midX} ${baselineY} L ${W} ${baselineY} Z`;

      expect(emptyBidsPath).toBe('M 0 152 L 180 152 Z');
      expect(emptyAsksPath).toBe('M 180 152 L 360 152 Z');
    });
  });

  describe('Liquidity Gap & Order Book Pressure Derivations (Task T5.4)', () => {
    it('should classify liquidity gap correctly based on spread percentage', () => {
      const getGapLabel = (spreadPct: number) =>
        spreadPct <= 0.05 ? 'Low' : spreadPct <= 0.15 ? 'Moderate' : 'High';

      expect(getGapLabel(0.02)).toBe('Low');
      expect(getGapLabel(0.05)).toBe('Low');
      expect(getGapLabel(0.08)).toBe('Moderate');
      expect(getGapLabel(0.15)).toBe('Moderate');
      expect(getGapLabel(0.25)).toBe('High');
    });

    it('should classify pressure correctly based on buy/sell percentages', () => {
      const getPressureLabel = (buyPressure: number, sellPressure: number) => {
        if (buyPressure > 55) return `Buy Heavy (${buyPressure.toFixed(0)}%)`;
        if (sellPressure > 55) return `Sell Heavy (${sellPressure.toFixed(0)}%)`;
        return 'Balanced';
      };

      expect(getPressureLabel(63, 37)).toBe('Buy Heavy (63%)');
      expect(getPressureLabel(40, 60)).toBe('Sell Heavy (60%)');
      expect(getPressureLabel(52, 48)).toBe('Balanced');
      expect(getPressureLabel(50, 50)).toBe('Balanced');
    });
  });
});
