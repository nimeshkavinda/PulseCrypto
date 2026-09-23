import WebSocket from 'ws';
import {
  SUPPORTED_PAIRS,
  SupportedPairSymbol,
  PROTOCOL_VERSION,
  ALL_CHANNELS,
  CLOSE_SLOW_CONSUMER,
  ClientMessageSchema,
  ClientMessage,
  ErrorCode,
  ServerMessage,
  parseChannel,
} from '@pulsecrypto/shared';
import { MarketSource } from '../market/marketSource.js';
import { MetricsRegistry } from '../metrics.js';
import { ClientSession, HubSocket } from './ClientSession.js';

export interface ChannelHubOptions {
  source: MarketSource;
  metrics: MetricsRegistry;
  /** Server tick interval (FLUSH_INTERVAL_MS). */
  tickMs: number;
  /** Above this many buffered bytes a client's frame is skipped (conflated). */
  softLimitBytes: number;
  /** Above this many buffered bytes a client is disconnected immediately. */
  hardLimitBytes: number;
  /** A client that stays above the soft limit for longer than this is disconnected. */
  lagGraceMs: number;
  /** Upper bound for client-requested cadence. */
  maxCadenceMs?: number;
  now?: () => number;
  logger?: { warn: (obj: unknown, msg?: string) => void };
}

interface CachedItem {
  version: number;
  json: string;
}

const PAIRS = Object.keys(SUPPORTED_PAIRS) as SupportedPairSymbol[];
const ERROR_RATE_LIMIT_MS = 1000;
const TERMINATE_GRACE_MS = 1000;

/**
 * Channel-based fan-out for market data.
 *
 * Each tick, for each client whose cadence allows it, the hub collects every subscribed item whose
 * version is newer than what that client was last sent, and sends them as ONE frame. Item JSON is
 * cached by version, so an item is serialized at most once no matter how many clients receive it;
 * per-client work is version comparisons plus string concatenation.
 *
 * Backpressure follows last-value-cache semantics: when a client's socket buffer is above the soft
 * limit its frame is skipped (not queued), and because delivery is version-tracked the next frame
 * carries the latest state. Clients stuck above the soft limit past the grace period, or above the
 * hard limit at any time, are closed with 1013 (Try Again Later).
 */
export class ChannelHub {
  private readonly sessions = new Set<ClientSession>();
  private readonly tickerCache = new Map<SupportedPairSymbol, CachedItem>();
  private readonly bookCache = new Map<SupportedPairSymbol, CachedItem>();
  private statusCache: CachedItem | null = null;
  private timer: NodeJS.Timeout | null = null;
  private tickCount = 0;

  private readonly now: () => number;
  private readonly maxCadenceMs: number;

  constructor(private readonly opts: ChannelHubOptions) {
    this.now = opts.now ?? Date.now;
    this.maxCadenceMs = opts.maxCadenceMs ?? 10_000;
  }

  public get tickMs(): number {
    return this.opts.tickMs;
  }

  public start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), this.opts.tickMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public getConnectedClientCount(): number {
    return this.sessions.size;
  }

  /** Registers a socket: sends `hello` + current `status`, then wires inbound handling. */
  public attach(socket: HubSocket): ClientSession {
    const session = new ClientSession(socket);
    this.sessions.add(session);
    this.opts.metrics.connectedClients.set(this.sessions.size);

    const status = this.statusItem();
    session.sentStatusVersion = status.version;
    const hello: ServerMessage = {
      type: 'hello',
      protocol: PROTOCOL_VERSION,
      tickMs: this.opts.tickMs,
      minCadenceMs: this.opts.tickMs,
      maxCadenceMs: this.maxCadenceMs,
      pairs: PAIRS,
      channels: ALL_CHANNELS,
    };
    this.sendControl(session, [JSON.stringify(hello), status.json]);

    socket.on('message', (data) => this.handleMessage(session, data));
    const cleanup = () => this.remove(session);
    socket.on('close', cleanup);
    socket.on('error', cleanup);
    return session;
  }

  /** One fan-out pass. Public so tests can drive it deterministically. */
  public tick(): void {
    this.tickCount += 1;
    if (this.sessions.size === 0) return;

    const started = process.hrtime.bigint();
    const now = this.now();
    let lagging = 0;

    // Snapshot versions once per tick (O(pairs)), shared by all sessions.
    const tickerVersions = PAIRS.map((p) => this.opts.source.getTickerVersion(p));
    const bookVersions = PAIRS.map((p) => this.opts.source.getBookVersion(p));
    const statusVersion = this.opts.source.getStatus().version;

    for (const session of this.sessions) {
      if (session.closed || session.socket.readyState !== WebSocket.OPEN) continue;

      const buffered = session.socket.bufferedAmount;
      if (buffered > this.opts.hardLimitBytes) {
        this.closeSlowConsumer(session, 'hard limit');
        continue;
      }
      const congested = buffered > this.opts.softLimitBytes;
      if (congested) {
        session.lagSince ??= now;
        if (now - session.lagSince > this.opts.lagGraceMs) {
          this.closeSlowConsumer(session, 'sustained lag');
          continue;
        }
        lagging++;
      } else {
        session.lagSince = null;
      }

      if (this.tickCount - session.lastSentTick < session.cadenceTicks) continue;

      const parts: string[] = [];
      const commits: Array<() => void> = [];

      if (statusVersion > session.sentStatusVersion) {
        const item = this.statusItem();
        parts.push(item.json);
        commits.push(() => (session.sentStatusVersion = item.version));
      }

      if (session.subscribedTickers) {
        const tickerParts: string[] = [];
        for (let i = 0; i < PAIRS.length; i++) {
          const pair = PAIRS[i];
          const version = tickerVersions[i];
          if (version === 0 || version <= (session.sentTickerVersions.get(pair) ?? 0)) continue;
          const item = this.tickerItem(pair);
          if (!item) continue;
          tickerParts.push(item.json);
          commits.push(() => session.sentTickerVersions.set(pair, item.version));
        }
        if (tickerParts.length > 0) {
          parts.push(`{"type":"tickers","data":[${tickerParts.join(',')}]}`);
        }
      }

      for (const pair of session.bookPairs) {
        const version = bookVersions[PAIRS.indexOf(pair)];
        if (version === 0 || version <= (session.sentBookVersions.get(pair) ?? 0)) continue;
        const item = this.bookItem(pair);
        if (!item) continue;
        parts.push(item.json);
        commits.push(() => session.sentBookVersions.set(pair, item.version));
      }

      if (parts.length === 0) continue;

      if (congested) {
        // Conflate: skip rather than queue. Versions stay uncommitted, so the next frame carries the latest state.
        this.opts.metrics.framesDropped.inc();
        continue;
      }

      if (this.sendFrame(session, parts, now)) {
        for (const commit of commits) commit();
        session.lastSentTick = this.tickCount;
      }
    }

    this.opts.metrics.laggingClients.set(lagging);
    this.opts.metrics.tickDuration.observe(Number(process.hrtime.bigint() - started) / 1e9);
  }

  // ---------------------------------------------------------------------------
  // Inbound
  // ---------------------------------------------------------------------------

  private handleMessage(session: ClientSession, data: Buffer | ArrayBuffer | Buffer[]): void {
    if (session.closed) return;
    let raw: unknown;
    try {
      const text = Array.isArray(data)
        ? Buffer.concat(data).toString('utf8')
        : Buffer.from(data as ArrayBuffer).toString('utf8');
      raw = JSON.parse(text);
    } catch {
      this.sendError(session, 'BAD_JSON', 'Message is not valid JSON');
      return;
    }

    const parsed = ClientMessageSchema.safeParse(raw);
    if (!parsed.success) {
      this.sendError(session, 'BAD_MESSAGE', 'Message does not match the protocol schema');
      return;
    }
    this.applyMessage(session, parsed.data);
  }

  private applyMessage(session: ClientSession, msg: ClientMessage): void {
    switch (msg.type) {
      case 'subscribe':
      case 'unsubscribe': {
        const unknown: string[] = [];
        for (const name of msg.channels) {
          const channel = parseChannel(name);
          if (!channel) {
            unknown.push(name);
            continue;
          }
          if (msg.type === 'subscribe') this.subscribe(session, channel);
          else this.unsubscribe(session, channel);
        }
        const out: string[] = [JSON.stringify({ type: 'ack', action: msg.type, channels: session.channels() })];
        if (unknown.length > 0) {
          const err = this.errorJson(session, 'UNKNOWN_CHANNEL', `Unknown channel(s): ${unknown.join(', ')}`);
          if (err) out.push(err);
        }
        this.sendControl(session, out);
        return;
      }
      case 'setCadence': {
        const maxTicks = Math.max(1, Math.floor(this.maxCadenceMs / this.opts.tickMs));
        const ticks = Math.min(Math.max(1, Math.ceil(msg.cadenceMs / this.opts.tickMs)), maxTicks);
        session.cadenceTicks = ticks;
        this.sendControl(session, [
          JSON.stringify({ type: 'ack', action: 'setCadence', cadenceMs: ticks * this.opts.tickMs }),
        ]);
        return;
      }
      case 'ping': {
        const pong: ServerMessage =
          msg.id !== undefined
            ? { type: 'pong', id: msg.id, serverTs: this.now() }
            : { type: 'pong', serverTs: this.now() };
        this.sendControl(session, [JSON.stringify(pong)]);
        return;
      }
    }
  }

  private subscribe(session: ClientSession, channel: NonNullable<ReturnType<typeof parseChannel>>): void {
    if (channel.kind === 'tickers') {
      if (!session.subscribedTickers) {
        session.subscribedTickers = true;
        session.sentTickerVersions.clear(); // new subscriber receives full current state
      }
    } else if (!session.bookPairs.has(channel.pair)) {
      session.bookPairs.add(channel.pair);
      session.sentBookVersions.delete(channel.pair);
    }
  }

  private unsubscribe(session: ClientSession, channel: NonNullable<ReturnType<typeof parseChannel>>): void {
    if (channel.kind === 'tickers') {
      session.subscribedTickers = false;
      session.sentTickerVersions.clear();
    } else {
      session.bookPairs.delete(channel.pair);
      session.sentBookVersions.delete(channel.pair);
    }
  }

  // ---------------------------------------------------------------------------
  // Serialization cache (at most one JSON.stringify per item version)
  // ---------------------------------------------------------------------------

  private tickerItem(pair: SupportedPairSymbol): CachedItem | null {
    const cached = this.tickerCache.get(pair);
    if (cached && cached.version === this.opts.source.getTickerVersion(pair)) return cached;
    const v = this.opts.source.getTicker(pair);
    if (!v) return null;
    const item = { version: v.version, json: JSON.stringify(v.ticker) };
    this.tickerCache.set(pair, item);
    return item;
  }

  private bookItem(pair: SupportedPairSymbol): CachedItem | null {
    const cached = this.bookCache.get(pair);
    if (cached && cached.version === this.opts.source.getBookVersion(pair)) return cached;
    const v = this.opts.source.getBook(pair);
    if (!v) return null;
    const item = { version: v.version, json: JSON.stringify({ type: 'book', ...v.book }) };
    this.bookCache.set(pair, item);
    return item;
  }

  private statusItem(): CachedItem {
    const v = this.opts.source.getStatus();
    if (this.statusCache && this.statusCache.version === v.version) return this.statusCache;
    this.statusCache = { version: v.version, json: JSON.stringify({ type: 'status', ...v.status }) };
    return this.statusCache;
  }

  // ---------------------------------------------------------------------------
  // Outbound
  // ---------------------------------------------------------------------------

  private sendFrame(session: ClientSession, parts: string[], now: number): boolean {
    const frame = `{"v":${PROTOCOL_VERSION},"tick":${this.tickCount},"ts":${now},"msgs":[${parts.join(',')}]}`;
    if (session.socket.readyState !== WebSocket.OPEN) return false;
    try {
      session.socket.send(frame);
    } catch {
      return false;
    }
    this.opts.metrics.framesSent.inc();
    this.opts.metrics.bytesSent.inc(Buffer.byteLength(frame));
    return true;
  }

  /** Control frames (hello, ack, pong, error) bypass cadence but not the hard limit. */
  private sendControl(session: ClientSession, parts: string[]): void {
    if (session.socket.bufferedAmount > this.opts.hardLimitBytes) {
      this.closeSlowConsumer(session, 'hard limit');
      return;
    }
    this.sendFrame(session, parts, this.now());
  }

  private errorJson(session: ClientSession, code: ErrorCode, message: string): string | null {
    const now = this.now();
    if (now - session.lastErrorAt < ERROR_RATE_LIMIT_MS) return null;
    session.lastErrorAt = now;
    return JSON.stringify({ type: 'error', code, message });
  }

  private sendError(session: ClientSession, code: ErrorCode, message: string): void {
    const json = this.errorJson(session, code, message);
    if (json) this.sendControl(session, [json]);
  }

  private closeSlowConsumer(session: ClientSession, reason: string): void {
    if (session.closed) return;
    session.closed = true;
    this.opts.metrics.slowConsumerDisconnects.inc();
    this.opts.logger?.warn({ reason, buffered: session.socket.bufferedAmount }, 'Closing slow consumer');
    try {
      session.socket.close(CLOSE_SLOW_CONSUMER, 'slow consumer');
    } catch {
      // fall through to terminate
    }
    // The close frame queues behind the congested buffer; terminate if it never flushes.
    setTimeout(() => {
      if (session.socket.readyState !== WebSocket.CLOSED) {
        try {
          session.socket.terminate();
        } catch {
          // already gone
        }
      }
    }, TERMINATE_GRACE_MS).unref?.();
    this.remove(session);
  }

  private remove(session: ClientSession): void {
    session.closed = true;
    if (this.sessions.delete(session)) {
      this.opts.metrics.connectedClients.set(this.sessions.size);
    }
  }
}
