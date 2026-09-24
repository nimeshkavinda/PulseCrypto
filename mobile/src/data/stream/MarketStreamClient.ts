import { ClientMessage, PROTOCOL_VERSION, ServerMessage } from '@pulsecrypto/shared';

/**
 * Connection lifecycle:
 *
 *   idle ──start──▶ connecting ──open──▶ open
 *                     ▲    │               │ close / idle timeout
 *                     │    └──fail──┐      ▼
 *                     └──timer── backoff ◀─┘
 *   network lost (not open) ──▶ offline ──network back──▶ connecting (attempts reset)
 *   app backgrounded ──▶ paused (socket closed) ──foreground──▶ connecting
 */
export type ConnectionState = 'idle' | 'connecting' | 'open' | 'backoff' | 'offline' | 'paused';

export interface ConnectionSnapshot {
  state: ConnectionState;
  /** Consecutive failed attempts since the last connection that delivered market data. */
  attempt: number;
  nextRetryAt: number | null;
  lastCloseCode: number | null;
  rttMs: number | null;
  /** From the gateway `hello`. */
  tickMs: number | null;
  minCadenceMs: number | null;
  maxCadenceMs: number | null;
  /** Effective cadence acknowledged by the gateway (null until acknowledged). */
  cadenceMs: number | null;
  openedAt: number | null;
}

export interface StreamStats {
  frames: number;
  bytes: number;
  messages: number;
  invalidFrames: number;
  /** Messages inside valid frames that were dropped (unknown type or malformed). */
  droppedMessages: number;
  connects: number;
}

/** The subset of the WebSocket API the client needs (RN WebSocket, browser WebSocket, or a fake). */
export interface SocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: { code: number; reason?: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export interface Scheduler {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  setInterval(fn: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

export interface StreamClientDeps {
  createSocket(url: string): SocketLike;
  /** Must invoke `onChange` with the current state soon after subscribing, then on every change. */
  subscribeNetwork(onChange: (online: boolean) => void): () => void;
  subscribeAppState(onChange: (active: boolean) => void): () => void;
  scheduler: Scheduler;
  random?: () => number;
}

export interface StreamClientOptions {
  url: string;
  backoffInitialMs?: number;
  backoffMaxMs?: number;
  pingIntervalMs?: number;
  /** Close and reconnect when nothing (data or pong) has arrived for this long. */
  idleTimeoutMs?: number;
  /** Give up on a socket that has not opened within this long and back off (default 10 s). */
  connectTimeoutMs?: number;
}

const OPEN = 1;
const CLOSE_NORMAL = 1000;
const KNOWN_TYPES = new Set(['hello', 'status', 'tickers', 'book', 'ack', 'pong', 'error']);

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Field-level check of one ticker element (the store and every row render trust these). */
function isTicker(t: unknown): boolean {
  if (!t || typeof t !== 'object') return false;
  const x = t as Record<string, unknown>;
  return (
    typeof x.pair === 'string' &&
    isNum(x.price) &&
    isNum(x.change24h) &&
    isNum(x.high24h) &&
    isNum(x.low24h) &&
    isNum(x.volume24h) &&
    isNum(x.updatedAt)
  );
}

/**
 * Parses and sanity-checks a gateway frame without a schema library (hot path, ~10 frames/s).
 * Returns null for anything that is not a protocol v1 frame. Unknown or malformed messages (and
 * malformed ticker elements) are dropped and counted in `counters.dropped`.
 */
export function parseFrame(data: unknown, counters?: { dropped: number }): ServerMessage[] | null {
  if (typeof data !== 'string') return null;
  let frame: { v?: unknown; msgs?: unknown };
  try {
    frame = JSON.parse(data);
  } catch {
    return null;
  }
  if (!frame || frame.v !== PROTOCOL_VERSION || !Array.isArray(frame.msgs)) return null;
  const out: ServerMessage[] = [];
  let dropped = 0;
  for (const m of frame.msgs as Array<{ type?: unknown; data?: unknown; bids?: unknown; asks?: unknown; pair?: unknown }>) {
    if (!m || typeof m.type !== 'string' || !KNOWN_TYPES.has(m.type)) {
      dropped++;
      continue;
    }
    if (m.type === 'tickers') {
      if (!Array.isArray(m.data)) {
        dropped++;
        continue;
      }
      const valid = m.data.filter(isTicker);
      dropped += m.data.length - valid.length;
      out.push((valid.length === m.data.length ? m : { ...m, data: valid }) as ServerMessage);
      continue;
    }
    if (m.type === 'book' && (typeof m.pair !== 'string' || !Array.isArray(m.bids) || !Array.isArray(m.asks))) {
      dropped++;
      continue;
    }
    out.push(m as ServerMessage);
  }
  if (counters) counters.dropped += dropped;
  return out;
}

/**
 * Framework-agnostic client for the PulseCrypto gateway (protocol v1).
 * Owns the socket, reconnection policy, heartbeat, subscriptions and cadence; knows nothing about
 * React or storage. Platform concerns (socket, network, app state, timers) are injected.
 */
export class MarketStreamClient {
  private socket: SocketLike | null = null;
  private url: string;
  private online = true;
  private active = true;
  private started = false;

  private readonly desiredChannels = new Set<string>();
  private readonly sentChannels = new Set<string>();
  private desiredCadenceMs: number | null = null;

  private backoffTimer: unknown = null;
  private connectTimer: unknown = null;
  private heartbeatTimer: unknown = null;
  /** True once the current socket has delivered market data (attempts reset then, not on open). */
  private receivedDataSinceOpen = false;
  private lastInboundAt = 0;
  private pingSeq = 0;
  private readonly pendingPings = new Map<number, number>();

  private unsubNetwork: (() => void) | null = null;
  private unsubAppState: (() => void) | null = null;

  private snapshot: ConnectionSnapshot = {
    state: 'idle',
    attempt: 0,
    nextRetryAt: null,
    lastCloseCode: null,
    rttMs: null,
    tickMs: null,
    minCadenceMs: null,
    maxCadenceMs: null,
    cadenceMs: null,
    openedAt: null,
  };
  private readonly stats: StreamStats = { frames: 0, bytes: 0, messages: 0, invalidFrames: 0, droppedMessages: 0, connects: 0 };
  private readonly dropCounter = { dropped: 0 };

  private readonly messageListeners = new Set<(msgs: ServerMessage[]) => void>();
  private readonly connectionListeners = new Set<(s: ConnectionSnapshot) => void>();

  private readonly backoffInitialMs: number;
  private readonly backoffMaxMs: number;
  private readonly pingIntervalMs: number;
  private readonly idleTimeoutMs: number;
  private readonly connectTimeoutMs: number;
  private readonly random: () => number;

  constructor(
    options: StreamClientOptions,
    private readonly deps: StreamClientDeps
  ) {
    this.url = options.url;
    this.backoffInitialMs = options.backoffInitialMs ?? 1000;
    this.backoffMaxMs = options.backoffMaxMs ?? 30_000;
    this.pingIntervalMs = options.pingIntervalMs ?? 5000;
    this.idleTimeoutMs = options.idleTimeoutMs ?? 12_000;
    this.connectTimeoutMs = options.connectTimeoutMs ?? 10_000;
    this.random = deps.random ?? Math.random;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  public start(): void {
    if (this.started) return;
    this.started = true;
    this.unsubAppState = this.deps.subscribeAppState((active) => this.onAppState(active));
    this.unsubNetwork = this.deps.subscribeNetwork((online) => this.onNetwork(online));
    if (this.snapshot.state === 'idle') this.resume();
  }

  public stop(): void {
    this.started = false;
    this.unsubNetwork?.();
    this.unsubAppState?.();
    this.unsubNetwork = this.unsubAppState = null;
    this.teardown(CLOSE_NORMAL);
    this.update({ state: 'idle', nextRetryAt: null });
  }

  public setUrl(url: string): void {
    if (url === this.url) return;
    this.url = url;
    if (this.started) this.reconnectNow();
  }

  /** Reconnect immediately, resetting the backoff (e.g. user pressed "retry"). */
  public reconnectNow(): void {
    if (!this.started) return;
    this.update({ attempt: 0 });
    this.resume();
  }

  /** Declares the full set of channels the app wants; the client diffs against what the gateway has. */
  public setChannels(channels: Iterable<string>): void {
    this.desiredChannels.clear();
    for (const c of channels) this.desiredChannels.add(c);
    if (this.isOpen()) this.syncChannels();
  }

  /** Requests a stream cadence (ms); `null` restores the gateway default (its tick). */
  public setCadence(ms: number | null): void {
    if (ms === this.desiredCadenceMs) return;
    this.desiredCadenceMs = ms;
    // `null` restores the gateway default: request 1 ms, which the gateway clamps to its tick.
    if (this.isOpen()) this.send({ type: 'setCadence', cadenceMs: ms === null ? 1 : Math.max(1, Math.round(ms)) });
  }

  public onMessages(listener: (msgs: ServerMessage[]) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  public onConnection(listener: (s: ConnectionSnapshot) => void): () => void {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  public getConnection(): ConnectionSnapshot {
    return this.snapshot;
  }

  public getStats(): StreamStats {
    return { ...this.stats, droppedMessages: this.dropCounter.dropped };
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  private resume(): void {
    if (!this.started) return;
    if (!this.active) {
      this.teardown(CLOSE_NORMAL);
      this.update({ state: 'paused', nextRetryAt: null });
      return;
    }
    if (!this.online) {
      this.teardown(CLOSE_NORMAL);
      this.update({ state: 'offline', nextRetryAt: null });
      return;
    }
    this.connect();
  }

  private connect(): void {
    this.teardown(CLOSE_NORMAL);
    this.update({ state: 'connecting', nextRetryAt: null });
    let socket: SocketLike;
    try {
      socket = this.deps.createSocket(this.url);
    } catch {
      this.scheduleBackoff(null);
      return;
    }
    this.socket = socket;
    this.stats.connects++;
    this.receivedDataSinceOpen = false;

    // A socket stuck in CONNECTING (e.g. a black-holed SYN) never fires onclose on some platforms.
    this.connectTimer = this.deps.scheduler.setTimeout(() => {
      this.connectTimer = null;
      if (this.socket !== socket || this.snapshot.state !== 'connecting') return;
      this.teardown(CLOSE_NORMAL);
      this.scheduleBackoff(null);
    }, this.connectTimeoutMs);

    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.clearConnectTimer();
      const now = this.deps.scheduler.now();
      this.lastInboundAt = now;
      this.sentChannels.clear();
      // Attempts are not reset here: a gateway that accepts and then closes straight away must
      // keep backing off. The first market data message resets them (handleData).
      this.update({ state: 'open', openedAt: now, cadenceMs: null });
      this.syncChannels();
      // A new session starts at the gateway default; only a user preference needs sending.
      if (this.desiredCadenceMs !== null) {
        this.send({ type: 'setCadence', cadenceMs: Math.max(1, Math.round(this.desiredCadenceMs)) });
      }
      this.startHeartbeat();
    };

    socket.onmessage = (event) => {
      if (this.socket !== socket) return;
      this.handleData(event.data);
    };

    socket.onclose = (event) => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.clearConnectTimer();
      this.stopHeartbeat();
      this.update({ lastCloseCode: event.code, openedAt: null });
      if (!this.started || !this.active) return;
      if (!this.online) {
        this.update({ state: 'offline', nextRetryAt: null });
        return;
      }
      this.scheduleBackoff(event.code);
    };

    // A close event always follows an error; reconnection is handled there.
    socket.onerror = () => undefined;
  }

  private scheduleBackoff(_closeCode: number | null): void {
    this.clearBackoff();
    const attempt = this.snapshot.attempt + 1;
    const cap = Math.min(this.backoffMaxMs, this.backoffInitialMs * 2 ** (attempt - 1));
    // Full jitter: spreads reconnects of many devices after a shared outage (no thundering herd).
    const delay = Math.max(250, Math.round(this.random() * cap));
    const now = this.deps.scheduler.now();
    this.update({ state: 'backoff', attempt, nextRetryAt: now + delay });
    this.backoffTimer = this.deps.scheduler.setTimeout(() => {
      this.backoffTimer = null;
      this.resume();
    }, delay);
  }

  /** Closes the current socket (if any) without triggering reconnection, and clears timers. */
  private teardown(code: number): void {
    this.clearBackoff();
    this.clearConnectTimer();
    this.stopHeartbeat();
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
      try {
        socket.close(code);
      } catch {
        // already closed
      }
    }
  }

  private clearConnectTimer(): void {
    if (this.connectTimer !== null) {
      this.deps.scheduler.clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
  }

  private clearBackoff(): void {
    if (this.backoffTimer !== null) {
      this.deps.scheduler.clearTimeout(this.backoffTimer);
      this.backoffTimer = null;
    }
  }

  private onNetwork(online: boolean): void {
    const wasOnline = this.online;
    this.online = online;
    if (!this.started) return;
    const state = this.snapshot.state;
    if (!online) {
      // An open socket may survive a brief network change (e.g. Wi-Fi to cellular); the idle
      // watchdog decides. Anything not yet open stops retrying until the network returns.
      if (state === 'connecting' || state === 'backoff') {
        this.teardown(CLOSE_NORMAL);
        this.update({ state: 'offline', nextRetryAt: null });
      }
      return;
    }
    if (!wasOnline && (state === 'offline' || state === 'backoff' || state === 'connecting')) {
      this.update({ attempt: 0 });
      this.resume();
    }
  }

  private onAppState(active: boolean): void {
    const was = this.active;
    this.active = active;
    if (!this.started || was === active) return;
    if (!active) {
      this.teardown(CLOSE_NORMAL);
      this.update({ state: 'paused', nextRetryAt: null, openedAt: null });
    } else {
      this.update({ attempt: 0 });
      this.resume();
    }
  }

  // ---------------------------------------------------------------------------
  // Heartbeat
  // ---------------------------------------------------------------------------

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = this.deps.scheduler.setInterval(() => {
      const now = this.deps.scheduler.now();
      if (now - this.lastInboundAt > this.idleTimeoutMs) {
        // Silent stall (half-open TCP): close and let onclose schedule the reconnect.
        const socket = this.socket;
        if (socket) {
          try {
            socket.close(4000, 'idle timeout');
          } finally {
            socket.onclose?.({ code: 4000, reason: 'idle timeout' });
          }
        }
        return;
      }
      const id = ++this.pingSeq;
      this.pendingPings.set(id, now);
      if (this.pendingPings.size > 8) this.pendingPings.delete(this.pendingPings.keys().next().value as number);
      this.send({ type: 'ping', id });
    }, this.pingIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      this.deps.scheduler.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.pendingPings.clear();
  }

  // ---------------------------------------------------------------------------
  // Inbound / outbound
  // ---------------------------------------------------------------------------

  private handleData(data: unknown): void {
    const now = this.deps.scheduler.now();
    this.lastInboundAt = now;
    this.stats.frames++;
    if (typeof data === 'string') this.stats.bytes += data.length;

    const msgs = parseFrame(data, this.dropCounter);
    if (!msgs) {
      this.stats.invalidFrames++;
      return;
    }
    // Only market data proves the session works: hello + status arrive on every connect, even
    // from a gateway that then closes straight away.
    if (!this.receivedDataSinceOpen && msgs.some((m) => m.type === 'tickers' || m.type === 'book')) {
      this.receivedDataSinceOpen = true;
      if (this.snapshot.attempt !== 0) this.update({ attempt: 0 });
    }
    this.stats.messages += msgs.length;

    for (const m of msgs) {
      if (m.type === 'hello') {
        this.update({ tickMs: m.tickMs, minCadenceMs: m.minCadenceMs, maxCadenceMs: m.maxCadenceMs });
      } else if (m.type === 'pong' && m.id !== undefined) {
        const sentAt = this.pendingPings.get(m.id);
        if (sentAt !== undefined) {
          this.pendingPings.delete(m.id);
          this.update({ rttMs: now - sentAt });
        }
      } else if (m.type === 'ack' && m.action === 'setCadence' && m.cadenceMs !== undefined) {
        this.update({ cadenceMs: m.cadenceMs });
      }
    }
    if (msgs.length > 0) for (const l of this.messageListeners) l(msgs);
  }

  private syncChannels(): void {
    const toAdd = [...this.desiredChannels].filter((c) => !this.sentChannels.has(c));
    const toRemove = [...this.sentChannels].filter((c) => !this.desiredChannels.has(c));
    if (toRemove.length > 0 && this.send({ type: 'unsubscribe', channels: toRemove })) {
      toRemove.forEach((c) => this.sentChannels.delete(c));
    }
    if (toAdd.length > 0 && this.send({ type: 'subscribe', channels: toAdd })) {
      toAdd.forEach((c) => this.sentChannels.add(c));
    }
  }

  private send(msg: ClientMessage): boolean {
    const socket = this.socket;
    if (!socket || socket.readyState !== OPEN) return false;
    try {
      socket.send(JSON.stringify(msg));
      return true;
    } catch {
      return false;
    }
  }

  private isOpen(): boolean {
    return this.snapshot.state === 'open' && !!this.socket && this.socket.readyState === OPEN;
  }

  private update(patch: Partial<ConnectionSnapshot>): void {
    let changed = false;
    for (const k of Object.keys(patch) as Array<keyof ConnectionSnapshot>) {
      if (this.snapshot[k] !== patch[k]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.snapshot = { ...this.snapshot, ...patch };
    for (const l of this.connectionListeners) l(this.snapshot);
  }
}
