import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import net from 'node:net';
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
    vi.restoreAllMocks();
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

  it('counts JSON literals that are not an envelope (null, numbers, arrays) without throwing', async () => {
    const { ws } = await connected();
    ws.send('null');
    ws.send('42');
    ws.send('[]');
    await tick();
    expect(await metrics.getMetrics()).toMatch(/pulsecrypto_upstream_messages_invalid_total\{reason="envelope"\} 3/);
  });

  it('counts a throwing handler as invalid and keeps processing later frames', async () => {
    const got: number[] = [];
    const { connector: c, ws } = await connected();
    c.onTrade((_p, price) => {
      if (price === 1) throw new Error('boom');
      got.push(price);
    });
    ws.send(JSON.stringify({ stream: 'btcusdt@aggTrade', data: { p: '1', T: 1 } }));
    ws.send(JSON.stringify({ stream: 'btcusdt@aggTrade', data: { p: '2', T: 2 } }));
    await tick();
    expect(got).toEqual([2]);
    expect(await metrics.getMetrics()).toContain('pulsecrypto_upstream_messages_invalid_total{reason="handler"} 1');
  });

  it('keeps growing the backoff while the upstream accepts and then closes without valid data', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(1); // no jitter: each delay is the full cap
    const opens: number[] = [];
    server.on('connection', (ws) => {
      opens.push(Date.now());
      ws.send(JSON.stringify({ result: null, id: 1 })); // not a stream message: must not reset
      ws.close();
    });
    connector = new BinanceConnector({ wsBaseUrl: `ws://127.0.0.1:${port}`, metrics, reconnectInitialDelayMs: 25 });
    connector.connect();
    await vi.waitFor(() => expect(opens.length).toBeGreaterThanOrEqual(5), { timeout: 3000, interval: 20 });
    const gaps = opens.slice(1).map((t, i) => t - opens[i]);
    // Delays are 25, 50, 100, 200 ms; with a reset on open they would all stay at 25 ms.
    expect(gaps[3]).toBeGreaterThan(gaps[0] * 3);
    expect(gaps[3]).toBeGreaterThanOrEqual(190);
  });

  it('resets the backoff once the upstream delivers a message', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const opens: number[] = [];
    server.on('connection', (ws) => {
      opens.push(Date.now());
      // Flap three times, then deliver one valid stream message before closing.
      if (opens.length === 4) ws.send(JSON.stringify({ stream: 'btcusdt@aggTrade', data: { p: '1', T: 1 } }));
      setTimeout(() => ws.close(), 10);
    });
    connector = new BinanceConnector({ wsBaseUrl: `ws://127.0.0.1:${port}`, metrics, reconnectInitialDelayMs: 25 });
    connector.connect();
    await vi.waitFor(() => expect(opens.length).toBeGreaterThanOrEqual(5), { timeout: 3000, interval: 20 });
    const gaps = opens.slice(1).map((t, i) => t - opens[i]);
    // gaps[2] follows three silent closes (~100 ms delay); gaps[3] follows a message (back to ~25 ms).
    expect(gaps[3]).toBeLessThan(gaps[2]);
    expect(gaps[3]).toBeLessThan(90);
  });

  it('aborts a handshake the server never answers and tries again', async () => {
    // Accepts TCP but never answers the HTTP upgrade.
    const sockets: net.Socket[] = [];
    const silent = net.createServer((s) => void sockets.push(s));
    await new Promise<void>((resolve) => silent.listen(0, '127.0.0.1', () => resolve()));
    const silentPort = (silent.address() as net.AddressInfo).port;
    try {
      connector = new BinanceConnector({
        wsBaseUrl: `ws://127.0.0.1:${silentPort}`,
        metrics,
        handshakeTimeoutMs: 50,
        reconnectInitialDelayMs: 20,
      });
      connector.connect();
      await vi.waitFor(() => expect(sockets.length).toBeGreaterThanOrEqual(2), { timeout: 2000, interval: 20 });
    } finally {
      connector?.disconnect();
      connector = null;
      sockets.forEach((s) => s.destroy());
      await new Promise<void>((resolve) => silent.close(() => resolve()));
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
