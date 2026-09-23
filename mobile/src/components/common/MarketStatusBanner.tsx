import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SUPPORTED_PAIRS } from '@pulsecrypto/shared';
import { useConnection, useMarket, useUpstream } from '../../data/store/hooks';
import { ConnectionSnapshot } from '../../data/stream/MarketStreamClient';
import { MarketState, UpstreamView } from '../../data/store/marketStore';
import { formatTimeOfDay } from '../../utils/formatters';
import { colors, typography, spacing } from '../../theme/tokens';

export interface BannerContent {
  tone: 'warn' | 'down' | 'info';
  text: string;
}

/**
 * What (if anything) to tell the user about data quality. Null when everything is live.
 * Pure so every state is unit-tested; `now` drives the reconnect countdown.
 */
export function bannerContent(
  connection: Pick<ConnectionSnapshot, 'state' | 'nextRetryAt'>,
  upstream: UpstreamView | null,
  lastDataAt: number | null,
  now: number
): BannerContent | null {
  const since = lastDataAt ? ` Showing prices from ${formatTimeOfDay(lastDataAt)}.` : '';
  switch (connection.state) {
    case 'offline':
      return { tone: 'down', text: `You're offline.${since || ' Showing the last prices received.'}` };
    case 'backoff': {
      const secs = connection.nextRetryAt ? Math.max(0, Math.ceil((connection.nextRetryAt - now) / 1000)) : 0;
      return { tone: 'warn', text: `Connection lost. Reconnecting${secs > 0 ? ` in ${secs}s` : '…'}` };
    }
    case 'connecting':
    case 'idle':
      return lastDataAt ? { tone: 'info', text: `Connecting…${since}` } : null;
    case 'paused':
      return null;
    case 'open':
      if (upstream && (upstream.status === 'down' || upstream.status === 'connecting')) {
        return { tone: 'down', text: 'Exchange feed unavailable. Prices may be out of date.' };
      }
      if (upstream && upstream.status === 'stale' && upstream.stalePairs.length > 0) {
        const names = upstream.stalePairs.map((p) => SUPPORTED_PAIRS[p].baseAsset).join(', ');
        return { tone: 'warn', text: `Delayed: ${names}` };
      }
      return null;
  }
}

const TONE = {
  warn: { bg: colors.warningYellowSubtle, fg: colors.warningYellow },
  down: { bg: colors.askRedSubtle, fg: colors.askRed },
  info: { bg: colors.accentBlueSubtle, fg: colors.accentBlue },
};

/** Time of the newest price on screen (live or cached), or null. */
export function latestDataAt(s: Pick<MarketState, 'tickers'>): number | null {
  let latest = 0;
  for (const t of Object.values(s.tickers)) if (t && t.updatedAt > latest) latest = t.updatedAt;
  return latest || null;
}

/** Connection / data-quality banner shown above market content. */
export function MarketStatusBanner() {
  const connection = useConnection();
  const upstream = useUpstream();
  // Only needed while disconnected; a constant while open so ticks don't re-render the banner.
  const lastDataAt = useMarket((s) => (s.connection.state === 'open' ? null : latestDataAt(s)));
  const [now, setNow] = useState(Date.now);

  // A 1 s countdown tick only while waiting to reconnect.
  useEffect(() => {
    if (connection.state !== 'backoff') return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0); // refresh immediately so the countdown starts accurate
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [connection.state]);

  const content = bannerContent(connection, upstream, lastDataAt, now);
  if (!content) return null;
  const tone = TONE[content.tone];
  return (
    <View style={[styles.banner, { backgroundColor: tone.bg }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={[styles.text, { color: tone.fg }]}>{content.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  text: { fontSize: typography.fontSize.small, fontFamily: typography.fontFamily.medium },
});
