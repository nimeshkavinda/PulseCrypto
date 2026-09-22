import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PairMetadata } from '@pulsecrypto/shared';
import { colors, typography, spacing, borderRadius } from '../../theme/tokens';
import { formatPrice, formatVolume } from '../../utils/formatters';

export interface MarketPairCardProps {
  item: PairMetadata;
  isFavorite: boolean;
  onToggleFavorite: (symbol: string) => void;
  onPress: (symbol: string) => void;
}

export function MarketPairCard({
  item,
  isFavorite,
  onToggleFavorite,
  onPress,
}: MarketPairCardProps) {
  const isPositive = item.change24h >= 0;
  const changeFormatted = `${isPositive ? '+' : ''}${item.change24h.toFixed(2)}%`;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.card}
      onPress={() => onPress(item.symbol)}
      accessibilityRole="button"
      accessibilityLabel={`${item.displayName}, price $${item.lastPrice}, 24h change ${changeFormatted}`}
    >
      {/* Left Column: Asset Info & Live Pill */}
      <View style={styles.leftColumn}>
        <View style={styles.symbolRow}>
          <Text style={styles.symbolText}>{item.displayName}</Text>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        <Text style={styles.volumeText}>
          Vol: ${formatVolume(item.volume24h)}
        </Text>

        <View style={styles.rangeRow}>
          <Text style={styles.rangeLabel}>
            H: <Text style={styles.rangeValue}>${formatPrice(item.high24h, item.priceDecimals)}</Text>
          </Text>
          <Text style={[styles.rangeLabel, styles.rangeMarginLeft]}>
            L: <Text style={styles.rangeValue}>${formatPrice(item.low24h, item.priceDecimals)}</Text>
          </Text>
        </View>
      </View>

      {/* Right Column: Price & 24h Change Pill */}
      <View style={styles.rightColumn}>
        <Text style={styles.priceText}>
          ${formatPrice(item.lastPrice, item.priceDecimals)}
        </Text>

        <View
          style={[
            styles.changePill,
            isPositive ? styles.changePillPositive : styles.changePillNegative,
          ]}
        >
          <Text
            style={[
              styles.changeText,
              isPositive ? styles.changeTextPositive : styles.changeTextNegative,
            ]}
          >
            {changeFormatted}
          </Text>
        </View>
      </View>

      {/* Star Favorite Toggle Button */}
      <TouchableOpacity
        style={styles.favoriteButton}
        onPress={() => onToggleFavorite(item.symbol)}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isFavorite }}
        accessibilityLabel={`Toggle favourite for ${item.symbol}`}
      >
        <Ionicons
          name={isFavorite ? 'star' : 'star-outline'}
          size={20}
          color={isFavorite ? colors.warningYellow : colors.textMuted}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  symbolText: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.subtitle,
    fontWeight: typography.fontWeight.bold,
    marginRight: spacing.sm,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bidGreenSubtle,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.bidGreen,
    marginRight: 4,
  },
  liveText: {
    color: colors.bidGreen,
    fontSize: 9,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 0.5,
  },
  volumeText: {
    color: colors.textSecondary,
    fontSize: typography.fontSize.caption,
    marginBottom: spacing.xs,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rangeLabel: {
    color: colors.textMuted,
    fontSize: typography.fontSize.caption,
  },
  rangeValue: {
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  rangeMarginLeft: {
    marginLeft: spacing.md,
  },
  rightColumn: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  priceText: {
    color: colors.textPrimary,
    fontSize: typography.fontSize.subtitle,
    fontWeight: typography.fontWeight.bold,
    fontFamily: typography.fontFamily.mono,
    marginBottom: spacing.xs,
  },
  changePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    minWidth: 68,
    alignItems: 'center',
  },
  changePillPositive: {
    backgroundColor: colors.bidGreenSubtle,
  },
  changePillNegative: {
    backgroundColor: colors.askRedSubtle,
  },
  changeText: {
    fontSize: typography.fontSize.caption,
    fontWeight: typography.fontWeight.bold,
  },
  changeTextPositive: {
    color: colors.bidGreen,
  },
  changeTextNegative: {
    color: colors.askRed,
  },
  favoriteButton: {
    padding: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
