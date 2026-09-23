import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { SupportedPairSymbol } from '@pulsecrypto/shared';
import { TickerView } from '../../data/store/marketStore';
import { STALE_AFTER_MS, usePairFreshness } from '../../data/freshness';
import { FreshnessBadge } from '../common/FreshnessBadge';
import { PriceFlash, directionColor, usePriceDirection } from '../common/PriceFlash';
import { colors } from '../../theme/tokens';
import { formatAge, formatChange, formatPrice, formatTimeOfDay, formatVolume } from '../../utils/formatters';
import { styles } from './LastPriceHero.styles';

interface LastPriceHeroProps {
  pair: SupportedPairSymbol;
  ticker: TickerView;
  /** Gateway receive time of the order book shown below, if any. */
  bookUpdatedAt: number | undefined;
  priceDecimals: number;
  baseAsset: string;
}

/** Ticks once a second, only while `enabled` (used for "x s ago" once data is stale). */
function useNow(enabled: boolean): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [enabled]);
  return Math.max(now, Date.now());
}

export const LastPriceHero = React.memo(function LastPriceHero({ pair, ticker, bookUpdatedAt, priceDecimals, baseAsset }: LastPriceHeroProps) {
  const updatedAt = Math.max(ticker.updatedAt, bookUpdatedAt ?? 0);
  const freshness = usePairFreshness(pair, updatedAt, ticker.origin);
  const now = useNow(freshness !== 'live');
  const age = now - updatedAt;

  const change = formatChange(ticker.change24h);
  const changeColor = change.positive ? colors.bidGreen : colors.askRed;
  const { direction } = usePriceDirection(pair, ticker.price);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>LAST PRICE</Text>
          <FreshnessBadge freshness={freshness} />
        </View>
        <Text style={styles.timestampText} accessibilityLabel={`Last updated ${formatTimeOfDay(updatedAt)}`}>
          Updated {formatTimeOfDay(updatedAt)}
          {age > STALE_AFTER_MS ? ` · ${formatAge(age)} ago` : ''}
        </Text>
      </View>

      <View style={styles.priceRow}>
        <PriceFlash flashKey={pair} price={ticker.price} style={styles.flashContainer}>
          <Text style={[styles.heroPrice, { color: directionColor(direction, changeColor) }]}>
            ${formatPrice(ticker.price, priceDecimals)}
          </Text>
        </PriceFlash>

        <View
          style={[styles.changeBadge, change.positive ? styles.changeBadgeGreen : styles.changeBadgeRed]}
          accessibilityLabel={`24 hour change ${change.positive ? 'up' : 'down'} ${change.text}`}
        >
          <Text style={[styles.changeText, { color: changeColor }]}>
            {change.arrow} {change.text}
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statColumn}>
          <Text style={styles.statLabel}>24H HIGH</Text>
          <Text style={styles.statValue}>${formatPrice(ticker.high24h, priceDecimals)}</Text>
        </View>
        <View style={[styles.statColumn, styles.statColumnMiddle]}>
          <Text style={styles.statLabel}>24H LOW</Text>
          <Text style={styles.statValue}>${formatPrice(ticker.low24h, priceDecimals)}</Text>
        </View>
        <View style={[styles.statColumn, styles.statColumnRight]}>
          <Text style={styles.statLabel}>24H VOL</Text>
          <Text style={styles.statValue}>
            {formatVolume(ticker.volume24h)} {baseAsset}
          </Text>
        </View>
      </View>
    </View>
  );
});
