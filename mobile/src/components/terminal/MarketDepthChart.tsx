import React, { useState, useEffect, useRef } from 'react';
import { View, Text, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line } from 'react-native-svg';
import { DepthTuple } from '@pulsecrypto/shared';
import { colors } from '../../theme/tokens';
import { formatVolume } from '../../utils/formatters';
import { defaultStorage } from '../../storage/storageRepository';
import { styles } from './MarketDepthChart.styles';

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
  const [dimensions, setDimensions] = useState({ width: 340, height: 160 });
  const [chartData, setChartData] = useState<{
    bids: DepthTuple[];
    asks: DepthTuple[];
  }>({ bids, asks });

  const lastRedrawTimeRef = useRef<number>(0);
  const pendingDataRef = useRef<{ bids: DepthTuple[]; asks: DepthTuple[] }>({ bids, asks });
  pendingDataRef.current = { bids, asks };
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Safety-floored redraw cadence per ADR 5: Math.max(sliderValue, 250)
  useEffect(() => {
    const throttleMs = defaultStorage.getClientThrottle();
    const minRedrawInterval = Math.max(throttleMs, 250);
    const now = Date.now();
    const elapsed = now - lastRedrawTimeRef.current;

    if (elapsed >= minRedrawInterval) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      lastRedrawTimeRef.current = now;
      setChartData({ bids, asks });
    } else if (!timerRef.current) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        lastRedrawTimeRef.current = Date.now();
        setChartData(pendingDataRef.current);
      }, minRedrawInterval - elapsed);
    }
  }, [bids, asks]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setDimensions({ width, height });
    }
  };

  const { width: W, height: H } = dimensions;
  const midX = W / 2;
  const baselineY = H - 8;
  const maxHeight = H - 32;

  // Use top 15 depth levels for smooth chart curvature
  const activeBids = chartData.bids.slice(0, 15);
  const activeAsks = chartData.asks.slice(0, 15);

  const totalBidQty = activeBids.reduce((sum, b) => sum + b[1], 0);
  const totalAskQty = activeAsks.reduce((sum, a) => sum + a[1], 0);

  const maxBidCumulative = activeBids[activeBids.length - 1]?.[2] ?? 1;
  const maxAskCumulative = activeAsks[activeAsks.length - 1]?.[2] ?? 1;
  const maxCumulative = Math.max(maxBidCumulative, maxAskCumulative, 0.001);

  // Build SVG Path for Bids (Left Mountain: 0 -> midX)
  let bidPath = `M 0 ${baselineY}`;
  if (activeBids.length > 0) {
    const n = activeBids.length;
    // Walk from lowest price (far left, index n - 1) to best bid (midX, index 0)
    for (let i = n - 1; i >= 0; i--) {
      const ratio = (n - 1 - i) / Math.max(n - 1, 1);
      const x = Number((midX * ratio).toFixed(1));
      const cumTotal = activeBids[i][2];
      const y = Number((baselineY - (cumTotal / maxCumulative) * maxHeight).toFixed(1));
      bidPath += ` L ${x} ${y}`;
    }
    bidPath += ` L ${midX} ${baselineY} Z`;
  } else {
    bidPath = `M 0 ${baselineY} L ${midX} ${baselineY} Z`;
  }

  // Build SVG Path for Asks (Right Mountain: midX -> W)
  let askPath = `M ${midX} ${baselineY}`;
  if (activeAsks.length > 0) {
    const m = activeAsks.length;
    // Walk from best ask (midX, index 0) to highest ask (far right, index m - 1)
    for (let j = 0; j < m; j++) {
      const ratio = j / Math.max(m - 1, 1);
      const x = Number((midX + (W - midX) * ratio).toFixed(1));
      const cumTotal = activeAsks[j][2];
      const y = Number((baselineY - (cumTotal / maxCumulative) * maxHeight).toFixed(1));
      askPath += ` L ${x} ${y}`;
    }
    askPath += ` L ${W} ${baselineY} Z`;
  } else {
    askPath = `M ${midX} ${baselineY} L ${W} ${baselineY} Z`;
  }

  // Liquidity Gap label
  const gapLabel =
    spreadPct <= 0.05 ? 'Low' : spreadPct <= 0.15 ? 'Moderate' : 'High';
  const gapColor: string =
    spreadPct <= 0.05
      ? colors.bidGreen
      : spreadPct <= 0.15
      ? colors.textSecondary
      : colors.askRed;

  // Pressure label
  let pressureLabel = 'Balanced';
  let pressureColor: string = colors.textSecondary;
  if (buyPressure > 55) {
    pressureLabel = `Buy Heavy (${buyPressure.toFixed(0)}%)`;
    pressureColor = colors.bidGreen;
  } else if (sellPressure > 55) {
    pressureLabel = `Sell Heavy (${sellPressure.toFixed(0)}%)`;
    pressureColor = colors.askRed;
  }

  return (
    <View style={styles.container}>
      {/* Header & Legend */}
      <View style={styles.headerRow}>
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
              <Stop offset="0%" stopColor={colors.bidGreen} stopOpacity="0.45" />
              <Stop offset="100%" stopColor={colors.bidGreen} stopOpacity="0.04" />
            </LinearGradient>
            <LinearGradient id="askGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={colors.askRed} stopOpacity="0.45" />
              <Stop offset="100%" stopColor={colors.askRed} stopOpacity="0.04" />
            </LinearGradient>
          </Defs>

          {/* Bids Mountain */}
          <Path d={bidPath} fill="url(#bidGrad)" stroke={colors.bidGreen} strokeWidth="1.5" />

          {/* Asks Mountain */}
          <Path d={askPath} fill="url(#askGrad)" stroke={colors.askRed} strokeWidth="1.5" />

          {/* Center Mid-Price Dividing Line */}
          <Line
            x1={midX}
            y1={12}
            x2={midX}
            y2={baselineY}
            stroke={colors.border}
            strokeWidth="1"
            strokeDasharray="4,4"
          />
        </Svg>
      </View>

      {/* Floating Analytics Badges */}
      <View style={styles.badgeOverlay}>
        <View style={styles.badgeCard}>
          <Text style={styles.badgeTitle}>LIQUIDITY GAP</Text>
          <Text style={[styles.badgeValue, { color: gapColor }]}>
            {gapLabel} ({spreadPct.toFixed(2)}%)
          </Text>
        </View>

        <View style={styles.badgeCard}>
          <Text style={styles.badgeTitle}>PRESSURE</Text>
          <Text style={[styles.badgeValue, { color: pressureColor }]}>
            {pressureLabel}
          </Text>
        </View>
      </View>
    </View>
  );
});
