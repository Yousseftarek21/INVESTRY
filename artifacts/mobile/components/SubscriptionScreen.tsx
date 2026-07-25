import React, { useRef, useEffect } from 'react';
import {
  Animated, Linking, Modal, PanResponder, Platform, Pressable,
  ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import { useSubscription } from '@/context/SubscriptionContext';
import { useT } from '@/hooks/useTranslation';
import { useColors } from '@/hooks/useColors';
import { getApiBaseUrl } from '@/utils/api';

// ─── Feature row ──────────────────────────────────────────────────────────────

function FeatureRow({ icon, label }: { icon: string; label: string }) {
  const colors = useColors();
  const accent = colors.primary;
  return (
    <View style={frow.cell}>
      <View style={[frow.icon, { backgroundColor: accent + '18' }]}>
        <Feather name={icon as any} size={13} color={accent} />
      </View>
      <Text style={[frow.label, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const frow = StyleSheet.create({
  cell: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 9 },
  icon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  label: { flex: 1, fontSize: 12.5, fontFamily: 'Inter_400Regular', lineHeight: 16 },
});

// ─── Free vs Pro compare table ─────────────────────────────────────────────────

function CompareTable() {
  const colors = useColors();
  const t = useT();
  const accent = colors.primary;

  const ROWS: { label: string; free: string | false; pro: string | true }[] = [
    { label: t.subCompareHoldings, free: '3', pro: t.subCompareUnlimited },
    { label: t.subMarketIntelligence, free: false, pro: true },
    { label: t.subPortfolioAnalytics, free: false, pro: true },
  ];

  return (
    <View style={[cmp.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={cmp.headerRow}>
        <View style={cmp.labelCol} />
        <Text style={[cmp.headerTxt, cmp.col, { color: colors.mutedForeground }]}>{t.subCompareFree}</Text>
        <View style={[cmp.colPro, cmp.colProTop, { backgroundColor: accent + '0F' }]}>
          <Text style={[cmp.headerTxt, { color: accent }]}>{t.subComparePro}</Text>
        </View>
      </View>
      {ROWS.map((r, i) => {
        const isLast = i === ROWS.length - 1;
        return (
          <View
            key={r.label}
            style={[cmp.row, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}
          >
            <Text style={[cmp.rowLabel, cmp.labelCol, { color: colors.text }]} numberOfLines={1}>{r.label}</Text>
            <View style={cmp.col}>
              {typeof r.free === 'string'
                ? <Text style={[cmp.cellTxt, { color: colors.mutedForeground }]}>{r.free}</Text>
                : <Feather name="x" size={14} color={colors.mutedForeground} />}
            </View>
            <View style={[cmp.colPro, isLast && cmp.colProBottom, { backgroundColor: accent + '0F' }]}>
              {typeof r.pro === 'string'
                ? <Text style={[cmp.cellTxt, cmp.cellTxtPro, { color: accent }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{r.pro}</Text>
                : <Feather name="check" size={15} color={accent} />}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const cmp = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, marginBottom: 16, overflow: 'hidden' },
  headerRow: { flexDirection: 'row', alignItems: 'stretch', paddingStart: 16, paddingTop: 14 },
  headerTxt: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.6, textTransform: 'uppercase', textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'stretch', paddingStart: 16 },
  labelCol: { flex: 1, justifyContent: 'center' },
  rowLabel: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  col: { width: 56, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  colPro: { width: 92, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 4 },
  colProTop: { paddingBottom: 8 },
  colProBottom: { paddingBottom: 14 },
  cellTxt: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  cellTxtPro: { fontFamily: 'Inter_700Bold' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
//
// Purely informational — shows the user's current plan and what Pro
// includes. There is no purchase flow here at all: the app never processes
// payments. Upgrading, managing, and cancelling all happen on the website
// (investry.app) with the same account; this screen just reflects whatever
// the backend currently reports.

interface SubscriptionScreenProps {
  visible: boolean;
  onClose: () => void;
}

export function SubscriptionScreen({ visible, onClose }: SubscriptionScreenProps) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const accent = colors.primary;
  const { isPro } = useSubscription();
  const t = useT();

  const FEATURES = [
    { icon: 'layers',      label: t.subUnlimitedInvestments  },
    { icon: 'globe',       label: t.subLiveRates             },
    { icon: 'cpu',         label: t.subPersonalizedSignals   },
    { icon: 'bar-chart-2', label: t.subHealthScore           },
    { icon: 'activity',    label: t.subFullCharts            },
    { icon: 'pie-chart',   label: t.subAllocationBreakdown   },
    { icon: 'award',       label: t.subTopPerformers         },
    { icon: 'zap',         label: t.subSmartInsights         },
  ];

  const slideY = useRef(new Animated.Value(700)).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const dragStart = useRef(0);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const snapOpen = () => {
    Animated.spring(slideY, { toValue: 0, damping: 26, stiffness: 230, useNativeDriver: Platform.OS !== 'web' }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        slideY.stopAnimation((value) => { dragStart.current = value; });
      },
      onPanResponderMove: (_, gesture) => {
        slideY.setValue(Math.max(0, dragStart.current + gesture.dy));
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 120 || gesture.vy > 0.8) {
          Animated.timing(slideY, { toValue: 800, duration: 200, useNativeDriver: Platform.OS !== 'web' })
            .start(() => onCloseRef.current());
        } else {
          snapOpen();
        }
      },
      onPanResponderTerminate: snapOpen,
    })
  ).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideY, {
          toValue: 0, damping: 26, stiffness: 230,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(bgOpacity, { toValue: 1, duration: 220, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
    } else {
      slideY.setValue(700);
      bgOpacity.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      {/* Dimmed backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay, opacity: bgOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Bottom sheet */}
      <Animated.View
        style={[
          sw.sheet,
          { backgroundColor: colors.card, borderColor: colors.border },
          { transform: [{ translateY: slideY }], paddingBottom: insets.bottom + 20 },
        ]}
      >
        <View style={sw.dragZone} {...panResponder.panHandlers}>
          <View style={[sw.handle, { backgroundColor: colors.border }]} />
        </View>

        <Pressable onPress={onClose} style={sw.closeBtn} hitSlop={16}>
          <View style={[sw.closeCircle, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="x" size={15} color={colors.mutedForeground} />
          </View>
        </Pressable>

        <ScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={sw.scroll}
        >
          {/* ── Hero ────────────────────────────────────────── */}
          <View style={sw.hero}>
            <View style={sw.iconGlowWrap}>
              <Svg width={100} height={100} style={StyleSheet.absoluteFill}>
                <Defs>
                  <RadialGradient id="heroGlow" cx="50%" cy="50%" r="50%">
                    <Stop offset="0%" stopColor={accent} stopOpacity={0.4} />
                    <Stop offset="100%" stopColor={accent} stopOpacity={0} />
                  </RadialGradient>
                </Defs>
                <Circle cx={50} cy={50} r={50} fill="url(#heroGlow)" />
              </Svg>
              <View style={[sw.iconWrap, { backgroundColor: accent + '15', borderColor: accent + '35' }]}>
                <Feather name="star" size={30} color={accent} />
              </View>
            </View>
            <Text style={[sw.heroTitle, { color: colors.text }]}>Investry Pro</Text>
            <Text style={[sw.heroSub, { color: colors.mutedForeground }]}>{t.subHeroSub}</Text>

            {/* Current plan status — always reflects the backend, never a
                locally-set flag */}
            <View style={[sw.planTag, { backgroundColor: isPro ? accent + '18' : colors.muted, borderColor: isPro ? accent + '35' : colors.border }]}>
              <Feather name={isPro ? 'check-circle' : 'info'} size={13} color={isPro ? accent : colors.mutedForeground} />
              <Text style={[sw.planTagTxt, { color: isPro ? accent : colors.mutedForeground }]}>
                {isPro ? t.subCurrentPlanPro : t.subCurrentPlanFree}
              </Text>
            </View>
          </View>

          {/* ── Features ────────────────────────────────────── */}
          <View style={[sw.featureCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[sw.featureTitle, { color: colors.mutedForeground }]}>{t.subWhatsIncluded}</Text>
            <View style={sw.featureGrid}>
              {FEATURES.map(f => (
                <FeatureRow key={f.label} icon={f.icon} label={f.label} />
              ))}
            </View>
          </View>

          {/* ── Free vs Pro ─────────────────────────────────── */}
          <CompareTable />

          {/* ── Manage on the website ───────────────────────── */}
          {/* Deliberately plain text, not a button or link — this app never
              initiates a purchase or opens a checkout/billing page. Upgrading
              and managing a subscription both happen entirely on
              investry.app, signed in with the same account. */}
          {!isPro && (
            <Text style={[sw.manageNote, { color: colors.mutedForeground }]}>
              {t.subManageOnWebsite}
            </Text>
          )}

          {/* ── Footer ──────────────────────────────────────── */}
          <View style={sw.footer}>
            <Pressable onPress={() => Linking.openURL(`${getApiBaseUrl()}/api/legal/terms`)}>
              <Text style={[sw.footerTxt, { color: colors.mutedForeground }]}>{t.subTerms}</Text>
            </Pressable>
            <View style={[sw.dot, { backgroundColor: colors.border }]} />
            <Pressable onPress={() => Linking.openURL(`${getApiBaseUrl()}/api/legal/privacy`)}>
              <Text style={[sw.footerTxt, { color: colors.mutedForeground }]}>{t.subPrivacy}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sw = StyleSheet.create({
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    borderTopWidth: 1,
    maxHeight: '95%',
  },
  dragZone: {
    width: 160, alignSelf: 'center', alignItems: 'center',
    paddingTop: 12, paddingBottom: 10,
  },
  handle: {
    width: 42, height: 4,
    borderRadius: 2,
  },
  closeBtn: { position: 'absolute', top: 16, end: 18, zIndex: 10 },
  closeCircle: {
    width: 30, height: 30, borderRadius: 15,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  scroll: { paddingHorizontal: 20, paddingBottom: 12 },

  // Hero
  hero: { alignItems: 'center', paddingTop: 44, paddingBottom: 26, gap: 10 },
  iconGlowWrap: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center' },
  iconWrap: {
    width: 72, height: 72, borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontSize: 30, fontFamily: 'Inter_700Bold', letterSpacing: -1 },
  heroSub: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center' },
  planTag: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1,
    marginTop: 4,
  },
  planTagTxt: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },

  // Features
  featureCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18, marginBottom: 20,
  },
  featureTitle: {
    fontSize: 11, fontFamily: 'Inter_700Bold',
    letterSpacing: 1, marginBottom: 4,
  },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap' },

  manageNote: {
    fontSize: 13, fontFamily: 'Inter_400Regular', lineHeight: 20,
    textAlign: 'center', marginBottom: 20,
  },

  // Footer
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 },
  footerTxt: { fontSize: 12, fontFamily: 'Inter_400Regular' },
  dot: { width: 3, height: 3, borderRadius: 1.5 },
});
