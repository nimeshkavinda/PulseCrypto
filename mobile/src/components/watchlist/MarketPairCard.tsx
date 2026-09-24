import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SupportedPairSymbol } from '@pulsecrypto/shared';
import { useTicker } from '../../data/store/hooks';
import { usePairFreshness } from '../../data/freshness';
import { FreshnessBadge, FRESHNESS_LABEL } from '../common/FreshnessBadge';
import { PriceFlash } from '../common/PriceFlash';
import { Skeleton } from '../common/Skeleton';
import { colors } from '../../theme/tokens';
import { formatChange, formatPrice, formatVolume } from '../../utils/formatters';
import { WatchRow } from './filterUtils';
import { styles } from './MarketPairCard.styles';

export interface MarketPairCardProps {
  row: WatchRow;
  isFavorite: boolean;
  onToggleFavorite: (symbol: SupportedPairSymbol) => void;
  onPress: (symbol: SupportedPairSymbol) => void;
}

/**
 * One watchlist row, bound to its pair's live ticker. It re-renders only when its own ticker,
 * freshness or favourite flag changes; other pairs' ticks never touch it.
 */
export const MarketPairCard = React.memo(function MarketPairCard({ row, isFavorite, onToggleFavorite, onPress }: MarketPairCardProps) {
  const ticker = useTicker(row.symbol);
  const values = ticker ?? (row.snapshot && { price: row.snapshot.lastPrice, ...row.snapshot });
  // REST values (before the first stream ticker) count as data: OFFLINE when disconnected.
  const source = ticker?.origin ?? (values ? 'rest' : undefined);
  const freshness = usePairFreshness(row.symbol, ticker?.updatedAt, source, ticker?.receivedAt);

  const change = values ? formatChange(values.change24h) : null;
  const halted = row.tradingStatus && row.tradingStatus !== 'TRADING';
  const priceText = values ? `$${formatPrice(values.price, row.priceDecimals)}` : null;

  // The favourite toggle is a sibling of the row's touchable, not a child: an accessible touchable
  // hides its children from VoiceOver/TalkBack, which made the star unreachable.
  return (
    <View style={styles.card}>
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.cardMain}
        onPress={() => onPress(row.symbol)}
        accessibilityRole="button"
        accessibilityLabel={
          values && change
            ? `${row.displayName}, ${priceText}, 24 hour change ${change.positive ? 'up' : 'down'} ${change.text}, ${FRESHNESS_LABEL[freshness]}`
            : `${row.displayName}, loading`
        }
      >
        <View style={styles.leftColumn}>
          <View style={styles.symbolRow}>
            <Text style={styles.symbolText}>{row.displayName}</Text>
            <FreshnessBadge freshness={freshness} />
            {halted ? <Text style={styles.haltedText}>{row.tradingStatus}</Text> : null}
          </View>
          {values ? (
            <>
              <Text style={styles.volumeText}>
                Vol: {formatVolume(values.volume24h)} {row.baseAsset}
              </Text>
              <View style={styles.rangeRow}>
                <Text style={styles.rangeLabel}>
                  H: <Text style={styles.rangeValue}>${formatPrice(values.high24h, row.priceDecimals)}</Text>
                </Text>
                <Text style={[styles.rangeLabel, styles.rangeMarginLeft]}>
                  L: <Text style={styles.rangeValue}>${formatPrice(values.low24h, row.priceDecimals)}</Text>
                </Text>
              </View>
            </>
          ) : (
            <Skeleton width={120} height={12} style={styles.skeletonLine} />
          )}
        </View>

        <View style={styles.rightColumn}>
          {values && change ? (
            <>
              <PriceFlash flashKey={row.symbol} source={source} price={values.price} style={styles.priceFlash}>
                <Text style={styles.priceText}>{priceText}</Text>
              </PriceFlash>
              <View style={[styles.changePill, change.positive ? styles.changePillPositive : styles.changePillNegative]}>
                <Text style={[styles.changeText, change.positive ? styles.changeTextPositive : styles.changeTextNegative]}>
                  {change.arrow} {change.text}
                </Text>
              </View>
            </>
          ) : (
            <>
              <Skeleton width={96} height={18} />
              <Skeleton width={68} height={20} style={styles.skeletonLine} />
            </>
          )}
        </View>
      </TouchableOpacity>

        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={() => onToggleFavorite(row.symbol)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isFavorite }}
          accessibilityLabel={`Toggle favourite for ${row.symbol}`}
        >
          <Ionicons name={isFavorite ? 'star' : 'star-outline'} size={20} color={isFavorite ? colors.warningYellow : colors.textMuted} />
        </TouchableOpacity>
    </View>
  );
});
