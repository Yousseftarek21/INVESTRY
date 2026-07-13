import React from 'react';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import type { Holding } from '@/types';

export type AssetType = Holding['type'];

export function AssetIcon({ type, size = 18, color }: {
  type: AssetType; size?: number; color: string;
}) {
  switch (type) {
    case 'gold':
      return <MaterialCommunityIcons name="gold" size={size} color={color} />;
    case 'silver':
      return <Feather name="disc" size={size} color={color} />;
    case 'stock':
      return <Feather name="trending-up" size={size} color={color} />;
    case 'real_estate':
      return <MaterialCommunityIcons name="home-city" size={size} color={color} />;
    case 'personal_asset':
      return <MaterialCommunityIcons name="tag-multiple" size={size} color={color} />;
    case 'fixed_income':
      return <MaterialCommunityIcons name="bank-transfer" size={size} color={color} />;
    default:
      return <Feather name="grid" size={size} color={color} />;
  }
}
