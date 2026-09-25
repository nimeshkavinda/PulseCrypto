import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';
import { formatPercentSig, formatPrice } from '../../utils/formatters';

interface PressureSpreadBarProps {
  buyPressure: number;
  sellPressure: number;
  spread: number;
  spreadPct: number;
  priceDecimals: number;
  quoteAsset: string;
}

/**
 * Buy/sell pressure (share of resting quantity on each side of the published book) as a split bar
 * with exact percentages, plus the absolute and relative bid/ask spread.
 */
export const PressureSpreadBar = React.memo(function PressureSpreadBar({
  buyPressure,
  sellPressure,
  spread,
  spreadPct,
  priceDecimals,
  quoteAsset,
}: PressureSpreadBarProps) {
  return (
    <View style={styles.container}>
      <View style={styles.labels}>
        <Text style={[styles.side, { color: colors.bidGreen }]} accessibilityLabel={`Buy pressure ${buyPressure.toFixed(1)} percent`}>
          BUY {buyPressure.toFixed(1)}%
        </Text>
        <Text style={[styles.side, { color: colors.askRed }]} accessibilityLabel={`Sell pressure ${sellPressure.toFixed(1)} percent`}>
          {sellPressure.toFixed(1)}% SELL
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { flex: Math.max(buyPressure, 0.5), backgroundColor: colors.bidGreen }]} />
        <View style={styles.gap} />
        <View style={[styles.fill, { flex: Math.max(sellPressure, 0.5), backgroundColor: colors.askRed }]} />
      </View>
      <View style={styles.spreadRow}>
        <Text style={styles.spreadLabel}>SPREAD</Text>
        <Text
          style={styles.spreadValue}
          accessibilityLabel={`Spread ${formatPrice(spread, priceDecimals)} ${quoteAsset}, ${formatPercentSig(spreadPct)} percent`}
        >
          {formatPrice(spread, priceDecimals)} {quoteAsset} ({formatPercentSig(spreadPct)}%)
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  side: { fontSize: typography.fontSize.caption, fontFamily: typography.fontFamily.monoBold, letterSpacing: 0.5 },
  track: { flexDirection: 'row', height: 6, borderRadius: borderRadius.pill, overflow: 'hidden' },
  fill: { height: 6 },
  gap: { width: 2 },
  spreadRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  spreadLabel: { color: colors.textMuted, fontSize: typography.fontSize.caption, fontFamily: typography.fontFamily.monoMedium, letterSpacing: 0.5 },
  spreadValue: { color: colors.textPrimary, fontSize: typography.fontSize.caption, fontFamily: typography.fontFamily.monoMedium },
});
