import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import {
  SupportedPairSymbol,
  MarketUpdatePayload,
  ClientCommand,
  SUPPORTED_PAIRS,
} from '@pulsecrypto/shared';
import { defaultStorage } from '../storage/storageRepository';
import { resolveWsBaseUrl } from '../api/urlUtils';
import { BASELINE_PAIRS_METADATA } from '../api/marketApi';

export type ConnectionStatus = 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED';
export type PriceDirection = 'up' | 'down' | 'neutral';

export interface MarketConnectionContextValue {
  activePair: SupportedPairSymbol;
  setActivePair: (pair: SupportedPairSymbol) => void;
  connectionStatus: ConnectionStatus;
  throttleMs: number;
  setThrottle: (intervalMs: number) => void;
  reconnect: () => void;
  latencyMs: number;
  messagesReceivedTotal: number;
  ingestionRate: number;
  resetMetrics: () => void;
}

export interface MarketDataContextValue {
  activePayload: MarketUpdatePayload | null;
  payloads: Partial<Record<SupportedPairSymbol, MarketUpdatePayload>>;
  prevPrice: number | null;
  priceDirection: PriceDirection;
}

export type MarketStreamContextValue = MarketConnectionContextValue & MarketDataContextValue;

const MarketConnectionContext = createContext<MarketConnectionContextValue | null>(null);
const MarketDataContext = createContext<MarketDataContextValue | null>(null);
const MarketStreamContext = createContext<MarketStreamContextValue | null>(null);

/**
 * Pure helper to compute price direction between ticks.
 */
export function computePriceDirection(prevPrice: number | null, currentPrice: number): PriceDirection {
  if (prevPrice === null || prevPrice === currentPrice) {
    return 'neutral';
  }
  return currentPrice > prevPrice ? 'up' : 'down';
}

/**
 * Fast boundary check for incoming WebSocket market payloads.
 * Avoids heavy Zod tree traversal in the high-frequency tick path.
 */
export function isValidMarketPayload(raw: unknown): raw is MarketUpdatePayload {
  if (!raw || typeof raw !== 'object') return false;
  const p = raw as Partial<MarketUpdatePayload>;
  return (
    typeof p.pair === 'string' &&
    p.pair in SUPPORTED_PAIRS &&
    typeof p.price === 'number' &&
    Number.isFinite(p.price) &&
    typeof p.timestamp === 'number' &&
    Array.isArray(p.bids) &&
    Array.isArray(p.asks)
  );
}

/**
 * Creates a synthetic fallback MarketUpdatePayload from baseline metadata
 * so the terminal renders rich default UI during cold start or offline mode.
 */
export function createFallbackPayload(symbol: SupportedPairSymbol): MarketUpdatePayload {
  const meta = BASELINE_PAIRS_METADATA.find((p) => p.symbol === symbol) || BASELINE_PAIRS_METADATA[0];
  const p = meta.lastPrice;
  const spread = p * 0.0004;
  const bestBid = p - spread / 2;
  const bestAsk = p + spread / 2;

  // Generate 10 synthetic bids and asks
  const bids = Array.from({ length: 10 }, (_, i) => {
    const price = Number((bestBid - i * (p * 0.0002)).toFixed(meta.priceDecimals));
    const qty = Number((1.5 + i * 0.4).toFixed(meta.qtyDecimals));
    const total = Number((price * qty).toFixed(2));
    return [price, qty, total] as [number, number, number];
  });

  const asks = Array.from({ length: 10 }, (_, i) => {
    const price = Number((bestAsk + i * (p * 0.0002)).toFixed(meta.priceDecimals));
    const qty = Number((1.2 + i * 0.5).toFixed(meta.qtyDecimals));
    const total = Number((price * qty).toFixed(2));
    return [price, qty, total] as [number, number, number];
  });

  return {
    pair: symbol,
    timestamp: Date.now(),
    price: meta.lastPrice,
    change24h: meta.change24h,
    high24h: meta.high24h,
    low24h: meta.low24h,
    volume24h: meta.volume24h,
    spread: Number(spread.toFixed(meta.priceDecimals)),
    spreadPct: Number((spread / p).toFixed(6)),
    buyPressure: 55,
    sellPressure: 45,
    bids,
    asks,
  };
}

export function MarketStreamProvider({ children }: { children: ReactNode }) {
  const [activePair, setActivePairState] = useState<SupportedPairSymbol>(
    () => (defaultStorage.getActivePair() as SupportedPairSymbol) || 'BTCUSDT'
  );

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('CONNECTING');
  const [payloads, setPayloads] = useState<Partial<Record<SupportedPairSymbol, MarketUpdatePayload>>>(() => ({
    BTCUSDT: createFallbackPayload('BTCUSDT'),
    ETHUSDT: createFallbackPayload('ETHUSDT'),
    SOLUSDT: createFallbackPayload('SOLUSDT'),
    DOGEUSDT: createFallbackPayload('DOGEUSDT'),
    XRPUSDT: createFallbackPayload('XRPUSDT'),
  }));

  const [prevPrice, setPrevPrice] = useState<number | null>(null);
  const [priceDirection, setPriceDirection] = useState<PriceDirection>('neutral');
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [messagesReceivedTotal, setMessagesReceivedTotal] = useState<number>(0);
  const [throttleMs, setThrottleMsState] = useState<number>(() => defaultStorage.getClientThrottle());
  const [ingestionRate, setIngestionRate] = useState<number>(0);

  // In-memory Last-Value-Cache (LVC) & Conflation refs
  const lvcRef = useRef<Partial<Record<SupportedPairSymbol, MarketUpdatePayload>>>({});
  const pendingFlushRef = useRef<boolean>(false);
  const lastFlushTimeRef = useRef<number>(0);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPriceRef = useRef<number | null>(null);
  const messagesCountRef = useRef<number>(0);
  const lastSecCountRef = useRef<number>(0);
  const latencyRef = useRef<number>(0);
  const pingSentAtRef = useRef<number>(0);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const throttleIntervalRef = useRef<number>(defaultStorage.getClientThrottle());

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const activePairRef = useRef<SupportedPairSymbol>(activePair);
  activePairRef.current = activePair;

  const sendCommand = useCallback((cmd: ClientCommand) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      try {
        socketRef.current.send(JSON.stringify(cmd));
      } catch (err) {
        console.warn('[MarketStreamContext] Failed to send client command:', err);
      }
    }
  }, []);

  const setThrottle = useCallback(
    (intervalMs: number) => {
      const clamped = Math.max(10, Math.min(1000, intervalMs));
      defaultStorage.setClientThrottle(clamped);
      throttleIntervalRef.current = clamped;
      setThrottleMsState(clamped);
      sendCommand({ action: 'setThrottle', intervalMs: clamped });
    },
    [sendCommand]
  );

  const resetMetrics = useCallback(() => {
    messagesCountRef.current = 0;
    lastSecCountRef.current = 0;
    setMessagesReceivedTotal(0);
    setIngestionRate(0);
  }, []);

  /**
   * Flushes accumulated LVC buffer to React state in a single batch pass.
   * Compares prices OUTSIDE setState to avoid impure updater infinite loops.
   */
  const flushPendingUpdates = useCallback(() => {
    if (!pendingFlushRef.current) return;
    pendingFlushRef.current = false;
    lastFlushTimeRef.current = Date.now();

    const snapshot = { ...lvcRef.current };
    const currentActive = activePairRef.current;
    const activeItem = snapshot[currentActive];

    if (activeItem) {
      const currentPrice = activeItem.price;
      const oldPrice = prevPriceRef.current;
      if (oldPrice !== null && oldPrice !== currentPrice) {
        const dir = computePriceDirection(oldPrice, currentPrice);
        setPrevPrice(oldPrice);
        setPriceDirection(dir);
      } else if (oldPrice === null) {
        // Initialize direction on first payload received for the active pair
        const bestBid = activeItem.bids[0]?.[0];
        const bestAsk = activeItem.asks[0]?.[0];
        let initialDir: PriceDirection;
        if (bestBid && currentPrice <= bestBid) {
          initialDir = 'down';
        } else if (bestAsk && currentPrice >= bestAsk) {
          initialDir = 'up';
        } else {
          initialDir = activeItem.change24h >= 0 ? 'up' : 'down';
        }
        setPriceDirection(initialDir);
      }
      prevPriceRef.current = currentPrice;
    }

    // Exactly one setPayloads call per flush pass (decoupled from telemetry counters)
    setPayloads((prev) => ({ ...prev, ...snapshot }));
  }, []);

  const setActivePair = useCallback(
    (pair: SupportedPairSymbol) => {
      if (activePairRef.current === pair) return;
      activePairRef.current = pair;
      setActivePairState(pair);
      defaultStorage.setActivePair(pair);
      // Reset price tracking on pair switch
      prevPriceRef.current = null;
      setPrevPrice(null);
      setPriceDirection('neutral');
      // Subscribe to backend using correct schema contract
      sendCommand({ action: 'subscribe', pairs: [pair] });
      // Immediately flush current LVC snapshot for instant display of new pair
      pendingFlushRef.current = true;
      flushPendingUpdates();
    },
    [sendCommand, flushPendingUpdates]
  );

  const connect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }

    if (socketRef.current) {
      try {
        socketRef.current.onopen = null;
        socketRef.current.onmessage = null;
        socketRef.current.onerror = null;
        socketRef.current.onclose = null;
        socketRef.current.close();
      } catch {
        // ignore cleanup error
      }
      socketRef.current = null;
    }

    const wsUrl = resolveWsBaseUrl(defaultStorage.getGatewayUrl());
    setConnectionStatus((prev) => (prev === 'CONNECTED' ? 'RECONNECTING' : 'CONNECTING'));

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
        setConnectionStatus('CONNECTED');

        // Sync initial client throttle to backend
        const throttle = defaultStorage.getClientThrottle();
        if (throttle !== 100) {
          sendCommand({ action: 'setThrottle', intervalMs: throttle });
        }

        // Start periodic RTT ping (every 5 seconds)
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
            pingSentAtRef.current = Date.now();
            try {
              socketRef.current.send(JSON.stringify({ action: 'ping' }));
            } catch {
              // ignore send errors
            }
          }
        }, 5000);
        // Send first ping immediately
        pingSentAtRef.current = Date.now();
        sendCommand({ action: 'ping' });
      };

      ws.onmessage = (event: { data: unknown }) => {
        try {
          const raw = typeof event.data === 'string' ? JSON.parse(event.data) : null;

          // Handle pong response for RTT measurement
          if (raw && raw.type === 'pong' && pingSentAtRef.current > 0) {
            latencyRef.current = Math.max(0, Date.now() - pingSentAtRef.current);
            return;
          }

          if (!isValidMarketPayload(raw)) {
            return;
          }

          // Ingest into LVC buffer without calling setState on hot path
          messagesCountRef.current += 1;
          lvcRef.current[raw.pair] = raw;
          pendingFlushRef.current = true;

          // Throttled display-side conflation decoupled from ws.onmessage
          const FLUSH_INTERVAL_MS = throttleIntervalRef.current;
          if (!flushTimerRef.current) {
            flushTimerRef.current = setTimeout(() => {
              try {
                flushPendingUpdates();
              } finally {
                flushTimerRef.current = null;
              }
            }, FLUSH_INTERVAL_MS);
          }
        } catch {
          // invalid JSON or binary frame — ignore gracefully
        }
      };

      ws.onerror = () => {
        // WebSocket error triggers onclose next
      };

      ws.onclose = () => {
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        setConnectionStatus('RECONNECTING');
        scheduleReconnect();
      };
    } catch {
      setConnectionStatus('RECONNECTING');
      scheduleReconnect();
    }
  }, [flushPendingUpdates, sendCommand]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) return;

    reconnectAttemptsRef.current += 1;
    // Exponential backoff with jitter: 1s, 2s, 4s, up to 15s max
    const baseDelay = Math.min(15000, 1000 * Math.pow(1.5, reconnectAttemptsRef.current - 1));
    const jitter = Math.random() * 500;
    const delay = Math.round(baseDelay + jitter);

    reconnectTimeoutRef.current = setTimeout(() => {
      reconnectTimeoutRef.current = null;
      connect();
    }, delay);
  }, [connect]);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  // Connect on mount
  useEffect(() => {
    connect();

    // 1-second rolling calculation for WS message ingestion rate and telemetry counters
    const rateInterval = setInterval(() => {
      const current = messagesCountRef.current;
      const rate = Math.max(0, current - lastSecCountRef.current);
      lastSecCountRef.current = current;
      setIngestionRate(rate);
      setMessagesReceivedTotal(current);
      setLatencyMs(latencyRef.current);
    }, 1000);

    // Listen for gateway URL changes from Settings screen
    const unsubGateway = defaultStorage.subscribeGatewayUrl(() => {
      reconnectAttemptsRef.current = 0;
      connect();
    });

    // Listen for throttle changes
    const unsubThrottle = defaultStorage.subscribeClientThrottle((newThrottleMs) => {
      throttleIntervalRef.current = newThrottleMs;
      setThrottleMsState(newThrottleMs);
      sendCommand({ action: 'setThrottle', intervalMs: newThrottleMs });
    });

    // Listen for active pair changes from storage
    const unsubPair = defaultStorage.subscribeActivePair((pair) => {
      if (activePairRef.current !== pair) {
        setActivePair(pair as SupportedPairSymbol);
      }
    });

    return () => {
      clearInterval(rateInterval);
      unsubGateway();
      unsubThrottle();
      unsubPair();
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect, sendCommand, setActivePair]);

  const activePayload = payloads[activePair] || null;

  // Memoize connection and telemetry context value (isolated from 100ms market tick cascades)
  const connectionValue = useMemo<MarketConnectionContextValue>(() => ({
    activePair,
    setActivePair,
    connectionStatus,
    throttleMs,
    setThrottle,
    reconnect,
    latencyMs,
    messagesReceivedTotal,
    ingestionRate,
    resetMetrics,
  }), [
    activePair,
    setActivePair,
    connectionStatus,
    throttleMs,
    setThrottle,
    reconnect,
    latencyMs,
    messagesReceivedTotal,
    ingestionRate,
    resetMetrics,
  ]);

  // Memoize real-time market data value (only consumed by active trading views)
  const dataValue = useMemo<MarketDataContextValue>(() => ({
    activePayload,
    payloads,
    prevPrice,
    priceDirection,
  }), [
    activePayload,
    payloads,
    prevPrice,
    priceDirection,
  ]);

  // Combined context value for backward compatibility with useMarketStream
  const streamValue = useMemo<MarketStreamContextValue>(() => ({
    ...connectionValue,
    ...dataValue,
  }), [connectionValue, dataValue]);

  return (
    <MarketConnectionContext.Provider value={connectionValue}>
      <MarketDataContext.Provider value={dataValue}>
        <MarketStreamContext.Provider value={streamValue}>
          {children}
        </MarketStreamContext.Provider>
      </MarketDataContext.Provider>
    </MarketConnectionContext.Provider>
  );
}

export function useMarketConnection(): MarketConnectionContextValue {
  const ctx = useContext(MarketConnectionContext);
  if (!ctx) {
    throw new Error('useMarketConnection must be used within a MarketStreamProvider');
  }
  return ctx;
}

export function useMarketData(): MarketDataContextValue {
  const ctx = useContext(MarketDataContext);
  if (!ctx) {
    throw new Error('useMarketData must be used within a MarketStreamProvider');
  }
  return ctx;
}

export function useMarketStream(): MarketStreamContextValue {
  const ctx = useContext(MarketStreamContext);
  if (!ctx) {
    throw new Error('useMarketStream must be used within a MarketStreamProvider');
  }
  return ctx;
}
