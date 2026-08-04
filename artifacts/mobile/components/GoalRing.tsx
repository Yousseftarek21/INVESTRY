import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';

interface GoalRingProps {
  pct: number;
  color: string;
  // The center fill — a genuinely different color from the ring stroke, not
  // a tint of it (a same-hue tint was tried first and didn't read as two
  // distinct colors). Defaults to `color` so the cluster's small rings,
  // which don't set this, keep their original tinted-same-hue look.
  fillColor?: string;
  trackColor: string;
  size?: number;
  strokeWidth?: number;
  done?: boolean;
}

// A single circular progress ring with a centered icon — used both standalone
// (one goal) and overlapping in a small cluster (multiple goals) on the
// Overview screen's goals row. Rotated -90deg so progress starts at 12
// o'clock, matching the usual "clock face" reading of a progress ring.
export function GoalRing({ pct, color, fillColor, trackColor, size = 42, strokeWidth = 3, done }: GoalRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = circumference * (1 - clamped / 100);
  const centerFill = fillColor ?? color;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} fill={centerFill + '40'} />
        <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <Circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
        />
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={done ? 'check' : 'target'} size={size * 0.38} color={centerFill} />
      </View>
    </View>
  );
}
