import { ConnectionState } from './stream/MarketStreamClient';
import { UpstreamView } from './store/marketStore';

export type StatusTone = 'live' | 'warn' | 'down' | 'muted';

export interface StatusLabel {
  label: string;
  tone: StatusTone;
}

/**
 * One user-facing status that combines the app↔gateway socket with gateway↔exchange freshness.
 * An open socket is only "LIVE" when the exchange feed is live too.
 */
export function describeStatus(state: ConnectionState, upstream: UpstreamView | null): StatusLabel {
  switch (state) {
    case 'open':
      if (!upstream || upstream.status === 'live') return { label: 'LIVE', tone: 'live' };
      if (upstream.status === 'stale') return { label: 'DELAYED', tone: 'warn' };
      // The gateway is up but still reaching the exchange (e.g. warming up after a restart).
      if (upstream.status === 'connecting') return { label: 'CONNECTING', tone: 'warn' };
      return { label: 'NO FEED', tone: 'down' };
    case 'idle':
    case 'connecting':
      return { label: 'CONNECTING', tone: 'warn' };
    case 'backoff':
      return { label: 'RECONNECTING', tone: 'warn' };
    case 'offline':
      return { label: 'OFFLINE', tone: 'down' };
    default:
      return { label: 'PAUSED', tone: 'muted' };
  }
}
