import { z } from 'zod';

/**
 * Canonical 5 supported cryptocurrency trading pairs
 */
export const SupportedPairSymbolSchema = z.enum([
  'BTCUSDT',
  'ETHUSDT',
  'SOLUSDT',
  'DOGEUSDT',
  'XRPUSDT',
]);

export type SupportedPairSymbol = z.infer<typeof SupportedPairSymbolSchema>;

/**
 * DepthTuple represents a single price level in the order book:
 * [price (> 0), quantity (>= 0), notional (>= 0)].
 * Protocol v1 sends per-level notional (price * quantity). The deprecated legacy
 * payload used a cumulative notional in the same slot.
 */
export const DepthTupleSchema = z.tuple([
  z.number().positive(),   // Price in USDT
  z.number().nonnegative(), // Quantity in base asset
  z.number().nonnegative(), // Notional in quote asset
]);

export type DepthTuple = z.infer<typeof DepthTupleSchema>;

/**
 * @deprecated Legacy (pre-protocol-v1) broadcast payload. Superseded by `Frame`/`Ticker`/`Book`
 * in protocol.ts. Retained only until the mobile client migrates (Phase 11).
 *
 * MarketUpdatePayload represents the real-time WebSocket market broadcast.
 * Directly satisfies assignment requirement Part 1, Section 3.
 * Timestamp is unix epoch in milliseconds (ms).
 */
export const MarketUpdatePayloadSchema = z
  .object({
    pair: SupportedPairSymbolSchema,
    timestamp: z.number().int().positive().describe('Unix timestamp in milliseconds (ms)'),
    price: z.number().positive(),
    change24h: z.number(), // Percentage change: can be negative, zero, or positive
    high24h: z.number().positive(),
    low24h: z.number().positive(),
    volume24h: z.number().nonnegative(),
    spread: z.number().nonnegative(),
    spreadPct: z.number().nonnegative(),
    buyPressure: z.number().min(0).max(100),
    sellPressure: z.number().min(0).max(100),
    bids: z.array(DepthTupleSchema).max(20),
    asks: z.array(DepthTupleSchema).max(20),
  })
  .refine(
    (data) => Math.abs(data.buyPressure + data.sellPressure - 100) < 0.01,
    {
      message: 'buyPressure and sellPressure must sum to 100%',
      path: ['buyPressure'],
    }
  );

/** @deprecated See MarketUpdatePayloadSchema. */
export type MarketUpdatePayload = z.infer<typeof MarketUpdatePayloadSchema>;

/**
 * PairMetadata represents the REST response from GET /pairs/meta.
 * Directly satisfies assignment requirement Part 1, Section 4.
 */
export const PairMetadataSchema = z.object({
  symbol: SupportedPairSymbolSchema,
  displayName: z.string(),
  baseAsset: z.string(),
  quoteAsset: z.string(),
  tradingStatus: z.enum(['TRADING', 'HALTED', 'MAINTENANCE']),
  priceDecimals: z.number().int().nonnegative(),
  qtyDecimals: z.number().int().nonnegative(),
  high24h: z.number().positive(),
  low24h: z.number().positive(),
  volume24h: z.number().nonnegative(),
  lastPrice: z.number().positive(),
  change24h: z.number(),
});

export type PairMetadata = z.infer<typeof PairMetadataSchema>;

/**
 * @deprecated Legacy client command. Superseded by `ClientMessageSchema` in protocol.ts.
 * Retained only until the mobile client migrates (Phase 11).
 *
 * ClientCommand represents bidirectional commands sent from client to server.
 * Modeled as a strict discriminated union on `action`.
 */
export const ClientCommandSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('setThrottle'),
    intervalMs: z.number().int().min(10).max(2000),
  }),
  z.object({
    action: z.literal('subscribe'),
    pairs: z.array(SupportedPairSymbolSchema).min(1),
  }),
  z.object({
    action: z.literal('unsubscribe'),
    pairs: z.array(SupportedPairSymbolSchema).min(1),
  }),
  z.object({
    action: z.literal('ping'),
  }),
]);

/** @deprecated See ClientCommandSchema. */
export type ClientCommand = z.infer<typeof ClientCommandSchema>;

/**
 * Supported trading pairs specification with strongly-typed keys
 */
export const SUPPORTED_PAIRS = {
  BTCUSDT: { displayName: 'BTC / USDT', baseAsset: 'BTC', quoteAsset: 'USDT', priceDecimals: 2, qtyDecimals: 5 },
  ETHUSDT: { displayName: 'ETH / USDT', baseAsset: 'ETH', quoteAsset: 'USDT', priceDecimals: 2, qtyDecimals: 4 },
  SOLUSDT: { displayName: 'SOL / USDT', baseAsset: 'SOL', quoteAsset: 'USDT', priceDecimals: 2, qtyDecimals: 3 },
  DOGEUSDT: { displayName: 'DOGE / USDT', baseAsset: 'DOGE', quoteAsset: 'USDT', priceDecimals: 5, qtyDecimals: 1 },
  XRPUSDT: { displayName: 'XRP / USDT', baseAsset: 'XRP', quoteAsset: 'USDT', priceDecimals: 4, qtyDecimals: 2 },
} as const;

export type SupportedPair = keyof typeof SUPPORTED_PAIRS;
