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

export interface MarketStreamContextValue {
  activePair: SupportedPairSymbol;
  setActivePair: (pair: SupportedPairSymbol) => void;
  activePayload: MarketUpdatePayload | null;
  payloads: Partial<Record<SupportedPairSymbol, MarketUpdatePayload>>;
  connectionStatus: ConnectionStatus;
  prevPrice: number | null;
  priceDirection: PriceDirection;
  setThrottle: (intervalMs: number) => void;
  reconnect: () => void;
  latencyMs: number;
  messagesReceivedTotal: number;
}

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

  // In-memory Last-Value-Cache (LVC) & Conflation refs
  const lvcRef = useRef<Partial<Record<SupportedPairSymbol, MarketUpdatePayload>>>({});
  const pendingFlushRef = useRef<boolean>(false);
  const lastFlushTimeRef = useRef<number>(0);
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevPriceRef = useRef<number | null>(null);
  const messagesCountRef = useRef<number>(0);
  const latencyRef = useRef<number>(0);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const activePairRef = useRef<SupportedPairSymbol>(activePair);
  activePairRef.current = activePair;

  const setActivePair = useCallback((pair: SupportedPairSymbol) => {
    if (activePairRef.current === pair) return;
    activePairRef.current = pair;
    setActivePairState(pair);
    defaultStorage.setActivePair(pair);
    // Reset price tracking on pair switch
    prevPriceRef.current = null;
    setPrevPrice(null);
    setPriceDirection('neutral');
  }, []);

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
      defaultStorage.setClientThrottle(intervalMs);
      sendCommand({ action: 'setThrottle', intervalMs });
    },
    [sendCommand]
  );

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
      }
      prevPriceRef.current = currentPrice;
    }

    // Exactly one setPayloads call per flush pass
    setPayloads((prev) => ({ ...prev, ...snapshot }));
    setMessagesReceivedTotal(messagesCountRef.current);
    setLatencyMs(latencyRef.current);
  }, []);

  const connect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
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
      };

      ws.onmessage = (event: { data: unknown }) => {
        try {
          const raw = typeof event.data === 'string' ? JSON.parse(event.data) : null;
          if (!isValidMarketPayload(raw)) {
            return;
          }

          // Ingest into LVC buffer without calling setState on hot path
          messagesCountRef.current += 1;
          if (raw.timestamp) {
            latencyRef.current = Math.max(0, Date.now() - raw.timestamp);
          }
          lvcRef.current[raw.pair] = raw;
          pendingFlushRef.current = true;

          // Throttled display-side conflation (target: ~3-4 renders/sec, well under 10/sec ceiling)
          const now = Date.now();
          const FLUSH_INTERVAL_MS = 250;
          const elapsed = now - lastFlushTimeRef.current;

          if (elapsed >= FLUSH_INTERVAL_MS) {
            flushPendingUpdates();
          } else if (!flushTimerRef.current) {
            flushTimerRef.current = setTimeout(() => {
              flushTimerRef.current = null;
              flushPendingUpdates();
            }, FLUSH_INTERVAL_MS - elapsed);
          }
        } catch {
          // invalid JSON or binary frame — ignore gracefully
        }
      };

      ws.onerror = () => {
        // WebSocket error triggers onclose next
      };

      ws.onclose = () => {
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

    // Listen for gateway URL changes from Settings screen
    const unsubGateway = defaultStorage.subscribeGatewayUrl(() => {
      reconnectAttemptsRef.current = 0;
      connect();
    });

    // Listen for throttle changes
    const unsubThrottle = defaultStorage.subscribeClientThrottle((throttleMs) => {
      sendCommand({ action: 'setThrottle', intervalMs: throttleMs });
    });

    // Listen for active pair changes from storage
    const unsubPair = defaultStorage.subscribeActivePair((pair) => {
      if (activePairRef.current !== pair) {
        setActivePair(pair as SupportedPairSymbol);
      }
    });

    return () => {
      unsubGateway();
      unsubThrottle();
      unsubPair();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect, sendCommand, setActivePair]);

  const activePayload = payloads[activePair] || null;

  // Memoize context value so consumer components do not re-render unless values actually change
  const value = useMemo<MarketStreamContextValue>(() => ({
    activePair,
    setActivePair,
    activePayload,
    payloads,
    connectionStatus,
    prevPrice,
    priceDirection,
    setThrottle,
    reconnect,
    latencyMs,
    messagesReceivedTotal,
  }), [
    activePair,
    setActivePair,
    activePayload,
    payloads,
    connectionStatus,
    prevPrice,
    priceDirection,
    setThrottle,
    reconnect,
    latencyMs,
    messagesReceivedTotal,
  ]);

  return <MarketStreamContext.Provider value={value}>{children}</MarketStreamContext.Provider>;
}

export function useMarketStream(): MarketStreamContextValue {
  const ctx = useContext(MarketStreamContext);
  if (!ctx) {
    throw new Error('useMarketStream must be used within a MarketStreamProvider');
  }
  return ctx;
}
