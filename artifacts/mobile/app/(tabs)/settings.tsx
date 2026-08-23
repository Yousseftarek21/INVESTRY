/**
 * Settings — Investry
 * Profile hub + a short category menu into focused sub-screens
 * (app/settings-account.tsx, settings-appearance.tsx, settings-notifications.tsx,
 * settings-portfolio.tsx, settings-privacy.tsx, settings-support.tsx) —
 * previously one very long page with all ten sections expanded at once.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { forwardChevron } from '@/utils/rtl';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { useAuth, useClerk, useUser } from '@clerk/expo';
import { Stack, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { DetailModal } from '@/components/DetailModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useHoldings } from '@/context/HoldingsContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { isIOSIAPAvailable } from '@/utils/revenuecat';
import { ManageSubscriptionSheet } from '@/components/ManageSubscriptionSheet';
import { apiFetch } from '@/utils/api';
import { Sect, NavRow } from '@/components/SettingsPrimitives';

// Read live from the running binary/update instead of a hand-maintained
// constant, so this can never silently drift out of sync with reality.
const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
const COPYRIGHT_YEAR = new Date().getFullYear();

// ─── Profile hero card ────────────────────────────────────────────────────────

function ProfileHero({
  initials, fullName, email, verified, holdingsCount, onPress, imageUrl,
}: {
  initials: string; fullName: string; email: string;
  verified: boolean; holdingsCount: number; onPress: () => void;
  imageUrl?: string;
}) {
  const colors = useColors();
  const t = useT();
  return (
    <TouchableOpacity
      onPress={onPress} activeOpacity={0.75}
      style={[ph.card, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      {/* Accent line at top of card (matches Pro badge color) */}
      <ExpoLinearGradient
        colors={[colors.primary + '00', colors.primary + 'CC', colors.primary + '00']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={ph.accentBar}
      />

      <View style={ph.inner}>
        {/* Avatar */}
        <View style={ph.avatarArea}>
          <View style={[ph.avatarRing, { borderColor: colors.primary }]}>
            {imageUrl ? (
              <Image source={{ uri: imageUrl }} style={ph.avatarPhoto} />
            ) : (
              <View style={[ph.avatarCircle, { backgroundColor: colors.primary + '1A' }]}>
                <Text style={[ph.avatarText, { color: colors.primary }]}>{initials}</Text>
              </View>
            )}
          </View>
          {verified && (
            <View style={[ph.verifyDot, { backgroundColor: colors.green, borderColor: colors.card }]}>
              <Feather name="check" size={7} color="#fff" />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={ph.info}>
          <View style={ph.nameRow}>
            <Text style={[ph.name, { color: colors.text }]} numberOfLines={1}>{fullName}</Text>
          </View>
          <Text style={[ph.email, { color: colors.mutedForeground }]} numberOfLines={1}>{email}</Text>

          <View style={ph.tagsRow}>
            {verified ? (
              <View style={[ph.tag, { backgroundColor: colors.green + '18', borderColor: colors.green + '38' }]}>
                <Feather name="shield" size={9} color={colors.green} />
                <Text style={[ph.tagTxt, { color: colors.green }]}>{t.verifiedLabel}</Text>
              </View>
            ) : (
              <View style={[ph.tag, { backgroundColor: colors.red + '14', borderColor: colors.red + '30' }]}>
                <Feather name="alert-circle" size={9} color={colors.red} />
                <Text style={[ph.tagTxt, { color: colors.red }]}>{t.unverifiedLabel}</Text>
              </View>
            )}
            <View style={[ph.tag, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '38' }]}>
              <Feather name="briefcase" size={9} color={colors.primary} />
              <Text style={[ph.tagTxt, { color: colors.primary }]}>{holdingsCount} {t.investmentsLabel}</Text>
            </View>
          </View>
        </View>

        <Feather name={forwardChevron()} size={17} color={colors.mutedForeground} style={{ marginTop: 4 }} />
      </View>
    </TouchableOpacity>
  );
}
const ph = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  accentBar: { height: 1.5, width: '100%' },
  inner: { flexDirection: 'row', alignItems: 'flex-start', padding: 18, gap: 15 },
  avatarArea: { flexShrink: 0, position: 'relative' },
  avatarRing: { width: 74, height: 74, borderRadius: 37, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  avatarPhoto: { width: 66, height: 66, borderRadius: 33 },
  avatarCircle: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 26, fontFamily: 'Inter_700Bold', letterSpacing: -1 },
  verifyDot: { position: 'absolute', bottom: 2, end: 2, width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 4, paddingTop: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  name: { fontSize: 18, fontFamily: 'Inter_700Bold', letterSpacing: -0.4 },
  email: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3 },
  tagTxt: { fontSize: 10, fontFamily: 'Inter_600SemiBold' },
});

// ─── Subscription status ───────────────────────────────────────────────────────
// Right under the profile card, always visible — Pro opens the billing
// portal (same route the website uses), Free opens the Paywall. Both reuse
// the create-checkout-session/create-portal-session routes already wired
// for Paywall.tsx and this card respectively.

function SubscriptionStatusCard() {
  const colors = useColors();
  const t = useT();
  const { impact: haptic } = useHaptic();
  const { getToken } = useAuth();
  const { isPro, showPaywall } = useSubscription();
  const [opening, setOpening] = useState(false);
  const [manageSheetVisible, setManageSheetVisible] = useState(false);

  const openManageSubscription = async () => {
    if (opening) return;
    haptic();
    // A subscription bought via native IAP is Apple's to manage, not
    // Stripe's — the billing portal has no record of it at all. Show the
    // in-app summary sheet first (plan, renewal date, auto-renew) rather
    // than sending the user straight to iOS Settings with no context —
    // the actual cancel action still has to happen there (Apple requires
    // it), but there's no reason to skip explaining what they're cancelling.
    if (isIOSIAPAvailable()) {
      setManageSheetVisible(true);
      return;
    }
    setOpening(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await apiFetch('/api/stripe/create-portal-session', token, { method: 'POST' });
      if (!res.ok) return;
      const { url } = (await res.json()) as { url?: string };
      if (url) await WebBrowser.openBrowserAsync(url);
    } finally {
      setOpening(false);
    }
  };

  const accent = isPro ? '#22C55E' : colors.primary;

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={isPro ? openManageSubscription : () => { haptic(); showPaywall(); }}
        style={[sub.card, { borderColor: accent + '3A' }]}
      >
        <ExpoLinearGradient
          colors={isPro ? [accent + '20', accent + '08'] : [colors.primary + '22', colors.primary + '08']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={sub.row}>
          <View style={[sub.iconWrap, { backgroundColor: accent + '22' }]}>
            <Feather name={isPro ? 'award' : 'credit-card'} size={18} color={accent} />
          </View>
          <View style={sub.info}>
            <Text style={[sub.title, { color: colors.text }]}>{isPro ? t.subCurrentPlanPro : t.subCurrentPlanFree}</Text>
          </View>
          {isPro ? (
            <Feather name={forwardChevron()} size={16} color={colors.mutedForeground} />
          ) : (
            <View style={[sub.cta, { backgroundColor: colors.primary, opacity: opening ? 0.6 : 1 }]}>
              <Text style={[sub.ctaTxt, { color: colors.primaryForeground }]}>{t.subUpgradeTo} {t.subComparePro}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
      <ManageSubscriptionSheet visible={manageSheetVisible} onClose={() => setManageSheetVisible(false)} />
    </>
  );
}
const sub = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16 },
  iconWrap: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 3, minWidth: 0 },
  title: { fontSize: 15, fontFamily: 'Inter_700Bold' },
  cta: { borderRadius: 11, paddingHorizontal: 14, paddingVertical: 9 },
  ctaTxt: { fontSize: 13, fontFamily: 'Inter_700Bold' },
});

// ─── Edit profile modal ────────────────────────────────────────────────────────

function EditProfileModal({
  visible, initials, email, initialDisplayName, imageUrl, saving, onSave, onPhotoSave, onClose,
}: {
  visible: boolean; initials: string; email: string; initialDisplayName: string;
  imageUrl?: string; saving: boolean;
  onSave: (name: string) => void;
  onPhotoSave: (uri: string) => Promise<void>;
  onClose: () => void;
}) {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState(initialDisplayName);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (visible) setValue(initialDisplayName);
  }, [visible, initialDisplayName]);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t.photoPermissionTitle, t.photoPermissionBody);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setUploadingPhoto(true);
    try {
      await onPhotoSave(result.assets[0].uri);
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={mo.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[epm.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 24 }]}
      >
        <View style={[mo.handle, { backgroundColor: colors.border }]} />
        <View style={[mo.header, { borderBottomColor: colors.border }]}>
          <Text style={[mo.title, { color: colors.text }]}>{t.editProfile}</Text>
          <TouchableOpacity onPress={onClose} style={[mo.close, { backgroundColor: colors.muted }]}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <View style={epm.body}>
          {/* Profile picture */}
          <View style={epm.avatarRow}>
            <TouchableOpacity onPress={pickPhoto} activeOpacity={0.75} style={epm.avatarTouchable}>
              <View style={[epm.avatarRing, { borderColor: colors.primary }]}>
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} style={epm.avatarPhoto} />
                ) : (
                  <View style={[epm.avatarCircle, { backgroundColor: colors.primary + '1A' }]}>
                    <Text style={[epm.avatarText, { color: colors.primary }]}>{initials}</Text>
                  </View>
                )}
              </View>
              <View style={[epm.cameraBadge, { backgroundColor: colors.primary }]}>
                {uploadingPhoto
                  ? <Feather name="loader" size={11} color="#000" />
                  : <Feather name="camera" size={11} color="#000" />}
              </View>
            </TouchableOpacity>
            <Text style={[epm.photoHint, { color: colors.mutedForeground }]}>{t.tapToChangePhoto}</Text>
          </View>

          {/* Display Name field */}
          <View style={epm.field}>
            <Text style={[epm.fieldLabel, { color: colors.mutedForeground }]}>{t.displayName}</Text>
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder={t.displayNamePlaceholder}
              placeholderTextColor={colors.mutedForeground}
              style={[epm.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
              maxLength={40}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={() => onSave(value)}
            />
            <Text style={[epm.hint, { color: colors.mutedForeground }]}>{t.displayNameHint}</Text>
          </View>

          {/* Email (read-only) */}
          <View style={epm.field}>
            <Text style={[epm.fieldLabel, { color: colors.mutedForeground }]}>{t.emailLabel}</Text>
            <View style={[epm.readonlyRow, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Text style={[epm.readonlyText, { color: colors.mutedForeground }]} numberOfLines={1}>{email}</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => onSave(value)}
            disabled={saving}
            style={[epm.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
          >
            <Text style={[epm.saveBtnTxt, { color: colors.primaryForeground }]}>
              {saving ? t.savingLabel : t.save}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const epm = StyleSheet.create({
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%' },
  body: { padding: 24, gap: 18 },
  avatarRow: { alignItems: 'center', marginBottom: 4, gap: 8 },
  avatarTouchable: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  avatarRing: { width: 82, height: 82, borderRadius: 41, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  avatarPhoto: { width: 74, height: 74, borderRadius: 37 },
  avatarCircle: { width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 28, fontFamily: 'Inter_700Bold', letterSpacing: -1 },
  cameraBadge: { position: 'absolute', bottom: 0, end: 0, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  photoHint: { fontSize: 11, fontFamily: 'Inter_400Regular' },
  field: { gap: 7 },
  fieldLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 1.2, marginLeft: 2 },
  input: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: 'Inter_400Regular' },
  hint: { fontSize: 11, fontFamily: 'Inter_400Regular', marginLeft: 2, lineHeight: 16 },
  readonlyRow: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 12 },
  readonlyText: { fontSize: 15, fontFamily: 'Inter_400Regular' },
  saveBtn: { borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 6 },
  saveBtnTxt: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
});
// Shared by EditProfileModal's own bottom-sheet chrome (backdrop/handle/header/close).
const mo = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginTop: 10, marginBottom: 4 },
  header: {
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  title: { fontSize: 18, fontFamily: 'Inter_700Bold', flex: 1 },
  close: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});

// ─── Smart footer ──────────────────────────────────────────────────────────────

function SmartFooter() {
  const colors = useColors();
  const t = useT();
  return (
    <View style={[sf.wrap, { borderTopColor: colors.border }]}>
      <Text style={[sf.brand, { color: colors.primary }]}>INVESTRY</Text>
      <Text style={[sf.metaVal, { color: colors.mutedForeground }]}>
        {t.versionLabel} {APP_VERSION}
      </Text>
      <Text style={[sf.copy, { color: colors.mutedForeground }]}>
        © {COPYRIGHT_YEAR} INVESTRY. {t.allRightsReserved}
      </Text>
    </View>
  );
}
const sf = StyleSheet.create({
  wrap: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 32, alignItems: 'center', gap: 12 },
  brand: { fontSize: 20, fontFamily: 'Inter_700Bold', letterSpacing: 4 },
  metaVal: { fontSize: 12, fontFamily: 'Inter_500Medium' },
  copy: { fontSize: 11, fontFamily: 'Inter_400Regular' },
});

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const t       = useT();
  const router  = useRouter();
  const { impact: haptic } = useHaptic();
  const { signOut } = useClerk();
  const { getToken } = useAuth();
  const { user } = useUser();
  const { holdings } = useHoldings();

  const [modal, setModal]         = useState<{ title: string; content: string } | null>(null);
  const [confirm, setConfirm]     = useState<{ id: string; title: string; message: string; label: string; danger: boolean } | null>(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const topPad = Platform.OS === 'web' ? Math.max(insets.top, 67) : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;
  const scrollRef = useRef<ScrollView>(null);

  // User data
  const firstName = user?.firstName ?? '';
  const lastName  = user?.lastName  ?? '';
  const fullName  = [firstName, lastName].filter(Boolean).join(' ') || 'Investor';
  const email     = user?.emailAddresses?.[0]?.emailAddress ?? '';
  const verified  = user?.hasVerifiedEmailAddress ?? false;
  const initials  = ([firstName[0], lastName[0]].filter(Boolean).join('').toUpperCase()) || email[0]?.toUpperCase() || 'I';
  const displayName = (user?.unsafeMetadata?.displayName as string | undefined) ?? '';
  const profileName = displayName.trim() || fullName;

  const showModal = (title: string, content: string) => { haptic(); setModal({ title, content }); };

  const handleSignOut = () => {
    haptic(Haptics.ImpactFeedbackStyle.Medium);
    setConfirm({ id: 'signout', title: t.signOutConfirmTitle, message: t.signOutConfirmMsg, label: t.signOutBtn, danger: true });
  };

  const handleSaveProfile = async (name: string) => {
    if (!user) return;
    haptic();
    setSavingProfile(true);
    try {
      await user.update({ unsafeMetadata: { ...(user.unsafeMetadata ?? {}), displayName: name.trim() } });
      setEditProfileOpen(false);
    } catch {
      showModal(t.couldNotSave, t.couldNotOpenLinkDesc);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePhoto = async (uri: string) => {
    if (!user) return;
    try {
      // React Native doesn't have the File constructor — pass a file-like object
      // with the local URI directly. Clerk's SDK accepts this for native uploads.
      const file = { uri, name: 'avatar.jpg', type: 'image/jpeg' } as unknown as File;
      await user.setProfileImage({ file });
    } catch {
      Alert.alert(t.photoUploadFailed, t.photoUploadFailedBody);
    }
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    if (confirm.id === 'signout') {
      // Clear this device's push token from the account before the session
      // that authenticates the call goes away — otherwise a signed-out
      // account keeps receiving its own real notifications on this device.
      try {
        const token = await getToken();
        if (token) await apiFetch('/api/push/unregister', token, { method: 'POST' });
      } catch { /* best-effort — never block sign-out on this */ }
      await signOut();
      router.replace('/(auth)/welcome' as any);
    }
    setConfirm(null);
  };

  const goTo = (path: string) => { haptic(); router.push(path as any); };

  // Matches Analytics/Markets exactly: contentInset (not contentOffset)
  // plus an imperative scrollTo on mount and onLayout, since the
  // declarative contentOffset prop alone can race against this screen's
  // initial layout. backgroundColor lives on the outer wrapping View, not
  // on the ScrollView's own style — same structural detail Markets uses.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: -topPad, animated: false });
  }, [topPad]);

  return (
    <View style={[sc.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        ref={scrollRef}
        style={sc.container}
        contentContainerStyle={[sc.content, { paddingTop: 16, paddingBottom: botPad + 120 }]}
        contentInset={{ top: topPad }}
        onLayout={() => scrollRef.current?.scrollTo({ y: -topPad, animated: false })}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Page header ─────────────────────────────────── */}
        <View style={sc.pageHeader}>
          <Text style={[sc.pageTitle, { color: colors.text }]}>{t.settings}</Text>
        </View>

        {/* ── SIGN-IN PROMPT (web, not signed in) ─────────── */}
        {!user && (
          <Pressable
            onPress={() => router.push('/(auth)/sign-in' as any)}
            style={({ pressed }) => [sc.signInCard, { backgroundColor: colors.card, borderColor: '#C9A22740', opacity: pressed ? 0.85 : 1 }]}
          >
            <View style={sc.signInIconWrap}>
              <Feather name="user" size={22} color="#C9A227" />
            </View>
            <View style={sc.signInText}>
              <Text style={[sc.signInTitle, { color: colors.text }]}>{t.signInToYourAccount}</Text>
              <Text style={[sc.signInSub, { color: colors.mutedForeground }]}>{t.loadSavedInvestments}</Text>
            </View>
            <Feather name={forwardChevron()} size={18} color="#C9A227" />
          </Pressable>
        )}

        {/* ── PROFILE HERO ─────────────────────────────────── */}
        {user && (
          <ProfileHero
            initials={initials} fullName={profileName} email={email}
            verified={verified} holdingsCount={holdings.length}
            imageUrl={user.imageUrl ?? undefined}
            onPress={() => { haptic(); setEditProfileOpen(true); }}
          />
        )}

        {/* ── SUBSCRIPTION — right under the profile card, always visible,
             not buried in a sub-screen ─────────────────────── */}
        {user && (
          <Sect label={t.settingsSectSubscription} noCard>
            <SubscriptionStatusCard />
          </Sect>
        )}

        {/* ── INVITE & EARN ─────────────────────────────────── */}
        {!!user && (
          <Sect label={t.settingsSectInvite}>
            <NavRow
              icon="gift" iconBg={colors.primary}
              label={t.inviteFriendsNav} sublabel={t.inviteFriendsNavSub}
              onPress={() => goTo('/invite-friends')}
            />
            <NavRow
              icon="trending-up" iconBg="#00D4AA"
              label={t.leaderboardNav} sublabel={t.leaderboardNavSub}
              onPress={() => goTo('/leaderboard')}
            />
            <NavRow
              icon="pie-chart" iconBg="#22C55E"
              label={t.dividendsTitle} sublabel={t.noDividendsHint}
              onPress={() => goTo('/dividends')}
              last
            />
          </Sect>
        )}

        {/* ── CATEGORY MENU ─────────────────────────────────── */}
        {/* Each category is its own separated card, no wrapping "Preferences"
            label — matches the approved menu exactly. Every label here is
            Title Case (the small-caps eyebrow strings like
            settingsSectAccount are for section headers, not row text). */}
        <View style={cat.wrap}>
          <View style={cat.stack}>
            {[
              { icon: 'user' as const, bg: '#1D4ED8', label: t.settingsCatAccount, sub: t.settingsCatAccountSub, path: '/settings-account' },
              { icon: 'sliders' as const, bg: '#8B5CF6', label: t.settingsCatAppearance, sub: t.settingsCatAppearanceSub, path: '/settings-appearance' },
              { icon: 'bell' as const, bg: '#F59E0B', label: t.settingsCatNotifications, sub: t.settingsCatNotificationsSub, path: '/settings-notifications' },
              { icon: 'briefcase' as const, bg: '#059669', label: t.settingsCatPortfolio, sub: t.settingsCatPortfolioSub, path: '/settings-portfolio' },
              { icon: 'shield' as const, bg: '#047857', label: t.settingsCatPrivacy, sub: t.settingsCatPrivacySub, path: '/settings-privacy' },
              { icon: 'help-circle' as const, bg: '#0EA5E9', label: t.settingsCatSupport, sub: t.settingsCatSupportSub, path: '/settings-support' },
            ].map(c => (
              <View key={c.path} style={[cat.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <NavRow icon={c.icon} iconBg={c.bg} label={c.label} sublabel={c.sub} onPress={() => goTo(c.path)} last />
              </View>
            ))}
          </View>
        </View>

        {/* ── SIGN OUT ─────────────────────────────────────── */}
        <TouchableOpacity
          style={[sc.signOut, { backgroundColor: colors.red + '12', borderColor: colors.red + '30' }]}
          onPress={handleSignOut} activeOpacity={0.7}
        >
          <Feather name="log-out" size={17} color={colors.red} />
          <Text style={[sc.signOutTxt, { color: colors.red }]}>{t.signOutBtn}</Text>
        </TouchableOpacity>

        {/* ── SMART FOOTER ─────────────────────────────────── */}
        <SmartFooter />
      </ScrollView>

      {modal && (
        <DetailModal visible title={modal.title} content={modal.content} onClose={() => setModal(null)} />
      )}
      {confirm && (
        <ConfirmModal
          visible
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.label}
          danger={confirm.danger}
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      <EditProfileModal
        visible={editProfileOpen}
        initials={initials}
        email={email}
        initialDisplayName={displayName}
        imageUrl={user?.imageUrl ?? undefined}
        saving={savingProfile}
        onSave={handleSaveProfile}
        onPhotoSave={handleSavePhoto}
        onClose={() => setEditProfileOpen(false)}
      />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const cat = StyleSheet.create({
  wrap: { gap: 9 },
  stack: { gap: 10 },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
});

const sc = StyleSheet.create({
  screen: { flex: 1 },
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 26 },

  pageHeader: { marginBottom: 2 },
  pageTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', letterSpacing: -0.3 },

  signOut: { borderRadius: 18, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 17, gap: 10 },
  signOutTxt: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },

  signInCard: { borderRadius: 18, borderWidth: 1, flexDirection: 'row', alignItems: 'center', padding: 18, gap: 14 },
  signInIconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#C9A22718', alignItems: 'center', justifyContent: 'center' },
  signInText: { flex: 1, gap: 3 },
  signInTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  signInSub: { fontSize: 12, fontFamily: 'Inter_400Regular' },
});
