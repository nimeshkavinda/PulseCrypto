import { z } from 'zod';

/**
 * DepthTuple represents a single price level in the order book:
 * [price, quantity, cumulativeTotal]
 */
export const DepthTupleSchema = z.tuple([
  z.number(), // Price (USDT)
  z.number(), // Quantity (Base asset)
  z.number(), // Cumulative Total (Volume * Price)
]);

export type DepthTuple = z.infer<typeof DepthTupleSchema>;

/**
 * MarketUpdatePayload represents the real-time WebSocket market broadcast.
 * Directly satisfies assignment requirement Part 1, Section 3.
 */
export const MarketUpdatePayloadSchema = z.object({
  pair: z.string(),
  timestamp: z.number(),
  price: z.number(),
  change24h: z.number(),
  high24h: z.number(),
  low24h: z.number(),
  volume24h: z.number(),
  spread: z.number(),
  spreadPct: z.number(),
  buyPressure: z.number(),
  sellPressure: z.number(),
  bids: z.array(DepthTupleSchema),
  asks: z.array(DepthTupleSchema),
});

export type MarketUpdatePayload = z.infer<typeof MarketUpdatePayloadSchema>;

/**
 * PairMetadata represents the REST response from GET /pairs/meta.
 * Directly satisfies assignment requirement Part 1, Section 4.
 */
export const PairMetadataSchema = z.object({
  symbol: z.string(),
  displayName: z.string(),
  baseAsset: z.string(),
  quoteAsset: z.string(),
  tradingStatus: z.enum(['TRADING', 'HALTED', 'MAINTENANCE']),
  priceDecimals: z.number(),
  qtyDecimals: z.number(),
  high24h: z.number(),
  low24h: z.number(),
  volume24h: z.number(),
  lastPrice: z.number(),
  change24h: z.number(),
});

export type PairMetadata = z.infer<typeof PairMetadataSchema>;

/**
 * ClientCommand represents bidirectional commands sent from client to server.
 */
export const ClientCommandSchema = z.object({
  action: z.enum(['setThrottle', 'subscribe', 'unsubscribe', 'ping']),
  intervalMs: z.number().min(10).max(2000).optional(),
  pairs: z.array(z.string()).optional(),
});

export type ClientCommand = z.infer<typeof ClientCommandSchema>;

/**
 * Supported trading pairs specification
 */
export interface SupportedPairConfig {
  displayName: string;
  baseAsset: string;
  quoteAsset: string;
  priceDecimals: number;
  qtyDecimals: number;
}

export const SUPPORTED_PAIRS: Record<string, SupportedPairConfig> = {
  BTCUSDT: { displayName: 'BTC / USDT', baseAsset: 'BTC', quoteAsset: 'USDT', priceDecimals: 2, qtyDecimals: 5 },
  ETHUSDT: { displayName: 'ETH / USDT', baseAsset: 'ETH', quoteAsset: 'USDT', priceDecimals: 2, qtyDecimals: 4 },
  SOLUSDT: { displayName: 'SOL / USDT', baseAsset: 'SOL', quoteAsset: 'USDT', priceDecimals: 2, qtyDecimals: 3 },
  DOGEUSDT: { displayName: 'DOGE / USDT', baseAsset: 'DOGE', quoteAsset: 'USDT', priceDecimals: 5, qtyDecimals: 1 },
  XRPUSDT: { displayName: 'XRP / USDT', baseAsset: 'XRP', quoteAsset: 'USDT', priceDecimals: 4, qtyDecimals: 2 },
};
