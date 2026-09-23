import React, { ReactNode, useEffect, useState } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { colors } from '../../theme/tokens';

export type PriceDirection = 'up' | 'down' | 'neutral';

interface DirectionState {
  key: string;
  price: number | undefined;
  direction: PriceDirection;
  /** Increments on every price move so consecutive moves in the same direction re-flash. */
  seq: number;
}

/**
 * Direction of the latest price move. Derived during render (React's supported pattern for state
 * derived from props). Resets without flashing when `key` changes (e.g. a pair switch) and on the
 * first value.
 */
export function usePriceDirection(key: string, price: number | undefined): { direction: PriceDirection; seq: number } {
  const [s, setS] = useState<DirectionState>({ key, price, direction: 'neutral', seq: 0 });
  if (s.key !== key) {
    setS({ key, price, direction: 'neutral', seq: 0 });
  } else if (price !== s.price) {
    const direction: PriceDirection =
      s.price === undefined || price === undefined ? 'neutral' : price > s.price ? 'up' : 'down';
    setS({ key, price, direction, seq: direction === 'neutral' ? s.seq : s.seq + 1 });
  }
  return s.key === key ? { direction: s.direction, seq: s.seq } : { direction: 'neutral', seq: 0 };
}

export const FLASH_UP = 'rgba(0, 197, 122, 0.28)';
export const FLASH_DOWN = 'rgba(255, 59, 105, 0.28)';

interface PriceFlashProps {
  flashKey: string;
  price: number | undefined;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

/**
 * Briefly highlights its children green on a price rise and red on a fall (~600 ms, UI thread).
 * Animates only the opacity of a single-colour overlay, so there is no layout work and no
 * cross-fade through the opposite colour.
 */
export const PriceFlash = React.memo(function PriceFlash({ flashKey, price, style, children }: PriceFlashProps) {
  const { direction, seq } = usePriceDirection(flashKey, price);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (seq === 0) return;
    opacity.value = withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 520 }));
  }, [seq, opacity]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[styles.container, style]}>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: direction === 'down' ? FLASH_DOWN : FLASH_UP }, overlayStyle]}
      />
      {children}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  overlay: { borderRadius: 6 },
});

export const directionColor = (direction: PriceDirection, fallback: string = colors.textPrimary) =>
  direction === 'up' ? colors.bidGreen : direction === 'down' ? colors.askRed : fallback;
