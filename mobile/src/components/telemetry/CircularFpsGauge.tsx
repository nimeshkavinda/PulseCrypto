import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, typography } from '../../theme/tokens';

interface CircularFpsGaugeProps {
  size?: number;
  strokeWidth?: number;
}

const getMonotonicTime = (): number => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
};

export const CircularFpsGauge = React.memo(function CircularFpsGauge({
  size = 126,
  strokeWidth = 8,
}: CircularFpsGaugeProps) {
  const [fps, setFps] = useState<number>(60);
  const frameCountRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(getMonotonicTime());
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;

    const measureFps = () => {
      frameCountRef.current += 1;
      const now = getMonotonicTime();
      const elapsed = now - lastTimeRef.current;

      if (elapsed >= 800) {
        // Calculate rolling frames per second with high accuracy
        const rawFps = Math.min(60, Math.round((frameCountRef.current * 1000) / elapsed));
        if (active) {
          setFps((prev) => {
            // Apply gentle smoothing so minor 1-frame micro-jitter doesn't drop the gauge erratically
            return Math.min(60, Math.max(1, Math.round(prev * 0.35 + rawFps * 0.65)));
          });
        }
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }

      if (active) {
        rafIdRef.current = requestAnimationFrame(measureFps);
      }
    };

    rafIdRef.current = requestAnimationFrame(measureFps);

    return () => {
      active = false;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const progressRatio = Math.max(0, Math.min(1, fps / 60));
  const strokeDashoffset = circumference * (1 - progressRatio);

  const gaugeColor =
    fps >= 55
      ? colors.bidGreen
      : fps >= 40
      ? colors.warningYellow
      : colors.askRed;

  return (
    <View style={styles.container}>
      <View style={[styles.gaugeWrapper, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          {/* Background circle track */}
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress circle */}
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={gaugeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
            transform={`rotate(-90 ${center} ${center})`}
          />
        </Svg>
        {/* Centered FPS text */}
        <View style={styles.textContainer}>
          <Text style={styles.fpsValue}>{fps}</Text>
          <Text style={styles.fpsLabel}>FPS</Text>
        </View>
      </View>
      <Text style={styles.caption}>JS Thread Frame Rate</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  gaugeWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fpsValue: {
    fontFamily: typography.fontFamily.monoBold,
    fontSize: 32,
    color: colors.textPrimary,
    lineHeight: 38,
  },
  fpsLabel: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 1,
    marginTop: -2,
  },
  caption: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
  },
});
