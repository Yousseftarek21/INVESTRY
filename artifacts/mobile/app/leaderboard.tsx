import React, { useState } from 'react';
import {
  ActivityIndicator, FlatList, Platform, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { backChevron } from '@/utils/rtl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useUser } from '@clerk/expo';
import { useLeaderboard, LeaderboardEntry, LeaderboardPeriod } from '@/hooks/useLeaderboard';

const NICKNAME_MAX = 24;

function pctColor(colors: ReturnType<typeof useColors>, pct: number): string {
  if (pct > 0) return colors.green;
  if (pct < 0) return colors.red;
  return colors.mutedForeground;
}

// Podium treatment for the top 3 — bigger, medal-tinted, visually distinct
// from the plain numbered rows below them, since "who's #1 this week" is the
// single most scannable thing a competitive leaderboard should communicate.
const MEDAL_BG: Record<number, string> = { 1: '#F5C34C1F', 2: '#C7CDD61F', 3: '#D3956B1F' };
const MEDAL_EMOJI: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function Row({ entry, isLast }: { entry: LeaderboardEntry; isLast: boolean }) {
  const colors = useColors();
  const t = useT();
  const isPodium = entry.rank <= 3;
  return (
    <View
      style={[
        rs.row,
        { borderBottomColor: colors.border },
        !isLast && rs.rowBorder,
        isPodium && { backgroundColor: MEDAL_BG[entry.rank] },
        entry.isMe && { backgroundColor: colors.primary + '14' },
      ]}
    >
      <View style={rs.rankWrap}>
        {isPodium ? (
          <Text style={rs.medal}>{MEDAL_EMOJI[entry.rank]}</Text>
        ) : (
          <Text style={[rs.rankTxt, { color: colors.mutedForeground }]}>{entry.rank}</Text>
        )}
      </View>
      <Text
        style={[rs.nickname, { color: colors.text }, isPodium && rs.nicknameBold]}
        numberOfLines={1}
      >
        {entry.nickname}{entry.isMe ? ` (${t.leaderboardYou})` : ''}
      </Text>
      <View style={[rs.pctPill, { backgroundColor: pctColor(colors, entry.pctReturn) + '18' }]}>
        <Text style={[rs.pct, { color: pctColor(colors, entry.pctReturn) }]} numberOfLines={1}>
          {entry.pctReturn > 0 ? '+' : ''}{entry.pctReturn.toFixed(2)}%
        </Text>
      </View>
    </View>
  );
}

function PeriodToggle({ period, onChange }: { period: LeaderboardPeriod; onChange: (p: LeaderboardPeriod) => void }) {
  const colors = useColors();
  const t = useT();
  const { impact } = useHaptic();
  const options: { key: LeaderboardPeriod; label: string }[] = [
    { key: 'week', label: t.leaderboardWeekly },
    { key: 'month', label: t.leaderboardMonthly },
  ];
  return (
    <View style={[pt.wrap, { backgroundColor: colors.muted }]}>
      {options.map(opt => {
        const active = opt.key === period;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[pt.pill, active && { backgroundColor: colors.card }]}
            onPress={() => { if (!active) { impact(); onChange(opt.key); } }}
            activeOpacity={0.8}
          >
            <Text style={[pt.pillTxt, { color: active ? colors.text : colors.mutedForeground }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function LeaderboardScreen() {
  const colors = useColors();
  const t = useT();
  const { user } = useUser();
  const insets = useSafeAreaInsets();
  const { impact } = useHaptic();
  const [period, setPeriod] = useState<LeaderboardPeriod>('week');
  const { top, me, isLoading, isFetching, isOptedIn, refresh, join, leave } = useLeaderboard(period);

  const realName = (user?.unsafeMetadata?.displayName as string | undefined) || user?.firstName || '';
  // Reusing the same nickname state for both first-time join and a later
  // edit (see `editing` below) — join() upserts either way, so there's no
  // separate "update" endpoint needed.
  const [nickname, setNickname] = useState(realName);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // An already-opted-in user could otherwise only fix a wrong nickname by
  // leaving and rejoining — this reopens the same form pre-filled with
  // whatever they're currently shown as, so a correction is one edit rather
  // than a full leave/rejoin round trip.
  const [editing, setEditing] = useState(false);

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  const yourRankLabel = period === 'week' ? t.leaderboardYourRankWeek : t.leaderboardYourRankMonth;
  const topLabel = period === 'week' ? t.leaderboardTopLabelWeek : t.leaderboardTopLabelMonth;

  const handleJoin = async () => {
    const trimmed = nickname.trim();
    if (!trimmed) { setError(t.leaderboardNicknameRequired); return; }
    setError(null);
    setJoining(true);
    impact();
    const ok = await join(trimmed);
    setJoining(false);
    if (ok) setEditing(false); else setError(t.leaderboardJoinFailed);
  };

  const startEditing = () => {
    impact();
    setNickname(me?.nickname ?? realName);
    setError(null);
    setEditing(true);
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
        ) : !isOptedIn || editing ? (
          <View style={[s.content, { paddingBottom: botPad + 24 }]}>
            <View style={[s.joinCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[s.joinIcon, { backgroundColor: colors.primary + '18' }]}>
                <Feather name="trending-up" size={22} color={colors.primary} />
              </View>
              <Text style={[s.joinTitle, { color: colors.text }]}>
                {editing ? t.leaderboardEditNickname : t.leaderboardJoinTitle}
              </Text>
              {!editing && <Text style={[s.joinBody, { color: colors.mutedForeground }]}>{t.leaderboardJoinBody}</Text>}

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
                  : <Text style={s.joinBtnTxt}>{editing ? t.leaderboardSaveCta : t.leaderboardJoinCta}</Text>}
              </TouchableOpacity>

              {editing ? (
                <TouchableOpacity onPress={() => { impact(); setError(null); setEditing(false); }} hitSlop={8}>
                  <Text style={[s.joinFootnote, { color: colors.mutedForeground, marginTop: 12 }]}>{t.cancel}</Text>
                </TouchableOpacity>
              ) : (
                <Text style={[s.joinFootnote, { color: colors.mutedForeground }]}>{t.leaderboardPrivacyNote}</Text>
              )}
            </View>
          </View>
        ) : (
          <>
            <PeriodToggle period={period} onChange={setPeriod} />

            {!me && (
              <View style={[s.pendingBanner, { backgroundColor: colors.muted }]}>
                <Feather name="clock" size={13} color={colors.mutedForeground} />
                <Text style={[s.pendingTxt, { color: colors.mutedForeground }]}>{t.leaderboardPending}</Text>
                <TouchableOpacity onPress={startEditing} hitSlop={8}>
                  <Feather name="edit-2" size={13} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            )}
            {!!me && (
              <View style={[s.meCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={s.meLabelRow}>
                  <Text style={[s.meLabel, { color: colors.mutedForeground }]}>{yourRankLabel}</Text>
                  <TouchableOpacity onPress={startEditing} hitSlop={8} style={s.editBtn}>
                    <Feather name="edit-2" size={11} color={colors.mutedForeground} />
                    <Text style={[s.editBtnTxt, { color: colors.mutedForeground }]}>{me.nickname}</Text>
                  </TouchableOpacity>
                </View>
                <View style={s.meRow}>
                  <Text style={[s.meRank, { color: colors.text }]}>#{me.rank}</Text>
                  <Text style={[s.mePct, { color: pctColor(colors, me.pctReturn) }]}>
                    {me.pctReturn > 0 ? '+' : ''}{me.pctReturn.toFixed(2)}%
                  </Text>
                </View>
              </View>
            )}

            <FlatList
              data={top}
              keyExtractor={item => item.nickname + item.rank}
              contentContainerStyle={{ paddingBottom: botPad + 20 }}
              refreshControl={
                <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />
              }
              ListHeaderComponent={
                top.length > 0 ? (
                  <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>{topLabel}</Text>
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
  meLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meLabel: { fontSize: 10.5, fontFamily: 'Inter_700Bold', letterSpacing: 0.8, textTransform: 'uppercase' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editBtnTxt: { fontSize: 11, fontFamily: 'Inter_500Medium' },
  meRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  meRank: { fontSize: 24, fontFamily: 'Inter_800ExtraBold' },
  mePct: { fontSize: 18, fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'] },

  sectionLabel: { fontSize: 10.5, fontFamily: 'Inter_700Bold', letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 60 },
  emptyTxt: { fontSize: 13, fontFamily: 'Inter_500Medium' },

  leaveBtn: { alignItems: 'center', paddingVertical: 14 },
  leaveTxt: { fontSize: 12.5, fontFamily: 'Inter_500Medium' },
});

const pt = StyleSheet.create({
  wrap: { flexDirection: 'row', margin: 16, marginBottom: 4, borderRadius: 12, padding: 3, gap: 3 },
  pill: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9 },
  pillTxt: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
});

const rs = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 13 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth },
  rankWrap: { width: 28, alignItems: 'center' },
  medal: { fontSize: 18 },
  rankTxt: { fontSize: 13, fontFamily: 'Inter_600SemiBold', fontVariant: ['tabular-nums'] },
  nickname: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium' },
  nicknameBold: { fontFamily: 'Inter_700Bold' },
  pctPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  pct: { fontSize: 13, fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'] },
});
