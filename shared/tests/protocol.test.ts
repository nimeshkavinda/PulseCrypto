import { describe, it, expect } from 'vitest';
import {
  ALL_CHANNELS,
  ClientMessageSchema,
  FrameSchema,
  PROTOCOL_VERSION,
  ServerMessageSchema,
  bookChannel,
  parseChannel,
} from '../src/index.js';

describe('protocol v1 channels', () => {
  it('parses tickers and supported book channels', () => {
    expect(parseChannel('tickers')).toEqual({ kind: 'tickers' });
    expect(parseChannel('book:BTCUSDT')).toEqual({ kind: 'book', pair: 'BTCUSDT' });
    expect(bookChannel('SOLUSDT')).toBe('book:SOLUSDT');
  });

  it('rejects unknown channels and prototype keys', () => {
    expect(parseChannel('book:FOOUSDT')).toBeNull();
    expect(parseChannel('book:toString')).toBeNull();
    expect(parseChannel('book:')).toBeNull();
    expect(parseChannel('status')).toBeNull();
  });

  it('lists tickers plus one book channel per supported pair', () => {
    expect(ALL_CHANNELS).toEqual(['tickers', 'book:BTCUSDT', 'book:ETHUSDT', 'book:SOLUSDT', 'book:DOGEUSDT', 'book:XRPUSDT']);
  });
});

describe('protocol v1 client messages', () => {
  it.each([
    { type: 'subscribe', channels: ['tickers', 'book:BTCUSDT'] },
    { type: 'unsubscribe', channels: ['book:BTCUSDT'] },
    { type: 'setCadence', cadenceMs: 250 },
    { type: 'ping' },
    { type: 'ping', id: 3 },
  ])('accepts %o', (msg) => {
    expect(ClientMessageSchema.safeParse(msg).success).toBe(true);
  });

  it.each([
    { type: 'subscribe', channels: [] },
    { type: 'subscribe', channels: 'tickers' },
    { type: 'subscribe', channels: Array.from({ length: 17 }, () => 'tickers') },
    { type: 'setCadence', cadenceMs: 0 },
    { type: 'setCadence', cadenceMs: 12.5 },
    { type: 'ping', id: -1 },
    { type: 'setThrottle', intervalMs: 100 },
  ])('rejects %o', (msg) => {
    expect(ClientMessageSchema.safeParse(msg).success).toBe(false);
  });
});

describe('protocol v1 server messages', () => {
  const ticker = {
    pair: 'BTCUSDT',
    price: 64238.17,
    change24h: 2.45,
    high24h: 65120,
    low24h: 62800,
    volume24h: 28410.5,
    updatedAt: 1727071234501,
    eventTs: null,
  };
  const book = {
    type: 'book',
    pair: 'BTCUSDT',
    updatedAt: 1727071234490,
    eventTs: 1727071234488,
    spread: 0.01,
    spreadPct: 0.0000156,
    buyPressure: 58.2,
    sellPressure: 41.8,
    bids: [[64238.16, 0.4522, 29048.4]],
    asks: [[64238.17, 0.112, 7194.67]],
  };

  it('validates a documented example frame', () => {
    const frame = { v: PROTOCOL_VERSION, tick: 1842, ts: 1727071234567, msgs: [{ type: 'tickers', data: [ticker] }, book] };
    expect(FrameSchema.safeParse(frame).success).toBe(true);
  });

  it('rejects frames with the wrong version or no messages', () => {
    expect(FrameSchema.safeParse({ v: 2, tick: 1, ts: 1, msgs: [{ type: 'pong', serverTs: 1 }] }).success).toBe(false);
    expect(FrameSchema.safeParse({ v: 1, tick: 1, ts: 1, msgs: [] }).success).toBe(false);
  });

  it('rejects books deeper than 20 levels and pressures outside 0..100', () => {
    const deep = { ...book, bids: Array.from({ length: 21 }, () => [1, 1, 1]) };
    expect(ServerMessageSchema.safeParse(deep).success).toBe(false);
    expect(ServerMessageSchema.safeParse({ ...book, buyPressure: 101 }).success).toBe(false);
  });

  it('accepts every control message shape', () => {
    for (const msg of [
      { type: 'hello', protocol: 1, tickMs: 100, minCadenceMs: 100, maxCadenceMs: 10000, pairs: ['BTCUSDT'], channels: ['tickers'] },
      { type: 'status', upstream: 'live', stalePairs: [], since: 1 },
      { type: 'ack', action: 'setCadence', cadenceMs: 300 },
      { type: 'pong', id: 1, serverTs: 1 },
      { type: 'error', code: 'UNKNOWN_CHANNEL', message: 'x' },
    ]) {
      expect(ServerMessageSchema.safeParse(msg).success).toBe(true);
    }
  });
});
