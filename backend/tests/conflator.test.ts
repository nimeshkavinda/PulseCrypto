import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocket } from 'ws';
import { ConflationEngine, BACKPRESSURE_THRESHOLDS } from '../src/conflator.js';
import { OrderBookManager } from '../src/orderbook.js';
import { MetricsRegistry } from '../src/metrics.js';
import { MarketUpdatePayloadSchema } from '@pulsecrypto/shared';

describe('Conflation Engine & 3-Tier Backpressure Guard (Tasks T2.4 & T2.5)', () => {
  let orderBookManager: OrderBookManager;
  let metrics: MetricsRegistry;
  let conflator: ConflationEngine;

  beforeEach(() => {
    orderBookManager = new OrderBookManager();
    metrics = new MetricsRegistry();
    conflator = new ConflationEngine({
      flushIntervalMs: 50,
      orderBookManager,
      metrics,
    });
  });

  afterEach(() => {
    conflator.stop();
  });

  function createMockSocket(bufferedAmount = 0) {
    const sentMessages: string[] = [];
    const eventHandlers: Record<string, ((...args: unknown[]) => void)[]> = {};

    const socket = {
      readyState: WebSocket.OPEN,
      bufferedAmount,
      send: vi.fn((data: string) => {
        sentMessages.push(data);
      }),
      terminate: vi.fn(() => {
        socket.readyState = WebSocket.CLOSED;
        eventHandlers['close']?.forEach((fn) => fn());
      }),
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        if (!eventHandlers[event]) eventHandlers[event] = [];
        eventHandlers[event].push(handler);
      }),
      emitMessage: (data: string) => {
        eventHandlers['message']?.forEach((fn) => fn(Buffer.from(data)));
      },
      sentMessages,
    } as unknown as WebSocket & { emitMessage: (data: string) => void; sentMessages: string[] };

    return socket;
  }

  it('should broadcast full order book snapshots in Tier 1 (Normal: < 512KB buffer)', () => {
    const socket = createMockSocket(10 * 1024); // 10 KB buffer
    conflator.handleConnection(socket);

    expect(conflator.getConnectedClientCount()).toBe(1);

    conflator.tick();

    // 5 supported pairs broadcast
    expect(socket.sentMessages).toHaveLength(5);
    const parsed = JSON.parse(socket.sentMessages[0]);
    expect(MarketUpdatePayloadSchema.safeParse(parsed).success).toBe(true);
    expect(parsed.bids.length).toBeGreaterThan(0);
    expect(parsed.asks.length).toBeGreaterThan(0);
  });

  it('should shed depth20 books (empty bids/asks) in Tier 2 (Degradation: 512KB..2MB buffer)', () => {
    const normalSocket = createMockSocket(20 * 1024); // 20 KB
    const laggySocket = createMockSocket(BACKPRESSURE_THRESHOLDS.SHED_DEPTH_BYTES + 1024); // 513 KB

    conflator.handleConnection(normalSocket);
    conflator.handleConnection(laggySocket);

    conflator.tick();

    // Normal socket gets full depth
    const normalPayload = JSON.parse(normalSocket.sentMessages[0]);
    expect(normalPayload.bids.length).toBeGreaterThan(0);
    expect(normalPayload.asks.length).toBeGreaterThan(0);

    // Laggy socket gets shed depth (preserves ticker/price, sheds order book)
    const shedPayload = JSON.parse(laggySocket.sentMessages[0]);
    expect(shedPayload.bids).toEqual([]);
    expect(shedPayload.asks).toEqual([]);
    expect(shedPayload.price).toBeGreaterThan(0);

    // Shedding metrics updated
    const sheddingCount = metrics.registry.getSingleMetric('pulsecrypto_backpressure_shedding_clients');
    expect(sheddingCount).toBeDefined();
  });

  it('should forcefully terminate connection in Tier 3 (Critical: >= 2MB buffer)', () => {
    const overloadedSocket = createMockSocket(BACKPRESSURE_THRESHOLDS.TERMINATE_BYTES + 1024); // > 2MB
    conflator.handleConnection(overloadedSocket);

    expect(conflator.getConnectedClientCount()).toBe(1);

    conflator.tick();

    expect(overloadedSocket.terminate).toHaveBeenCalled();
    expect(conflator.getConnectedClientCount()).toBe(0);
  });

  it('should process client commands: ping, setThrottle, subscribe, unsubscribe', () => {
    const socket = createMockSocket(0);
    conflator.handleConnection(socket);

    // Ping -> Pong
    socket.emitMessage(JSON.stringify({ action: 'ping' }));
    expect(socket.sentMessages).toHaveLength(1);
    const pong = JSON.parse(socket.sentMessages[0]);
    expect(pong.type).toBe('pong');
    expect(typeof pong.timestamp).toBe('number');

    // setThrottle command
    socket.emitMessage(JSON.stringify({ action: 'setThrottle', intervalMs: 250 }));
    // subscribe to specific pairs
    socket.emitMessage(JSON.stringify({ action: 'subscribe', pairs: ['BTCUSDT'] }));
    // unsubscribe
    socket.emitMessage(JSON.stringify({ action: 'unsubscribe', pairs: ['ETHUSDT'] }));

    // Send invalid command -> expect error message
    socket.emitMessage(JSON.stringify({ action: 'setThrottle', intervalMs: 1 })); // below 10ms
    const errMsg = JSON.parse(socket.sentMessages[socket.sentMessages.length - 1]);
    expect(errMsg.type).toBe('error');
  });

  it('should respect environment variable FLUSH_INTERVAL_MS', () => {
    const origEnv = process.env.FLUSH_INTERVAL_MS;
    process.env.FLUSH_INTERVAL_MS = '250';

    const customConflator = new ConflationEngine();
    expect(customConflator.flushIntervalMs).toBe(250);

    if (origEnv) {
      process.env.FLUSH_INTERVAL_MS = origEnv;
    } else {
      delete process.env.FLUSH_INTERVAL_MS;
    }
  });
});
