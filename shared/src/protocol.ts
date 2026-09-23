import { z } from 'zod';
import { SUPPORTED_PAIRS, SupportedPairSymbol, SupportedPairSymbolSchema, DepthTupleSchema } from './schemas.js';

/**
 * PulseCrypto gateway wire protocol, version 1.
 * Full specification with examples: docs/protocol.md
 */
export const PROTOCOL_VERSION = 1 as const;

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

/** All tickers (price + 24h stats) for every supported pair. Lightweight; used by the watchlist. */
export const TICKERS_CHANNEL = 'tickers' as const;
/** Gateway/upstream health. Delivered to every connected client without subscription. */
export const STATUS_CHANNEL = 'status' as const;

export type BookChannel = `book:${SupportedPairSymbol}`;
export type Channel = typeof TICKERS_CHANNEL | BookChannel;

export function bookChannel(pair: SupportedPairSymbol): BookChannel {
  return `book:${pair}`;
}

export type ParsedChannel =
  | { kind: 'tickers' }
  | { kind: 'book'; pair: SupportedPairSymbol };

/** Parses a channel name; returns null for unknown channels. */
export function parseChannel(channel: string): ParsedChannel | null {
  if (channel === TICKERS_CHANNEL) return { kind: 'tickers' };
  if (channel.startsWith('book:')) {
    const pair = channel.slice(5);
    if (Object.prototype.hasOwnProperty.call(SUPPORTED_PAIRS, pair)) {
      return { kind: 'book', pair: pair as SupportedPairSymbol };
    }
  }
  return null;
}

export const ALL_CHANNELS: Channel[] = [
  TICKERS_CHANNEL,
  ...(Object.keys(SUPPORTED_PAIRS) as SupportedPairSymbol[]).map(bookChannel),
];

// ---------------------------------------------------------------------------
// Client -> server messages (validated with Zod at the gateway boundary)
// ---------------------------------------------------------------------------

const ChannelListSchema = z.array(z.string().min(1).max(32)).min(1).max(16);

export const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('subscribe'), channels: ChannelListSchema }),
  z.object({ type: z.literal('unsubscribe'), channels: ChannelListSchema }),
  z.object({ type: z.literal('setCadence'), cadenceMs: z.number().int().min(1).max(60_000) }),
  z.object({ type: z.literal('ping'), id: z.number().int().nonnegative().optional() }),
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

// ---------------------------------------------------------------------------
// Server -> client messages
// ---------------------------------------------------------------------------

export const UpstreamStatusSchema = z.enum(['connecting', 'live', 'stale', 'down']);
export type UpstreamStatus = z.infer<typeof UpstreamStatusSchema>;

export const TickerSchema = z.object({
  pair: SupportedPairSymbolSchema,
  price: z.number().positive(),
  change24h: z.number(),
  high24h: z.number().nonnegative(),
  low24h: z.number().nonnegative(),
  volume24h: z.number().nonnegative(),
  /** Gateway receive time of the latest update for this item (epoch ms). */
  updatedAt: z.number().int().positive(),
  /** Exchange event time when the upstream provides one (epoch ms), otherwise null. */
  eventTs: z.number().int().positive().nullable(),
});
export type Ticker = z.infer<typeof TickerSchema>;

export const BookSchema = z.object({
  pair: SupportedPairSymbolSchema,
  updatedAt: z.number().int().positive(),
  eventTs: z.number().int().positive().nullable(),
  spread: z.number().nonnegative(),
  spreadPct: z.number().nonnegative(),
  /** Share of base-asset quantity on the bid side across all levels sent (0..100). */
  buyPressure: z.number().min(0).max(100),
  sellPressure: z.number().min(0).max(100),
  /** [price, quantity, notional (price * quantity)], best level first, at most 20. */
  bids: z.array(DepthTupleSchema).max(20),
  asks: z.array(DepthTupleSchema).max(20),
});
export type Book = z.infer<typeof BookSchema>;

export const ErrorCodeSchema = z.enum(['BAD_JSON', 'BAD_MESSAGE', 'UNKNOWN_CHANNEL']);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ServerMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('hello'),
    protocol: z.literal(PROTOCOL_VERSION),
    tickMs: z.number().int().positive(),
    minCadenceMs: z.number().int().positive(),
    maxCadenceMs: z.number().int().positive(),
    pairs: z.array(SupportedPairSymbolSchema),
    channels: z.array(z.string()),
  }),
  z.object({
    type: z.literal('status'),
    upstream: UpstreamStatusSchema,
    /** Pairs whose data has not been refreshed recently (populated by the upstream monitor). */
    stalePairs: z.array(SupportedPairSymbolSchema),
    since: z.number().int().positive(),
  }),
  z.object({ type: z.literal('tickers'), data: z.array(TickerSchema).min(1) }),
  BookSchema.extend({ type: z.literal('book') }),
  z.object({
    type: z.literal('ack'),
    action: z.enum(['subscribe', 'unsubscribe', 'setCadence']),
    channels: z.array(z.string()).optional(),
    cadenceMs: z.number().int().positive().optional(),
  }),
  z.object({ type: z.literal('pong'), id: z.number().int().nonnegative().optional(), serverTs: z.number().int().positive() }),
  z.object({ type: z.literal('error'), code: ErrorCodeSchema, message: z.string() }),
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
export type ServerMessageOf<T extends ServerMessage['type']> = Extract<ServerMessage, { type: T }>;

/**
 * Every server WebSocket frame. `tick` is the gateway's global tick counter:
 * gaps are expected (nothing changed, or the frame was conflated away for this client).
 */
export const FrameSchema = z.object({
  v: z.literal(PROTOCOL_VERSION),
  tick: z.number().int().nonnegative(),
  ts: z.number().int().positive(),
  msgs: z.array(ServerMessageSchema).min(1),
});
export type Frame = z.infer<typeof FrameSchema>;

/** Close code sent to consumers that cannot keep up (RFC 6455: "Try Again Later"). */
export const CLOSE_SLOW_CONSUMER = 1013 as const;
