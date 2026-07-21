import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BanknoteIcon } from '@/components/BanknoteIcon';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';

// Entrance/exit are handled entirely by the navigator's own
// "slide_from_bottom" transition (see _layout.tsx) — a hand-rolled JS
// animation here previously raced against that transition and read as
// laggy. Letting the native transition own the whole screen (dim + sheet
// together) matches how the other native "modal" screens (cash-accounts,
// goals) already feel, since those get the same native-driven treatment.
export default function AddChooseScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();

  const dismiss = () => router.back();

  const goInvestment = () => router.push('/add-investment?mode=investment' as any);
  const goCash = () => router.push('/cash-accounts?openAdd=1' as any);
  const goRecurringIncome = () => router.push('/recurring-income' as any);

  const bottomPad = insets.bottom + (Platform.OS === 'android' ? 16 : 8);

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={s.dim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
      </View>

      <View
        style={[
          s.sheet,
          {
            backgroundColor: colors.card,
            paddingBottom: bottomPad,
          },
        ]}
      >
        <View style={[s.handle, { backgroundColor: colors.mutedForeground + '50' }]} />
        <Text style={[s.title, { color: colors.mutedForeground }]}>{t.whatToAdd}</Text>

        <TouchableOpacity
          style={[s.card, { backgroundColor: colors.background, borderColor: colors.border }]}
          onPress={goInvestment}
          activeOpacity={0.72}
        >
          <View style={[s.iconWrap, { backgroundColor: colors.primary + '1A' }]}>
            <Feather name="trending-up" size={26} color={colors.primary} />
          </View>
          <View style={s.cardText}>
            <Text style={[s.cardTitle, { color: colors.text }]}>{t.addInvestmentOption}</Text>
            <Text style={[s.cardDesc, { color: colors.mutedForeground }]}>{t.addInvestmentOptionDesc}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.card, { backgroundColor: colors.background, borderColor: colors.border }]}
          onPress={goCash}
          activeOpacity={0.72}
        >
          <View style={[s.iconWrap, { backgroundColor: '#22C55E1A' }]}>
            <BanknoteIcon size={26} color="#22C55E" />
          </View>
          <View style={s.cardText}>
            <Text style={[s.cardTitle, { color: colors.text }]}>{t.addCashOption}</Text>
            <Text style={[s.cardDesc, { color: colors.mutedForeground }]}>{t.addCashOptionDesc}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.cardSm, { backgroundColor: colors.background, borderColor: colors.border }]}
          onPress={goRecurringIncome}
          activeOpacity={0.72}
        >
          <View style={[s.iconWrapSm, { backgroundColor: '#8B5CF61A' }]}>
            <Feather name="repeat" size={18} color="#8B5CF6" />
          </View>
          <View style={s.cardSmText}>
            <Text style={[s.cardTitleSm, { color: colors.text }]}>{t.addRecurringIncomeOption}</Text>
            <Text style={[s.cardDescSm, { color: colors.mutedForeground }]}>{t.addRecurringIncomeOptionDesc}</Text>
          </View>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 24,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  cardDesc: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    lineHeight: 17,
  },
  cardSm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  iconWrapSm: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardSmText: {
    flex: 1,
    gap: 2,
  },
  cardTitleSm: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  cardDescSm: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    lineHeight: 15,
  },
});
