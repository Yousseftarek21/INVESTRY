import React, { useId } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg';
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
//
// The arc and the center disc both carry a gradient rather than a flat fill
// — a two-stop sheen along the progress stroke (color -> centerFill, so the
// arc visually resolves into the icon it's wrapped around instead of reading
// as a separate flat ring), and a soft radial glow behind the icon instead
// of a uniform tint block. Purely a rendering upgrade — every prop and call
// site is unchanged.
export function GoalRing({ pct, color, fillColor, trackColor, size = 42, strokeWidth = 3, done }: GoalRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = circumference * (1 - clamped / 100);
  const centerFill = fillColor ?? color;
  // Unique per instance so overlapping rings in a cluster don't collide on
  // the same gradient id (SVG gradients are resolved by id, globally).
  const uid = useId();
  const arcGradientId = `goalRingArc-${uid}`;
  const glowGradientId = `goalRingGlow-${uid}`;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <LinearGradient id={arcGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={color} />
            <Stop offset="100%" stopColor={centerFill} />
          </LinearGradient>
          <RadialGradient id={glowGradientId} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={centerFill} stopOpacity={0.5} />
            <Stop offset="100%" stopColor={centerFill} stopOpacity={0.12} />
          </RadialGradient>
        </Defs>
        {/* A solid, theme-neutral disc first (trackColor — already passed
            in for the un-filled arc, so it's guaranteed correct for the
            current theme) — without it, a gold ring on a gold-tinted card
            background (the redesigned Overview goals card) had almost no
            contrast against its own backdrop. The tinted glow then sits on
            top of that solid disc instead of directly on the card. */}
        <Circle cx={size / 2} cy={size / 2} r={radius} fill={trackColor} />
        <Circle cx={size / 2} cy={size / 2} r={radius} fill={`url(#${glowGradientId})`} />
        <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <Circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={`url(#${arcGradientId})`} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
        />
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={done ? 'check' : 'target'} size={size * 0.38} color={centerFill} />
      </View>
    </View>
  );
}
