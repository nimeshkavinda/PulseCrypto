import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PairMetadata } from '@pulsecrypto/shared';
import { colors } from '../../theme/tokens';
import { formatPrice, formatVolume } from '../../utils/formatters';
import { styles } from './MarketPairCard.styles';

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
        onPress={(e) => {
          e.stopPropagation();
          onToggleFavorite(item.symbol);
        }}
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
