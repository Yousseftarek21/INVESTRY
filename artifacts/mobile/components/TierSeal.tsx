import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { TierId } from '@/utils/portfolioTier';

/**
 * Disc + star colors per tier, chosen to carry each tier's own meaning
 * rather than a single metal ramp: Core reads clean and understated (a
 * quiet, desaturated slate — recessive on purpose, so it doesn't compete
 * with the two tiers above it), Plus reads vibrant and energetic (indigo /
 * violet — the "most popular" tier gets the most saturated color), Wealth
 * reads exclusive and secure (obsidian charcoal with a rich gold star, the
 * same pairing a black-card product uses). All three now share the same
 * disc-darker-than-star construction, Core included, instead of Core being
 * the one light-disc exception.
 *
 * Disc first, star second, in each tuple.
 */
const TIER_METAL: Record<TierId, { disc: [string, string]; star: [string, string, string]; discStroke: string; starStroke: string }> = {
  core: {
    disc: ['#94A3B8', '#475569'],
    star: ['#ffffff', '#e2e8f0', '#cbd5e1'],
    discStroke: '#334155',
    starStroke: '#94a3b8',
  },
  plus: {
    disc: ['#5b3fe0', '#180f3d'],
    star: ['#f4ecff', '#c9a4ff', '#8b5cf6'],
    discStroke: '#0d0824',
    starStroke: '#4c2f8a',
  },
  wealth: {
    disc: ['#2e3036', '#08080a'],
    star: ['#fff3c4', '#DDB94A', '#96751A'],
    discStroke: '#000000',
    starStroke: '#5c4713',
  },
};

/**
 * One representative hex per tier — the star's vivid mid-tone — used
 * anywhere a tier needs a single accent rather than a full disc+star
 * treatment (the celebration's glow/burst, its tier-name text). Keeps
 * that glow in the same color family as the seal it surrounds instead of
 * defaulting to the app's generic brand accent.
 */
export const TIER_ACCENT: Record<TierId, string> = {
  core: '#94A3B8',
  plus: '#8b5cf6',
  wealth: '#DDB94A',
};

// Star engraved on the disc's face, authored in the same -20..20 coordinate
// space as the disc so it centers without extra offsetting.
const STAR_PATH = 'M 0,-11 L 2.6,-3.8 L 10.4,-3.4 L 4.2,1.4 L 6.4,8.7 L 0,4.4 L -6.4,8.7 L -4.2,1.4 L -10.4,-3.4 L -2.6,-3.8 Z';

/**
 * The tier seal — a struck disc with a star on its face, pinned at an
 * avatar's corner like a wax seal rather than wrapping it like a progress
 * ring. Always rendered for a real, currently-held tier — there's no
 * "muted/lost" variant, because landing on a lower tier (Wealth -> Plus)
 * means genuinely holding that tier, in its own true colors, not a
 * diminished version of the one before it. The "no tier at all" state
 * (net worth back under Core's floor) doesn't render this component —
 * see TierCelebration, which shows a plain neutral icon instead.
 *
 * Purely presentational — callers decide whether to render it at all (see
 * index.tsx, which only mounts this once a real tier is held).
 */
export function TierSeal({ tier, size = 30 }: { tier: TierId; size?: number }) {
  const metal = TIER_METAL[tier];
  const discGradientId = `tierDisc-${tier}`;
  const starGradientId = `tierStar-${tier}`;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="-20 -20 40 40">
        <Defs>
          <LinearGradient id={discGradientId} x1="20%" y1="0%" x2="80%" y2="100%">
            <Stop offset="0%" stopColor={metal.disc[0]} />
            <Stop offset="100%" stopColor={metal.disc[1]} />
          </LinearGradient>
          <LinearGradient id={starGradientId} x1="15%" y1="0%" x2="85%" y2="100%">
            <Stop offset="0%" stopColor={metal.star[0]} />
            <Stop offset="45%" stopColor={metal.star[1]} />
            <Stop offset="100%" stopColor={metal.star[2]} />
          </LinearGradient>
          <RadialGradient id="tierSealShine" cx="35%" cy="28%" r="70%">
            <Stop offset="0%" stopColor="#ffffff" stopOpacity={0.22} />
            <Stop offset="40%" stopColor="#ffffff" stopOpacity={0.04} />
            <Stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={0} cy={0} r={18.5} fill={`url(#${discGradientId})`} stroke={metal.discStroke} strokeWidth={1.4} />
        <Circle cx={0} cy={0} r={18.5} fill="url(#tierSealShine)" />
        <Path d={STAR_PATH} fill={`url(#${starGradientId})`} stroke={metal.starStroke} strokeWidth={0.6} strokeLinejoin="round" />
      </Svg>
    </View>
  );
}
