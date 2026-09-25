import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  Book,
  Frame,
  FrameSchema,
  SupportedPairSymbol,
  Ticker,
  CLOSE_SLOW_CONSUMER,
} from '@pulsecrypto/shared';
import { ChannelHub } from '../src/hub/ChannelHub.js';
import { MarketSource, VersionedStatus } from '../src/market/marketSource.js';
import { MetricsRegistry } from '../src/metrics.js';
import { HubSocket } from '../src/hub/ClientSession.js';

const OPEN = 1;
const CLOSED = 3;

class FakeSocket implements HubSocket {
  readyState = OPEN;
  bufferedAmount = 0;
  sent: string[] = [];
  closedWith: { code?: number; reason?: string } | null = null;
  terminated = false;
  private handlers: Record<string, Array<(...args: unknown[]) => void>> = {};

  pings = 0;
  send(data: string | Buffer): void {
    this.sent.push(typeof data === 'string' ? data : data.toString('utf8'));
  }
  ping(): void {
    this.pings++;
  }
  pong(): void {
    this.handlers['pong']?.forEach((fn) => fn());
  }
  close(code?: number, reason?: string): void {
    this.closedWith = { code, reason };
  }
  terminate(): void {
    this.terminated = true;
    this.readyState = CLOSED;
  }
  on(event: 'message', listener: (data: Buffer) => void): this;
  on(event: 'close' | 'error' | 'pong', listener: (...args: unknown[]) => void): this;
  on(event: string, listener: (...args: never[]) => void): this {
    (this.handlers[event] ??= []).push(listener as (...args: unknown[]) => void);
    return this;
  }
  emitClose(): void {
    this.readyState = CLOSED;
    this.handlers['close']?.forEach((fn) => fn());
  }
  receive(msg: unknown): void {
    const raw = typeof msg === 'string' ? msg : JSON.stringify(msg);
    this.handlers['message']?.forEach((fn) => fn(Buffer.from(raw)));
  }
  frames(): Frame[] {
    return this.sent.map((s) => FrameSchema.parse(JSON.parse(s)));
  }
  lastFrame(): Frame {
    return FrameSchema.parse(JSON.parse(this.sent[this.sent.length - 1]));
  }
  clear(): void {
    this.sent = [];
  }
}

class FakeSource implements MarketSource {
  tickers = new Map<SupportedPairSymbol, { version: number; ticker: Ticker }>();
  books = new Map<SupportedPairSymbol, { version: number; book: Book }>();
  status: VersionedStatus = { version: 1, status: { upstream: 'live', stalePairs: [], since: 1 } };

  setTicker(pair: SupportedPairSymbol, price: number): void {
    const version = (this.tickers.get(pair)?.version ?? 0) + 1;
    this.tickers.set(pair, {
      version,
      ticker: { pair, price, change24h: 1, high24h: price, low24h: price, volume24h: 10, updatedAt: 1000 + version, eventTs: null },
    });
  }
  setBook(pair: SupportedPairSymbol, bidQty = 1): void {
    const version = (this.books.get(pair)?.version ?? 0) + 1;
    this.books.set(pair, {
      version,
      book: {
        pair,
        updatedAt: 2000 + version,
        eventTs: null,
        spread: 1,
        spreadPct: 0.01,
        buyPressure: 50,
        sellPressure: 50,
        bids: [[100, bidQty, 100 * bidQty]],
        asks: [[101, 1, 101]],
      },
    });
  }
  getTickerVersion = (p: SupportedPairSymbol) => this.tickers.get(p)?.version ?? 0;
  getTicker = (p: SupportedPairSymbol) => this.tickers.get(p) ?? null;
  getBookVersion = (p: SupportedPairSymbol) => this.books.get(p)?.version ?? 0;
  getBook = (p: SupportedPairSymbol) => this.books.get(p) ?? null;
  getStatus = () => this.status;
}

const SOFT = 64 * 1024;
const HARD = 1024 * 1024;
const GRACE = 5000;

describe('ChannelHub', () => {
  let source: FakeSource;
  let metrics: MetricsRegistry;
  let hub: ChannelHub;
  let clock: number;

  beforeEach(() => {
    source = new FakeSource();
    metrics = new MetricsRegistry();
    clock = 1_700_000_000_000;
    hub = new ChannelHub({
      source,
      metrics,
      tickMs: 100,
      softLimitBytes: SOFT,
      hardLimitBytes: HARD,
      lagGraceMs: GRACE,
      now: () => clock,
    });
  });

  afterEach(() => {
    hub.stop();
    vi.restoreAllMocks();
  });

  function connect(): FakeSocket {
    const socket = new FakeSocket();
    hub.attach(socket);
    return socket;
  }

  function subscribed(channels: string[]): FakeSocket {
    const socket = connect();
    socket.receive({ type: 'subscribe', channels });
    socket.clear();
    return socket;
  }

  it('sends hello and the current status on connect', () => {
    const socket = connect();
    expect(socket.sent).toHaveLength(1);
    const [hello, status] = socket.lastFrame().msgs;
    expect(hello).toMatchObject({ type: 'hello', protocol: 1, tickMs: 100, minCadenceMs: 100 });
    expect(status).toMatchObject({ type: 'status', upstream: 'live' });
  });

  it('sends no market data to a client that has not subscribed', () => {
    source.setTicker('BTCUSDT', 100);
    source.setBook('BTCUSDT');
    const socket = connect();
    socket.clear();
    hub.tick();
    expect(socket.sent).toHaveLength(0);
  });

  it('acks a subscription and delivers the full current state on the next tick', () => {
    source.setTicker('BTCUSDT', 100);
    source.setTicker('ETHUSDT', 10);
    const socket = connect();
    socket.clear();

    socket.receive({ type: 'subscribe', channels: ['tickers'] });
    expect(socket.lastFrame().msgs[0]).toMatchObject({ type: 'ack', action: 'subscribe', channels: ['tickers'] });

    socket.clear();
    hub.tick();
    const msgs = socket.lastFrame().msgs;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].type).toBe('tickers');
    const pairs = msgs[0].type === 'tickers' ? msgs[0].data.map((t) => t.pair) : [];
    expect(pairs.sort()).toEqual(['BTCUSDT', 'ETHUSDT']);
  });

  it('never sends items that have no upstream data (version 0)', () => {
    source.setTicker('BTCUSDT', 100);
    const socket = subscribed(['tickers', 'book:BTCUSDT']);
    hub.tick();
    const msgs = socket.lastFrame().msgs;
    expect(msgs.map((m) => m.type)).toEqual(['tickers']);
  });

  it('sends nothing when nothing changed', () => {
    source.setTicker('BTCUSDT', 100);
    const socket = subscribed(['tickers']);
    hub.tick();
    socket.clear();
    hub.tick();
    hub.tick();
    expect(socket.sent).toHaveLength(0);
  });

  it('sends only the tickers that changed', () => {
    source.setTicker('BTCUSDT', 100);
    source.setTicker('ETHUSDT', 10);
    const socket = subscribed(['tickers']);
    hub.tick();
    socket.clear();

    source.setTicker('BTCUSDT', 101);
    hub.tick();
    const msg = socket.lastFrame().msgs[0];
    expect(msg.type === 'tickers' && msg.data.map((t) => [t.pair, t.price])).toEqual([['BTCUSDT', 101]]);
  });

  it('batches all changes for a client into a single frame per tick', () => {
    source.setTicker('BTCUSDT', 100);
    source.setBook('BTCUSDT');
    const socket = subscribed(['tickers', 'book:BTCUSDT']);
    hub.tick();
    expect(socket.sent).toHaveLength(1);
    expect(socket.lastFrame().msgs.map((m) => m.type)).toEqual(['tickers', 'book']);
  });

  it('delivers only the subscribed book pairs', () => {
    source.setBook('BTCUSDT');
    source.setBook('ETHUSDT');
    const socket = subscribed(['book:ETHUSDT']);
    hub.tick();
    const books = socket.lastFrame().msgs.filter((m) => m.type === 'book');
    expect(books.map((b) => (b.type === 'book' ? b.pair : null))).toEqual(['ETHUSDT']);
  });

  it('stops delivering a channel after unsubscribe', () => {
    source.setBook('ETHUSDT');
    const socket = subscribed(['book:ETHUSDT']);
    hub.tick();

    socket.receive({ type: 'unsubscribe', channels: ['book:ETHUSDT'] });
    expect(socket.lastFrame().msgs[0]).toMatchObject({ type: 'ack', action: 'unsubscribe', channels: [] });
    socket.clear();

    source.setBook('ETHUSDT', 5);
    hub.tick();
    expect(socket.sent).toHaveLength(0);
  });

  it('rounds cadence up to a multiple of the tick and throttles data frames accordingly', () => {
    source.setTicker('BTCUSDT', 100);
    const socket = subscribed(['tickers']);
    socket.receive({ type: 'setCadence', cadenceMs: 250 });
    expect(socket.lastFrame().msgs[0]).toMatchObject({ type: 'ack', action: 'setCadence', cadenceMs: 300 });
    socket.clear();

    const framesPerTick: number[] = [];
    for (let i = 0; i < 6; i++) {
      source.setTicker('BTCUSDT', 100 + i);
      const before = socket.sent.length;
      hub.tick();
      framesPerTick.push(socket.sent.length - before);
    }
    expect(framesPerTick).toEqual([1, 0, 0, 1, 0, 0]);
    // The frame after skipped ticks carries the latest state, not intermediate values.
    const msg = socket.lastFrame().msgs[0];
    expect(msg.type === 'tickers' && msg.data[0].price).toBe(103);
  });

  it('clamps cadence requests below the tick to the tick', () => {
    const socket = connect();
    socket.receive({ type: 'setCadence', cadenceMs: 10 });
    expect(socket.lastFrame().msgs[0]).toMatchObject({ type: 'ack', cadenceMs: 100 });
  });

  it('skips frames above the soft limit and recovers with the latest state', () => {
    source.setTicker('BTCUSDT', 100);
    const socket = subscribed(['tickers']);
    hub.tick();
    socket.clear();

    socket.bufferedAmount = SOFT + 1;
    source.setTicker('BTCUSDT', 101);
    hub.tick();
    source.setTicker('BTCUSDT', 102);
    hub.tick();
    expect(socket.sent).toHaveLength(0);

    socket.bufferedAmount = 0;
    hub.tick();
    expect(socket.sent).toHaveLength(1);
    const msg = socket.lastFrame().msgs[0];
    expect(msg.type === 'tickers' && msg.data[0].price).toBe(102);
  });

  it('counts dropped frames and lagging clients', async () => {
    source.setTicker('BTCUSDT', 100);
    const socket = subscribed(['tickers']);
    socket.bufferedAmount = SOFT + 1;
    hub.tick();
    const text = await metrics.getMetrics();
    expect(text).toContain('pulsecrypto_frames_dropped_total 1');
    expect(text).toContain('pulsecrypto_lagging_clients 1');
  });

  it('closes with 1013 when a client stays congested past the grace period', () => {
    vi.useFakeTimers();
    source.setTicker('BTCUSDT', 100);
    const socket = subscribed(['tickers']);
    socket.bufferedAmount = SOFT + 1;

    hub.tick();
    clock += GRACE;
    source.setTicker('BTCUSDT', 101);
    hub.tick();
    expect(socket.closedWith).toBeNull();

    clock += 1;
    source.setTicker('BTCUSDT', 102);
    hub.tick();
    expect(socket.closedWith).toEqual({ code: CLOSE_SLOW_CONSUMER, reason: 'slow consumer' });
    expect(hub.getConnectedClientCount()).toBe(0);

    vi.advanceTimersByTime(1000);
    expect(socket.terminated).toBe(true);
    vi.useRealTimers();
  });

  it('grace-closes a congested client even when it has nothing new to receive', () => {
    const socket = subscribed(['tickers']);
    socket.bufferedAmount = SOFT + 1;
    hub.tick();
    clock += GRACE + 1;
    hub.tick();
    expect(socket.closedWith?.code).toBe(CLOSE_SLOW_CONSUMER);
  });

  it('ignores inbound messages from a session already closed as a slow consumer', () => {
    const socket = subscribed(['tickers']);
    socket.bufferedAmount = HARD + 1;
    hub.tick();
    socket.bufferedAmount = 0;
    socket.clear();
    socket.receive({ type: 'ping', id: 1 });
    expect(socket.sent).toHaveLength(0);
  });

  it('never acknowledges a cadence above the advertised maximum', () => {
    const odd = new ChannelHub({
      source, metrics, tickMs: 300, softLimitBytes: SOFT, hardLimitBytes: HARD, lagGraceMs: GRACE, maxCadenceMs: 10_000, now: () => clock,
    });
    const socket = new FakeSocket();
    odd.attach(socket);
    socket.receive({ type: 'setCadence', cadenceMs: 60_000 });
    expect(socket.lastFrame().msgs[0]).toMatchObject({ type: 'ack', cadenceMs: 9900 });
  });

  it('closes immediately with 1013 above the hard limit', () => {
    const socket = subscribed(['tickers']);
    socket.bufferedAmount = HARD + 1;
    hub.tick();
    expect(socket.closedWith?.code).toBe(CLOSE_SLOW_CONSUMER);
    expect(hub.getConnectedClientCount()).toBe(0);
  });

  it('replies with a coded error for invalid JSON and schema violations, rate-limited per client', () => {
    const socket = connect();
    socket.clear();
    socket.receive('{not json');
    expect(socket.lastFrame().msgs[0]).toMatchObject({ type: 'error', code: 'BAD_JSON' });

    socket.receive({ type: 'subscribe', channels: 'tickers' });
    expect(socket.sent).toHaveLength(1); // rate-limited within the same second

    clock += 1000;
    socket.receive({ type: 'subscribe', channels: 'tickers' });
    expect(socket.lastFrame().msgs[0]).toMatchObject({ type: 'error', code: 'BAD_MESSAGE' });
    expect(socket.closedWith).toBeNull();
  });

  it('answers ping with a pong echoing the id', () => {
    const socket = connect();
    socket.receive({ type: 'ping', id: 7 });
    expect(socket.lastFrame().msgs[0]).toEqual({ type: 'pong', id: 7, serverTs: clock });
  });

  it('applies valid channels and reports unknown ones', () => {
    const socket = connect();
    socket.clear();
    socket.receive({ type: 'subscribe', channels: ['book:FOOUSDT', 'book:BTCUSDT'] });
    const msgs = socket.lastFrame().msgs;
    expect(msgs[0]).toMatchObject({ type: 'ack', channels: ['book:BTCUSDT'] });
    expect(msgs[1]).toMatchObject({ type: 'error', code: 'UNKNOWN_CHANNEL' });
  });

  it('pushes status changes to every client regardless of subscriptions', () => {
    const socket = connect();
    socket.clear();
    source.status = { version: 2, status: { upstream: 'down', stalePairs: [], since: 5 } };
    hub.tick();
    expect(socket.lastFrame().msgs[0]).toMatchObject({ type: 'status', upstream: 'down' });
  });

  it('shares one encoded frame across clients with identical pending state', () => {
    source.setTicker('BTCUSDT', 100);
    const raw: Array<string | Buffer> = [];
    const sockets = Array.from({ length: 3 }, () => {
      const s = subscribed(['tickers']);
      const orig = s.send.bind(s);
      s.send = (d: string | Buffer) => {
        raw.push(d);
        orig(d);
      };
      return s;
    });
    hub.tick();
    expect(raw).toHaveLength(3);
    expect(raw[0]).toBeInstanceOf(Buffer);
    expect(raw[1]).toBe(raw[0]);
    expect(raw[2]).toBe(raw[0]);
    expect(sockets[0].lastFrame().msgs[0].type).toBe('tickers');
  });

  it('builds distinct frames for clients whose pending state differs', () => {
    source.setTicker('BTCUSDT', 100);
    source.setBook('BTCUSDT');
    const a = subscribed(['tickers']);
    const b = subscribed(['tickers', 'book:BTCUSDT']);
    hub.tick();
    expect(a.lastFrame().msgs.map((m) => m.type)).toEqual(['tickers']);
    expect(b.lastFrame().msgs.map((m) => m.type)).toEqual(['tickers', 'book']);
  });

  it('gives each client its own pending status when their data would otherwise share a frame', () => {
    source.setTicker('BTCUSDT', 100);
    const early = subscribed(['tickers']); // saw status v1 in its hello
    source.status = { version: 2, status: { upstream: 'stale', stalePairs: ['BTCUSDT'], since: 5 } };
    const late = subscribed(['tickers']); // saw status v2 in its hello
    hub.tick();
    expect(early.lastFrame().msgs.map((m) => m.type)).toEqual(['status', 'tickers']);
    expect(early.lastFrame().msgs[0]).toMatchObject({ type: 'status', upstream: 'stale' });
    expect(late.lastFrame().msgs.map((m) => m.type)).toEqual(['tickers']);

    // Next status change: both are pending again and may share one frame.
    source.status = { version: 3, status: { upstream: 'live', stalePairs: [], since: 6 } };
    source.setTicker('BTCUSDT', 101);
    hub.tick();
    for (const s of [early, late]) {
      expect(s.lastFrame().msgs.map((m) => m.type)).toEqual(['status', 'tickers']);
      expect(s.lastFrame().msgs[0]).toMatchObject({ upstream: 'live' });
    }
  });

  it('resets the lagging-clients gauge when the last client leaves', async () => {
    source.setTicker('BTCUSDT', 100);
    const socket = subscribed(['tickers']);
    socket.bufferedAmount = SOFT + 1;
    hub.tick();
    expect(await metrics.getMetrics()).toContain('pulsecrypto_lagging_clients 1');
    socket.emitClose();
    expect(hub.getConnectedClientCount()).toBe(0);
    hub.tick();
    expect(await metrics.getMetrics()).toContain('pulsecrypto_lagging_clients 0');
  });

  describe('connection limits', () => {
    function limitedHub(extra: Partial<ConstructorParameters<typeof ChannelHub>[0]> = {}) {
      return new ChannelHub({
        source, metrics, tickMs: 100, softLimitBytes: SOFT, hardLimitBytes: HARD, lagGraceMs: GRACE, now: () => clock, ...extra,
      });
    }

    it('closes a client that floods messages past the burst with 1008', async () => {
      const h = limitedHub({ rateLimitBurst: 5, rateLimitPerSec: 1 });
      const socket = new FakeSocket();
      h.attach(socket);
      for (let i = 0; i < 6; i++) socket.receive({ type: 'ping', id: i });
      expect(socket.closedWith).toEqual({ code: 1008, reason: 'rate limit' });
      expect(h.getConnectedClientCount()).toBe(0);
      expect(await metrics.getMetrics()).toContain('pulsecrypto_rate_limit_disconnects_total 1');
    });

    it('never limits normal chatter (ping every 5 s plus occasional subscribes)', () => {
      const h = limitedHub({ rateLimitBurst: 20, rateLimitPerSec: 10 });
      const socket = new FakeSocket();
      h.attach(socket);
      for (let i = 0; i < 200; i++) {
        clock += 5000;
        socket.receive({ type: 'ping', id: i });
        if (i % 10 === 0) socket.receive({ type: 'subscribe', channels: ['tickers', 'book:BTCUSDT'] });
      }
      expect(socket.closedWith).toBeNull();
    });

    it('refills tokens over time so a paced client stays connected after a burst', () => {
      const h = limitedHub({ rateLimitBurst: 5, rateLimitPerSec: 10 });
      const socket = new FakeSocket();
      h.attach(socket);
      for (let i = 0; i < 5; i++) socket.receive({ type: 'ping' });
      clock += 200; // +2 tokens
      socket.receive({ type: 'ping' });
      socket.receive({ type: 'ping' });
      expect(socket.closedWith).toBeNull();
    });

    it('terminates clients that miss a heartbeat pong and keeps responsive ones', async () => {
      const h = limitedHub();
      const healthy = new FakeSocket();
      const halfOpen = new FakeSocket();
      h.attach(healthy);
      h.attach(halfOpen);

      h.heartbeat();
      expect(healthy.pings).toBe(1);
      expect(halfOpen.pings).toBe(1);
      healthy.pong();

      h.heartbeat();
      expect(halfOpen.terminated).toBe(true);
      expect(healthy.terminated).toBe(false);
      expect(healthy.pings).toBe(2);
      expect(h.getConnectedClientCount()).toBe(1);
      expect(await metrics.getMetrics()).toContain('pulsecrypto_heartbeat_timeouts_total 1');
    });

    it('reports capacity against maxConnections', () => {
      const h = limitedHub({ maxConnections: 2 });
      h.attach(new FakeSocket());
      expect(h.hasCapacity()).toBe(true);
      h.attach(new FakeSocket());
      expect(h.hasCapacity()).toBe(false);
    });
  });

  it('serializes each changed item once per tick regardless of client count', () => {
    source.setTicker('BTCUSDT', 100);
    const sockets = Array.from({ length: 1000 }, () => subscribed(['tickers']));
    hub.tick();
    source.setTicker('BTCUSDT', 101);

    const stringify = vi.spyOn(JSON, 'stringify');
    hub.tick();
    expect(stringify).toHaveBeenCalledTimes(1);
    for (const s of sockets) expect(s.sent).toHaveLength(2);
  });
});
