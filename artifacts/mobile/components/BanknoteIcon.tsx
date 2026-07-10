import React from 'react';
import Svg, { Rect, Circle, Line } from 'react-native-svg';

export function BanknoteIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="1" y="6" width="22" height="13" rx="2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="12" cy="12.5" r="2.5" stroke={color} strokeWidth="2" />
      <Line x1="1" y1="10" x2="5" y2="10" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="19" y1="10" x2="23" y2="10" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="1" y1="15" x2="5" y2="15" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="19" y1="15" x2="23" y2="15" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}
