import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line } from 'react-native-svg';
import { DepthTuple } from '@pulsecrypto/shared';
import { colors } from '../../theme/tokens';
import { formatPrice, formatVolume } from '../../utils/formatters';
import { buildDepthGeometry } from '../../utils/depthChart';
import { styles } from './MarketDepthChart.styles';

interface MarketDepthChartProps {
  bids: DepthTuple[];
  asks: DepthTuple[];
  baseAsset: string;
  priceDecimals: number;
  spreadPct: number;
  buyPressure: number;
  sellPressure: number;
}

const CHART_HEIGHT = 170;
const MID_LABEL_WIDTH = 90;

/**
 * Cumulative depth: x is price (deepest bid → deepest ask), y is cumulative base quantity.
 * Geometry is a pure function of the book (see utils/depthChart.ts), memoised per book update.
 */
export const MarketDepthChart = React.memo(function MarketDepthChart({
  bids,
  asks,
  baseAsset,
  priceDecimals,
  spreadPct,
  buyPressure,
  sellPressure,
}: MarketDepthChartProps) {
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0) setWidth((prev) => (prev === w ? prev : w));
  }, []);

  const geometry = useMemo(() => buildDepthGeometry(bids, asks, width, CHART_HEIGHT), [bids, asks, width]);

  const gapLabel = spreadPct <= 0.05 ? 'Low' : spreadPct <= 0.15 ? 'Moderate' : 'High';
  const gapColor = spreadPct <= 0.05 ? colors.bidGreen : spreadPct <= 0.15 ? colors.textSecondary : colors.askRed;
  const pressure =
    buyPressure > 55
      ? { label: 'Buy Heavy', color: colors.bidGreen }
      : sellPressure > 55
        ? { label: 'Sell Heavy', color: colors.askRed }
        : { label: 'Balanced', color: colors.textSecondary };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>MARKET DEPTH</Text>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.bidGreen }]} />
            <Text style={styles.legendText}>
              Bids: {formatVolume(geometry?.totalBidQty ?? 0)} {baseAsset}
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.askRed }]} />
            <Text style={styles.legendText}>
              Asks: {formatVolume(geometry?.totalAskQty ?? 0)} {baseAsset}
            </Text>
          </View>
        </View>
      </View>

      <View
        style={[styles.chartContainer, { height: CHART_HEIGHT }]}
        onLayout={onLayout}
        accessibilityLabel={`Market depth chart: ${formatVolume(geometry?.totalBidQty ?? 0)} ${baseAsset} bid, ${formatVolume(geometry?.totalAskQty ?? 0)} ${baseAsset} ask`}
      >
        {geometry ? (
          <Svg width={width} height={CHART_HEIGHT}>
            <Defs>
              <LinearGradient id="bidGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={colors.bidGreen} stopOpacity="0.35" />
                <Stop offset="100%" stopColor={colors.bidGreen} stopOpacity="0.04" />
              </LinearGradient>
              <LinearGradient id="askGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={colors.askRed} stopOpacity="0.35" />
                <Stop offset="100%" stopColor={colors.askRed} stopOpacity="0.04" />
              </LinearGradient>
            </Defs>
            <Path d={geometry.bidPath} fill="url(#bidGrad)" stroke={colors.bidGreen} strokeWidth={1.5} />
            <Path d={geometry.askPath} fill="url(#askGrad)" stroke={colors.askRed} strokeWidth={1.5} />
            <Line x1={geometry.midX} y1={0} x2={geometry.midX} y2={CHART_HEIGHT} stroke="rgba(255, 255, 255, 0.16)" strokeWidth={1} />
          </Svg>
        ) : null}

        <View style={styles.floatingBadgeCard}>
          <View style={styles.badgeColumn}>
            <Text style={styles.badgeTitle}>LIQUIDITY GAP</Text>
            <Text style={[styles.badgeValue, { color: gapColor }]} numberOfLines={1}>
              {gapLabel} ({spreadPct.toFixed(2)}%)
            </Text>
          </View>
          <View style={styles.badgeDivider} />
          <View style={styles.badgeColumn}>
            <Text style={styles.badgeTitle}>PRESSURE</Text>
            <Text style={[styles.badgeValue, { color: pressure.color }]} numberOfLines={1}>
              {pressure.label}
            </Text>
          </View>
        </View>
      </View>

      {geometry ? (
        <View style={styles.axisRow}>
          <Text style={styles.axisText}>{formatPrice(geometry.priceMin, priceDecimals)}</Text>
          <Text style={styles.axisText}>{formatPrice(geometry.priceMax, priceDecimals)}</Text>
          {/* Mid price sits under the mid line, which is where the mid price falls on the price axis. */}
          <Text
            style={[styles.axisText, styles.axisMid, { left: Math.min(Math.max(geometry.midX - MID_LABEL_WIDTH / 2, 70), width - 70 - MID_LABEL_WIDTH) }]}
          >
            {formatPrice((bids[0][0] + asks[0][0]) / 2, priceDecimals)}
          </Text>
        </View>
      ) : null}
    </View>
  );
});
