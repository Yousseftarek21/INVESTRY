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
}

function computeCurrentValue(holding: Holding, prices?: MarketPrices): number {
  if (!prices) return 0;
  if (holding.type === 'gold') {
    return holding.grams * goldPricePerGram(prices, holding.karat);
  }
  if (holding.type === 'silver') {
    return holding.grams * silverPricePerGram(prices);
  }
  if (holding.type === 'stock') {
    return holding.shares * holding.purchasePricePerShare;
  }
  if (holding.type === 'real_estate') {
    return holding.currentValue;
  }
  return 0;
}

function computeCost(holding: Holding): number {
  if (holding.type === 'gold') return holding.grams * holding.purchasePricePerGram;
  if (holding.type === 'silver') return holding.grams * holding.purchasePricePerGram;
  if (holding.type === 'stock') return holding.shares * holding.purchasePricePerShare;
  if (holding.type === 'real_estate') return holding.purchasePrice;
  return 0;
}

function getIcon(holding: Holding): keyof typeof Feather.glyphMap {
  if (holding.type === 'gold') return 'award';
  if (holding.type === 'silver') return 'circle';
  if (holding.type === 'stock') return 'bar-chart-2';
  return 'home';
}

function getTitle(holding: Holding): string {
  if (holding.type === 'gold') return `Gold ${holding.karat} (${holding.form})`;
  if (holding.type === 'silver') return `Silver (${holding.form})`;
  if (holding.type === 'stock') return holding.symbol;
  return holding.location || 'Real Estate';
}

function getSubtitle(holding: Holding): string {
  if (holding.type === 'gold') return `${holding.grams.toLocaleString()} g`;
  if (holding.type === 'silver') return `${holding.grams.toLocaleString()} g`;
  if (holding.type === 'stock') return `${holding.shares.toLocaleString()} shares · ${holding.companyName}`;
  return holding.propertyType.charAt(0).toUpperCase() + holding.propertyType.slice(1);
}

function getIconColor(holding: Holding, colors: ReturnType<typeof useColors>): string {
  if (holding.type === 'gold') return colors.primary;
  if (holding.type === 'silver') return colors.silverColor;
  if (holding.type === 'stock') return '#4A9EFF';
  return '#A47FCA';
}

export function HoldingCard({ holding, prices, onDelete }: HoldingCardProps) {
  const colors = useColors();
  const currentValue = computeCurrentValue(holding, prices);
  const cost = computeCost(holding);
  const gain = currentValue - cost;
  const gainPercent = cost > 0 ? (gain / cost) * 100 : 0;
  const isPositive = gain >= 0;
  const iconColor = getIconColor(holding, colors);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: iconColor + '22' }]}>
        <Feather name={getIcon(holding)} size={18} color={iconColor} />
      </View>
      <View style={styles.info}>
        <Text style={[styles.title, { color: colors.text }]}>{getTitle(holding)}</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{getSubtitle(holding)}</Text>
      </View>
      <View style={styles.right}>
        {prices ? (
          <>
            <Text style={[styles.value, { color: colors.text }]}>
              {currentValue.toLocaleString('en-EG', { maximumFractionDigits: 0 })}
            </Text>
            <View style={[styles.badge, { backgroundColor: (isPositive ? colors.green : colors.red) + '1A' }]}>
              <Text style={[styles.badgeText, { color: isPositive ? colors.green : colors.red }]}>
                {isPositive ? '+' : ''}{gainPercent.toFixed(1)}%
              </Text>
            </View>
          </>
        ) : (
          <View style={[styles.skeleton, { backgroundColor: colors.muted }]} />
        )}
      </View>
      {onDelete && (
        <TouchableOpacity onPress={onDelete} style={styles.deleteBtn} hitSlop={12}>
          <Feather name="trash-2" size={15} color={colors.mutedForeground} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  value: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  skeleton: {
    width: 70,
    height: 16,
    borderRadius: 6,
  },
  deleteBtn: {
    paddingLeft: 4,
  },
});
