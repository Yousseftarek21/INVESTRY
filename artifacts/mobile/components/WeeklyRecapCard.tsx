import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Platform, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';

const GLOW_SIZE = 220;

// Same radial "spotlight" construction as GoalCelebration/TierCelebration's
// Glow — kept as its own small copy rather than a shared import, same
// reasoning GoalCelebration's own comment gives: related visual language,
// not the same event, shouldn't be coupled through one shared component.
function Glow({ color, reveal }: { color: string; reveal: Animated.Value }) {
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', width: GLOW_SIZE, height: GLOW_SIZE,
        opacity: reveal,
        transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
      }}
    >
      <Svg width={GLOW_SIZE} height={GLOW_SIZE} viewBox={`0 0 ${GLOW_SIZE} ${GLOW_SIZE}`}>
        <Defs>
          <RadialGradient id="weeklyRecapGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <Stop offset="55%" stopColor={color} stopOpacity={0.1} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={GLOW_SIZE / 2} cy={GLOW_SIZE / 2} r={GLOW_SIZE / 2} fill="url(#weeklyRecapGlow)" />
      </Svg>
    </Animated.View>
  );
}

export interface RecapAllocationItem {
  label: string;
  value: number;
  color: string;
}

/**
 * On-demand weekly summary — headline % + EGP change over the last 7 days
 * (from the same server snapshot history the 1W chart already uses) plus
 * today's live allocation mix. Deliberately does NOT claim "X led the
 * gains" for the week: portfolio_snapshots only ever stored a single
 * totalValue per day, never a per-asset-class breakdown, so there is no
 * honest way to compute that without fabricating a number — see this
 * app's own established policy (RE_PRICES fallback, EGX empty-on-failure)
 * of never showing a confident, precise, wrong figure in place of one that
 * genuinely isn't available yet.
 */
export function WeeklyRecapCard({
  visible,
  onDismiss,
  pctChange,
  egpChange,
  currentValue,
  currencyLabel,
  allocation,
  hideValues,
}: {
  visible: boolean;
  onDismiss: () => void;
  /** null = not enough snapshot history yet (new account, < 7 days tracked) */
  pctChange: number | null;
  egpChange: number;
  currentValue: number;
  currencyLabel: string;
  allocation: RecapAllocationItem[];
  hideValues?: boolean;
}) {
  const colors = useColors();
  const t = useT();
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const glowReveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.9);
    opacity.setValue(0);
    glowReveal.setValue(0);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(glowReveal, { toValue: 1, duration: 380, delay: 80, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  if (!visible) return null;

  const isPos = (pctChange ?? 0) >= 0;
  const accent = pctChange == null ? colors.mutedForeground : isPos ? colors.green : colors.red;
  const total = allocation.reduce((s, a) => s + a.value, 0) || 1;
  const topAllocation = [...allocation].filter(a => a.value > 0).sort((a, b) => b.value - a.value);

  const shareText = pctChange == null
    ? t.weeklyRecapShareNoHistory
    : t.weeklyRecapShareText(isPos, Math.abs(pctChange).toFixed(1), currentValue.toLocaleString('en-EG', { maximumFractionDigits: 0 }), currencyLabel);

  const handleShare = async () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try { await Share.share({ message: shareText }); } catch { /* user cancelled or share unavailable — silent */ }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={s.overlay}>
        <Animated.View style={[s.sheet, { backgroundColor: colors.card, borderColor: colors.border, opacity, transform: [{ scale }] }]}>
          <TouchableOpacity onPress={onDismiss} hitSlop={10} style={s.closeBtn}>
            <Feather name="x" size={18} color={colors.mutedForeground} />
          </TouchableOpacity>

          <Text style={[s.eyebrow, { color: colors.mutedForeground }]}>{t.weeklyRecapEyebrow}</Text>

          <View style={s.stage}>
            <Glow color={accent} reveal={glowReveal} />
            <View style={[s.badge, { backgroundColor: accent + '18', borderColor: accent + '35' }]}>
              <Feather name={pctChange == null ? 'clock' : isPos ? 'trending-up' : 'trending-down'} size={30} color={accent} />
            </View>
          </View>

          {pctChange == null ? (
            <>
              <Text style={[s.headline, { color: colors.text }]}>{t.weeklyRecapNoHistoryTitle}</Text>
              <Text style={[s.body, { color: colors.textSecondary }]}>{t.weeklyRecapNoHistoryBody}</Text>
            </>
          ) : (
            <>
              <Text style={[s.headline, { color: accent }]}>
                {isPos ? '+' : ''}{pctChange.toFixed(1)}%
              </Text>
              <Text style={[s.body, { color: colors.textSecondary }]}>
                {t.weeklyRecapBody(isPos, hideValues ? '••••' : Math.abs(egpChange).toLocaleString('en-EG', { maximumFractionDigits: 0 }), currencyLabel)}
              </Text>
            </>
          )}

          {topAllocation.length > 0 && (
            <View style={[s.allocRow, { borderTopColor: colors.border }]}>
              {topAllocation.slice(0, 4).map(a => (
                <View key={a.label} style={s.allocItem}>
                  <View style={[s.allocDot, { backgroundColor: a.color }]} />
                  <Text style={[s.allocLabel, { color: colors.mutedForeground }]} numberOfLines={1}>{a.label}</Text>
                  <Text style={[s.allocPct, { color: colors.text }]}>{Math.round((a.value / total) * 100)}%</Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity onPress={handleShare} activeOpacity={0.85} style={[s.shareBtn, { backgroundColor: colors.primary }]}>
            <Feather name="share" size={15} color={colors.primaryForeground} />
            <Text style={[s.shareTxt, { color: colors.primaryForeground }]}>{t.weeklyRecapShare}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 28 },
  sheet: { width: '100%', maxWidth: 360, alignItems: 'center', gap: 10, borderRadius: 24, borderWidth: 1, padding: 26 },
  closeBtn: { position: 'absolute', top: 16, right: 16, zIndex: 1, padding: 4 },
  eyebrow: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.6, textTransform: 'uppercase' },
  stage: { width: GLOW_SIZE, height: 120, alignItems: 'center', justifyContent: 'center' },
  badge: { width: 72, height: 72, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headline: { fontSize: 32, fontFamily: 'Inter_700Bold', letterSpacing: -0.5, textAlign: 'center' },
  body: { fontSize: 13.5, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20, paddingHorizontal: 4 },
  allocRow: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth, width: '100%', paddingTop: 14, marginTop: 4,
  },
  allocItem: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '48%' },
  allocDot: { width: 7, height: 7, borderRadius: 3.5, flexShrink: 0 },
  allocLabel: { fontSize: 11, fontFamily: 'Inter_500Medium', flexShrink: 1 },
  allocPct: { fontSize: 11, fontFamily: 'Inter_700Bold', flexShrink: 0 },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    alignSelf: 'stretch', paddingVertical: 14, borderRadius: 15, marginTop: 10,
  },
  shareTxt: { fontSize: 15, fontFamily: 'Inter_700Bold' },
});
