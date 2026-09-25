import { createStore, StoreApi } from 'zustand/vanilla';
import { Book, SupportedPairSymbol, Ticker, UpstreamStatus } from '@pulsecrypto/shared';
import { ConnectionSnapshot } from '../stream/MarketStreamClient';

/** Where a value came from: this session's stream, or the on-device cache of an earlier session. */
export type DataOrigin = 'live' | 'cache';

/**
 * `receivedAt` is this device's clock when the value arrived (live values only). Freshness uses
 * it instead of the gateway's `updatedAt`, so a device clock that is off does not skew LIVE.
 */
export type TickerView = Ticker & { origin: DataOrigin; receivedAt?: number };
export type BookView = Book & { origin: DataOrigin; receivedAt?: number };

export interface UpstreamView {
  status: UpstreamStatus;
  stalePairs: SupportedPairSymbol[];
  since: number;
}

export interface MarketState {
  /** Per-pair entries are replaced only when that pair changes, so per-pair selectors stay stable. */
  tickers: Partial<Record<SupportedPairSymbol, TickerView>>;
  books: Partial<Record<SupportedPairSymbol, BookView>>;
  upstream: UpstreamView | null;
  connection: ConnectionSnapshot;
  activePair: SupportedPairSymbol;
  /** When the cached snapshot shown at cold start was saved (null if none was loaded). */
  cachedAt: number | null;
  /** True while adaptive mode is slowing the stream because the connection is metered. */
  adaptiveActive: boolean;
}

export type MarketStore = StoreApi<MarketState>;

export const INITIAL_CONNECTION: ConnectionSnapshot = {
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

export function createMarketStore(initial: Partial<MarketState> = {}): MarketStore {
  return createStore<MarketState>()(() => ({
    tickers: {},
    books: {},
    upstream: null,
    connection: INITIAL_CONNECTION,
    activePair: 'BTCUSDT',
    cachedAt: null,
    adaptiveActive: false,
    ...initial,
  }));
}
