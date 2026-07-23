import React, { useState } from 'react';
import {
  Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';

interface FAQItem { q: string; a: string }
interface FAQCategory { icon: keyof typeof Feather.glyphMap; color: string; title: string; items: FAQItem[] }

function FAQRow({ item, isLast }: { item: FAQItem; isLast: boolean }) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  return (
    <View style={[fr.wrap, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
      <TouchableOpacity
        style={fr.row}
        activeOpacity={0.7}
        onPress={() => setOpen(v => !v)}
      >
        <Text style={[fr.q, { color: colors.text }]}>{item.q}</Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
      {open && <Text style={[fr.a, { color: colors.mutedForeground }]}>{item.a}</Text>}
    </View>
  );
}

const fr = StyleSheet.create({
  wrap: { paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 12 },
  q: { flex: 1, fontSize: 14, fontFamily: 'Inter_600SemiBold', lineHeight: 20 },
  a: { fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20, paddingBottom: 14 },
});

function CategoryCard({ category }: { category: FAQCategory }) {
  const colors = useColors();
  return (
    <View style={[cc.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={cc.header}>
        <View style={[cc.iconWrap, { backgroundColor: category.color + '18' }]}>
          <Feather name={category.icon} size={15} color={category.color} />
        </View>
        <Text style={[cc.title, { color: colors.text }]}>{category.title}</Text>
      </View>
      {category.items.map((item, i) => (
        <FAQRow key={item.q} item={item} isLast={i === category.items.length - 1} />
      ))}
    </View>
  );
}

const cc = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  iconWrap: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontFamily: 'Inter_700Bold' },
});

export default function HelpCenterScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();

  const CATEGORIES: FAQCategory[] = [
    {
      icon: 'compass', color: '#0EA5E9', title: t.helpCatGettingStarted,
      items: [
        { q: t.helpAddHoldingQ, a: t.helpAddHoldingA },
        { q: t.helpSwitchLanguageQ, a: t.helpSwitchLanguageA },
      ],
    },
    {
      icon: 'briefcase', color: '#C9A227', title: t.helpCatHoldings,
      items: [
        { q: t.helpHoldingTypesQ, a: t.helpHoldingTypesA },
        { q: t.helpEditDeleteQ, a: t.helpEditDeleteA },
        { q: t.helpFixedIncomeFlatQ, a: t.helpFixedIncomeFlatA },
      ],
    },
    {
      icon: 'dollar-sign', color: '#22C55E', title: t.helpCatCash,
      items: [
        { q: t.helpCashTypesQ, a: t.helpCashTypesA },
        { q: t.helpRecurringIncomeQ, a: t.helpRecurringIncomeA },
      ],
    },
    {
      icon: 'tool', color: '#A47FCA', title: t.helpCatTools,
      items: [
        { q: t.helpCalculatorsQ, a: t.helpCalculatorsA },
        { q: t.helpZakatQ, a: t.helpZakatA },
      ],
    },
    {
      icon: 'bar-chart-2', color: '#4A9EFF', title: t.helpCatAnalytics,
      items: [
        { q: t.helpAnalyticsQ, a: t.helpAnalyticsA },
        { q: t.helpChartFlatQ, a: t.helpChartFlatA },
      ],
    },
    {
      icon: 'star', color: '#C9A227', title: t.helpCatSubscription,
      items: [
        { q: t.helpFreeVsProQ, a: t.helpFreeVsProA },
      ],
    },
    {
      icon: 'shield', color: '#4A9EFF', title: t.helpCatPrivacy,
      items: [
        { q: t.helpDataSyncQ, a: t.helpDataSyncA },
        { q: t.helpEncryptionQ, a: t.helpEncryptionA },
      ],
    },
  ];

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.screen, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Feather name="chevron-left" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>{t.helpCenter}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.content, { paddingBottom: botPad + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {CATEGORIES.map(cat => <CategoryCard key={cat.title} category={cat} />)}

          <View style={[s.contact, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.contactTitle, { color: colors.text }]}>{t.helpStillNeedHelp}</Text>
            <Text style={[s.contactDesc, { color: colors.mutedForeground }]}>{t.helpContactDesc}</Text>
            <TouchableOpacity
              style={[s.contactBtn, { backgroundColor: colors.primary }]}
              onPress={() => Linking.openURL('mailto:support@investry.app')}
              activeOpacity={0.85}
            >
              <Feather name="mail" size={15} color={colors.primaryForeground} />
              <Text style={[s.contactBtnTxt, { color: colors.primaryForeground }]}>{t.contactSupport}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  content: { padding: 16, paddingTop: 18 },
  contact: {
    borderRadius: 18, borderWidth: 1, padding: 20,
    alignItems: 'center', gap: 6, marginTop: 4,
  },
  contactTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  contactDesc: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', marginBottom: 10 },
  contactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12,
  },
  contactBtnTxt: { fontSize: 14, fontFamily: 'Inter_700Bold' },
});
