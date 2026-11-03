import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  Animated, Platform, Pressable,
  StyleSheet, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { ConceptIcon } from '@/components/ConceptIcon';
import { ICON_INVESTMENTS } from '@/constants/conceptIcons';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { forwardArrow } from '@/utils/rtl';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useAppSettings } from '@/context/AppSettingsContext';
import * as Updates from 'expo-updates';
import {
  LivePricesPreview, PortfolioPreview, PropertyPreview, RentalPreview, SmartPrivatePreview,
} from '@/components/onboarding/OnboardingPreviews';

const ONBOARDING_KEY = '@invstry_onboarding_done';

function Dot({ active, color }: { active: boolean; color: string }) {
  const anim = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: active ? 1 : 0, useNativeDriver: false }).start();
  }, [active]);
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: [7, 22] });
  return (
    <Animated.View style={[styles.dot, { width, backgroundColor: active ? color : color + '40' }]} />
  );
}

export default function WelcomeScreen() {
  const colors = useColors();
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showWelcome, setShowWelcome] = useState(false);
  const slideAnim = useRef(new Animated.Value(1)).current;
  const cardAnim = useRef(new Animated.Value(1)).current;
  const screenAnim = useRef(new Animated.Value(0)).current;

  // Five slides, each showing a miniature of the real screen: live gold,
  // dollar and EGX prices and real price per m² come straight from the
  // public market endpoints, so a new user sees today's actual numbers
  // before signing up. Privacy stays last as the trust close.
  const SLIDES = useMemo(() => [
    { id: '1', color: '#C9A227', eyebrow: t.onboardSlide1Eyebrow, title: t.onboardSlide1Title, subtitle: t.onboardSlide1Sub, Preview: PortfolioPreview },
    { id: '2', color: '#00D4AA', eyebrow: t.onboardSlide2Eyebrow, title: t.onboardSlide2Title, subtitle: t.onboardSlide2Sub, Preview: LivePricesPreview },
    { id: '3', color: '#A47FCA', eyebrow: t.onboardSlide3Eyebrow, title: t.onboardSlide3Title, subtitle: t.onboardSlide3Sub, Preview: PropertyPreview },
    { id: '4', color: '#F59E0B', eyebrow: t.onboardSlide4Eyebrow, title: t.onboardSlide4Title, subtitle: t.onboardSlide4Sub, Preview: RentalPreview },
    { id: '5', color: '#4A9EFF', eyebrow: t.onboardSlide5Eyebrow, title: t.onboardSlide5Title, subtitle: t.onboardSlide5Sub, Preview: SmartPrivatePreview },
  ], [t]);

  // English ⇄ Arabic before signing up. Reloads so the whole layout flips
  // to right-to-left; if a reload isn't possible the text still switches.
  const { language, setLanguage } = useAppSettings();
  const switchLanguage = async () => {
    await setLanguage(language === 'ar' ? 'en' : 'ar');
    try { await Updates.reloadAsync(); } catch { /* text already switched */ }
  };

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then(done => {
      if (done) setShowWelcome(true);
    });
    Animated.timing(screenAnim, {
      toValue: 1, duration: 600,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, []);

  const markDone = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
  };

  const goToSlide = (nextIndex: number) => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 150, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(cardAnim, { toValue: 0.94, duration: 150, useNativeDriver: Platform.OS !== 'web' }),
    ]).start(() => {
      setCurrentIndex(nextIndex);
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 1, duration: 260, useNativeDriver: Platform.OS !== 'web' }),
        Animated.spring(cardAnim, { toValue: 1, friction: 7, tension: 60, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
    });
  };

  const handleNext = async () => {
    if (currentIndex < SLIDES.length - 1) {
      goToSlide(currentIndex + 1);
    } else {
      await markDone();
      Animated.timing(screenAnim, {
        toValue: 0, duration: 300,
        useNativeDriver: Platform.OS !== 'web',
      }).start(() => {
        setShowWelcome(true);
        Animated.timing(screenAnim, {
          toValue: 1, duration: 400,
          useNativeDriver: Platform.OS !== 'web',
        }).start();
      });
    }
  };

  // Skip only fast-forwards past the feature-highlight slides — it always
  // lands on the final privacy/security slide rather than bypassing it, so
  // every new user sees that one regardless of whether they skip the rest.
  const handleSkip = () => {
    const lastIndex = SLIDES.length - 1;
    if (currentIndex < lastIndex) {
      goToSlide(lastIndex);
    } else {
      handleNext();
    }
  };

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  const slide = SLIDES[currentIndex];
  const SlidePreview = slide.Preview;

  if (showWelcome) {
    return (
      <Animated.View style={[styles.container, { backgroundColor: colors.background, opacity: screenAnim }]}>
        <ExpoLinearGradient
          colors={[colors.primary + '2E', colors.primary + '08', colors.background + '00']}
          locations={[0, 0.35, 0.75]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.62 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={[styles.welcomeInner, { paddingTop: topPad + 32, paddingBottom: botPad + 20 }]}>
          <View style={[styles.logoHero, { borderColor: colors.primary + '35' }]}>
            <ExpoLinearGradient
              colors={[colors.primary + '2A', colors.primary + '08']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={[styles.logoInner, { backgroundColor: colors.primary + '1E' }]}>
              <ConceptIcon icon={ICON_INVESTMENTS} size={34} color={colors.primary} />
            </View>
          </View>

          <View style={styles.welcomeText}>
            <Text style={[styles.welcomeApp, { color: colors.primary }]}>INVESTRY</Text>
            <Text style={[styles.welcomeTitle, { color: colors.text }]}>
              {t.welcomeTaglineLine1}
              <Text style={{ color: colors.primary }}>{t.welcomeTaglineLine2}</Text>
            </Text>
            <Text style={[styles.welcomeDesc, { color: colors.mutedForeground }]}>
              {t.welcomeDesc}
            </Text>
          </View>

          <View style={styles.welcomeActions}>
            <Pressable
              style={[styles.btnPrimary, { backgroundColor: colors.primary, shadowColor: colors.primary }]}
              onPress={() => router.push('/(auth)/sign-up' as any)}
            >
              <Text style={[styles.btnPrimaryText, { color: colors.primaryForeground }]}>{t.getStarted}</Text>
              <Feather name={forwardArrow()} size={18} color={colors.primaryForeground} />
            </Pressable>

            <Pressable
              style={[styles.btnSecondary, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={() => router.push('/(auth)/sign-in' as any)}
            >
              <Text style={[styles.btnSecondaryText, { color: colors.text }]}>{t.signInBtn}</Text>
            </Pressable>
          </View>

          <Text style={[styles.welcomeFooter, { color: colors.mutedForeground }]}>
            {t.welcomeFooter(String(new Date().getFullYear()))}
          </Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.container, { backgroundColor: colors.background, opacity: screenAnim }]}>
      <View style={[styles.topRow, { paddingTop: topPad + 12 }]}>
        <Pressable onPress={switchLanguage} style={[styles.skipBtn, { backgroundColor: colors.muted }]} accessibilityRole="button">
          <Text style={[styles.skipText, { color: colors.text }]}>{t.obLangSwitch}</Text>
        </Pressable>
        <View style={styles.stepRow}>
          {SLIDES.map((s, i) => (
            <View
              key={s.id}
              style={[
                styles.stepSeg,
                { backgroundColor: i <= currentIndex ? colors.primary : colors.muted },
              ]}
            />
          ))}
        </View>
        <Pressable onPress={handleSkip} style={[styles.skipBtn, { backgroundColor: colors.muted }]}>
          <Text style={[styles.skipText, { color: colors.mutedForeground }]}>{t.skip}</Text>
        </Pressable>
      </View>

      <Animated.View style={[styles.slide, { opacity: slideAnim }]}>
        <Animated.View style={[styles.previewWrap, { transform: [{ scale: cardAnim }] }]}>
          <ExpoLinearGradient
            colors={[slide.color + '14', slide.color + '00']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.previewGlow}
            pointerEvents="none"
          />
          <SlidePreview />
        </Animated.View>

        <Text style={[styles.slideEyebrow, language === 'ar' && styles.slideEyebrowAr, { color: slide.color }]}>{slide.eyebrow}</Text>
        <Text style={[styles.slideTitle, { color: colors.text }]}>{slide.title}</Text>
        <Text style={[styles.slideSubtitle, { color: colors.mutedForeground }]}>{slide.subtitle}</Text>
      </Animated.View>

      <View style={[styles.footer, { paddingBottom: botPad + 32 }]}>
        <View style={styles.dotsRow}>
          <View style={styles.dots}>
            {SLIDES.map((s, i) => (
              <Dot key={s.id} active={i === currentIndex} color={colors.primary} />
            ))}
          </View>

          {currentIndex < SLIDES.length - 1 && (
            <Pressable
              style={[styles.nextBtn, { backgroundColor: colors.primary }]}
              onPress={handleNext}
            >
              <Feather name={forwardArrow()} size={22} color={colors.primaryForeground} />
            </Pressable>
          )}
        </View>

        {currentIndex === SLIDES.length - 1 && (
          <Pressable
            style={[styles.getStartedBtn, { backgroundColor: colors.primary }]}
            onPress={handleNext}
          >
            <Text style={[styles.getStartedText, { color: colors.primaryForeground }]}>{t.getStarted}</Text>
            <Feather name={forwardArrow()} size={18} color={colors.primaryForeground} />
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  topRow: {
    paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 16,
  },
  stepRow: { flex: 1, flexDirection: 'row', gap: 5 },
  stepSeg: { flex: 1, height: 3, borderRadius: 2 },
  skipBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  skipText: { fontSize: 13, fontFamily: 'Inter_500Medium' },

  slide: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 24, gap: 12,
  },
  previewWrap: { width: '100%', maxWidth: 380, marginBottom: 12 },
  previewGlow: { position: 'absolute', top: -40, left: -8, right: -8, bottom: 0, borderRadius: 48 },
  slideEyebrow: { fontSize: 12, fontFamily: 'Inter_700Bold', letterSpacing: 2, textTransform: 'uppercase' },
  slideEyebrowAr: { letterSpacing: 0, fontSize: 13 },
  slideTitle: { fontSize: 25, fontFamily: 'Inter_700Bold', letterSpacing: -0.7, textAlign: 'center', marginTop: 2 },
  slideSubtitle: { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 24, textAlign: 'center' },

  footer: { paddingHorizontal: 32, gap: 20, alignItems: 'center' },
  dotsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { height: 7, borderRadius: 4 },
  nextBtn: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  getStartedBtn: {
    width: '100%', height: 56, borderRadius: 18,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  getStartedText: { fontSize: 16, fontFamily: 'Inter_700Bold' },

  welcomeInner: { flex: 1, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'space-between' },
  logoHero: {
    width: 132, height: 132, borderRadius: 36, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    marginTop: 12,
  },
  logoInner: {
    width: 76, height: 76, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  welcomeText: { alignItems: 'center', gap: 10, marginTop: 20 },
  welcomeApp: { fontSize: 13, fontFamily: 'Inter_700Bold', letterSpacing: 3 },
  welcomeTitle: { fontSize: 32, fontFamily: 'Inter_700Bold', letterSpacing: -0.8, textAlign: 'center', lineHeight: 40 },
  welcomeDesc: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 24 },
  welcomeActions: { width: '100%', gap: 12 },
  btnPrimary: {
    height: 56, borderRadius: 18, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 6,
  },
  btnPrimaryText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  btnSecondary: {
    height: 56, borderRadius: 18, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  btnSecondaryText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  welcomeFooter: { fontSize: 11, fontFamily: 'Inter_400Regular', letterSpacing: 0.3 },
});
