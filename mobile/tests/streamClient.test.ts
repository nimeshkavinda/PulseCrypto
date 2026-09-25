import { ServerMessage } from '@pulsecrypto/shared';
import { MarketStreamClient, SocketLike, StreamClientDeps, parseFrame } from '../src/data/stream/MarketStreamClient';
import { ticker } from './fixtures';

class FakeSocket implements SocketLike {
  readyState = 0;
  sent: Array<Record<string, unknown>> = [];
  closedWith: number | null = null;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: ((e: { code: number; reason?: string }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;

  constructor(public readonly url: string) {}
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close(code?: number) {
    this.closedWith = code ?? 1000;
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  frame(msgs: unknown[]) {
    this.onmessage?.({ data: JSON.stringify({ v: 1, tick: 1, ts: Date.now(), msgs }) });
  }
  raw(data: unknown) {
    this.onmessage?.({ data });
  }
  drop(code = 1006) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
  sentOfType(type: string) {
    return this.sent.filter((m) => m.type === type);
  }
}

function setup(opts: { online?: boolean; active?: boolean; random?: number } = {}) {
  const sockets: FakeSocket[] = [];
  let setOnline: (v: boolean) => void = () => undefined;
  let setActive: (v: boolean) => void = () => undefined;
  const deps: StreamClientDeps = {
    createSocket: (url) => {
      const s = new FakeSocket(url);
      sockets.push(s);
      return s;
    },
    subscribeNetwork: (cb) => {
      setOnline = cb;
      cb(opts.online ?? true);
      return () => undefined;
    },
    subscribeAppState: (cb) => {
      setActive = cb;
      cb(opts.active ?? true);
      return () => undefined;
    },
    scheduler: {
      now: () => Date.now(),
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
      setInterval: (fn, ms) => setInterval(fn, ms),
      clearInterval: (h) => clearInterval(h as ReturnType<typeof setInterval>),
    },
    random: () => opts.random ?? 1,
  };
  const client = new MarketStreamClient({ url: 'ws://gw/ws' }, deps);
  return {
    client,
    sockets,
    last: () => sockets[sockets.length - 1],
    online: (v: boolean) => setOnline(v),
    active: (v: boolean) => setActive(v),
  };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('MarketStreamClient lifecycle', () => {
  it('connects on start and subscribes to the desired channels once open', () => {
    const t = setup();
    t.client.setChannels(['tickers', 'book:BTCUSDT']);
    t.client.start();
    expect(t.client.getConnection().state).toBe('connecting');
    expect(t.last().url).toBe('ws://gw/ws');

    t.last().open();
    expect(t.client.getConnection().state).toBe('open');
    expect(t.last().sentOfType('subscribe')).toEqual([{ type: 'subscribe', channels: ['tickers', 'book:BTCUSDT'] }]);
  });

  it('sends a preferred cadence on open, and nothing when the gateway default is wanted', () => {
    const t = setup();
    t.client.setCadence(500);
    t.client.start();
    t.last().open();
    expect(t.last().sentOfType('setCadence')).toEqual([{ type: 'setCadence', cadenceMs: 500 }]);

    const u = setup();
    u.client.start();
    u.last().open();
    expect(u.last().sentOfType('setCadence')).toEqual([]);
  });

  it('stays offline without opening sockets or spending attempts when the network is down', () => {
    const t = setup({ online: false });
    t.client.start();
    expect(t.client.getConnection()).toMatchObject({ state: 'offline', attempt: 0 });
    jest.advanceTimersByTime(60_000);
    expect(t.sockets).toHaveLength(0);
  });

  it('backs off with capped full-jitter delays after unexpected closes', () => {
    const t = setup({ random: 1 });
    t.client.start();
    const delays: number[] = [];
    for (let i = 0; i < 7; i++) {
      t.last().drop();
      const c = t.client.getConnection();
      expect(c.state).toBe('backoff');
      delays.push(c.nextRetryAt! - Date.now());
      jest.advanceTimersByTime(c.nextRetryAt! - Date.now());
      expect(t.client.getConnection().state).toBe('connecting');
    }
    expect(delays).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
    expect(t.client.getConnection().attempt).toBe(7);
  });

  it('never schedules a retry sooner than 250 ms even with zero jitter', () => {
    const t = setup({ random: 0 });
    t.client.start();
    t.last().drop();
    expect(t.client.getConnection().nextRetryAt! - Date.now()).toBe(250);
  });

  it('resets attempts on the first market data message, not on open or control messages', () => {
    const t = setup();
    t.client.start();
    t.last().drop();
    jest.advanceTimersByTime(1000);
    t.last().open();
    expect(t.client.getConnection()).toMatchObject({ state: 'open', attempt: 1 });
    t.last().frame([{ type: 'status', upstream: 'live', stalePairs: [], since: 1 }]);
    t.last().raw('garbage');
    expect(t.client.getConnection()).toMatchObject({ state: 'open', attempt: 1 });
    t.last().frame([{ type: 'tickers', data: [ticker('BTCUSDT', 64000)] }]);
    expect(t.client.getConnection()).toMatchObject({ state: 'open', attempt: 0 });
  });

  it('keeps growing the backoff when the gateway sends hello + status and then closes', () => {
    const t = setup({ random: 1 });
    t.client.start();
    const delays: number[] = [];
    for (let i = 0; i < 4; i++) {
      t.last().open();
      t.last().frame([
        { type: 'hello', protocol: 1, tickMs: 100, minCadenceMs: 100, maxCadenceMs: 10000, pairs: [], channels: [] },
        { type: 'status', upstream: 'connecting', stalePairs: [], since: 1 },
      ]);
      t.last().drop();
      const c = t.client.getConnection();
      delays.push(c.nextRetryAt! - Date.now());
      jest.advanceTimersByTime(c.nextRetryAt! - Date.now());
    }
    expect(delays).toEqual([1000, 2000, 4000, 8000]);
  });

  it('keeps growing the backoff when the gateway accepts and then closes without a frame', () => {
    const t = setup({ random: 1 });
    t.client.start();
    const delays: number[] = [];
    for (let i = 0; i < 4; i++) {
      t.last().open();
      t.last().drop();
      const c = t.client.getConnection();
      delays.push(c.nextRetryAt! - Date.now());
      jest.advanceTimersByTime(c.nextRetryAt! - Date.now());
    }
    expect(delays).toEqual([1000, 2000, 4000, 8000]);
  });

  it('gives up on a socket stuck connecting after the connect timeout and backs off', () => {
    const t = setup({ random: 1 });
    t.client.start();
    jest.advanceTimersByTime(9_999);
    expect(t.client.getConnection().state).toBe('connecting');
    jest.advanceTimersByTime(1);
    expect(t.sockets[0].closedWith).toBe(1000);
    expect(t.client.getConnection()).toMatchObject({ state: 'backoff', attempt: 1 });
    jest.advanceTimersByTime(1000);
    expect(t.sockets).toHaveLength(2);
  });

  it('does not time out a socket that opened', () => {
    const t = setup();
    t.client.start();
    t.last().open();
    t.last().frame([{ type: 'pong', serverTs: 1 }]);
    jest.advanceTimersByTime(10_000);
    t.last().frame([{ type: 'pong', serverTs: 1 }]);
    expect(t.client.getConnection().state).toBe('open');
    expect(t.sockets).toHaveLength(1);
  });

  it('goes offline during backoff and reconnects immediately when the network returns', () => {
    const t = setup();
    t.client.start();
    t.last().drop();
    t.last().drop(); // stale socket events are ignored
    expect(t.client.getConnection().state).toBe('backoff');

    t.online(false);
    expect(t.client.getConnection().state).toBe('offline');
    jest.advanceTimersByTime(60_000);
    expect(t.sockets).toHaveLength(1);

    t.online(true);
    expect(t.sockets).toHaveLength(2);
    expect(t.client.getConnection()).toMatchObject({ state: 'connecting', attempt: 0 });
  });

  it('keeps an open socket through a brief network blip', () => {
    const t = setup();
    t.client.start();
    t.last().open();
    t.online(false);
    expect(t.client.getConnection().state).toBe('open');
    expect(t.last().closedWith).toBeNull();
  });

  it('pauses on background (closing with 1000) and reconnects immediately on foreground', () => {
    const t = setup();
    t.client.start();
    t.last().open();
    t.active(false);
    expect(t.client.getConnection().state).toBe('paused');
    expect(t.sockets[0].closedWith).toBe(1000);

    jest.advanceTimersByTime(120_000);
    expect(t.sockets).toHaveLength(1);

    t.active(true);
    expect(t.sockets).toHaveLength(2);
    expect(t.client.getConnection().state).toBe('connecting');
  });

  it('treats a 1013 slow-consumer close as a normal reconnect', () => {
    const t = setup();
    t.client.start();
    t.last().open();
    t.last().drop(1013);
    expect(t.client.getConnection()).toMatchObject({ state: 'backoff', lastCloseCode: 1013 });
  });

  it('closes a silent connection after the idle timeout and reconnects', () => {
    const t = setup();
    t.client.start();
    t.last().open();
    jest.advanceTimersByTime(10_000);
    expect(t.last().sentOfType('ping').length).toBeGreaterThanOrEqual(2);
    expect(t.client.getConnection().state).toBe('open');

    jest.advanceTimersByTime(5_000);
    expect(t.sockets[0].closedWith).toBe(4000);
    expect(t.client.getConnection()).toMatchObject({ state: 'backoff', lastCloseCode: 4000 });
  });

  it('stays open while messages keep arriving', () => {
    const t = setup();
    t.client.start();
    t.last().open();
    for (let i = 0; i < 10; i++) {
      jest.advanceTimersByTime(4000);
      t.last().frame([{ type: 'pong', serverTs: Date.now() }]);
    }
    expect(t.client.getConnection().state).toBe('open');
  });

  it('reconnects to a new URL immediately', () => {
    const t = setup();
    t.client.start();
    t.last().open();
    t.client.setUrl('ws://other/ws');
    expect(t.sockets[0].closedWith).toBe(1000);
    expect(t.last().url).toBe('ws://other/ws');
  });

  it('stop() closes the socket and cancels retries', () => {
    const t = setup();
    t.client.start();
    t.last().drop();
    t.client.stop();
    jest.advanceTimersByTime(60_000);
    expect(t.sockets).toHaveLength(1);
    expect(t.client.getConnection().state).toBe('idle');
  });
});

describe('MarketStreamClient subscriptions and messages', () => {
  it('sends only the channel diff while open, and the full set after a reconnect', () => {
    const t = setup();
    t.client.setChannels(['tickers']);
    t.client.start();
    t.last().open();

    t.client.setChannels(['tickers', 'book:ETHUSDT']);
    expect(t.last().sent.slice(-1)).toEqual([{ type: 'subscribe', channels: ['book:ETHUSDT'] }]);

    t.client.setChannels(['tickers', 'book:BTCUSDT']);
    expect(t.last().sent.slice(-2)).toEqual([
      { type: 'unsubscribe', channels: ['book:ETHUSDT'] },
      { type: 'subscribe', channels: ['book:BTCUSDT'] },
    ]);

    t.last().drop();
    jest.advanceTimersByTime(1000);
    t.last().open();
    expect(t.last().sentOfType('subscribe')).toEqual([{ type: 'subscribe', channels: ['tickers', 'book:BTCUSDT'] }]);
  });

  it('delivers parsed messages and records gateway parameters, RTT and acknowledged cadence', () => {
    const t = setup();
    const received: ServerMessage[] = [];
    t.client.onMessages((m) => received.push(...m));
    t.client.start();
    t.last().open();

    t.last().frame([{ type: 'hello', protocol: 1, tickMs: 100, minCadenceMs: 100, maxCadenceMs: 10000, pairs: [], channels: [] }]);
    expect(t.client.getConnection()).toMatchObject({ tickMs: 100, minCadenceMs: 100, maxCadenceMs: 10000 });

    jest.advanceTimersByTime(5000);
    const ping = t.last().sentOfType('ping')[0] as { id: number };
    jest.advanceTimersByTime(42);
    t.last().frame([{ type: 'pong', id: ping.id, serverTs: 1 }]);
    expect(t.client.getConnection().rttMs).toBe(42);

    t.client.setCadence(250);
    t.last().frame([{ type: 'ack', action: 'setCadence', cadenceMs: 300 }]);
    expect(t.client.getConnection().cadenceMs).toBe(300);
    expect(received.map((m) => m.type)).toEqual(['hello', 'pong', 'ack']);
  });

  it('requests the gateway default cadence when the preference is cleared', () => {
    const t = setup();
    t.client.setCadence(500);
    t.client.start();
    t.last().open();
    t.client.setCadence(null);
    expect(t.last().sentOfType('setCadence').slice(-1)).toEqual([{ type: 'setCadence', cadenceMs: 1 }]);
  });

  it('ignores and counts malformed frames without throwing', () => {
    const t = setup();
    const received: ServerMessage[] = [];
    t.client.onMessages((m) => received.push(...m));
    t.client.start();
    t.last().open();
    t.last().raw('not json');
    t.last().raw(JSON.stringify({ v: 2, msgs: [] }));
    t.last().raw(new ArrayBuffer(4));
    expect(t.client.getStats().invalidFrames).toBe(3);
    expect(received).toEqual([]);
  });
});

describe('parseFrame', () => {
  it('keeps known message types and drops unknown or malformed ones', () => {
    const msgs = parseFrame(
      JSON.stringify({
        v: 1,
        tick: 1,
        ts: 1,
        msgs: [
          { type: 'tickers', data: [] },
          { type: 'future-thing' },
          { type: 'book', pair: 'BTCUSDT', bids: 'nope', asks: [] },
          { type: 'status', upstream: 'live', stalePairs: [], since: 1 },
        ],
      })
    );
    expect(msgs?.map((m) => m.type)).toEqual(['tickers', 'status']);
  });

  it('drops malformed ticker elements, keeps the valid ones, and counts every dropped message', () => {
    const counters = { dropped: 0 };
    const good = ticker('BTCUSDT', 64000);
    const msgs = parseFrame(
      JSON.stringify({
        v: 1,
        tick: 1,
        ts: 1,
        msgs: [
          { type: 'tickers', data: [good, null, { ...good, pair: 'ETHUSDT', price: 'x' }, { pair: 'SOLUSDT' }] },
          { type: 'future-thing' },
          { type: 'tickers', data: 'nope' },
        ],
      }),
      counters
    );
    expect(msgs).toEqual([{ type: 'tickers', data: [good] }]);
    expect(counters.dropped).toBe(5);
  });

  it('reports dropped messages in the client stats', () => {
    const t = setup();
    t.client.start();
    t.last().open();
    t.last().frame([{ type: 'future-thing' }, { type: 'tickers', data: [{ pair: 'BTCUSDT' }] }]);
    expect(t.client.getStats()).toMatchObject({ invalidFrames: 0, droppedMessages: 2 });
  });
});
