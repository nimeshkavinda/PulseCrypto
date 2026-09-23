import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useConnectionState, useUpstream } from '../../data/store/hooks';
import { describeStatus, StatusTone } from '../../data/connectionStatus';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';

export function statusColor(tone: StatusTone): string {
  switch (tone) {
    case 'live':
      return colors.bidGreen;
    case 'warn':
      return colors.warningYellow;
    case 'down':
      return colors.askRed;
    default:
      return colors.textMuted;
  }
}

export function HeaderStatusPill() {
  const { label, tone } = describeStatus(useConnectionState(), useUpstream());
  const dotColor = statusColor(tone);

  return (
    <View style={styles.pill} accessibilityLabel={`Market data status: ${label}`}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={[styles.text, { color: dotColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs,
  },
  text: {
    fontSize: typography.fontSize.caption - 1,
    fontFamily: typography.fontFamily.monoBold,
    letterSpacing: 0.5,
  },
});
