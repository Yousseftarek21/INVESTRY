import React from 'react';
import { Image, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

// Shared display primitives for anywhere a leaderboard entry/rank shows up
// — app/leaderboard.tsx (the live weekly/monthly board) and
// LeaderboardResultsCelebration.tsx (the frozen last-period results). Pulled
// out into their own file rather than defined in leaderboard.tsx and
// imported from there, which would make the two files import each other.

export const MEDAL_BG: Record<number, string> = { 1: '#F5C34C1F', 2: '#C7CDD61F', 3: '#D3956B1F' };
export const MEDAL_EMOJI: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function pctColor(colors: ReturnType<typeof useColors>, pct: number): string {
  if (pct > 0) return colors.green;
  if (pct < 0) return colors.red;
  return colors.mutedForeground;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function Avatar({ name, imageUrl, size }: { name: string; imageUrl: string | null; size: number }) {
  const colors = useColors();
  return imageUrl ? (
    <Image source={{ uri: imageUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />
  ) : (
    <View style={[
      { width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' },
      { backgroundColor: colors.primary + '1A' },
    ]}>
      <Text style={{ fontSize: size * 0.4, fontFamily: 'Inter_700Bold', color: colors.primary }}>{initialsOf(name)}</Text>
    </View>
  );
}
