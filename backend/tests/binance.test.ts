import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocketServer, WebSocket } from 'ws';
import { SupportedPairSymbol } from '@pulsecrypto/shared';
import { BinanceConnector, buildStreamUrl } from '../src/binance.js';
import { MetricsRegistry } from '../src/metrics.js';
import { Ticker24h } from '../src/metadata.js';

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));

describe('BinanceConnector', () => {
  let server: WebSocketServer;
  let port: number;
  let connector: BinanceConnector | null = null;
  let metrics: MetricsRegistry;

  beforeEach(async () => {
    metrics = new MetricsRegistry();
    server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
    await new Promise<void>((resolve) => server.on('listening', () => resolve()));
    const addr = server.address();
    port = typeof addr === 'object' && addr ? addr.port : 0;
  });

  afterEach(async () => {
    connector?.disconnect();
    connector = null;
    for (const c of server.clients) c.terminate();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  async function connected(options: ConstructorParameters<typeof BinanceConnector>[0] = {}) {
    connector = new BinanceConnector({ wsBaseUrl: `ws://127.0.0.1:${port}`, metrics, reconnectInitialDelayMs: 20, ...options });
    const upstream = new Promise<{ ws: WebSocket; path: string }>((resolve) =>
      server.once('connection', (ws, req) => resolve({ ws, path: req.url ?? '' }))
    );
    connector.connect();
    return { connector, ...(await upstream) };
  }

  it('builds the combined stream URL for supported pairs only', () => {
    const url = buildStreamUrl('wss://data-stream.binance.vision/', ['BTCUSDT', 'ETHUSDT']);
    expect(url).toBe(
      'wss://data-stream.binance.vision/stream?streams=btcusdt@depth20@100ms/btcusdt@aggTrade/btcusdt@ticker/ethusdt@depth20@100ms/ethusdt@aggTrade/ethusdt@ticker'
    );
    expect(url).not.toContain('miniTicker');
  });

  it('requests the combined stream path on connect', async () => {
    const { path } = await connected({ pairs: ['SOLUSDT'] });
    expect(path).toBe('/stream?streams=solusdt@depth20@100ms/solusdt@aggTrade/solusdt@ticker');
  });

  it('parses depth20 snapshots', async () => {
    const got: Array<[SupportedPairSymbol, [number, number][], [number, number][]]> = [];
    const { connector: c, ws } = await connected();
    c.onDepth((p, b, a) => got.push([p, b, a]));
    ws.send(JSON.stringify({ stream: 'btcusdt@depth20@100ms', data: { lastUpdateId: 1, bids: [['64000.5', '1.5']], asks: [['64010', '0.8']] } }));
    await tick();
    expect(got).toEqual([['BTCUSDT', [[64000.5, 1.5]], [[64010, 0.8]]]]);
  });

  it('parses aggTrade price and trade time', async () => {
    const got: Array<[SupportedPairSymbol, number, number]> = [];
    const { connector: c, ws } = await connected();
    c.onTrade((p, price, ts) => got.push([p, price, ts]));
    ws.send(JSON.stringify({ stream: 'ethusdt@aggTrade', data: { e: 'aggTrade', E: 1700000000100, s: 'ETHUSDT', p: '3500.12', q: '1', T: 1700000000099, m: false } }));
    await tick();
    expect(got).toEqual([['ETHUSDT', 3500.12, 1700000000099]]);
  });

  it('parses 24h ticker statistics with event time', async () => {
    const got: Array<[SupportedPairSymbol, Ticker24h]> = [];
    const { connector: c, ws } = await connected();
    c.onTicker((p, t) => got.push([p, t]));
    ws.send(JSON.stringify({ stream: 'dogeusdt@ticker', data: { e: '24hrTicker', E: 1700000000500, s: 'DOGEUSDT', c: '0.101', h: '0.104', l: '0.099', v: '5000', P: '-1.25' } }));
    await tick();
    expect(got).toEqual([
      ['DOGEUSDT', { lastPrice: 0.101, high24h: 0.104, low24h: 0.099, volume24h: 5000, changePct: -1.25, eventTs: 1700000000500 }],
    ]);
  });

  it('ignores and counts malformed, unknown and unsupported messages without throwing', async () => {
    let calls = 0;
    const { connector: c, ws } = await connected();
    c.onDepth(() => calls++).onTrade(() => calls++).onTicker(() => calls++);
    ws.send('not json');
    ws.send(JSON.stringify({ result: null, id: 1 }));
    ws.send(JSON.stringify({ stream: 'fooUSDT@aggTrade', data: { p: '1', T: 1 } }));
    ws.send(JSON.stringify({ stream: 'btcusdt@aggTrade', data: { p: 'abc', T: 1 } }));
    ws.send(JSON.stringify({ stream: 'btcusdt@depth20@100ms', data: { bids: [['1', 'x']], asks: [] } }));
    ws.send(JSON.stringify({ stream: 'btcusdt@ticker', data: { c: '1', h: '1', l: '1', v: '1', P: 'n/a', E: 1 } }));
    ws.send(JSON.stringify({ stream: 'btcusdt@kline_1m', data: {} }));
    await tick();
    expect(calls).toBe(0);
    const text = await metrics.getMetrics();
    for (const reason of ['json', 'envelope', 'symbol', 'aggTrade', 'depth', 'ticker', 'stream']) {
      expect(text).toContain(`pulsecrypto_upstream_messages_invalid_total{reason="${reason}"}`);
    }
  });

  it('reports status and reconnects after an unexpected close', async () => {
    const statuses: boolean[] = [];
    const { connector: c, ws } = await connected();
    c.onStatus((s) => statuses.push(s));
    const reconnected = new Promise<void>((resolve) => server.once('connection', () => resolve()));
    ws.terminate();
    await reconnected;
    await tick();
    // The first `true` may or may not be observed depending on open/connection event ordering.
    expect(statuses.slice(-2)).toEqual([false, true]);
  });

  it('terminates the socket and does not reconnect after disconnect()', async () => {
    const { connector: c, ws } = await connected();
    const closed = new Promise<void>((resolve) => ws.once('close', () => resolve()));
    let reconnects = 0;
    server.on('connection', () => reconnects++);
    c.disconnect();
    await closed;
    await tick(100);
    expect(c.isConnected()).toBe(false);
    expect(reconnects).toBe(0);
  });

  it('terminates an idle upstream and reconnects', async () => {
    const { ws } = await connected({ idleTimeoutMs: 300 });
    const closed = new Promise<void>((resolve) => ws.once('close', () => resolve()));
    const reconnected = new Promise<void>((resolve) => server.once('connection', () => resolve()));
    await closed;
    await reconnected;
  });
});
