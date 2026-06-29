import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface PriceCardProps {
  label: string;
  sublabel?: string;
  price: number;
  unit?: string;
  change?: number;
  changePercent?: number;
  icon?: keyof typeof Feather.glyphMap;
  iconColor?: string;
}

export function PriceCard({ label, sublabel, price, unit = 'EGP', change, changePercent, icon, iconColor }: PriceCardProps) {
  const colors = useColors();

  const isPositive = (changePercent ?? 0) >= 0;
  const changeColor = isPositive ? colors.green : colors.red;
  const changeIcon: keyof typeof Feather.glyphMap = isPositive ? 'trending-up' : 'trending-down';

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.header}>
        {icon && (
          <View style={[styles.iconWrap, { backgroundColor: iconColor ? iconColor + '22' : colors.muted }]}>
            <Feather name={icon} size={16} color={iconColor ?? colors.primary} />
          </View>
        )}
        <View style={styles.labels}>
          <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
          {sublabel ? <Text style={[styles.sublabel, { color: colors.mutedForeground }]}>{sublabel}</Text> : null}
        </View>
      </View>
      <Text style={[styles.price, { color: colors.text }]}>
        {price.toLocaleString('en-EG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        <Text style={[styles.unit, { color: colors.mutedForeground }]}> {unit}</Text>
      </Text>
      {changePercent !== undefined && (
        <View style={[styles.change, { backgroundColor: changeColor + '1A' }]}>
          <Feather name={changeIcon} size={12} color={changeColor} />
          <Text style={[styles.changeText, { color: changeColor }]}>
            {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
          </Text>
          {change !== undefined && (
            <Text style={[styles.changeAbs, { color: colors.mutedForeground }]}>
              ({isPositive ? '+' : ''}{change.toFixed(2)})
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labels: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  sublabel: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginTop: 1,
  },
  price: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5,
  },
  unit: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  change: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  changeText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  changeAbs: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
});
