import React from 'react';
import { DimensionValue, StyleProp, View, ViewStyle } from 'react-native';
import { borderRadius } from '../../theme/tokens';

/** Placeholder block shown before any data (live or cached) exists. Never shows fake values. */
export function Skeleton({ width, height, style }: { width: DimensionValue; height: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      accessibilityLabel="Loading"
      style={[{ width, height, borderRadius: borderRadius.sm, backgroundColor: 'rgba(255, 255, 255, 0.06)' }, style]}
    />
  );
}
