import WebSocket from 'ws';
import {
  SupportedPairSymbol,
  SUPPORTED_PAIRS,
  MarketUpdatePayload,
  ClientCommandSchema,
  ClientCommand,
} from '@pulsecrypto/shared';
import { OrderBookManager, defaultOrderBookManager } from './orderbook.js';
import { MetricsRegistry, defaultMetrics } from './metrics.js';

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
    const envInterval = Number(process.env.FLUSH_INTERVAL_MS);
    this.flushIntervalMs = options.flushIntervalMs ?? (isNaN(envInterval) || envInterval <= 0 ? 100 : envInterval);
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
   * Handle incoming WebSocket client connection
   */
  public handleConnection(socket: WebSocket): void {
    const session: ClientSession = {
      socket,
      subscribedPairs: new Set(Object.keys(SUPPORTED_PAIRS) as SupportedPairSymbol[]),
      intervalMs: this.flushIntervalMs,
      lastEmitTimestamp: 0,
      isShedding: false,
    };

    this.clients.add(session);
    this.metrics.connectedClients.set(this.clients.size);

    socket.on('message', (data: WebSocket.RawData) => {
      this.handleClientMessage(session, data);
    });

    const cleanup = () => {
      this.clients.delete(session);
      this.metrics.connectedClients.set(this.clients.size);
      this.updateSheddingMetrics();
    };

    socket.on('close', cleanup);
    socket.on('error', cleanup);
  }

  private handleClientMessage(session: ClientSession, rawData: WebSocket.RawData): void {
    try {
      const parsed = JSON.parse(rawData.toString());
      const validation = ClientCommandSchema.safeParse(parsed);
      if (!validation.success) {
        session.socket.send(
          JSON.stringify({ type: 'error', message: 'Invalid command payload', errors: validation.error.format() })
        );
        return;
      }

      const command: ClientCommand = validation.data;
      switch (command.action) {
        case 'setThrottle':
          session.intervalMs = command.intervalMs;
          break;

        case 'subscribe':
          for (const pair of command.pairs) {
            session.subscribedPairs.add(pair);
          }
          break;

        case 'unsubscribe':
          for (const pair of command.pairs) {
            session.subscribedPairs.delete(pair);
          }
          break;

        case 'ping':
          session.socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;
      }
    } catch {
      session.socket.send(JSON.stringify({ type: 'error', message: 'Malformed JSON' }));
    }
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
      const snapshot = this.orderBookManager.getSnapshot(symbol);
      fullPayloads.set(symbol, JSON.stringify(snapshot));

      // Tier 2: Degraded/Shedding payload (empty bids/asks to conserve 90% bandwidth)
      const shedSnapshot: MarketUpdatePayload = {
        ...snapshot,
        bids: [],
        asks: [],
      };
      shedPayloads.set(symbol, JSON.stringify(shedSnapshot));
    }

    // Broadcast to connected clients respecting individual throttle and 3-tier backpressure
    for (const session of Array.from(this.clients)) {
      if (session.socket.readyState !== WebSocket.OPEN) continue;

      // Check client-specific throttle cadence
      if (now - session.lastEmitTimestamp < session.intervalMs) continue;

      const buffered = session.socket.bufferedAmount;

      // Tier 3: Critical backpressure (>= 2 MB) -> Terminate lagging socket
      if (buffered >= BACKPRESSURE_THRESHOLDS.TERMINATE_BYTES) {
        session.socket.terminate();
        this.clients.delete(session);
        continue;
      }

      // Tier 2: Degraded backpressure (>= 512 KB) -> Shed depth books
      if (buffered >= BACKPRESSURE_THRESHOLDS.SHED_DEPTH_BYTES) {
        session.isShedding = true;
        for (const pair of session.subscribedPairs) {
          const payload = shedPayloads.get(pair);
          if (payload) {
            session.socket.send(payload);
            this.metrics.wsBroadcastsSent.inc({ symbol: pair });
          }
        }
      } else {
        // Tier 1: Normal backpressure (< 512 KB) -> Full depth20 update
        session.isShedding = false;
        for (const pair of session.subscribedPairs) {
          const payload = fullPayloads.get(pair);
          if (payload) {
            session.socket.send(payload);
            this.metrics.wsBroadcastsSent.inc({ symbol: pair });
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
