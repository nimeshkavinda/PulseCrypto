import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import WebSocket from 'ws';
import { Frame, FrameSchema, ServerMessage } from '@pulsecrypto/shared';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { MetadataService } from '../src/metadata.js';
import { MetricsRegistry } from '../src/metrics.js';
import { OrderBookManager } from '../src/orderbook.js';
import { ChannelHub } from '../src/hub/ChannelHub.js';
import { InMemoryMarketSource, StatusTracker } from '../src/market/marketSource.js';

/** Minimal client that records every frame and lets tests await specific messages. */
class TestClient {
  readonly frames: Frame[] = [];
  private waiters: Array<() => void> = [];

  private constructor(readonly ws: WebSocket) {
    ws.on('message', (data) => {
      this.frames.push(FrameSchema.parse(JSON.parse(data.toString())));
      this.waiters.splice(0).forEach((w) => w());
    });
  }

  static async connect(url: string): Promise<TestClient> {
    const ws = new WebSocket(url);
    const client = new TestClient(ws);
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', reject);
    });
    return client;
  }

  send(msg: unknown): void {
    this.ws.send(JSON.stringify(msg));
  }

  messages(): ServerMessage[] {
    return this.frames.flatMap((f) => f.msgs);
  }

  async waitFor<T extends ServerMessage['type']>(
    type: T,
    predicate: (m: Extract<ServerMessage, { type: T }>) => boolean = () => true,
    timeoutMs = 2000
  ): Promise<Extract<ServerMessage, { type: T }>> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const found = this.messages().find(
        (m): m is Extract<ServerMessage, { type: T }> =>
          m.type === type && predicate(m as Extract<ServerMessage, { type: T }>)
      );
      if (found) return found;
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error(`Timed out waiting for "${type}"`);
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, remaining);
        this.waiters.push(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  }

  close(): void {
    this.ws.terminate();
  }
}

describe('WebSocket stream (Fastify + ws integration)', () => {
  let app: FastifyInstance;
  let hub: ChannelHub;
  let metadata: MetadataService;
  let books: OrderBookManager;
  let url: string;
  const clients: TestClient[] = [];

  beforeEach(async () => {
    const config = loadConfig({ NODE_ENV: 'test', FLUSH_INTERVAL_MS: '50' });
    const metrics = new MetricsRegistry();
    metadata = new MetadataService();
    books = new OrderBookManager();
    hub = new ChannelHub({
      source: new InMemoryMarketSource(metadata, books, new StatusTracker()),
      metrics,
      tickMs: config.FLUSH_INTERVAL_MS,
      softLimitBytes: config.WS_SOFT_LIMIT_BYTES,
      hardLimitBytes: config.WS_HARD_LIMIT_BYTES,
      lagGraceMs: config.WS_LAG_GRACE_MS,
    });
    app = await buildApp({ enableLogger: false, config, metadataService: metadata, metricsRegistry: metrics, hub });
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    url = `ws://127.0.0.1:${port}/ws`;
    hub.start();
  });

  afterEach(async () => {
    clients.splice(0).forEach((c) => c.close());
    hub.stop();
    await app.close();
  });

  async function client(): Promise<TestClient> {
    const c = await TestClient.connect(url);
    clients.push(c);
    return c;
  }

  it('greets new connections with hello and status', async () => {
    const c = await client();
    const hello = await c.waitFor('hello');
    expect(hello).toMatchObject({ protocol: 1, tickMs: 50, minCadenceMs: 50 });
    expect(hello.channels).toContain('tickers');
    expect(hello.channels).toContain('book:BTCUSDT');
    await c.waitFor('status', (s) => s.upstream === 'connecting');
  });

  it('streams tickers after subscribing, and nothing before', async () => {
    const c = await client();
    await c.waitFor('hello');
    metadata.updateTradePrice('BTCUSDT', 65000);
    await new Promise((r) => setTimeout(r, 150));
    expect(c.messages().some((m) => m.type === 'tickers')).toBe(false);

    c.send({ type: 'subscribe', channels: ['tickers'] });
    await c.waitFor('ack', (a) => a.action === 'subscribe');
    const tickers = await c.waitFor('tickers');
    expect(tickers.data).toEqual([expect.objectContaining({ pair: 'BTCUSDT', price: 65000 })]);

    metadata.updateTradePrice('BTCUSDT', 65001);
    await c.waitFor('tickers', (t) => t.data[0].price === 65001);
  });

  it('streams only the subscribed order book and stops after unsubscribe', async () => {
    const c = await client();
    books.updateDepth('ETHUSDT', [[3000, 2]], [[3001, 1]]);
    books.updateDepth('BTCUSDT', [[60000, 1]], [[60001, 1]]);

    c.send({ type: 'subscribe', channels: ['book:ETHUSDT'] });
    const book = await c.waitFor('book');
    expect(book).toMatchObject({ pair: 'ETHUSDT', buyPressure: 66.67, spread: 1 });
    expect(c.messages().some((m) => m.type === 'book' && m.pair === 'BTCUSDT')).toBe(false);

    c.send({ type: 'unsubscribe', channels: ['book:ETHUSDT'] });
    await c.waitFor('ack', (a) => a.action === 'unsubscribe');
    const booksBefore = c.messages().filter((m) => m.type === 'book').length;
    books.updateDepth('ETHUSDT', [[3000, 5]], [[3001, 1]]);
    await new Promise((r) => setTimeout(r, 150));
    expect(c.messages().filter((m) => m.type === 'book').length).toBe(booksBefore);
  });

  it('acknowledges cadence with the effective value', async () => {
    const c = await client();
    c.send({ type: 'setCadence', cadenceMs: 120 });
    const ack = await c.waitFor('ack', (a) => a.action === 'setCadence');
    expect(ack.cadenceMs).toBe(150);
  });

  it('answers ping with pong and rejects malformed input without disconnecting', async () => {
    const c = await client();
    c.send({ type: 'ping', id: 42 });
    const pong = await c.waitFor('pong');
    expect(pong.id).toBe(42);

    c.ws.send('not json');
    await c.waitFor('error', (e) => e.code === 'BAD_JSON');
    expect(c.ws.readyState).toBe(WebSocket.OPEN);
  });

  it('tracks connected clients', async () => {
    const a = await client();
    const b = await client();
    await a.waitFor('hello');
    await b.waitFor('hello');
    expect(hub.getConnectedClientCount()).toBe(2);
  });
});
