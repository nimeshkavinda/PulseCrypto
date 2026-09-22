import { describe, it, expect } from 'vitest';
import {
  MarketUpdatePayloadSchema,
  PairMetadataSchema,
  ClientCommandSchema,
  SupportedPairSymbolSchema,
  MarketUpdatePayload,
  PairMetadata,
  SUPPORTED_PAIRS,
} from '../src/schemas.js';

describe('Shared Zod Schemas Round-Trip & Edge Validation (Task T1.3)', () => {
  const baseValidPayload: MarketUpdatePayload = {
    pair: 'BTCUSDT',
    timestamp: 1720802025000,
    price: 64238.17,
    change24h: 2.45,
    high24h: 65120.0,
    low24h: 62800.0,
    volume24h: 28410.52,
    spread: 0.41,
    spreadPct: 0.0006,
    buyPressure: 63.0,
    sellPressure: 37.0,
    bids: [
      [64239.5, 0.4522, 29045.12],
      [64238.0, 1.12, 100991.68],
    ],
    asks: [
      [64241.5, 0.112, 7195.05],
      [64242.0, 0.95, 68224.95],
    ],
  };

  it('should successfully validate a complete MarketUpdatePayload', () => {
    const result = MarketUpdatePayloadSchema.safeParse(baseValidPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pair).toBe('BTCUSDT');
      expect(result.data.bids).toHaveLength(2);
      expect(result.data.bids[0]).toEqual([64239.5, 0.4522, 29045.12]);
    }
  });

  it('should allow empty order books (e.g. cold start)', () => {
    const emptyBookPayload = {
      ...baseValidPayload,
      bids: [],
      asks: [],
    };
    const result = MarketUpdatePayloadSchema.safeParse(emptyBookPayload);
    expect(result.success).toBe(true);
  });

  it('should reject order books exceeding 20 levels (depth20 ceiling)', () => {
    const oversizedBids = Array.from({ length: 21 }, (_, i) => [60000 - i, 1.0, 60000] as [number, number, number]);
    const payload = {
      ...baseValidPayload,
      bids: oversizedBids,
    };
    const result = MarketUpdatePayloadSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('should reject negative price, high, low, or non-positive timestamps', () => {
    expect(MarketUpdatePayloadSchema.safeParse({ ...baseValidPayload, price: -10 }).success).toBe(false);
    expect(MarketUpdatePayloadSchema.safeParse({ ...baseValidPayload, price: 0 }).success).toBe(false);
    expect(MarketUpdatePayloadSchema.safeParse({ ...baseValidPayload, high24h: -1 }).success).toBe(false);
    expect(MarketUpdatePayloadSchema.safeParse({ ...baseValidPayload, timestamp: -100 }).success).toBe(false);
  });

  it('should reject unsupported pair symbols', () => {
    const invalidPair = { ...baseValidPayload, pair: 'UNKNOWNUSDT' };
    expect(MarketUpdatePayloadSchema.safeParse(invalidPair).success).toBe(false);
  });

  it('should reject buy and sell pressure that do not sum to 100', () => {
    const badSumPayload = {
      ...baseValidPayload,
      buyPressure: 70.0,
      sellPressure: 40.0, // sum = 110
    };
    const result = MarketUpdatePayloadSchema.safeParse(badSumPayload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('must sum to 100%');
    }
  });

  it('should reject buy/sell pressure outside [0, 100]', () => {
    expect(
      MarketUpdatePayloadSchema.safeParse({ ...baseValidPayload, buyPressure: 110, sellPressure: -10 }).success
    ).toBe(false);
  });

  it('should successfully validate PairMetadata for GET /pairs/meta', () => {
    const validMeta: PairMetadata = {
      symbol: 'BTCUSDT',
      displayName: 'BTC / USDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      tradingStatus: 'TRADING',
      priceDecimals: 2,
      qtyDecimals: 5,
      high24h: 65120.0,
      low24h: 62800.0,
      volume24h: 28410.52,
      lastPrice: 64238.17,
      change24h: 2.45,
    };

    const result = PairMetadataSchema.safeParse(validMeta);
    expect(result.success).toBe(true);
  });

  it('should reject PairMetadata with negative price metrics', () => {
    const invalidMeta = {
      symbol: 'BTCUSDT',
      displayName: 'BTC / USDT',
      baseAsset: 'BTC',
      quoteAsset: 'USDT',
      tradingStatus: 'TRADING',
      priceDecimals: 2,
      qtyDecimals: 5,
      high24h: -10,
      low24h: 62800.0,
      volume24h: 28410.52,
      lastPrice: 64238.17,
      change24h: 2.45,
    };
    expect(PairMetadataSchema.safeParse(invalidMeta).success).toBe(false);
  });

  describe('ClientCommandSchema Discriminated Union', () => {
    it('should validate setThrottle with intervalMs in range', () => {
      expect(ClientCommandSchema.safeParse({ action: 'setThrottle', intervalMs: 250 }).success).toBe(true);
      expect(ClientCommandSchema.safeParse({ action: 'setThrottle', intervalMs: 10 }).success).toBe(true);
      expect(ClientCommandSchema.safeParse({ action: 'setThrottle', intervalMs: 2000 }).success).toBe(true);
    });

    it('should reject setThrottle with missing or out-of-range intervalMs', () => {
      expect(ClientCommandSchema.safeParse({ action: 'setThrottle' }).success).toBe(false);
      expect(ClientCommandSchema.safeParse({ action: 'setThrottle', intervalMs: 5 }).success).toBe(false);
      expect(ClientCommandSchema.safeParse({ action: 'setThrottle', intervalMs: 3000 }).success).toBe(false);
    });

    it('should validate subscribe and unsubscribe commands', () => {
      expect(
        ClientCommandSchema.safeParse({ action: 'subscribe', pairs: ['BTCUSDT', 'ETHUSDT'] }).success
      ).toBe(true);
      expect(
        ClientCommandSchema.safeParse({ action: 'unsubscribe', pairs: ['SOLUSDT'] }).success
      ).toBe(true);
    });

    it('should reject subscribe with empty or invalid pairs', () => {
      expect(ClientCommandSchema.safeParse({ action: 'subscribe', pairs: [] }).success).toBe(false);
      expect(ClientCommandSchema.safeParse({ action: 'subscribe', pairs: ['FAKEPAIR'] }).success).toBe(false);
    });

    it('should validate ping command', () => {
      expect(ClientCommandSchema.safeParse({ action: 'ping' }).success).toBe(true);
    });

    it('should reject unknown action', () => {
      expect(ClientCommandSchema.safeParse({ action: 'unknownCommand' }).success).toBe(false);
    });
  });

  describe('SUPPORTED_PAIRS constant', () => {
    it('should contain all 5 target trading pairs with correct metadata', () => {
      const keys = Object.keys(SUPPORTED_PAIRS);
      expect(keys).toEqual(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'XRPUSDT']);
      expect(SUPPORTED_PAIRS.BTCUSDT.baseAsset).toBe('BTC');
      expect(SUPPORTED_PAIRS.BTCUSDT.quoteAsset).toBe('USDT');
    });
  });
});
