import WebSocket from 'ws';
import {
  SupportedPairSymbol,
  SUPPORTED_PAIRS,
  MarketUpdatePayload,
} from '@pulsecrypto/shared';
import { OrderBookManager, defaultOrderBookManager } from './orderbook.js';
import { MetricsRegistry, defaultMetrics } from './metrics.js';
import { loadConfig } from './config.js';
import { handleClientMessage, sendSafe } from './ws/commands.js';

export const BACKPRESSURE_THRESHOLDS = {
  SHED_DEPTH_BYTES: 512 * 1024,      // 512 KB
  TERMINATE_BYTES: 2 * 1024 * 1024,  // 2 MB
};

export interface ConflatorOptions {
  flushIntervalMs?: number;
  orderBookManager?: OrderBookManager;
  metrics?: MetricsRegistry;
}

export interface ClientSession {
  socket: WebSocket;
  subscribedPairs: Set<SupportedPairSymbol>;
  intervalMs: number;
  lastEmitTimestamp: number;
  lastErrorTimestamp: number;
  isShedding: boolean;
}

export class ConflationEngine {
  public readonly flushIntervalMs: number;
  private readonly orderBookManager: OrderBookManager;
  private readonly metrics: MetricsRegistry;

  private clients: Set<ClientSession> = new Set();
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(options: ConflatorOptions = {}) {
    this.flushIntervalMs = options.flushIntervalMs ?? loadConfig().FLUSH_INTERVAL_MS;
    this.orderBookManager = options.orderBookManager ?? defaultOrderBookManager;
    this.metrics = options.metrics ?? defaultMetrics;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.timer = setInterval(() => {
      this.tick();
    }, this.flushIntervalMs);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Registers a new client socket session for broadcast conflation.
   */
  public registerClient(socket: WebSocket): ClientSession {
    const session: ClientSession = {
      socket,
      subscribedPairs: new Set(Object.keys(SUPPORTED_PAIRS) as SupportedPairSymbol[]),
      intervalMs: this.flushIntervalMs,
      lastEmitTimestamp: 0,
      lastErrorTimestamp: 0,
      isShedding: false,
    };

    this.clients.add(session);
    this.metrics.connectedClients.set(this.clients.size);

    const cleanup = () => {
      this.clients.delete(session);
      this.metrics.connectedClients.set(this.clients.size);
      this.updateSheddingMetrics();
    };

    socket.on('close', cleanup);
    socket.on('error', cleanup);

    return session;
  }

  /**
   * Handles incoming WebSocket client connection and attaches message handler.
   */
  public handleConnection(socket: WebSocket): void {
    const session = this.registerClient(socket);

    socket.on('message', (data: WebSocket.RawData) => {
      handleClientMessage(session, data);
    });
  }

  /**
   * Main conflation loop: inspect backpressure, serialize, and emit snapshots
   */
  public tick(): void {
    if (this.clients.size === 0) return;

    const startTime = process.hrtime.bigint();
    const now = Date.now();

    // Cache generated snapshots and serialized strings per pair for this cycle
    const fullPayloads: Map<SupportedPairSymbol, string> = new Map();
    const shedPayloads: Map<SupportedPairSymbol, string> = new Map();

    const symbols = Object.keys(SUPPORTED_PAIRS) as SupportedPairSymbol[];
    for (const symbol of symbols) {
      try {
        const snapshot = this.orderBookManager.getSnapshot(symbol);
        fullPayloads.set(symbol, JSON.stringify(snapshot));

        // Tier 2: Degraded/Shedding payload.
        // DESIGN NOTE: We deliberately emit empty bids/asks ([] / []) instead of top-5 during Tier 2 backpressure.
        // Rationale: Emitting top-5 still incurs substantial JSON serialization and network payload overhead (~30-40% of depth20).
        // Emitting [] eliminates >90% of payload size while preserving real-time price, 24h stats, and buy/sell pressure metrics,
        // allowing the client socket buffer to rapidly drain without losing top-line market telemetry.
        const shedSnapshot: MarketUpdatePayload = {
          ...snapshot,
          bids: [],
          asks: [],
        };
        shedPayloads.set(symbol, JSON.stringify(shedSnapshot));
      } catch (err) {
        // Robustness: Never allow one pair's error to kill the entire conflation interval
        console.error(`[ConflationEngine] Error snapshotting pair ${symbol}:`, err);
      }
    }

    // Broadcast to connected clients respecting individual throttle and 3-tier backpressure
    for (const session of Array.from(this.clients)) {
      if (session.socket.readyState !== WebSocket.OPEN) continue;

      // Check client-specific throttle cadence
      if (now - session.lastEmitTimestamp < session.intervalMs) continue;

      const buffered = session.socket.bufferedAmount;

      // Tier 3: Critical backpressure (>= 2 MB) -> Graceful close (1008: Slow Consumer), fallback to terminate
      if (buffered >= BACKPRESSURE_THRESHOLDS.TERMINATE_BYTES) {
        try {
          session.socket.close(1008, 'Slow consumer');
        } catch {
          session.socket.terminate();
        }

        // Fallback safety: ensure socket is terminated if not closed within grace timeout
        setTimeout(() => {
          if (session.socket.readyState !== WebSocket.CLOSED) {
            try {
              session.socket.terminate();
            } catch {
              // noop
            }
          }
        }, 1000).unref?.();

        this.clients.delete(session);
        continue;
      }

      // Tier 2: Degraded backpressure (>= 512 KB) -> Shed depth books
      if (buffered >= BACKPRESSURE_THRESHOLDS.SHED_DEPTH_BYTES) {
        session.isShedding = true;
        for (const pair of session.subscribedPairs) {
          const payload = shedPayloads.get(pair);
          if (payload) {
            const sent = sendSafe(session.socket, payload);
            if (sent) {
              this.metrics.wsBroadcastsSent.inc({ symbol: pair });
            }
          }
        }
      } else {
        // Tier 1: Normal backpressure (< 512 KB) -> Full depth20 update
        session.isShedding = false;
        for (const pair of session.subscribedPairs) {
          const payload = fullPayloads.get(pair);
          if (payload) {
            const sent = sendSafe(session.socket, payload);
            if (sent) {
              this.metrics.wsBroadcastsSent.inc({ symbol: pair });
            }
          }
        }
      }

      session.lastEmitTimestamp = now;
    }

    this.updateSheddingMetrics();

    const endTime = process.hrtime.bigint();
    const durationSeconds = Number(endTime - startTime) / 1_000_000_000;
    this.metrics.conflationDuration.observe(durationSeconds);
  }

  private updateSheddingMetrics(): void {
    let sheddingCount = 0;
    for (const client of this.clients) {
      if (client.isShedding) sheddingCount++;
    }
    this.metrics.backpressureSheddingClients.set(sheddingCount);
  }

  public getConnectedClientCount(): number {
    return this.clients.size;
  }
}

export const defaultConflator = new ConflationEngine();
