import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Holding, MarketPrices } from '@/types';
import { goldPricePerGram, silverPricePerGram } from '@/hooks/usePrices';

interface HoldingCardProps {
  holding: Holding;
  prices?: MarketPrices;
  onDelete?: () => void;
  onEdit?: () => void;
}

function personalAssetValueEGP(holding: Extract<Holding, { type: 'personal_asset' }>, prices?: MarketPrices): number {
  const v = holding.currentValue ?? holding.purchasePrice;
  if (holding.currency === 'USD' && prices) return v * prices.usdToEgp;
  return v;
}

function personalAssetCostEGP(holding: Extract<Holding, { type: 'personal_asset' }>, prices?: MarketPrices): number {
  if (holding.currency === 'USD' && prices) return holding.purchasePrice * prices.usdToEgp;
  return holding.purchasePrice;
}

function computeCurrentValue(holding: Holding, prices?: MarketPrices): number {
  if (!prices) return 0;
  if (holding.type === 'gold') return holding.grams * goldPricePerGram(prices, holding.karat);
  if (holding.type === 'silver') return holding.grams * silverPricePerGram(prices);
  if (holding.type === 'stock') return holding.shares * holding.purchasePricePerShare;
  if (holding.type === 'real_estate') return holding.currentValue;
  if (holding.type === 'personal_asset') return personalAssetValueEGP(holding, prices);
  return 0;
}

function computeCost(holding: Holding, prices?: MarketPrices): number {
  if (holding.type === 'gold') return holding.grams * holding.purchasePricePerGram;
  if (holding.type === 'silver') return holding.grams * holding.purchasePricePerGram;
  if (holding.type === 'stock') return holding.shares * holding.purchasePricePerShare;
  if (holding.type === 'real_estate') return holding.purchasePrice;
  if (holding.type === 'personal_asset') return personalAssetCostEGP(holding, prices);
  return 0;
}

function getIcon(holding: Holding): keyof typeof Feather.glyphMap {
  if (holding.type === 'gold') return 'award';
  if (holding.type === 'silver') return 'circle';
  if (holding.type === 'stock') return 'bar-chart-2';
  if (holding.type === 'personal_asset') return (holding.icon as keyof typeof Feather.glyphMap) || 'star';
  return 'home';
}

function getTitle(holding: Holding): string {
  if (holding.type === 'gold') return `Gold ${holding.karat}`;
  if (holding.type === 'silver') return 'Silver';
  if (holding.type === 'stock') return holding.symbol;
  if (holding.type === 'personal_asset') return holding.name || 'Personal Asset';
  return holding.propertyName || 'Real Estate';
}

function getSubtitle(holding: Holding): string {
  if (holding.type === 'gold') return `${holding.grams.toLocaleString()} g · ${holding.form}`;
  if (holding.type === 'silver') return `${holding.grams.toLocaleString()} g · ${holding.form}`;
  if (holding.type === 'stock') return `${holding.shares.toLocaleString()} shares · ${holding.companyName}`;
  if (holding.type === 'personal_asset') {
    const c = holding.category;
    return c.charAt(0).toUpperCase() + c.slice(1);
  }
  const typeLabel = holding.propertyType.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
  const place = [holding.district, holding.city].filter(Boolean).join(', ');
  return place ? `${typeLabel} · ${place}` : typeLabel;
}

const ICON_COLORS: Record<Holding['type'], string> = {
  gold: '#D4AC0D',
  silver: '#C0C8D4',
  stock: '#4A9EFF',
  real_estate: '#A47FCA',
  personal_asset: '#E08E45',
};

export function HoldingCard({ holding, prices, onDelete, onEdit }: HoldingCardProps) {
  const colors = useColors();
  const currentValue = computeCurrentValue(holding, prices);
  const cost = computeCost(holding, prices);
  const gain = currentValue - cost;
  const gainPercent = cost > 0 ? (gain / cost) * 100 : 0;
  const isPositive = gain >= 0;
  const gainColor = isPositive ? colors.green : colors.red;
  const iconColor = ICON_COLORS[holding.type];

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Left accent */}
      <View style={[styles.leftAccent, { backgroundColor: iconColor }]} />

      <View style={[styles.iconWrap, { backgroundColor: iconColor + '20' }]}>
        <Feather name={getIcon(holding)} size={17} color={iconColor} />
      </View>

      <View style={styles.info}>
        <Text style={[styles.title, { color: colors.text }]}>{getTitle(holding)}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>{getSubtitle(holding)}</Text>
      </View>

      <View style={styles.right}>
        {prices ? (
          <>
            <Text style={[styles.value, { color: colors.text }]}>
              {currentValue.toLocaleString('en-EG', { maximumFractionDigits: 0 })}
              <Text style={[styles.valueUnit, { color: colors.mutedForeground }]}> EGP</Text>
            </Text>
            {holding.type === 'personal_asset' ? (
              <View style={[styles.manualPill, { backgroundColor: colors.mutedForeground + '18' }]}>
                <Feather name="edit-3" size={9} color={colors.mutedForeground} />
                <Text style={[styles.manualText, { color: colors.mutedForeground }]}>Manual Value</Text>
              </View>
            ) : (
              <View style={[styles.gainPill, { backgroundColor: gainColor + '18' }]}>
                <Feather name={isPositive ? 'arrow-up' : 'arrow-down'} size={9} color={gainColor} />
                <Text style={[styles.gainText, { color: gainColor }]}>
                  {isPositive ? '+' : ''}{gainPercent.toFixed(1)}%
                </Text>
              </View>
            )}
          </>
        ) : (
          <View style={[styles.skeleton, { backgroundColor: colors.muted }]} />
        )}
      </View>

      <View style={styles.actions}>
        {onEdit && (
          <TouchableOpacity
            onPress={onEdit}
            style={[styles.actionBtn, { backgroundColor: colors.primary + '14' }]}
            hitSlop={8}
            activeOpacity={0.7}
          >
            <Feather name="edit-2" size={13} color={colors.primary} />
          </TouchableOpacity>
        )}
        {onDelete && (
          <TouchableOpacity
            onPress={onDelete}
            style={[styles.actionBtn, { backgroundColor: colors.red + '12' }]}
            hitSlop={8}
            activeOpacity={0.7}
          >
            <Feather name="trash-2" size={13} color={colors.red} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: 14,
    paddingRight: 14,
    paddingLeft: 6,
    borderWidth: 1,
    gap: 12,
    overflow: 'hidden',
  },
  leftAccent: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginLeft: 2,
    opacity: 0.7,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  right: {
    alignItems: 'flex-end',
    gap: 5,
  },
  value: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.3,
  },
  valueUnit: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  gainPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
  },
  gainText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  manualPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
  },
  manualText: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
  },
  skeleton: {
    width: 80,
    height: 18,
    borderRadius: 6,
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  actionBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
