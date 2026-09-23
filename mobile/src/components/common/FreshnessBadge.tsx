import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Freshness } from '../../data/freshness';
import { colors, typography, borderRadius } from '../../theme/tokens';

const LOOK: Record<Freshness, { label: string; fg: string; bg: string }> = {
  live: { label: 'LIVE', fg: colors.bidGreen, bg: colors.bidGreenSubtle },
  delayed: { label: 'DELAYED', fg: colors.warningYellow, bg: colors.warningYellowSubtle },
  cached: { label: 'CACHED', fg: colors.accentBlue, bg: colors.accentBlueSubtle },
  offline: { label: 'OFFLINE', fg: colors.askRed, bg: colors.askRedSubtle },
  none: { label: 'SYNCING', fg: colors.textMuted, bg: 'rgba(255, 255, 255, 0.06)' },
};

export const FRESHNESS_LABEL: Record<Freshness, string> = {
  live: 'live',
  delayed: 'delayed',
  cached: 'cached',
  offline: 'offline',
  none: 'loading',
};

/** Per-pair data freshness pill (the watchlist's "live connection indicator"). */
export const FreshnessBadge = React.memo(function FreshnessBadge({ freshness }: { freshness: Freshness }) {
  const look = LOOK[freshness];
  return (
    <View style={[styles.pill, { backgroundColor: look.bg }]} accessibilityLabel={`Data ${FRESHNESS_LABEL[freshness]}`}>
      <View style={[styles.dot, { backgroundColor: look.fg }]} />
      <Text style={[styles.text, { color: look.fg }]}>{look.label}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  text: { fontSize: 9, fontFamily: typography.fontFamily.bold, letterSpacing: 0.5 },
});
