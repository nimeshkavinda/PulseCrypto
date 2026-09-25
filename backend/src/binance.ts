import WebSocket from 'ws';
import { SupportedPairSymbol, SUPPORTED_PAIRS } from '@pulsecrypto/shared';
import { MetricsRegistry, defaultMetrics } from './metrics.js';
import { Ticker24h } from './metadata.js';

export interface BinanceConnectorOptions {
  /** Stream host, e.g. `wss://stream.binance.com:9443` or `wss://data-stream.binance.vision`. */
  wsBaseUrl?: string;
  pairs?: SupportedPairSymbol[];
  reconnectInitialDelayMs?: number;
  reconnectMaxDelayMs?: number;
  /** Terminate and reconnect if no message arrives for this long. Depth alone arrives every 100 ms. */
  idleTimeoutMs?: number;
  /** Abort an opening handshake that takes longer than this (the close handler schedules a retry). */
  handshakeTimeoutMs?: number;
  metrics?: MetricsRegistry;
}

export type DepthUpdateHandler = (symbol: SupportedPairSymbol, bids: [number, number][], asks: [number, number][]) => void;
export type TradeUpdateHandler = (symbol: SupportedPairSymbol, price: number, tradeTs: number) => void;
export type TickerUpdateHandler = (symbol: SupportedPairSymbol, ticker: Ticker24h) => void;
export type StatusChangeHandler = (connected: boolean) => void;

export const DEFAULT_BINANCE_WS_URL = 'wss://stream.binance.com:9443';

/** Builds the combined-stream URL: `<base>/stream?streams=btcusdt@depth20@100ms/btcusdt@aggTrade/...` */
export function buildStreamUrl(base: string, pairs: SupportedPairSymbol[]): string {
  const streams = pairs.flatMap((p) => {
    const s = p.toLowerCase();
    return [`${s}@depth20@100ms`, `${s}@aggTrade`, `${s}@ticker`];
  });
  return `${base.replace(/\/+$/, '')}/stream?streams=${streams.join('/')}`;
}

/**
 * Binance combined-stream client for the supported pairs.
 * - `<pair>@depth20@100ms`: top-20 partial book snapshots (no diff sync needed; no event time).
 * - `<pair>@aggTrade`: last traded price with trade time.
 * - `<pair>@ticker`: rolling 24h statistics once per second with event time.
 * Reconnects with capped exponential backoff and full jitter; an idle watchdog catches silent stalls.
 * Protocol-level pings from Binance are answered automatically by `ws`.
 */
export class BinanceConnector {
  private ws: WebSocket | null = null;
  private explicitlyClosed = false;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private watchdogTimer: NodeJS.Timeout | null = null;
  private lastMessageAt = 0;

  private readonly url: string;
  private readonly reconnectInitialDelayMs: number;
  private readonly reconnectMaxDelayMs: number;
  private readonly idleTimeoutMs: number;
  private readonly handshakeTimeoutMs: number;
  private readonly metrics: MetricsRegistry;

  private onDepthHandler: DepthUpdateHandler | null = null;
  private onTradeHandler: TradeUpdateHandler | null = null;
  private onTickerHandler: TickerUpdateHandler | null = null;
  private onStatusHandler: StatusChangeHandler | null = null;

  constructor(options: BinanceConnectorOptions = {}) {
    this.reconnectInitialDelayMs = options.reconnectInitialDelayMs ?? 1000;
    this.reconnectMaxDelayMs = options.reconnectMaxDelayMs ?? 30000;
    this.idleTimeoutMs = options.idleTimeoutMs ?? 10000;
    this.handshakeTimeoutMs = options.handshakeTimeoutMs ?? 10000;
    this.metrics = options.metrics ?? defaultMetrics;
    const pairs = options.pairs ?? (Object.keys(SUPPORTED_PAIRS) as SupportedPairSymbol[]);
    this.url = buildStreamUrl(options.wsBaseUrl ?? DEFAULT_BINANCE_WS_URL, pairs);
  }

  public get streamUrl(): string {
    return this.url;
  }

  public onDepth(handler: DepthUpdateHandler): this {
    this.onDepthHandler = handler;
    return this;
  }

  public onTrade(handler: TradeUpdateHandler): this {
    this.onTradeHandler = handler;
    return this;
  }

  public onTicker(handler: TickerUpdateHandler): this {
    this.onTickerHandler = handler;
    return this;
  }

  public onStatus(handler: StatusChangeHandler): this {
    this.onStatusHandler = handler;
    return this;
  }

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.explicitlyClosed = false;

    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url, { handshakeTimeout: this.handshakeTimeoutMs });
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.on('open', () => {
      this.lastMessageAt = Date.now();
      this.metrics.binanceConnectionStatus.set(1);
      this.startWatchdog();
      this.onStatusHandler?.(true);
    });

    ws.on('message', (raw: WebSocket.RawData) => {
      this.lastMessageAt = Date.now();
      this.handleMessage(raw);
    });

    ws.on('close', () => {
      if (this.ws !== ws) return; // superseded socket
      this.stopWatchdog();
      this.ws = null;
      this.metrics.binanceConnectionStatus.set(0);
      this.onStatusHandler?.(false);
      if (!this.explicitlyClosed) this.scheduleReconnect();
    });

    // 'close' always follows 'error'; terminate so it fires promptly.
    ws.on('error', () => ws.terminate());
  }

  public disconnect(): void {
    this.explicitlyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopWatchdog();
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.removeAllListeners('message');
      ws.terminate();
    }
    this.metrics.binanceConnectionStatus.set(0);
    this.onStatusHandler?.(false);
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private handleMessage(raw: WebSocket.RawData): void {
    let msg: { stream?: unknown; data?: Record<string, unknown> } | null;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      this.invalid('json');
      return;
    }
    // `null`, numbers and arrays are valid JSON but not a stream envelope.
    if (!msg || typeof msg !== 'object' || typeof msg.stream !== 'string' || !msg.data || typeof msg.data !== 'object') {
      this.invalid('envelope');
      return;
    }

    const [symbolPart, kind] = msg.stream.split('@');
    const symbol = symbolPart?.toUpperCase();
    if (!symbol || !Object.prototype.hasOwnProperty.call(SUPPORTED_PAIRS, symbol)) {
      this.invalid('symbol');
      return;
    }
    const pair = symbol as SupportedPairSymbol;
    // Backoff resets on the first valid stream message, not on open (or on junk): an upstream that
    // accepts and then closes straight away would otherwise be retried about once a second forever.
    this.reconnectAttempts = 0;
    try {
      this.dispatch(pair, kind, msg.data);
    } catch {
      // A throwing handler must not escape the ws 'message' listener; count it and move on.
      this.invalid('handler');
    }
  }

  private dispatch(pair: SupportedPairSymbol, kind: string | undefined, data: Record<string, unknown>): void {
    switch (kind) {
      case 'depth20': {
        const bids = parseLevels(data.bids);
        const asks = parseLevels(data.asks);
        if (!bids || !asks) return this.invalid('depth');
        this.metrics.wsMessagesReceived.inc({ stream: 'depth20', symbol: pair });
        this.onDepthHandler?.(pair, bids, asks);
        return;
      }
      case 'aggTrade': {
        const price = Number(data.p);
        const tradeTs = Number(data.T);
        if (!(price > 0) || !Number.isFinite(price) || !(tradeTs > 0)) return this.invalid('aggTrade');
        this.metrics.wsMessagesReceived.inc({ stream: 'aggTrade', symbol: pair });
        this.onTradeHandler?.(pair, price, tradeTs);
        return;
      }
      case 'ticker': {
        const ticker: Ticker24h = {
          lastPrice: Number(data.c),
          high24h: Number(data.h),
          low24h: Number(data.l),
          volume24h: Number(data.v),
          changePct: Number(data.P),
          eventTs: Number(data.E),
        };
        const valid =
          ticker.lastPrice > 0 &&
          [ticker.high24h, ticker.low24h, ticker.volume24h].every((n) => Number.isFinite(n) && n >= 0) &&
          Number.isFinite(ticker.changePct) &&
          ticker.eventTs > 0;
        if (!valid) return this.invalid('ticker');
        this.metrics.wsMessagesReceived.inc({ stream: 'ticker', symbol: pair });
        this.onTickerHandler?.(pair, ticker);
        return;
      }
      default:
        this.invalid('stream');
    }
  }

  private invalid(reason: string): void {
    this.metrics.upstreamMessagesInvalid.inc({ reason });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.explicitlyClosed) return;
    const cap = Math.min(this.reconnectInitialDelayMs * 2 ** this.reconnectAttempts, this.reconnectMaxDelayMs);
    // Full jitter spreads reconnects of many gateway replicas after a shared upstream outage.
    const delay = Math.max(this.reconnectInitialDelayMs / 4, Math.random() * cap);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
    this.reconnectTimer.unref?.();
  }

  private startWatchdog(): void {
    this.stopWatchdog();
    this.watchdogTimer = setInterval(() => {
      if (this.ws && Date.now() - this.lastMessageAt > this.idleTimeoutMs) {
        this.ws.terminate(); // 'close' handler schedules the reconnect
      }
    }, Math.max(250, this.idleTimeoutMs / 2));
    this.watchdogTimer.unref?.();
  }

  private stopWatchdog(): void {
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }
}

/** Parses Binance `[["price","qty"], ...]` levels; returns null if any level is malformed. */
function parseLevels(raw: unknown): [number, number][] | null {
  if (!Array.isArray(raw)) return null;
  const out: [number, number][] = [];
  for (const level of raw) {
    if (!Array.isArray(level) || level.length < 2) return null;
    const price = Number(level[0]);
    const qty = Number(level[1]);
    if (!Number.isFinite(price) || !Number.isFinite(qty) || price <= 0 || qty < 0) return null;
    out.push([price, qty]);
  }
  return out;
}
