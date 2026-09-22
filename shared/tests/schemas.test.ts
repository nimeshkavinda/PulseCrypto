import { describe, it, expect } from 'vitest';
import {
  MarketUpdatePayloadSchema,
  PairMetadataSchema,
  ClientCommandSchema,
  MarketUpdatePayload,
  PairMetadata,
} from '../src/schemas.js';

describe('Shared Zod Schemas Round-Trip Validation (Task T1.3)', () => {
  it('should successfully validate a complete MarketUpdatePayload', () => {
    const validPayload: MarketUpdatePayload = {
      pair: 'BTCUSDT',
      timestamp: 1720802025,
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

    const result = MarketUpdatePayloadSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pair).toBe('BTCUSDT');
      expect(result.data.bids).toHaveLength(2);
      expect(result.data.bids[0]).toEqual([64239.5, 0.4522, 29045.12]);
    }
  });

  it('should reject a MarketUpdatePayload with invalid types', () => {
    const invalidPayload = {
      pair: 'BTCUSDT',
      price: 'invalid_price_string',
    };

    const result = MarketUpdatePayloadSchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
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

  it('should validate ClientCommand payload schemas', () => {
    const validThrottle = { action: 'setThrottle', intervalMs: 250 };
    expect(ClientCommandSchema.safeParse(validThrottle).success).toBe(true);

    const invalidThrottle = { action: 'setThrottle', intervalMs: 2 }; // Below 10ms min
    expect(ClientCommandSchema.safeParse(invalidThrottle).success).toBe(false);

    const validSubscribe = { action: 'subscribe', pairs: ['BTCUSDT', 'ETHUSDT'] };
    expect(ClientCommandSchema.safeParse(validSubscribe).success).toBe(true);
  });
});
