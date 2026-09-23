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
 * - `offline`: the app is not connected to the gateway (last values kept).
 * - `none`: nothing to show yet.
 */
export type Freshness = 'live' | 'delayed' | 'cached' | 'offline' | 'none';

export const STALE_AFTER_MS = 5000;

export interface FreshnessInputs {
  pair: SupportedPairSymbol;
  connection: ConnectionState;
  upstream: UpstreamView | null;
  updatedAt: number | undefined;
  origin: DataOrigin | undefined;
  now: number;
}

export function pairFreshness({ pair, connection, upstream, updatedAt, origin, now }: FreshnessInputs): Freshness {
  if (!updatedAt) return 'none';
  if (origin === 'cache') return 'cached';
  if (connection !== 'open') return 'offline';
  // Exchange feed down (or not yet up) affects every pair; a partial stall only the listed pairs.
  if (upstream && (upstream.status === 'down' || upstream.status === 'connecting' || upstream.stalePairs.includes(pair))) {
    return 'delayed';
  }
  if (now - updatedAt > STALE_AFTER_MS) return 'delayed';
  return 'live';
}

/**
 * Freshness for one pair. Re-renders only on transitions: while `live`, a single timer fires at the
 * moment the data would turn stale, instead of a per-second tick for every row.
 */
export function usePairFreshness(
  pair: SupportedPairSymbol,
  updatedAt: number | undefined,
  origin: DataOrigin | undefined
): Freshness {
  const connection = useConnectionState();
  const upstream = useUpstream();
  const [now, setNow] = useState(() => Date.now());
  const freshness = pairFreshness({ pair, connection, upstream, updatedAt, origin, now: Math.max(now, Date.now()) });

  useEffect(() => {
    if (freshness !== 'live' || !updatedAt) return;
    const delay = Math.max(0, updatedAt + STALE_AFTER_MS - Date.now()) + 50;
    const id = setTimeout(() => setNow(Date.now()), delay);
    return () => clearTimeout(id);
  }, [freshness, updatedAt]);

  return freshness;
}
