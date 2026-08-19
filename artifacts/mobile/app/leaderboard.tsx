import React, { useState } from 'react';
import {
  ActivityIndicator, FlatList, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { backChevron } from '@/utils/rtl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useLeaderboard, LeaderboardEntry } from '@/hooks/useLeaderboard';

const NICKNAME_MAX = 24;

function pctColor(colors: ReturnType<typeof useColors>, pct: number): string {
  if (pct > 0) return colors.green;
  if (pct < 0) return colors.red;
  return colors.mutedForeground;
}

function Row({ entry, isLast }: { entry: LeaderboardEntry; isLast: boolean }) {
  const colors = useColors();
  const t = useT();
  const medal = entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : null;
  return (
    <View
      style={[
        rs.row,
        { borderBottomColor: colors.border },
        !isLast && rs.rowBorder,
        entry.isMe && { backgroundColor: colors.primary + '0F' },
      ]}
    >
      <View style={rs.rankWrap}>
        {medal ? (
          <Text style={rs.medal}>{medal}</Text>
        ) : (
          <Text style={[rs.rankTxt, { color: colors.mutedForeground }]}>{entry.rank}</Text>
        )}
      </View>
      <Text style={[rs.nickname, { color: colors.text }]} numberOfLines={1}>
        {entry.nickname}{entry.isMe ? ` (${t.leaderboardYou})` : ''}
      </Text>
      <Text style={[rs.pct, { color: pctColor(colors, entry.pctReturn) }]} numberOfLines={1}>
        {entry.pctReturn > 0 ? '+' : ''}{entry.pctReturn.toFixed(1)}%
      </Text>
    </View>
  );
}

export default function LeaderboardScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { impact } = useHaptic();
  const { top, me, isLoading, isOptedIn, join, leave } = useLeaderboard();

  const [nickname, setNickname] = useState('');
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  const handleJoin = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) { setError(t.leaderboardNicknameRequired); return; }
    setError(null);
    setJoining(true);
    impact();
    const ok = await join(trimmed);
    setJoining(false);
    if (!ok) setError(t.leaderboardJoinFailed);
  };

  const handleLeave = async () => {
    impact();
    await leave();
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.screen, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Feather name={backChevron()} size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>{t.leaderboardTitle}</Text>
          <View style={{ width: 22 }} />
        </View>

        {isLoading ? (
          <View style={s.empty}>
            <ActivityIndicator size="small" color={colors.mutedForeground} />
          </View>
        ) : !isOptedIn ? (
          <View style={[s.content, { paddingBottom: botPad + 24 }]}>
            <View style={[s.joinCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[s.joinIcon, { backgroundColor: colors.primary + '18' }]}>
                <Feather name="trending-up" size={22} color={colors.primary} />
              </View>
              <Text style={[s.joinTitle, { color: colors.text }]}>{t.leaderboardJoinTitle}</Text>
              <Text style={[s.joinBody, { color: colors.mutedForeground }]}>{t.leaderboardJoinBody}</Text>

              <TextInput
                style={[s.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.muted }]}
                placeholder={t.leaderboardNicknamePlaceholder}
                placeholderTextColor={colors.mutedForeground}
                value={nickname}
                onChangeText={t2 => { setNickname(t2.slice(0, NICKNAME_MAX)); setError(null); }}
                maxLength={NICKNAME_MAX}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {!!error && <Text style={[s.errorTxt, { color: colors.red }]}>{error}</Text>}

              <TouchableOpacity
                style={[s.joinBtn, { backgroundColor: colors.primary, opacity: joining ? 0.6 : 1 }]}
                onPress={handleJoin}
                disabled={joining}
                activeOpacity={0.8}
              >
                {joining
                  ? <ActivityIndicator size="small" color="#000" />
                  : <Text style={s.joinBtnTxt}>{t.leaderboardJoinCta}</Text>}
              </TouchableOpacity>

              <Text style={[s.joinFootnote, { color: colors.mutedForeground }]}>{t.leaderboardPrivacyNote}</Text>
            </View>
          </View>
        ) : (
          <>
            {!me && (
              <View style={[s.pendingBanner, { backgroundColor: colors.muted }]}>
                <Feather name="clock" size={13} color={colors.mutedForeground} />
                <Text style={[s.pendingTxt, { color: colors.mutedForeground }]}>{t.leaderboardPending}</Text>
              </View>
            )}
            {!!me && (
              <View style={[s.meCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.meLabel, { color: colors.mutedForeground }]}>{t.leaderboardYourRank}</Text>
                <View style={s.meRow}>
                  <Text style={[s.meRank, { color: colors.text }]}>#{me.rank}</Text>
                  <Text style={[s.mePct, { color: pctColor(colors, me.pctReturn) }]}>
                    {me.pctReturn > 0 ? '+' : ''}{me.pctReturn.toFixed(1)}%
                  </Text>
                </View>
              </View>
            )}

            <FlatList
              data={top}
              keyExtractor={item => item.nickname + item.rank}
              contentContainerStyle={{ paddingBottom: botPad + 20 }}
              ListHeaderComponent={
                top.length > 0 ? (
                  <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>{t.leaderboardTopLabel}</Text>
                ) : null
              }
              ListEmptyComponent={
                <View style={s.empty}>
                  <Feather name="users" size={26} color={colors.mutedForeground} />
                  <Text style={[s.emptyTxt, { color: colors.mutedForeground }]}>{t.leaderboardEmpty}</Text>
                </View>
              }
              renderItem={({ item, index }) => <Row entry={item} isLast={index === top.length - 1} />}
            />

            <TouchableOpacity style={s.leaveBtn} onPress={handleLeave} activeOpacity={0.7}>
              <Text style={[s.leaveTxt, { color: colors.mutedForeground }]}>{t.leaderboardLeave}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  content: { padding: 20, flexGrow: 1 },

  joinCard: { borderRadius: 20, borderWidth: 1, padding: 22, alignItems: 'center', gap: 6 },
  joinIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  joinTitle: { fontSize: 17, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  joinBody: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19, marginBottom: 12 },
  input: { width: '100%', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: 'Inter_500Medium', marginTop: 4 },
  errorTxt: { fontSize: 12, fontFamily: 'Inter_500Medium', alignSelf: 'flex-start', marginTop: 6 },
  joinBtn: { width: '100%', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  joinBtnTxt: { fontSize: 15, fontFamily: 'Inter_700Bold', color: '#000' },
  joinFootnote: { fontSize: 11, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 16, marginTop: 14 },

  pendingBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, marginBottom: 4, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11 },
  pendingTxt: { flex: 1, fontSize: 12, fontFamily: 'Inter_500Medium', lineHeight: 17 },

  meCard: { margin: 16, marginBottom: 4, borderRadius: 16, borderWidth: 1, padding: 16, gap: 6 },
  meLabel: { fontSize: 10.5, fontFamily: 'Inter_700Bold', letterSpacing: 0.8, textTransform: 'uppercase' },
  meRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  meRank: { fontSize: 24, fontFamily: 'Inter_800ExtraBold' },
  mePct: { fontSize: 18, fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'] },

  sectionLabel: { fontSize: 10.5, fontFamily: 'Inter_700Bold', letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 60 },
  emptyTxt: { fontSize: 13, fontFamily: 'Inter_500Medium' },

  leaveBtn: { alignItems: 'center', paddingVertical: 14 },
  leaveTxt: { fontSize: 12.5, fontFamily: 'Inter_500Medium' },
});

const rs = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 13 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth },
  rankWrap: { width: 28, alignItems: 'center' },
  medal: { fontSize: 17 },
  rankTxt: { fontSize: 13, fontFamily: 'Inter_600SemiBold', fontVariant: ['tabular-nums'] },
  nickname: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium' },
  pct: { fontSize: 14, fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'] },
});
