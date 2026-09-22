import React, { useState, useMemo } from 'react';
import { View, Text, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line } from 'react-native-svg';
import { DepthTuple } from '@pulsecrypto/shared';
import { colors } from '../../theme/tokens';
import { formatVolume } from '../../utils/formatters';
import { styles } from './MarketDepthChart.styles';
import { buildSplineSegments } from '../../utils/chartUtils';

interface MarketDepthChartProps {
  bids: DepthTuple[];
  asks: DepthTuple[];
  baseAsset: string;
  spreadPct?: number;
  buyPressure?: number;
  sellPressure?: number;
}

export const MarketDepthChart = React.memo(function MarketDepthChart({
  bids,
  asks,
  baseAsset,
  spreadPct = 0,
  buyPressure = 50,
  sellPressure = 50,
}: MarketDepthChartProps) {
  const [dimensions, setDimensions] = useState({ width: 360, height: 190 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setDimensions({ width, height });
    }
  };

  const { width: W, height: H } = dimensions;
  const midX = W / 2;
  const baselineY = H;
  const minHeight = 28;
  const maxHeight = H - 28;
  const availableHeight = maxHeight - minHeight;

  // Use top 15 depth levels for smooth chart curvature
  const activeBids = useMemo(() => bids.slice(0, 15), [bids]);
  const activeAsks = useMemo(() => asks.slice(0, 15), [asks]);

  const {
    totalBidQty,
    totalAskQty,
    bidFillPath,
    bidStrokePath,
    askFillPath,
    askStrokePath,
  } = useMemo(() => {
    const bQty = activeBids.reduce((sum, b) => sum + b[1], 0);
    const aQty = activeAsks.reduce((sum, a) => sum + a[1], 0);

    // Build points for Bids (Left Mountain: x = 0 -> midX)
    let bFill = `M 0 ${baselineY} L ${midX} ${baselineY} Z`;
    let bStroke = '';
    if (activeBids.length > 0) {
      const n = activeBids.length;
      let runningQty = 0;
      const cumQtys: number[] = [];
      for (let i = 0; i < n; i++) {
        runningQty += activeBids[i][1];
        cumQtys.push(runningQty);
      }
      const maxBidQty = Math.max(runningQty, 0.0001);
      const bidHeightFactor = Math.max(0.45, Math.min(1.0, buyPressure / 50));

      // Build points from deepest bid (x = 0) to best bid (near midX)
      const bidPoints: [number, number][] = [];
      for (let i = n - 1; i >= 0; i--) {
        const ratioX = (n - 1 - i) / Math.max(n - 1, 1);
        const x = Number((midX * ratioX).toFixed(1));
        const rankRatio = (i + 1) / n;
        const volRatio = cumQtys[i] / maxBidQty;
        const blended = 0.45 * rankRatio + 0.55 * volRatio;
        const curveH = Math.pow(blended, 0.7);
        const y = Number(
          (baselineY - (minHeight + curveH * availableHeight * bidHeightFactor)).toFixed(1)
        );
        bidPoints.push([x, y]);
      }
      // Meet center at baseline
      bidPoints.push([midX, baselineY - minHeight]);

      const { fill, stroke } = buildSplineSegments(bidPoints);
      bFill = `M 0 ${baselineY} ${fill} L ${midX} ${baselineY} Z`;
      bStroke = stroke;
    }

    // Build points for Asks (Right Mountain: x = midX -> W)
    let aFill = `M ${midX} ${baselineY} L ${W} ${baselineY} Z`;
    let aStroke = '';
    if (activeAsks.length > 0) {
      const m = activeAsks.length;
      let runningQty = 0;
      const cumQtys: number[] = [];
      for (let j = 0; j < m; j++) {
        runningQty += activeAsks[j][1];
        cumQtys.push(runningQty);
      }
      const maxAskQty = Math.max(runningQty, 0.0001);
      const askHeightFactor = Math.max(0.45, Math.min(1.0, sellPressure / 50));

      // Start at center at baseline
      const askPoints: [number, number][] = [[midX, baselineY - minHeight]];

      // Walk from best ask (j = 0) to deepest ask (j = m - 1, x = W)
      for (let j = 0; j < m; j++) {
        const ratioX = (j + 1) / m;
        const x = Number((midX + (W - midX) * ratioX).toFixed(1));
        const rankRatio = (j + 1) / m;
        const volRatio = cumQtys[j] / maxAskQty;
        const blended = 0.45 * rankRatio + 0.55 * volRatio;
        const curveH = Math.pow(blended, 0.7);
        const y = Number(
          (baselineY - (minHeight + curveH * availableHeight * askHeightFactor)).toFixed(1)
        );
        askPoints.push([x, y]);
      }

      const { fill, stroke } = buildSplineSegments(askPoints);
      aFill = `M ${midX} ${baselineY} ${fill} L ${W} ${baselineY} Z`;
      aStroke = stroke;
    }

    return {
      totalBidQty: bQty,
      totalAskQty: aQty,
      bidFillPath: bFill,
      bidStrokePath: bStroke,
      askFillPath: aFill,
      askStrokePath: aStroke,
    };
  }, [activeBids, activeAsks, W, availableHeight, baselineY, midX, minHeight, buyPressure, sellPressure]);

  // Liquidity Gap label
  const gapLabel =
    spreadPct <= 0.05 ? 'Low' : spreadPct <= 0.15 ? 'Moderate' : 'High';
  const gapColor: string =
    spreadPct <= 0.05
      ? colors.bidGreen
      : spreadPct <= 0.15
      ? colors.textSecondary
      : colors.askRed;

  // Pressure label (Mockup 3 matches discrete qualitative states without jumping text lengths)
  let pressureLabel = 'Balanced';
  let pressureColor: string = colors.textSecondary;
  if (buyPressure > 55) {
    pressureLabel = 'Buy Heavy';
    pressureColor = colors.bidGreen;
  } else if (sellPressure > 55) {
    pressureLabel = 'Sell Heavy';
    pressureColor = colors.askRed;
  }

  return (
    <View style={styles.container}>
      {/* Header & Legend (Left-aligned & stacked per Mockup 3) */}
      <View style={styles.header}>
        <Text style={styles.title}>MARKET DEPTH</Text>

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View
              style={[styles.legendDot, { backgroundColor: colors.bidGreen }]}
            />
            <Text style={styles.legendText}>
              Bids: {formatVolume(totalBidQty)} {baseAsset}
            </Text>
          </View>

          <View style={styles.legendItem}>
            <View
              style={[styles.legendDot, { backgroundColor: colors.askRed }]}
            />
            <Text style={styles.legendText}>
              Asks: {formatVolume(totalAskQty)} {baseAsset}
            </Text>
          </View>
        </View>
      </View>

      {/* SVG Dual-Mountain Area Chart */}
      <View style={styles.chartContainer} onLayout={onLayout}>
        <Svg width={W} height={H}>
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

          {/* Bids Mountain (fill + glowing top contour stroke) */}
          <Path d={bidFillPath} fill="url(#bidGrad)" />
          {bidStrokePath ? (
            <Path d={bidStrokePath} stroke={colors.bidGreen} strokeWidth="1.5" fill="none" />
          ) : null}

          {/* Asks Mountain (fill + glowing top contour stroke) */}
          <Path d={askFillPath} fill="url(#askGrad)" />
          {askStrokePath ? (
            <Path d={askStrokePath} stroke={colors.askRed} strokeWidth="1.5" fill="none" />
          ) : null}

          {/* Center Mid-Price Dividing Line (Solid line per Mockup 3) */}
          <Line
            x1={midX}
            y1={0}
            x2={midX}
            y2={baselineY}
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth="1"
          />
        </Svg>

        {/* Floating Combined Analytics Badges Card (Bottom-Right overlay per Mockup 3) */}
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
            <Text style={[styles.badgeValue, { color: pressureColor }]} numberOfLines={1}>
              {pressureLabel}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
});
