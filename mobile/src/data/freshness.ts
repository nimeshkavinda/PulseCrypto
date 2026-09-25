import { useEffect, useState } from 'react';
import { SupportedPairSymbol } from '@pulsecrypto/shared';
import { ConnectionState } from './stream/MarketStreamClient';
import { DataOrigin, UpstreamView } from './store/marketStore';
import { useConnectionState, useUpstream } from './store/hooks';

/**
 * How trustworthy a pair's displayed data is right now.
 * - `live`: socket open, exchange feed live, pair not stale, updated within STALE_AFTER_MS.
 * - `delayed`: socket open but the exchange feed is down, this pair is listed stale, or its data is old.
 * - `cached`: values come from the on-device snapshot of an earlier session.
 * - `offline`: the app is not connected to the gateway (last values kept, including REST values).
 * - `none`: nothing to show yet, or only REST values while the stream is connecting up.
 */
export type Freshness = 'live' | 'delayed' | 'cached' | 'offline' | 'none';

export const STALE_AFTER_MS = 5000;

/** `rest`: values from the `/pairs/meta` snapshot, shown until the first stream ticker. */
export type FreshnessSource = DataOrigin | 'rest';

export interface FreshnessInputs {
  pair: SupportedPairSymbol;
  connection: ConnectionState;
  upstream: UpstreamView | null;
  /** Gateway receive time (gateway clock). */
  updatedAt: number | undefined;
  /** Local receive time (device clock); preferred for the age check when present. */
  receivedAt?: number;
  origin: FreshnessSource | undefined;
  now: number;
}

export function pairFreshness({ pair, connection, upstream, updatedAt, receivedAt, origin, now }: FreshnessInputs): Freshness {
  const at = receivedAt ?? updatedAt;
  if (!origin || (origin !== 'rest' && !at)) return 'none';
  if (origin === 'cache') return 'cached';
  if (connection !== 'open') return 'offline';
  if (origin === 'rest' || !at) return 'none';
  // Exchange feed down (or not yet up) affects every pair; a partial stall only the listed pairs.
  if (upstream && (upstream.status === 'down' || upstream.status === 'connecting' || upstream.stalePairs.includes(pair))) {
    return 'delayed';
  }
  if (now - at > STALE_AFTER_MS) return 'delayed';
  return 'live';
}

/**
 * Freshness for one pair. Re-renders only on transitions: while `live`, a single timer fires at the
 * moment the data would turn stale, instead of a per-second tick for every row.
 */
export function usePairFreshness(
  pair: SupportedPairSymbol,
  updatedAt: number | undefined,
  origin: FreshnessSource | undefined,
  receivedAt?: number
): Freshness {
  const connection = useConnectionState();
  const upstream = useUpstream();
  const [now, setNow] = useState(() => Date.now());
  // `now` only needs to be current for age checks; a timer below advances it exactly when the
  // data would turn stale. New data (a newer receive time) is by definition fresh.
  const freshness = pairFreshness({ pair, connection, upstream, updatedAt, receivedAt, origin, now });
  const at = receivedAt ?? updatedAt;

  useEffect(() => {
    if (freshness !== 'live' || !at) return;
    const delay = Math.max(0, at + STALE_AFTER_MS - Date.now()) + 50;
    const id = setTimeout(() => setNow(Date.now()), delay);
    return () => clearTimeout(id);
  }, [freshness, at]);

  return freshness;
}
