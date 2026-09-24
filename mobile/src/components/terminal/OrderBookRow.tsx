import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { formatPrice } from '../../utils/formatters';
import { styles } from './OrderBookTable.styles';

interface OrderBookRowProps {
  price: number;
  amount: number;
  total: number;
  priceDecimals: number;
  qtyDecimals: number;
  type: 'bid' | 'ask';
  depthRatio: number; // 0..1
}

/**
 * One order book level. The volume bar animates `transform: scaleX` from the row's right edge, on
 * the UI thread, so a volume change causes no layout pass.
 */
export const OrderBookRow = React.memo(function OrderBookRow({
  price,
  amount,
  total,
  priceDecimals,
  qtyDecimals,
  type,
  depthRatio,
}: OrderBookRowProps) {
  const scale = useSharedValue(depthRatio);

  useEffect(() => {
    scale.value = withTiming(Math.min(1, Math.max(0, depthRatio)), { duration: 180 });
  }, [depthRatio, scale]);

  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: scale.value }] }));
  const isBid = type === 'bid';

  return (
    <View style={styles.row}>
      <Animated.View style={[styles.depthBar, isBid ? styles.bidDepthBar : styles.askDepthBar, barStyle]} />
      <Text style={[styles.colPrice, isBid ? styles.bidText : styles.askText]}>{formatPrice(price, priceDecimals)}</Text>
      <Text style={styles.colAmount}>{amount.toFixed(qtyDecimals)}</Text>
      <Text style={styles.colTotal}>{formatPrice(total, 2)}</Text>
    </View>
  );
});
