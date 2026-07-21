import React from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import {
  getTools,
  ZakatContent, GoldValueContent, SilverValueContent, CurrencyContent,
  ROIContent, CompoundContent, GoldPurityContent, WeightContent,
} from '@/components/FinancialTools';

// Same screen chrome as app/goals.tsx (header row, safe-area padding,
// KeyboardAvoidingView + ScrollView body) and the same "modal" presentation
// in _layout.tsx — one shared route for every calculator, all native-driven,
// no custom open/close animation.
export default function FinancialToolScreen() {
  const { tool } = useLocalSearchParams<{ tool: string }>();
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();

  const meta = getTools(t).find(tl => tl.id === tool);

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.screen, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Feather name="chevron-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>{meta?.title ?? ''}</Text>
          <View style={{ width: 22 }} />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[s.content, { paddingBottom: botPad + 32 }]}
            keyboardShouldPersistTaps="handled"
          >
            {tool === 'zakat' && <ZakatContent />}
            {tool === 'gold' && <GoldValueContent />}
            {tool === 'silver' && <SilverValueContent />}
            {tool === 'currency' && <CurrencyContent />}
            {tool === 'roi' && <ROIContent />}
            {tool === 'compound' && <CompoundContent />}
            {tool === 'purity' && <GoldPurityContent />}
            {tool === 'weight' && <WeightContent />}
          </ScrollView>
        </KeyboardAvoidingView>
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
  content: { padding: 16, gap: 16 },
});
