import React from 'react';
import Svg, { Path } from 'react-native-svg';

// Matches the wallet icon used for "Cash Accounts" on the marketing site
// (artifacts/website/index.html) — kept visually consistent across both.
export function BanknoteIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M20 7H5a2 2 0 00-2 2v9a2 2 0 002 2h15a1 1 0 001-1v-3M16 12a1 1 0 100 2 1 1 0 000-2z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M18 7V5a2 2 0 00-2-2H6a2 2 0 00-2 2v2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
