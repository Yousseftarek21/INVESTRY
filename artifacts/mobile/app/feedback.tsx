import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Image, NativeScrollEvent, NativeSyntheticEvent,
  Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
// Every "behavior"-driven keyboard-avoidance approach tried here tonight —
// react-native's own KeyboardAvoidingView, this library's KeyboardAvoidingView
// (padding and translate-with-padding), KeyboardStickyView — relies on some
// component's own automatic keyboard-height measurement, and that
// measurement is exactly what's unreliable under this app's setup
// (KeyboardProvider + New Architecture). This instead reads the real
// keyboard height directly and applies it as literal, fully-visible
// padding: no "behavior" prop, no internal transform math to go wrong.
// useReanimatedKeyboardAnimation specifically (not the plain useKeyboardState
// hook) because its shared value is driven straight from the native
// keyboard event on the UI thread, tracking the keyboard's own animation
// in real time — a plain React-state version of this same fix showed a
// visible delay/pop versus the keyboard, since a state update only lands a
// frame or two behind the native animation.
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
// Reanimated's own Animated.View, aliased — react-native's own Animated
// (below) already drives Bubble's entrance/like animations under that name.
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';
import { router, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { backChevron } from '@/utils/rtl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useFeedback, markFeedbackSeen, type FeedbackMessage } from '@/hooks/useFeedback';

// Two-color system, not one flat accent: rose is this screen's own identity
// (distinct from the AI Assistant's violet and the app's gold) — used for
// "this is you" (your bubbles, the send button, the header). Likes use the
// app's real gold instead of rose, deliberately: gold already means
// "appreciated/valued" everywhere else in the app (Fix My Portfolio,
// price alerts), so a liked message rewards with that same color instead of
// competing with the identity color for attention.
const FEEDBACK_ACCENT = '#EC4899';
const FEEDBACK_ACCENT_DEEP = '#9D174D';

// A pure client-side convention, not a schema field — a leading emoji marker
// on the message text itself. Chosen over a real category column so this
// stays a genuine "type and send" chat (no form fields, per the original
// direction) while still letting bug reports and feature ideas visually
// stand apart from general chatter, which is the whole point of a board
// meant for exactly those two things. Older messages with no marker (or
// anything sent from outside these three chips) just render as plain
// "General" — nothing breaks, nothing requires a migration.
const CATEGORY_MARKERS: Record<string, { color: string; icon: keyof typeof Feather.glyphMap }> = {
  '🐛': { color: '#F87171', icon: 'alert-triangle' },
  '💡': { color: '#38BDF8', icon: 'zap' },
};

// Labels resolved separately (not baked into CATEGORY_MARKERS) so they can
// go through the app's own translation table — the marker/color/icon are
// language-independent, but "Bug"/"Idea" as shown on-screen shouldn't be
// the one English-only string on a screen everything else here translates.
function categoryLabel(marker: string, t: ReturnType<typeof useT>): string {
  return marker === '🐛' ? t.feedbackCatBug : t.feedbackCatIdea;
}

function parseCategory(message: string, t: ReturnType<typeof useT>): { color: string; label: string; icon: keyof typeof Feather.glyphMap; body: string } | null {
  const trimmed = message.trim();
  for (const marker of Object.keys(CATEGORY_MARKERS)) {
    if (trimmed.startsWith(marker)) {
      return { ...CATEGORY_MARKERS[marker], label: categoryLabel(marker, t), body: trimmed.slice(marker.length).trim() };
    }
  }
  return null;
}

// Every "other" sender gets a real, stable color instead of one flat neutral
// gray for everyone who isn't you — a chat where every other participant
// looks identical doesn't read as a room full of people. Deliberately clear
// of rose (this screen's own "you" identity) and gold (reserved for likes)
// so neither meaning gets diluted by coincidentally matching a sender's
// color.
const SENDER_PALETTE = ['#38BDF8', '#A78BFA', '#34D399', '#FB923C', '#22D3EE', '#FBBF24'];
function senderColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  return SENDER_PALETTE[hash % SENDER_PALETTE.length];
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

// No existing relative-time util in the codebase to reuse — this is
// deliberately minimal (a chat timestamp, not a full i18n date library):
// seconds/minutes/hours "ago" for anything recent, a plain date past a week.
function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Bubble({ m, onLike, isNew }: { m: FeedbackMessage; onLike: (id: string) => void; isNew: boolean }) {
  const colors = useColors();
  const t = useT();
  const category = parseCategory(m.message, t);
  const displayText = category ? category.body : m.message;
  const accent = m.isMe ? FEEDBACK_ACCENT : senderColor(m.userId);

  // Plays once, only for a message that just arrived (a poll tick or your
  // own send) — not replayed on every re-render of the same bubble (a like
  // count changing shouldn't re-trigger the entrance), and not played at
  // all for the batch that was already there when the screen opened, which
  // would just read as the whole history cascading in rather than "this
  // one is new."
  const wasNew = useRef(isNew).current;
  const enter = useRef(new Animated.Value(wasNew ? 0 : 1)).current;
  useEffect(() => {
    if (!wasNew) return;
    Animated.spring(enter, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true }).start();
  }, [wasNew, enter]);

  // A little more than a flat color swap on like — a quick scale-bounce on
  // the heart itself makes tapping it feel like it actually did something,
  // instead of just toggling a css-like state.
  const heartScale = useRef(new Animated.Value(1)).current;
  const handleLike = () => {
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.35, friction: 3, tension: 200, useNativeDriver: true }),
      Animated.spring(heartScale, { toValue: 1, friction: 4, tension: 150, useNativeDriver: true }),
    ]).start();
    onLike(m.id);
  };

  return (
    <Animated.View
      style={[
        s.row, m.isMe && s.rowMe,
        {
          opacity: enter,
          transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        },
      ]}
    >
      {!m.isMe && (
        m.senderImageUrl ? (
          <Image source={{ uri: m.senderImageUrl }} style={[s.avatar, { borderColor: accent + '70' }]} />
        ) : (
          <View style={[s.avatar, s.avatarFallback, { backgroundColor: accent + '22', borderColor: accent + '70' }]}>
            <Text style={[s.avatarInitials, { color: accent }]}>{initials(m.senderName)}</Text>
          </View>
        )
      )}
      <View style={[s.bubbleCol, m.isMe && s.bubbleColMe]}>
        {!m.isMe && (
          <Text style={[s.senderName, { color: accent }]}>{firstName(m.senderName)}</Text>
        )}
        {category && (
          <View style={[s.catTag, m.isMe && s.catTagMe, { backgroundColor: category.color + '1E', borderColor: category.color + '40' }]}>
            <Feather name={category.icon} size={9} color={category.color} />
            <Text style={[s.catTagTxt, { color: category.color }]}>{category.label}</Text>
          </View>
        )}
        {m.isMe ? (
          <ExpoLinearGradient
            colors={[FEEDBACK_ACCENT, FEEDBACK_ACCENT_DEEP]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[s.bubble, s.bubbleMe, { shadowColor: FEEDBACK_ACCENT_DEEP, shadowOpacity: 0.35 }]}
          >
            <Text style={[s.bubbleText, { color: '#FFFFFF' }]}>{displayText}</Text>
          </ExpoLinearGradient>
        ) : (
          <View style={[s.bubble, s.bubbleOther, { backgroundColor: colors.card, borderColor: accent + '2A' }]}>
            <Text style={[s.bubbleText, { color: colors.text }]}>{displayText}</Text>
          </View>
        )}
        <TouchableOpacity style={[s.likeRow, m.isMe && s.likeRowMe, m.hasLiked && { backgroundColor: colors.primary + '16' }]} onPress={handleLike} hitSlop={6}>
          <Animated.View style={{ transform: [{ scale: heartScale }] }}>
            <Feather name="heart" size={12} color={m.hasLiked ? colors.primary : colors.mutedForeground} />
          </Animated.View>
          {m.likeCount > 0 && (
            <Text style={[s.likeCount, { color: m.hasLiked ? colors.primary : colors.mutedForeground }]}>{m.likeCount}</Text>
          )}
          <Text style={[s.timeText, { color: colors.mutedForeground }]}>· {relativeTime(m.createdAt)}</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

export default function FeedbackScreen() {
  const colors = useColors();
  const t = useT();
  const { impact } = useHaptic();
  const insets = useSafeAreaInsets();
  const { messages, isLoading, isError, isFetching, refetch, sendMessage, toggleLike } = useFeedback();

  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Which message ids have already been rendered once — anything not in
  // here the first time it's seen gets Bubble's entrance animation; after
  // that first render it's added and never animates again. Seeded from the
  // very first successful load so opening the chat doesn't cascade-animate
  // the entire history.
  const seenIdsRef = useRef<Set<string> | null>(null);
  if (!isLoading && !isError && seenIdsRef.current === null) {
    seenIdsRef.current = new Set(messages.map(m => m.id));
  }

  // Marks the feed as seen once it's actually loaded (not on mount — a
  // failed/still-loading fetch shouldn't clear the Settings badge for a
  // feed the user hasn't really seen yet). Re-marks on every fresh
  // successful load, including the periodic poll, so leaving the screen
  // open counts the same as re-opening it.
  useEffect(() => {
    if (!isLoading && !isError) markFeedbackSeen();
  }, [isLoading, isError, messages.length]);
  const scrollRef = useRef<ScrollView>(null);
  // onContentSizeChange used to force-scroll to the bottom unconditionally,
  // on every content-size change — not just a real new message, but also
  // the 15s poll's own re-render (useFeedback's refetchInterval), a relative
  // "2m ago" timestamp label reflowing, an avatar image settling its
  // dimensions, etc. If the user had scrolled up to read older messages,
  // that yanked them straight back to the bottom every time, which read as
  // the screen scrolling itself while idle — exactly this report. Tracked
  // here instead: only auto-scroll on a content-size change while the user
  // is already at/near the bottom (normal "watching it live" chat
  // behavior); once they've scrolled up, further poll ticks leave them
  // where they are, same as any real chat app.
  const isNearBottomRef = useRef(true);
  const NEAR_BOTTOM_PX = 120;
  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
    isNearBottomRef.current = distanceFromBottom < NEAR_BOTTOM_PX;
  };

  const send = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    impact(Haptics.ImpactFeedbackStyle.Light);
    setSending(true);
    setSendError(null);
    // The marker is only ever added to the text that actually gets sent —
    // the input the user is looking at and typing into never shows it (see
    // toggleCategory below for why), so it's stitched on right here instead
    // of living in `input` itself.
    const toSend = activeCategory ? `${activeCategory} ${trimmed}` : trimmed;
    const ok = await sendMessage(toSend);
    setSending(false);
    if (ok) {
      setInput('');
      setActiveCategory(null);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } else {
      setSendError(t.feedbackSendError);
    }
  }, [input, sending, sendMessage, impact, t, activeCategory]);

  const handleLike = useCallback((id: string) => {
    toggleLike(id);
  }, [toggleLike]);

  // A pure toggle on `activeCategory` only — deliberately does NOT touch
  // `input`. Stamping the marker emoji directly into the text field looked
  // cluttered and redundant with the chip's own highlighted state (the chip
  // already shows which category is selected), so the input stays exactly
  // what the user actually typed; the marker is stitched onto the message
  // only at send time.
  const toggleCategory = useCallback((marker: string) => {
    impact(Haptics.ImpactFeedbackStyle.Light);
    setActiveCategory(prev => (prev === marker ? null : marker));
  }, [impact]);

  const topPad = Platform.OS === 'web' ? 16 : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;
  // `height` is a Reanimated shared value driven straight from the native
  // keyboard event on the UI thread — the library's own docs use it
  // directly as `transform: translateY`, negative as the keyboard rises.
  // Negated here for a bottom-padding equivalent, so this column's height
  // shrinks in perfect real-time sync with the keyboard's own animation,
  // not a frame behind it like a React-state-driven padding would be.
  const { height: keyboardHeightSV } = useReanimatedKeyboardAnimation();
  const keyboardPaddingStyle = useAnimatedStyle(() => ({
    paddingBottom: -keyboardHeightSV.value,
  }));

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.screen, { backgroundColor: colors.background }]}>
        <ExpoLinearGradient
          colors={[FEEDBACK_ACCENT + '1C', FEEDBACK_ACCENT + '00']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={[s.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}
        >
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Feather name={backChevron()} size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <View style={[s.headerIcon, { backgroundColor: FEEDBACK_ACCENT + '22' }]}>
              <Feather name="message-circle" size={14} color={FEEDBACK_ACCENT} />
            </View>
            <View>
              <Text style={[s.headerTitle, { color: colors.text }]}>{t.feedbackChatTitle}</Text>
              <Text style={[s.headerSub, { color: colors.mutedForeground }]}>{t.feedbackChatSubtitle}</Text>
            </View>
          </View>
          <View style={{ width: 22 }} />
        </ExpoLinearGradient>

        <Reanimated.View style={[{ flex: 1 }, keyboardPaddingStyle]}>
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
            onScroll={handleScroll}
            scrollEventThrottle={100}
            onContentSizeChange={() => {
              if (isNearBottomRef.current) scrollRef.current?.scrollToEnd({ animated: false });
            }}
            refreshControl={
              <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={FEEDBACK_ACCENT} colors={[FEEDBACK_ACCENT]} />
            }
          >
            {isLoading ? (
              <View style={s.empty}>
                <ActivityIndicator size="small" color={FEEDBACK_ACCENT} />
                <Text style={[s.emptyHint, { color: colors.mutedForeground, marginTop: 10 }]}>{t.loadingLabel}</Text>
              </View>
            ) : isError ? (
              <View style={s.empty}>
                <View style={[s.emptyIcon, { backgroundColor: colors.red + '18' }]}>
                  <Feather name="wifi-off" size={26} color={colors.red} />
                </View>
                <Text style={[s.emptyTitle, { color: colors.text }]}>{t.feedbackLoadError}</Text>
                <TouchableOpacity onPress={() => refetch()} style={[s.retryBtn, { borderColor: colors.border }]}>
                  <Text style={[s.retryTxt, { color: colors.text }]}>{t.retryLabel}</Text>
                </TouchableOpacity>
              </View>
            ) : messages.length === 0 ? (
              <View style={s.empty}>
                <View style={[s.emptyIconRing, { backgroundColor: FEEDBACK_ACCENT + '0C' }]}>
                  <View style={[s.emptyIcon, { backgroundColor: FEEDBACK_ACCENT + '20' }]}>
                    <Feather name="message-circle" size={26} color={FEEDBACK_ACCENT} />
                  </View>
                </View>
                <Text style={[s.emptyTitle, { color: colors.text }]}>{t.feedbackEmptyTitle}</Text>
                <Text style={[s.emptyHint, { color: colors.mutedForeground }]}>{t.feedbackEmptyHint}</Text>
              </View>
            ) : (
              messages.map(m => {
                const isNew = !seenIdsRef.current!.has(m.id);
                seenIdsRef.current!.add(m.id);
                return <Bubble key={m.id} m={m} onLike={handleLike} isNew={isNew} />;
              })
            )}

            {sendError && <Text style={[s.errorText, { color: colors.red }]}>{sendError}</Text>}
          </ScrollView>

          <View style={[s.inputBar, { paddingBottom: botPad + 10, borderTopColor: colors.border, backgroundColor: colors.background }]}>
            <View style={s.chipsRow}>
              {Object.entries(CATEGORY_MARKERS).map(([marker, cat]) => {
                const active = activeCategory === marker;
                return (
                  <TouchableOpacity
                    key={marker}
                    onPress={() => toggleCategory(marker)}
                    style={[
                      s.catChip,
                      { backgroundColor: active ? cat.color + '22' : colors.card, borderColor: active ? cat.color + '60' : colors.border },
                    ]}
                  >
                    <Feather name={cat.icon} size={11} color={active ? cat.color : colors.mutedForeground} />
                    <Text style={[s.catChipTxt, { color: active ? cat.color : colors.mutedForeground }]}>{categoryLabel(marker, t)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={[s.inputRow, { backgroundColor: colors.card, borderColor: inputFocused ? FEEDBACK_ACCENT + '80' : colors.border }]}>
              <TextInput
                style={[s.input, { color: colors.text }]}
                placeholder={t.feedbackPlaceholder}
                placeholderTextColor={colors.mutedForeground}
                value={input}
                onChangeText={setInput}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                multiline
                maxLength={500}
                editable={!sending}
                onSubmitEditing={send}
              />
              <TouchableOpacity
                onPress={send}
                disabled={sending || !input.trim()}
                style={[s.sendBtn, { backgroundColor: FEEDBACK_ACCENT, opacity: sending || !input.trim() ? 0.4 : 1 }]}
              >
                {sending ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Feather name="arrow-up" size={18} color="#FFFFFF" />}
              </TouchableOpacity>
            </View>
          </View>
        </Reanimated.View>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerIcon: { width: 26, height: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 15.5, fontFamily: 'Inter_600SemiBold' },
  headerSub: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
  content: { padding: 16, gap: 14, flexGrow: 1 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 60 },
  emptyIconRing: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyIcon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  emptyHint: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19, paddingHorizontal: 24 },
  retryBtn: { marginTop: 4, borderRadius: 12, borderWidth: 1, paddingHorizontal: 18, paddingVertical: 9 },
  retryTxt: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },

  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rowMe: { justifyContent: 'flex-end' },
  avatar: { width: 26, height: 26, borderRadius: 13, borderWidth: 1 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  bubbleCol: { maxWidth: '78%', gap: 3 },
  bubbleColMe: { alignItems: 'flex-end' },
  senderName: { fontSize: 11, fontFamily: 'Inter_600SemiBold', marginLeft: 2 },
  catTag: {
    flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start',
    borderRadius: 7, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 1,
  },
  catTagMe: { alignSelf: 'flex-end' },
  catTagTxt: { fontSize: 9.5, fontFamily: 'Inter_700Bold', textTransform: 'uppercase', letterSpacing: 0.3 },
  bubble: {
    borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 2,
  },
  bubbleMe: { borderBottomRightRadius: 5 },
  bubbleOther: { borderWidth: 1, borderBottomLeftRadius: 5 },
  bubbleText: { fontSize: 14.5, fontFamily: 'Inter_400Regular', lineHeight: 21 },
  likeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, marginTop: 1,
  },
  likeRowMe: { alignSelf: 'flex-end' },
  likeCount: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  timeText: { fontSize: 10.5, fontFamily: 'Inter_400Regular', marginLeft: 2 },

  errorText: { fontSize: 12.5, fontFamily: 'Inter_500Medium', textAlign: 'center', paddingTop: 4 },

  inputBar: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 10 },
  chipsRow: { flexDirection: 'row', gap: 7, marginBottom: 8 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6,
  },
  catChipTxt: { fontSize: 11.5, fontFamily: 'Inter_600SemiBold' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', borderRadius: 22, borderWidth: 1.5, paddingLeft: 16, paddingRight: 6, paddingVertical: 6, gap: 8 },
  input: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', maxHeight: 100, paddingVertical: 6 },
  sendBtn: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    shadowColor: FEEDBACK_ACCENT_DEEP, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 2,
  },
});
