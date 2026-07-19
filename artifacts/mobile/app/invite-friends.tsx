import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/expo';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { apiFetch } from '@/utils/api';

interface ReferralInfo {
  code: string;
  link: string;
  referredCount: number;
  proCreditExpiresAt: string | null;
  hasRedeemed: boolean;
}

export default function InviteFriendsScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();

  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemMessage, setRedeemMessage] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const res = await apiFetch('/api/referral', token ?? '');
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setInfo(data);
    } catch {
      setInfo(null);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  const handleShare = async () => {
    if (!info) return;
    try {
      await Share.share({
        message: `${t.referralShareMessage} ${info.code} ${t.referralShareMessageLink} ${info.link}`,
      });
    } catch {
      // user cancelled or share sheet failed silently — nothing to do
    }
  };

  const handleRedeem = async () => {
    const code = redeemCode.trim();
    if (!code || redeeming) return;
    setRedeeming(true);
    setRedeemMessage(null);
    try {
      const token = await getToken();
      const res = await apiFetch('/api/referral/redeem', token ?? '', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      if (res.ok) {
        setRedeemMessage({ text: t.referralRedeemSuccess, kind: 'success' });
        setRedeemCode('');
        load();
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) setRedeemMessage({ text: t.referralAlreadyRedeemed, kind: 'error' });
      else if (res.status === 404) setRedeemMessage({ text: t.referralRedeemInvalidCode, kind: 'error' });
      else if (res.status === 400 && data?.error?.includes('own')) setRedeemMessage({ text: t.referralRedeemOwnCode, kind: 'error' });
      else setRedeemMessage({ text: t.referralRedeemGenericError, kind: 'error' });
    } catch {
      setRedeemMessage({ text: t.referralRedeemGenericError, kind: 'error' });
    } finally {
      setRedeeming(false);
    }
  };

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.screen, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Feather name="chevron-left" size={24} color={colors.text} />
          </Pressable>
          <Text style={[s.headerTitle, { color: colors.text }]}>{t.referralScreenTitle}</Text>
          <View style={{ width: 24 }} />
        </View>

        {loading ? (
          <View style={s.centerFill}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : !info ? (
          <View style={s.centerFill}>
            <Text style={{ color: colors.mutedForeground }}>{t.referralRedeemGenericError}</Text>
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[s.content, { paddingBottom: botPad + 32 }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Hero */}
            <View style={[s.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[s.heroIcon, { backgroundColor: colors.primary + '18' }]}>
                <Feather name="gift" size={26} color={colors.primary} />
              </View>
              <Text style={[s.heroTitle, { color: colors.text }]}>{t.referralHeroTitle}</Text>
              <Text style={[s.heroSub, { color: colors.mutedForeground }]}>{t.referralHeroSub}</Text>
            </View>

            {/* Code */}
            <View style={[s.codeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.codeLabel, { color: colors.mutedForeground }]}>{t.referralYourCode}</Text>
              <Text selectable style={[s.codeValue, { color: colors.primary }]}>{info.code}</Text>
              <Pressable
                onPress={handleShare}
                style={({ pressed }) => [s.shareBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.88 : 1 }]}
              >
                <Feather name="share-2" size={16} color={colors.primaryForeground} />
                <Text style={[s.shareBtnTxt, { color: colors.primaryForeground }]}>{t.referralShareBtn}</Text>
              </Pressable>
            </View>

            {/* Stats */}
            <View style={s.statsRow}>
              <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.statValue, { color: colors.text }]}>{info.referredCount}</Text>
                <Text style={[s.statLabel, { color: colors.mutedForeground }]}>{t.referralFriendsJoined}</Text>
              </View>
              <View style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.statValue, { color: colors.text }]}>{info.referredCount}</Text>
                <Text style={[s.statLabel, { color: colors.mutedForeground }]}>{t.referralMonthsEarned}</Text>
              </View>
            </View>

            {info.proCreditExpiresAt && (
              <Text style={[s.creditNote, { color: colors.mutedForeground }]}>
                {t.referralProCreditUntil} {new Date(info.proCreditExpiresAt).toLocaleDateString()}
              </Text>
            )}

            {/* Redeem a friend's code */}
            {!info.hasRedeemed && (
              <View style={[s.redeemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.redeemTitle, { color: colors.text }]}>{t.referralHaveCodeTitle}</Text>
                <Text style={[s.redeemSub, { color: colors.mutedForeground }]}>{t.referralHaveCodeSub}</Text>
                <View style={s.redeemRow}>
                  <TextInput
                    value={redeemCode}
                    onChangeText={(v) => { setRedeemCode(v.toUpperCase()); setRedeemMessage(null); }}
                    placeholder={t.referralCodePlaceholder}
                    placeholderTextColor={colors.mutedForeground}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    style={[s.redeemInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.input }]}
                  />
                  <Pressable
                    onPress={handleRedeem}
                    disabled={!redeemCode.trim() || redeeming}
                    style={({ pressed }) => [
                      s.redeemBtn,
                      { backgroundColor: colors.primary, opacity: pressed || !redeemCode.trim() || redeeming ? 0.6 : 1 },
                    ]}
                  >
                    {redeeming ? (
                      <ActivityIndicator size="small" color={colors.primaryForeground} />
                    ) : (
                      <Text style={[s.redeemBtnTxt, { color: colors.primaryForeground }]}>{t.referralRedeemBtn}</Text>
                    )}
                  </Pressable>
                </View>
                {redeemMessage && (
                  <Text style={[s.redeemMsg, { color: redeemMessage.kind === 'success' ? colors.green : colors.red }]}>
                    {redeemMessage.text}
                  </Text>
                )}
              </View>
            )}
          </ScrollView>
        )}
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
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 14 },

  hero: { borderRadius: 20, borderWidth: 1, padding: 22, alignItems: 'center', gap: 8 },
  heroIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  heroTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  heroSub: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19 },

  codeCard: { borderRadius: 18, borderWidth: 1, padding: 20, alignItems: 'center', gap: 12 },
  codeLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', letterSpacing: 0.4, textTransform: 'uppercase' },
  codeValue: { fontSize: 32, fontFamily: 'Inter_700Bold', letterSpacing: 6 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 4,
  },
  shareBtnTxt: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },

  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 16, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 24, fontFamily: 'Inter_700Bold' },
  statLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', textAlign: 'center' },

  creditNote: { fontSize: 12, fontFamily: 'Inter_400Regular', textAlign: 'center' },

  redeemCard: { borderRadius: 18, borderWidth: 1, padding: 18, gap: 4 },
  redeemTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  redeemSub: { fontSize: 12, fontFamily: 'Inter_400Regular', marginBottom: 10 },
  redeemRow: { flexDirection: 'row', gap: 10 },
  redeemInput: {
    flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontFamily: 'Inter_600SemiBold', letterSpacing: 2,
  },
  redeemBtn: { paddingHorizontal: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  redeemBtnTxt: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  redeemMsg: { fontSize: 12, fontFamily: 'Inter_500Medium', marginTop: 10, lineHeight: 17 },
});
