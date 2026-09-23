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
 * The notional is per level (price * quantity), in the quote asset.
 */
export const DepthTupleSchema = z.tuple([
  z.number().positive(),   // Price in USDT
  z.number().nonnegative(), // Quantity in base asset
  z.number().nonnegative(), // Notional in quote asset
]);

export type DepthTuple = z.infer<typeof DepthTupleSchema>;

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
