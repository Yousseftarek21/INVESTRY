import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

/** Gold gradient — now on the star itself, not the disc behind it. */
const GOLD_STOPS: [string, string, string] = ['#fff3c4', '#DDB94A', '#96751A'];
// Oxblood, not near-black — a dark warm neutral sat right next to gold read
// as muddy (same warm family, too little contrast to look deliberate). This
// is also the literal color of a wax seal, which is the metaphor the pin
// placement is already going for — gold-on-oxblood is a real, recognizable
// premium pairing (formal seals, presentation cases), not an invented one.
const DISC_STOPS: [string, string] = ['#5c1a26', '#1c0509'];
// Same star, tarnished — used only for the "tier lost" moment in
// TierCelebration. Same shape and construction as the gold star, not a
// different icon system: losing Pro should look like this exact star gone
// dull, not like a whole different graphic appeared.
const MUTED_STAR: [string, string, string] = ['#d8dade', '#9a9ea6', '#5c6068'];
// The disc tarnishes along with the star when the tier is lost — a real
// medal doesn't keep its rich color while only the emblem on it fades; the
// whole object dulls together, which is also what makes the muted state
// read clearly as "the same seal, diminished" rather than two unrelated
// color choices.
const MUTED_DISC_STOPS: [string, string] = ['#3a3438', '#141215'];

// Star engraved on the disc's face, authored in the same -20..20 coordinate
// space as the disc so it centers without extra offsetting.
const STAR_PATH = 'M 0,-11 L 2.6,-3.8 L 10.4,-3.4 L 4.2,1.4 L 6.4,8.7 L 0,4.4 L -6.4,8.7 L -4.2,1.4 L -10.4,-3.4 L -2.6,-3.8 Z';

/**
 * The Pro seal — a dark struck disc with a gold star on its face, pinned at
 * an avatar's corner like a wax seal rather than wrapping it like a
 * progress ring. There is only one tier, so there is only one glyph: no
 * per-tier switch needed, no `tier` prop — just gold (held) or `muted`
 * (the moment it's lost, see TierCelebration).
 *
 * Purely presentational — callers decide whether to render it at all (see
 * index.tsx, which only mounts this once Pro is actually held).
 */
export function TierSeal({ size = 30, muted = false }: { size?: number; muted?: boolean }) {
  const starStops = muted ? MUTED_STAR : GOLD_STOPS;
  const starGradientId = muted ? 'tierStarMuted' : 'tierStarGold';
  const starStroke = muted ? '#4a4a4c' : '#5c4713';
  const discStops = muted ? MUTED_DISC_STOPS : DISC_STOPS;
  const discGradientId = muted ? 'tierDiscMuted' : 'tierDiscGold';
  const discStroke = muted ? '#2a2a2c' : '#100307';

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="-20 -20 40 40">
        <Defs>
          <LinearGradient id={discGradientId} x1="20%" y1="0%" x2="80%" y2="100%">
            <Stop offset="0%" stopColor={discStops[0]} />
            <Stop offset="100%" stopColor={discStops[1]} />
          </LinearGradient>
          <LinearGradient id={starGradientId} x1="15%" y1="0%" x2="85%" y2="100%">
            <Stop offset="0%" stopColor={starStops[0]} />
            <Stop offset="45%" stopColor={starStops[1]} />
            <Stop offset="100%" stopColor={starStops[2]} />
          </LinearGradient>
          <RadialGradient id="tierSealShine" cx="35%" cy="28%" r="70%">
            <Stop offset="0%" stopColor="#ffffff" stopOpacity={0.22} />
            <Stop offset="40%" stopColor="#ffffff" stopOpacity={0.04} />
            <Stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={0} cy={0} r={18.5} fill={`url(#${discGradientId})`} stroke={discStroke} strokeWidth={1.4} />
        <Circle cx={0} cy={0} r={18.5} fill="url(#tierSealShine)" />
        <Path d={STAR_PATH} fill={`url(#${starGradientId})`} stroke={starStroke} strokeWidth={0.6} strokeLinejoin="round" />
      </Svg>
    </View>
  );
}
