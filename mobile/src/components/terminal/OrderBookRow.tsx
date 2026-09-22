import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
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

export const OrderBookRow = React.memo(
  function OrderBookRow({
    price,
    amount,
    total,
    priceDecimals,
    qtyDecimals,
    type,
    depthRatio,
  }: OrderBookRowProps) {
    const animatedRatio = useSharedValue(depthRatio);

    useEffect(() => {
      animatedRatio.value = withTiming(Math.min(1, Math.max(0, depthRatio)), {
        duration: 180,
      });
    }, [depthRatio, animatedRatio]);

    const barAnimatedStyle = useAnimatedStyle(() => {
      return {
        width: `${animatedRatio.value * 100}%`,
      };
    });

    const isBid = type === 'bid';

    return (
      <View style={styles.row}>
        {/* Animated Horizontal Depth Volume Bar */}
        <Animated.View
          style={[
            styles.depthBar,
            isBid ? styles.bidDepthBar : styles.askDepthBar,
            barAnimatedStyle,
          ]}
        />

        {/* Columns */}
        <Text style={[styles.colPrice, isBid ? styles.bidText : styles.askText]}>
          {formatPrice(price, priceDecimals)}
        </Text>

        <Text style={styles.colAmount}>{amount.toFixed(qtyDecimals)}</Text>

        <Text style={styles.colTotal}>{formatPrice(total, 2)}</Text>
      </View>
    );
  },
  (prev, next) =>
    prev.price === next.price &&
    prev.amount === next.amount &&
    prev.total === next.total &&
    prev.priceDecimals === next.priceDecimals &&
    prev.qtyDecimals === next.qtyDecimals &&
    prev.type === next.type &&
    prev.depthRatio === next.depthRatio
);
