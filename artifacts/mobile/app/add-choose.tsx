import { Feather } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import React, { useCallback, useRef } from 'react';
import {
  Animated,
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

export default function AddChooseScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();

  const slideY = useRef(new Animated.Value(500)).current;
  const dimOpacity = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      slideY.setValue(500);
      dimOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, bounciness: 3, speed: 16, useNativeDriver: true }),
        Animated.timing(dimOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }, []),
  );

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(slideY, { toValue: 500, duration: 220, useNativeDriver: true }),
      Animated.timing(dimOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start(() => router.back());
  };

  const goInvestment = () => router.push('/add-investment?mode=investment' as any);
  const goCash = () => router.push('/cash-accounts?openAdd=1' as any);
  const goRecurringIncome = () => router.push('/recurring-income' as any);

  const bottomPad = insets.bottom + (Platform.OS === 'android' ? 16 : 8);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[s.dim, { opacity: dimOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
      </Animated.View>

      <Animated.View
        style={[
          s.sheet,
          {
            backgroundColor: colors.card,
            paddingBottom: bottomPad,
            transform: [{ translateY: slideY }],
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
          <Text style={[s.cardTitleSm, { color: colors.text, flex: 1 }]}>{t.addRecurringIncomeOption}</Text>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </Animated.View>
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
  cardTitleSm: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
});
