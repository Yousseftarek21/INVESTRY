import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useAppSettings } from '@/context/AppSettingsContext';
import { Tier, TierId } from '@/utils/portfolioTier';
import { tierName } from '@/components/TierCelebration';

// Each tier's own color family, same as TierSeal's disc — Core a quiet,
// desaturated slate (recessive on purpose: it's the entry tier, it
// shouldn't outshine the two above it), Plus vivid indigo/violet, Wealth an
// obsidian "black card" background that lets its gold text carry the
// premium read instead of a bright gold panel.
// Exported so the Tiers explainer screen's mini previews use these exact
// values instead of a hand-copied approximation — one palette, not two
// that can drift apart.
export const TIER_GRADIENT: Record<TierId, [string, string, string]> = {
  core: ['#94A3B8', '#7E8B9B', '#3f4a58'],
  plus: ['#a78bfa', '#6d28d9', '#1e1147'],
  wealth: ['#3a3a3f', '#1a1a1d', '#000000'],
};

// Text color per tier: white reads cleanly on all three grounds now that
// Core is a mid-toned slate rather than a pale one, so every card shares
// one text treatment. Wealth is the one exception — gold on its obsidian
// ground is the actual point of that tier's design (a black card with gold
// engraving, not a gold card with white print).
export const TIER_TEXT: Record<TierId, string> = {
  core: '#ffffff',
  plus: '#ffffff',
  wealth: '#f0cf7a',
};

// Wealth's foil stripe: a thin metallic accent line, the same detail a
// real black card carries near its face — reads as premium the same way an
// Amex Centurion's foil edge does. Tier-specific, not a general treatment:
// Core and Plus already carry their identity in the background color, and
// a line does nothing there but clutter.
export const WEALTH_ACCENT_LINE: [string, string, string] = ['#8a6a1c', '#D4AF37', '#8a6a1c'];

/**
 * A membership card, not a badge — tapping the sealed avatar opens this.
 * The physical-card metaphor (issuer mark, contactless glyph, embossed-style
 * tier name, a member-since line) is what a badge fundamentally can't do: it
 * makes the tier feel like something *issued* to the user, the way a real
 * bank's tier cards do, rather than a status label the UI is asserting
 * about them.
 *
 * Only ever mounted with a real tier (see index.tsx, which gates both the
 * seal and this card on actually holding one) — there's no "not yet Core"
 * version of a card that represents something you don't have.
 */
export function TierCard({
  visible,
  onClose,
  tier,
  since,
}: {
  visible: boolean;
  onClose: () => void;
  tier: Tier;
  since: string | null;
}) {
  const colors = useColors();
  const t = useT();
  const router = useRouter();
  const { language } = useAppSettings();
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    scale.setValue(0.92);
    opacity.setValue(0);
    shine.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 8, tension: 70, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    Animated.timing(shine, {
      toValue: 1, duration: 1300, delay: 150,
      easing: Easing.out(Easing.quad), useNativeDriver: true,
    }).start();
  }, [visible, scale, opacity, shine]);

  if (!visible) return null;

  const onCard = TIER_TEXT[tier.id];
  const sinceDate = since
    ? new Date(since).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-EG', { month: 'short', year: 'numeric' })
    : null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <Animated.View style={{ opacity, transform: [{ scale }], width: '100%', maxWidth: 380 }}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <LinearGradient
              colors={TIER_GRADIENT[tier.id]}
              start={{ x: 0.05, y: 0 }}
              end={{ x: 0.95, y: 1 }}
              style={s.card}
            >
              {/* Scrim: keeps white text legible over each gradient's paler end. */}
              <LinearGradient
                colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.32)']}
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
              />

              {/* Sweep, same construction as TierCelebration's — the two
                  moments (unlocking Pro, opening its card) share one
                  animation signature. */}
              <Animated.View
                pointerEvents="none"
                style={[
                  s.sweep,
                  {
                    transform: [
                      { rotate: '18deg' },
                      { translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-260, 320] }) },
                    ],
                  },
                ]}
              />

              <View style={s.topRow}>
                <Text style={[s.issuer, { color: onCard }]}>INVESTRY</Text>
                {/* Rotated wifi glyph = the contactless symbol every physical
                    card actually carries — a small, specific detail that
                    sells the metaphor far more than a generic icon would. */}
                <Feather name="wifi" size={20} color={onCard} style={{ opacity: 0.85, transform: [{ rotate: '90deg' }] }} />
              </View>

              <View style={s.chipRow}>
                <View style={[s.chip, { borderColor: onCard + '55' }]}>
                  <View style={[s.chipLine, { backgroundColor: onCard + '55' }]} />
                  <View style={[s.chipLine, { backgroundColor: onCard + '55' }]} />
                </View>
              </View>

              {tier.id === 'wealth' && (
                <LinearGradient
                  colors={WEALTH_ACCENT_LINE}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.accentLine}
                />
              )}

              <Text style={[s.tierName, { color: onCard }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                {tierName(tier.id, t)}
              </Text>

              {!!sinceDate && (
                <Text style={[s.since, { color: onCard + 'CC' }]}>{t.tierMemberSince(sinceDate)}</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { onClose(); router.push('/tiers' as any); }}
            activeOpacity={0.7}
            style={s.seeAllLink}
          >
            <Text style={[s.seeAllTxt, { color: colors.mutedForeground }]}>{t.tiersSeeAllLink}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} activeOpacity={0.8} style={[s.closeBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.closeTxt, { color: colors.text }]}>{t.tierCelebrateDismiss}</Text>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', alignItems: 'center', padding: 28 },
  card: {
    borderRadius: 24, padding: 22, aspectRatio: 1.65,
    justifyContent: 'space-between', overflow: 'hidden',
  },
  sweep: { position: 'absolute', top: -80, bottom: -80, width: 90, backgroundColor: 'rgba(255,255,255,0.16)' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  issuer: { fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 2.5 },
  chipRow: { flexDirection: 'row' },
  chip: {
    width: 34, height: 25, borderRadius: 5, borderWidth: 1,
    padding: 4, justifyContent: 'space-evenly',
  },
  chipLine: { height: 1.5, borderRadius: 1 },
  accentLine: { height: 2, borderRadius: 1, opacity: 0.9, marginBottom: 8 },
  tierName: { fontSize: 34, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  since: { fontSize: 11.5, fontFamily: 'Inter_500Medium', marginTop: -6 },
  seeAllLink: { alignSelf: 'center', marginTop: 16, paddingVertical: 4 },
  seeAllTxt: { fontSize: 13, fontFamily: 'Inter_500Medium', textDecorationLine: 'underline' },
  closeBtn: {
    alignSelf: 'center', marginTop: 10, paddingHorizontal: 20, paddingVertical: 11,
    borderRadius: 14, borderWidth: 1,
  },
  closeTxt: { fontSize: 13.5, fontFamily: 'Inter_600SemiBold' },
});
