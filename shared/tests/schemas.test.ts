import { describe, it, expect } from 'vitest';
import { DepthTupleSchema, PairMetadata, PairMetadataSchema, SUPPORTED_PAIRS, SupportedPairSymbolSchema } from '../src/schemas.js';

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

describe('PairMetadataSchema (GET /pairs/meta)', () => {
  it('accepts valid metadata, including negative 24h change', () => {
    expect(PairMetadataSchema.safeParse(validMeta).success).toBe(true);
    expect(PairMetadataSchema.safeParse({ ...validMeta, change24h: -3.1 }).success).toBe(true);
  });

  it.each([
    ['negative high', { high24h: -10 }],
    ['zero last price', { lastPrice: 0 }],
    ['negative volume', { volume24h: -1 }],
    ['fractional decimals', { priceDecimals: 1.5 }],
    ['unknown status', { tradingStatus: 'OPEN' }],
    ['unsupported symbol', { symbol: 'FOOUSDT' }],
  ])('rejects %s', (_label, patch) => {
    expect(PairMetadataSchema.safeParse({ ...validMeta, ...patch }).success).toBe(false);
  });
});

describe('DepthTupleSchema', () => {
  it('accepts [price, quantity, notional]', () => {
    expect(DepthTupleSchema.safeParse([64000.5, 1.5, 96000.75]).success).toBe(true);
  });

  it('rejects non-positive prices and negative quantities', () => {
    expect(DepthTupleSchema.safeParse([0, 1, 0]).success).toBe(false);
    expect(DepthTupleSchema.safeParse([1, -1, 0]).success).toBe(false);
  });
});

describe('SUPPORTED_PAIRS', () => {
  it('lists the five required pairs, matching the symbol enum', () => {
    expect(Object.keys(SUPPORTED_PAIRS)).toEqual(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'XRPUSDT']);
    expect(Object.keys(SUPPORTED_PAIRS)).toEqual(SupportedPairSymbolSchema.options);
    expect(SUPPORTED_PAIRS.BTCUSDT).toMatchObject({ baseAsset: 'BTC', quoteAsset: 'USDT' });
  });
});
