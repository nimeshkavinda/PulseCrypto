import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useMarketStream } from '../../hooks/useMarketStream';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';

export function HeaderStatusPill() {
  const { connectionStatus } = useMarketStream();

  let dotColor: string;
  let label: string;

  if (connectionStatus === 'CONNECTED') {
    dotColor = colors.bidGreen;
    label = 'LIVE';
  } else if (connectionStatus === 'CONNECTING' || connectionStatus === 'RECONNECTING') {
    dotColor = '#F59E0B'; // Amber
    label = 'RECONNECTING';
  } else {
    dotColor = colors.askRed;
    label = 'OFFLINE';
  }

  return (
    <View style={styles.pill} accessibilityLabel={`Gateway status: ${label}`}>
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
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.5,
  },
});
