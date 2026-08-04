import React, { useId } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';

interface GoalRingProps {
  pct: number;
  color: string;
  // When set, the progress arc sweeps through these colors instead of a
  // flat `color` — used for the single-goal ring, which (unlike the small
  // cluster rings, already differentiated from each other by color) had
  // nothing to visually distinguish it. `color` is still used for the
  // center-fill tint and the icon.
  gradientColors?: [string, string];
  trackColor: string;
  size?: number;
  strokeWidth?: number;
  done?: boolean;
}

// A single circular progress ring with a centered icon — used both standalone
// (one goal) and overlapping in a small cluster (multiple goals) on the
// Overview screen's goals row. Rotated -90deg so progress starts at 12
// o'clock, matching the usual "clock face" reading of a progress ring. The
// center is filled with a soft tint of the ring's own color (a "badge" look)
// rather than left empty, so the icon sits on something instead of floating
// in transparent space.
export function GoalRing({ pct, color, gradientColors, trackColor, size = 42, strokeWidth = 3, done }: GoalRingProps) {
  // useId, not a fixed string — multiple rings render at once in the goal
  // cluster, and an SVG gradient id has to be unique across all of them or
  // later rings would silently reuse (and override) an earlier one's stop.
  const gradientId = `goalRingGradient-${useId()}`;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = circumference * (1 - clamped / 100);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: [{ rotate: '-90deg' }] }}>
        {gradientColors && (
          <Defs>
            <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={gradientColors[0]} />
              <Stop offset="100%" stopColor={gradientColors[1]} />
            </LinearGradient>
          </Defs>
        )}
        <Circle cx={size / 2} cy={size / 2} r={radius} fill={color + '1A'} />
        <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <Circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={gradientColors ? `url(#${gradientId})` : color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
        />
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={done ? 'check' : 'target'} size={size * 0.38} color={gradientColors ? gradientColors[1] : color} />
      </View>
    </View>
  );
}
