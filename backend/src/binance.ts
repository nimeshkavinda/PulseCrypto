import WebSocket from 'ws';
import { SupportedPairSymbol, SUPPORTED_PAIRS } from '@pulsecrypto/shared';
import { MetricsRegistry, defaultMetrics } from './metrics.js';

export interface BinanceConnectorOptions {
  baseUrl?: string;
  reconnectInitialDelayMs?: number;
  reconnectMaxDelayMs?: number;
  heartbeatIntervalMs?: number;
  metrics?: MetricsRegistry;
}

export type DepthUpdateHandler = (
  symbol: SupportedPairSymbol,
  bids: [number, number][],
  asks: [number, number][]
) => void;

export type TickerUpdateHandler = (
  updates: Array<{
    symbol: SupportedPairSymbol;
    lastPrice: number;
    openPrice: number;
    high24h: number;
    low24h: number;
    volume24h: number;
  }>
) => void;

export type StatusChangeHandler = (connected: boolean) => void;

export type TradeUpdateHandler = (
  symbol: SupportedPairSymbol,
  price: number,
  isBuyerMaker: boolean
) => void;

export class BinanceConnector {
  private ws: WebSocket | null = null;
  private isExplicitlyClosed = false;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private lastMessageTimestamp = 0;

  private readonly baseUrl: string;
  private readonly reconnectInitialDelayMs: number;
  private readonly reconnectMaxDelayMs: number;
  private readonly heartbeatIntervalMs: number;
  private readonly metrics: MetricsRegistry;

  private onDepthHandler: DepthUpdateHandler | null = null;
  private onTickerHandler: TickerUpdateHandler | null = null;
  private onTradeHandler: TradeUpdateHandler | null = null;
  private onStatusHandler: StatusChangeHandler | null = null;

  constructor(options: BinanceConnectorOptions = {}) {
    this.reconnectInitialDelayMs = options.reconnectInitialDelayMs ?? 1000;
    this.reconnectMaxDelayMs = options.reconnectMaxDelayMs ?? 30000;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 30000;
    this.metrics = options.metrics ?? defaultMetrics;

    const pairs = Object.keys(SUPPORTED_PAIRS).map((p) => p.toLowerCase());
    const depthStreams = pairs.map((p) => `${p}@depth20@100ms`).join('/');
    const tradeStreams = pairs.map((p) => `${p}@trade`).join('/');
    const defaultStreamUrl = `wss://stream.binance.com:9443/stream?streams=${depthStreams}/${tradeStreams}/!miniTicker@arr`;

    this.baseUrl = options.baseUrl ?? defaultStreamUrl;
  }

  public onDepth(handler: DepthUpdateHandler): this {
    this.onDepthHandler = handler;
    return this;
  }

  public onTicker(handler: TickerUpdateHandler): this {
    this.onTickerHandler = handler;
    return this;
  }

  public onTrade(handler: TradeUpdateHandler): this {
    this.onTradeHandler = handler;
    return this;
  }

  public onStatus(handler: StatusChangeHandler): this {
    this.onStatusHandler = handler;
    return this;
  }

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isExplicitlyClosed = false;

    try {
      this.ws = new WebSocket(this.baseUrl);

      this.ws.on('open', () => {
        this.reconnectAttempts = 0;
        this.lastMessageTimestamp = Date.now();
        this.metrics.binanceConnectionStatus.set(1);
        this.onStatusHandler?.(true);
        this.startHeartbeat();
      });

      this.ws.on('message', (rawData: WebSocket.RawData) => {
        this.lastMessageTimestamp = Date.now();
        this.handleMessage(rawData);
      });

      this.ws.on('close', () => {
        this.cleanupSocket();
        this.metrics.binanceConnectionStatus.set(0);
        this.onStatusHandler?.(false);
        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      });

      this.ws.on('error', (_err) => {
        // Socket close event will trigger reconnect
        this.ws?.terminate();
      });

      this.ws.on('ping', () => {
        this.ws?.pong();
      });
    } catch {
      this.scheduleReconnect();
    }
  }

  private handleMessage(rawData: WebSocket.RawData): void {
    try {
      const payload = JSON.parse(rawData.toString());
      if (!payload.stream || !payload.data) return;

      const stream: string = payload.stream;

      // Handle depth20 updates: e.g. "btcusdt@depth20@100ms"
      if (stream.includes('@depth20')) {
        const symbolMatch = stream.split('@')[0].toUpperCase() as SupportedPairSymbol;
        if (SUPPORTED_PAIRS[symbolMatch]) {
          const rawBids: [string, string][] = payload.data.bids || [];
          const rawAsks: [string, string][] = payload.data.asks || [];

          // Drop non-finite depth levels; never propagate NaN to orderbook
          const bids: [number, number][] = [];
          for (const [pStr, qStr] of rawBids) {
            const p = Number(pStr);
            const q = Number(qStr);
            if (Number.isFinite(p) && Number.isFinite(q) && p > 0 && q >= 0) {
              bids.push([p, q]);
            }
          }

          const asks: [number, number][] = [];
          for (const [pStr, qStr] of rawAsks) {
            const p = Number(pStr);
            const q = Number(qStr);
            if (Number.isFinite(p) && Number.isFinite(q) && p > 0 && q >= 0) {
              asks.push([p, q]);
            }
          }

          this.metrics.wsMessagesReceived.inc({ stream: 'depth20', symbol: symbolMatch });
          this.onDepthHandler?.(symbolMatch, bids, asks);
        }
      }

      // Handle real-time trade updates: e.g. "btcusdt@trade"
      if (stream.includes('@trade')) {
        const symbolMatch = stream.split('@')[0].toUpperCase() as SupportedPairSymbol;
        if (SUPPORTED_PAIRS[symbolMatch] && payload.data) {
          const price = Number(payload.data.p);
          const isBuyerMaker = Boolean(payload.data.m);
          if (Number.isFinite(price) && price > 0) {
            this.metrics.wsMessagesReceived.inc({ stream: 'trade', symbol: symbolMatch });
            this.onTradeHandler?.(symbolMatch, price, isBuyerMaker);
          }
        }
      }

      // Handle 24h miniTicker updates: "!miniTicker@arr"
      if (stream === '!miniTicker@arr' && Array.isArray(payload.data)) {
        const validUpdates: Array<{
          symbol: SupportedPairSymbol;
          lastPrice: number;
          openPrice: number;
          high24h: number;
          low24h: number;
          volume24h: number;
        }> = [];

        for (const item of payload.data) {
          const symbol = item.s as SupportedPairSymbol;
          if (SUPPORTED_PAIRS[symbol]) {
            const lastPrice = Number(item.c);
            const openPrice = Number(item.o ?? item.c);
            const high24h = Number(item.h);
            const low24h = Number(item.l);
            const volume24h = Number(item.v);

            // Drop entire item if c/h/l/v not finite; never propagate NaN to metadata
            if (
              Number.isFinite(lastPrice) &&
              Number.isFinite(openPrice) &&
              Number.isFinite(high24h) &&
              Number.isFinite(low24h) &&
              Number.isFinite(volume24h) &&
              lastPrice >= 0 &&
              openPrice >= 0 &&
              high24h >= 0 &&
              low24h >= 0 &&
              volume24h >= 0
            ) {
              validUpdates.push({
                symbol,
                lastPrice,
                openPrice,
                high24h,
                low24h,
                volume24h,
              });
              this.metrics.wsMessagesReceived.inc({ stream: 'miniTicker', symbol });
            }
          }
        }

        if (validUpdates.length > 0) {
          this.onTickerHandler?.(validUpdates);
        }
      }
    } catch {
      // Ingest error tolerance: ignore malformed stream packets
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    const backoff = Math.min(
      this.reconnectInitialDelayMs * Math.pow(2, this.reconnectAttempts),
      this.reconnectMaxDelayMs
    );
    // Add 10-25% random jitter to avoid thundering herd
    const jitter = Math.random() * 0.25 * backoff;
    const delay = Math.round(backoff + jitter);

    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

    this.heartbeatTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      const idleDuration = Date.now() - this.lastMessageTimestamp;
      if (idleDuration > this.heartbeatIntervalMs * 2) {
        // Socket stalled, force terminate to trigger reconnect
        this.ws.terminate();
      } else {
        this.ws.ping();
      }
    }, this.heartbeatIntervalMs);
  }

  private cleanupSocket(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.ws = null;
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.cleanupSocket();
    if (this.ws) {
      this.ws.terminate();
      this.ws = null;
    }
    this.metrics.binanceConnectionStatus.set(0);
    this.onStatusHandler?.(false);
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
