import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import {
  SupportedPairSymbol,
  MarketUpdatePayload,
  MarketUpdatePayloadSchema,
  ClientCommand,
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

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const activePairRef = useRef<SupportedPairSymbol>(activePair);
  activePairRef.current = activePair;

  const setActivePair = useCallback((pair: SupportedPairSymbol) => {
    setActivePairState(pair);
    defaultStorage.setActivePair(pair);
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

      ws.onmessage = (event: WebSocketMessageEvent) => {
        try {
          const raw = typeof event.data === 'string' ? JSON.parse(event.data) : null;
          if (!raw || !raw.pair) return;

          const parsed = MarketUpdatePayloadSchema.safeParse(raw);
          if (!parsed.success) return;

          const payload = parsed.data;
          setMessagesReceivedTotal((count) => count + 1);

          if (payload.timestamp) {
            const now = Date.now();
            setLatencyMs(Math.max(0, now - payload.timestamp));
          }

          setPayloads((prev) => ({
            ...prev,
            [payload.pair]: payload,
          }));

          // Track price direction for active pair
          if (payload.pair === activePairRef.current) {
            setPayloads((current) => {
              const prevItem = current[payload.pair];
              if (prevItem && prevItem.price !== payload.price) {
                setPrevPrice(prevItem.price);
                setPriceDirection(payload.price > prevItem.price ? 'up' : 'down');
              }
              return { ...current, [payload.pair]: payload };
            });
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
  }, [sendCommand]);

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
      setActivePairState(pair as SupportedPairSymbol);
    });

    return () => {
      unsubGateway();
      unsubThrottle();
      unsubPair();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect, sendCommand]);

  const activePayload = payloads[activePair] || null;

  const value: MarketStreamContextValue = {
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
  };

  return <MarketStreamContext.Provider value={value}>{children}</MarketStreamContext.Provider>;
}

export function useMarketStream(): MarketStreamContextValue {
  const ctx = useContext(MarketStreamContext);
  if (!ctx) {
    throw new Error('useMarketStream must be used within a MarketStreamProvider');
  }
  return ctx;
}
