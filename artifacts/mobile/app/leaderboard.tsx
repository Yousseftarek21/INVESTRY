import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Platform, RefreshControl, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { useAuth } from '@clerk/expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { ConceptIcon } from '@/components/ConceptIcon';
import { ICON_LEADERBOARD } from '@/constants/conceptIcons';
import { backChevron, forwardChevron } from '@/utils/rtl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useLeaderboard, useLastLeaderboardResult, LeaderboardEntry, LeaderboardPeriod } from '@/hooks/useLeaderboard';
import { ConfirmModal } from '@/components/ConfirmModal';
import { BetaChip } from '@/components/BetaChip';
import { Avatar, MEDAL_BG, MEDAL_EMOJI, pctColor } from '@/components/LeaderboardDisplay';
import { LeaderboardResultsCelebration } from '@/components/LeaderboardResultsCelebration';

// Per-user, per-period "have I already seen the results celebration"
// gate — same dismiss-key-in-AsyncStorage pattern as CommunityInviteBanner.
// Purely a "don't replay the animation" nicety, not a correctness concern,
// so a local flag is the right tool rather than a server-side one.
function resultSeenKey(userId: string, periodType: LeaderboardPeriod, periodStart: string) {
  return `@investry_leaderboard_result_seen_${userId}_${periodType}_${periodStart}`;
}

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
      <Avatar name={entry.name} imageUrl={entry.imageUrl} size={30} />
      <Text
        style={[rs.name, { color: colors.text }, isPodium && rs.nameBold]}
        numberOfLines={1}
      >
        {entry.name}{entry.isMe ? ` (${t.leaderboardYou})` : ''}
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
  const insets = useSafeAreaInsets();
  const { impact } = useHaptic();
  const { userId } = useAuth();
  const [period, setPeriod] = useState<LeaderboardPeriod>('week');
  const { top, me, isLoading, isFetching, isOptedIn, refresh, join, leave } = useLeaderboard(period);
  const { periodStart: lastPeriodStart, top: lastTop } = useLastLeaderboardResult(period);

  const [joining, setJoining] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [celebrationVisible, setCelebrationVisible] = useState(false);

  // Auto-show once per user per period the first time results for it
  // exist and haven't been seen yet — see resultSeenKey's own comment.
  // Re-checked whenever the active period tab or the fetched result
  // changes, so switching Weekly<->Monthly can surface a second, distinct
  // celebration if that period also has unseen results.
  useEffect(() => {
    if (!userId || !isOptedIn || !lastPeriodStart || lastTop.length === 0) return;
    let cancelled = false;
    AsyncStorage.getItem(resultSeenKey(userId, period, lastPeriodStart))
      .then(seen => { if (!cancelled && !seen) setCelebrationVisible(true); })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [userId, isOptedIn, period, lastPeriodStart, lastTop.length]);

  const dismissCelebration = () => {
    setCelebrationVisible(false);
    if (userId && lastPeriodStart) {
      AsyncStorage.setItem(resultSeenKey(userId, period, lastPeriodStart), '1').catch(() => null);
    }
  };

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  const yourRankLabel = period === 'week' ? t.leaderboardYourRankWeek : t.leaderboardYourRankMonth;
  const topLabel = period === 'week' ? t.leaderboardTopLabelWeek : t.leaderboardTopLabelMonth;
  const lastResultsCardTitle = period === 'month' ? t.leaderboardResultsCardTitleMonth : t.leaderboardResultsCardTitleWeek;

  const handleJoin = async () => {
    impact();
    setJoining(true);
    await join();
    setJoining(false);
  };

  const handleLeavePress = () => {
    impact();
    setConfirmLeave(true);
  };

  const confirmLeaveNow = async () => {
    setConfirmLeave(false);
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
          <View style={s.headerTitleRow}>
            <Text style={[s.headerTitle, { color: colors.text }]}>{t.leaderboardTitle}</Text>
            <BetaChip label={t.leaderboardBetaChip} />
            {/* Explains why this ranking can read differently from the
                Week in Review recap on Analytics — both are legitimate,
                they just measure different things (see leaderboardScopeNote
                for why the leaderboard can't safely include everything
                Week in Review does). */}
            <TouchableOpacity
              onPress={() => Alert.alert(t.leaderboardScopeTitle, t.leaderboardScopeNote)}
              hitSlop={8}
            >
              <Feather name="info" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
          <View style={{ width: 22 }} />
        </View>

        {isLoading ? (
          <View style={s.empty}>
            <ActivityIndicator size="small" color={colors.mutedForeground} />
          </View>
        ) : (
          <>
            <PeriodToggle period={period} onChange={setPeriod} />

            {!isOptedIn && (
              <View style={[s.joinCta, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {/* ICON_LEADERBOARD — matches the Leaderboard's own NavRow
                    entry point in Settings. */}
                <View style={[s.joinCtaIcon, { backgroundColor: colors.primary + '18' }]}>
                  <ConceptIcon icon={ICON_LEADERBOARD} size={18} color={colors.primary} />
                </View>
                <View style={s.joinCtaText}>
                  <Text style={[s.joinCtaTitle, { color: colors.text }]}>{t.leaderboardJoinTitle}</Text>
                  <Text style={[s.joinCtaBody, { color: colors.mutedForeground }]}>{t.leaderboardJoinBody}</Text>
                </View>
                <TouchableOpacity
                  style={[s.joinCtaBtn, { backgroundColor: colors.primary, opacity: joining ? 0.6 : 1 }]}
                  onPress={handleJoin}
                  disabled={joining}
                  activeOpacity={0.8}
                >
                  {joining
                    ? <ActivityIndicator size="small" color="#000" />
                    : <Text style={s.joinCtaBtnTxt}>{t.leaderboardJoinCta}</Text>}
                </TouchableOpacity>
                <Text style={[s.joinCtaFootnote, { color: colors.mutedForeground }]}>{t.leaderboardPrivacyNote}</Text>
              </View>
            )}

            {isOptedIn && !me && (
              <View style={[s.pendingBanner, { backgroundColor: colors.muted }]}>
                <Feather name="clock" size={13} color={colors.mutedForeground} />
                <Text style={[s.pendingTxt, { color: colors.mutedForeground }]}>{t.leaderboardPending}</Text>
              </View>
            )}
            {!!me && (
              <View style={[s.meCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.meLabel, { color: colors.mutedForeground }]}>{yourRankLabel}</Text>
                <View style={s.meRow}>
                  <View style={s.meRankRow}>
                    <Avatar name={me.name} imageUrl={me.imageUrl} size={28} />
                    <Text style={[s.meRank, { color: colors.text }]}>#{me.rank}</Text>
                  </View>
                  <Text style={[s.mePct, { color: pctColor(colors, me.pctReturn) }]}>
                    {me.pctReturn > 0 ? '+' : ''}{me.pctReturn.toFixed(2)}%
                  </Text>
                </View>
              </View>
            )}

            <FlatList
              data={top}
              keyExtractor={item => item.userId}
              contentContainerStyle={{ paddingBottom: botPad + 20 }}
              refreshControl={
                <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />
              }
              ListHeaderComponent={
                <>
                  {/* Persistent "last period's top 3" — not just the
                      one-time celebration modal, so the result isn't lost
                      once that's dismissed. Gated on isOptedIn same as the
                      rest of this screen: never shown to anyone who hasn't
                      joined the competition. */}
                  {isOptedIn && lastTop.length > 0 && (
                    <TouchableOpacity
                      style={[s.lastResultsCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                      onPress={() => { impact(); setCelebrationVisible(true); }}
                      activeOpacity={0.85}
                    >
                      <View style={s.lastResultsHeader}>
                        <Text style={[s.lastResultsTitle, { color: colors.text }]}>{lastResultsCardTitle}</Text>
                        <Feather name={forwardChevron()} size={14} color={colors.mutedForeground} />
                      </View>
                      {lastTop.map(entry => (
                        <View key={entry.userId} style={s.lastResultsRow}>
                          <Text style={s.lastResultsMedal}>{MEDAL_EMOJI[entry.rank]}</Text>
                          <Avatar name={entry.name} imageUrl={entry.imageUrl} size={22} />
                          <Text style={[s.lastResultsName, { color: colors.text }]} numberOfLines={1}>
                            {entry.name}{entry.userId === userId ? ` (${t.leaderboardYou})` : ''}
                          </Text>
                          <Text style={[s.lastResultsPct, { color: pctColor(colors, entry.pctReturn) }]}>
                            {entry.pctReturn > 0 ? '+' : ''}{entry.pctReturn.toFixed(2)}%
                          </Text>
                        </View>
                      ))}
                    </TouchableOpacity>
                  )}
                  {top.length > 0 && (
                    <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>{topLabel}</Text>
                  )}
                </>
              }
              ListEmptyComponent={
                <View style={s.empty}>
                  <Feather name="users" size={26} color={colors.mutedForeground} />
                  <Text style={[s.emptyTxt, { color: colors.mutedForeground }]}>{t.leaderboardEmpty}</Text>
                </View>
              }
              renderItem={({ item, index }) => <Row entry={item} isLast={index === top.length - 1} />}
            />

            {isOptedIn && (
              <TouchableOpacity style={[s.leaveBtn, { borderColor: colors.red + '30' }]} onPress={handleLeavePress} activeOpacity={0.7}>
                <Feather name="log-out" size={14} color={colors.red} />
                <Text style={[s.leaveTxt, { color: colors.red }]}>{t.leaderboardLeave}</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      <ConfirmModal
        visible={confirmLeave}
        title={t.leaderboardLeaveConfirmTitle}
        message={t.leaderboardLeaveConfirmMsg}
        confirmLabel={t.leaderboardLeaveConfirmCta}
        danger
        onConfirm={confirmLeaveNow}
        onCancel={() => setConfirmLeave(false)}
      />

      {celebrationVisible && (
        <LeaderboardResultsCelebration
          period={period}
          top={lastTop}
          myUserId={userId}
          onDismiss={dismissCelebration}
        />
      )}
    </>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },

  joinCta: { margin: 16, marginBottom: 4, borderRadius: 18, borderWidth: 1, padding: 16, gap: 10 },
  joinCtaIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  joinCtaText: { gap: 3 },
  joinCtaTitle: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  joinCtaBody: { fontSize: 12.5, fontFamily: 'Inter_400Regular', lineHeight: 18 },
  joinCtaBtn: { borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  joinCtaBtnTxt: { fontSize: 14, fontFamily: 'Inter_700Bold', color: '#000' },
  joinCtaFootnote: { fontSize: 10.5, fontFamily: 'Inter_400Regular', lineHeight: 15 },

  pendingBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, marginBottom: 4, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 11 },
  pendingTxt: { flex: 1, fontSize: 12, fontFamily: 'Inter_500Medium', lineHeight: 17 },

  meCard: { margin: 16, marginBottom: 4, borderRadius: 16, borderWidth: 1, padding: 16, gap: 8 },
  meLabel: { fontSize: 10.5, fontFamily: 'Inter_700Bold', letterSpacing: 0.8, textTransform: 'uppercase' },
  meRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meRankRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  meRank: { fontSize: 22, fontFamily: 'Inter_800ExtraBold' },
  mePct: { fontSize: 18, fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'] },

  sectionLabel: { fontSize: 10.5, fontFamily: 'Inter_700Bold', letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6 },

  lastResultsCard: { marginHorizontal: 16, marginTop: 14, borderRadius: 16, borderWidth: 1, padding: 14, gap: 8 },
  lastResultsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lastResultsTitle: { fontSize: 13, fontFamily: 'Inter_700Bold' },
  lastResultsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lastResultsMedal: { fontSize: 15, width: 20, textAlign: 'center' },
  lastResultsName: { flex: 1, fontSize: 12.5, fontFamily: 'Inter_600SemiBold' },
  lastResultsPct: { fontSize: 12.5, fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'] },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 60 },
  emptyTxt: { fontSize: 13, fontFamily: 'Inter_500Medium' },

  leaveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: 20, marginTop: 4, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
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
  rankWrap: { width: 22, alignItems: 'center' },
  medal: { fontSize: 18 },
  rankTxt: { fontSize: 13, fontFamily: 'Inter_600SemiBold', fontVariant: ['tabular-nums'] },
  name: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium' },
  nameBold: { fontFamily: 'Inter_700Bold' },
  pctPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  pct: { fontSize: 13, fontFamily: 'Inter_700Bold', fontVariant: ['tabular-nums'] },
});
