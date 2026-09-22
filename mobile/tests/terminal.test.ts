import { describe, it, expect } from 'vitest';
import { MarketUpdatePayloadSchema, SupportedPairSymbol } from '@pulsecrypto/shared';
import {
  createFallbackPayload,
  computePriceDirection,
  isValidMarketPayload,
} from '../src/context/MarketStreamContext';
import { buildSplineSegments } from '../src/utils/chartUtils';

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

    it('should generate smooth cubic Bezier spline segments via buildSplineSegments', () => {
      const points: [number, number][] = [
        [0, 120],
        [90, 80],
        [180, 140],
      ];
      const { fill, stroke } = buildSplineSegments(points);

      expect(fill).toContain('L 0.0 120.0');
      expect(fill).toContain('C ');
      expect(stroke).toContain('M 0.0 120.0');
      expect(stroke).toContain('C ');
    });

    it('should handle edge cases in buildSplineSegments cleanly', () => {
      expect(buildSplineSegments([])).toEqual({ fill: '', stroke: '' });
      expect(buildSplineSegments([[50, 100]])).toEqual({
        fill: 'L 50.0 100.0',
        stroke: 'M 50.0 100.0',
      });
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

  describe('Price Direction Tracking (computePriceDirection)', () => {
    it('should return neutral when prevPrice is null or equal to currentPrice', () => {
      expect(computePriceDirection(null, 65000)).toBe('neutral');
      expect(computePriceDirection(65000, 65000)).toBe('neutral');
    });

    it('should return up when currentPrice > prevPrice', () => {
      expect(computePriceDirection(64999.99, 65000)).toBe('up');
      expect(computePriceDirection(100, 105)).toBe('up');
    });

    it('should return down when currentPrice < prevPrice', () => {
      expect(computePriceDirection(65000.01, 65000)).toBe('down');
      expect(computePriceDirection(105, 100)).toBe('down');
    });
  });

  describe('Fast Payload Boundary Checker (isValidMarketPayload)', () => {
    it('should accept a valid MarketUpdatePayload', () => {
      const payload = createFallbackPayload('BTCUSDT');
      expect(isValidMarketPayload(payload)).toBe(true);
    });

    it('should reject invalid or malformed data frames', () => {
      expect(isValidMarketPayload(null)).toBe(false);
      expect(isValidMarketPayload(undefined)).toBe(false);
      expect(isValidMarketPayload('string')).toBe(false);
      expect(isValidMarketPayload(123)).toBe(false);
      expect(isValidMarketPayload({})).toBe(false);
      expect(isValidMarketPayload({ pair: 'INVALID_PAIR', price: 100, timestamp: 123, bids: [], asks: [] })).toBe(false);
      expect(isValidMarketPayload({ pair: 'BTCUSDT', price: NaN, timestamp: 123, bids: [], asks: [] })).toBe(false);
      expect(isValidMarketPayload({ pair: 'BTCUSDT', price: 100, timestamp: 123, bids: 'not-array', asks: [] })).toBe(false);
    });
  });

  describe('Rapid Message Conflation & LVC Ingestion', () => {
    it('should conflate sequential rapid updates into LVC without state update depth recursion', () => {
      const lvc: Record<string, { pair: string; price: number; timestamp: number }> = {};
      let prevPrice: number | null = null;
      let priceDirection: string = 'neutral';

      const ticks = [
        { pair: 'BTCUSDT', price: 65000, timestamp: 1000 },
        { pair: 'BTCUSDT', price: 65050, timestamp: 1050 },
        { pair: 'BTCUSDT', price: 64980, timestamp: 1100 },
      ];

      // Simulate rapid ingestion into LVC buffer
      for (const tick of ticks) {
        lvc[tick.pair] = tick;
      }

      // Simulate single batch flush
      const activeItem = lvc['BTCUSDT'];
      if (activeItem) {
        const currentPrice = activeItem.price;
        if (prevPrice !== null && prevPrice !== currentPrice) {
          priceDirection = computePriceDirection(prevPrice, currentPrice);
        }
        prevPrice = currentPrice;
      }

      // Last value cache retained the final tick
      expect(lvc['BTCUSDT'].price).toBe(64980);
      expect(prevPrice).toBe(64980);
      // Because prevPrice was initially null, first evaluation yields neutral without recursion
      expect(priceDirection).toBe('neutral');

      // Subsequent tick evaluation
      const nextTick = { pair: 'BTCUSDT', price: 65100, timestamp: 1200 };
      lvc[nextTick.pair] = nextTick;
      const nextActive = lvc['BTCUSDT'];
      if (nextActive && prevPrice !== null && prevPrice !== nextActive.price) {
        priceDirection = computePriceDirection(prevPrice, nextActive.price);
        prevPrice = nextActive.price;
      }

      expect(prevPrice).toBe(65100);
      expect(priceDirection).toBe('up');
    });
  });
});
