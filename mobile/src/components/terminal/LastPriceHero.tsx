import React, { useEffect, useRef } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { MarketUpdatePayload, SUPPORTED_PAIRS } from '@pulsecrypto/shared';
import { colors } from '../../theme/tokens';
import { formatPrice, formatMarketCap } from '../../utils/formatters';
import { styles } from './LastPriceHero.styles';
import { PriceDirection } from '../../hooks/useMarketStream';

interface LastPriceHeroProps {
  payload: MarketUpdatePayload;
  priceDirection: PriceDirection;
}

export const LastPriceHero = React.memo(function LastPriceHero({
  payload,
  priceDirection,
}: LastPriceHeroProps) {
  const pairInfo = SUPPORTED_PAIRS[payload.pair];
  const priceDecimals = pairInfo?.priceDecimals ?? 2;

  const isPositive = payload.change24h >= 0;
  const changeColor = isPositive ? colors.bidGreen : colors.askRed;

  // Last trade price color matches tick direction (green on tick up, red on tick down, baseline changeColor on neutral)
  const heroPriceColor =
    priceDirection === 'up'
      ? colors.bidGreen
      : priceDirection === 'down'
      ? colors.askRed
      : changeColor;

  // Flash animation shared value: 0 = transparent, 1 = flash green, 2 = flash red
  const flashAnim = useSharedValue(0);
  const prevPriceRef = useRef<number>(payload.price);
  const prevDirectionRef = useRef<PriceDirection>(priceDirection);

  useEffect(() => {
    // Only flash if price actually changed and direction is non-neutral
    const priceChanged = prevPriceRef.current !== payload.price;
    const directionChanged = prevDirectionRef.current !== priceDirection;

    if ((priceChanged || directionChanged) && priceDirection !== 'neutral') {
      if (priceDirection === 'up') {
        flashAnim.value = withSequence(
          withTiming(1, { duration: 120 }),
          withTiming(0, { duration: 350 })
        );
      } else if (priceDirection === 'down') {
        flashAnim.value = withSequence(
          withTiming(2, { duration: 120 }),
          withTiming(0, { duration: 350 })
        );
      }
    }

    prevPriceRef.current = payload.price;
    prevDirectionRef.current = priceDirection;
  }, [priceDirection, payload.price, flashAnim]);

  const animatedStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      flashAnim.value,
      [0, 1, 2],
      ['rgba(0, 0, 0, 0)', 'rgba(0, 197, 122, 0.22)', 'rgba(255, 59, 105, 0.22)']
    );

    return {
      backgroundColor,
    };
  });

  const formattedTimestamp = payload.timestamp
    ? new Date(payload.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '';

  return (
    <View style={styles.container}>
      {/* Header Label & Timestamp */}
      <View style={styles.headerRow}>
        <Text style={styles.label}>LAST PRICE</Text>
        {formattedTimestamp ? (
          <Text style={styles.timestampText}>{formattedTimestamp}</Text>
        ) : null}
      </View>

      {/* Hero Price & 24h Change Pill */}
      <View style={styles.priceRow}>
        <Animated.View style={[styles.flashContainer, animatedStyle]}>
          <Text style={[styles.heroPrice, { color: heroPriceColor }]}>
            ${formatPrice(payload.price, priceDecimals)}
          </Text>
        </Animated.View>

        <View
          style={[
            styles.changeBadge,
            isPositive ? styles.changeBadgeGreen : styles.changeBadgeRed,
          ]}
        >
          <Ionicons
            name={isPositive ? 'caret-up' : 'caret-down'}
            size={14}
            color={changeColor}
          />
          <Text style={[styles.changeText, { color: changeColor }]}>
            {Math.abs(payload.change24h).toFixed(2)}%
          </Text>
        </View>
      </View>

      {/* 24h Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statColumn}>
          <Text style={styles.statLabel}>24H HIGH</Text>
          <Text style={styles.statValue}>
            ${formatPrice(payload.high24h, priceDecimals)}
          </Text>
        </View>

        <View style={[styles.statColumn, styles.statColumnMiddle]}>
          <Text style={styles.statLabel}>24H LOW</Text>
          <Text style={styles.statValue}>
            ${formatPrice(payload.low24h, priceDecimals)}
          </Text>
        </View>

        <View style={[styles.statColumn, styles.statColumnRight]}>
          <Text style={styles.statLabel}>MARKET CAP</Text>
          <Text style={styles.statValue}>
            {formatMarketCap(payload.pair, payload.price)}
          </Text>
        </View>
      </View>
    </View>
  );
});
