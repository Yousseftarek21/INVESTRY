import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { backChevron } from '@/utils/rtl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useFeedback, type FeedbackMessage } from '@/hooks/useFeedback';

// Two-color system, not one flat accent: rose is this screen's own identity
// (distinct from the AI Assistant's violet and the app's gold) — used for
// "this is you" (your bubbles, the send button, the header). Likes use the
// app's real gold instead of rose, deliberately: gold already means
// "appreciated/valued" everywhere else in the app (Fix My Portfolio,
// price alerts), so a liked message rewards with that same color instead of
// competing with the identity color for attention.
const FEEDBACK_ACCENT = '#EC4899';
const FEEDBACK_ACCENT_DEEP = '#9D174D';

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

function Bubble({ m, onLike }: { m: FeedbackMessage; onLike: (id: string) => void }) {
  const colors = useColors();
  return (
    <View style={[s.row, m.isMe && s.rowMe]}>
      {!m.isMe && (
        m.senderImageUrl ? (
          <Image source={{ uri: m.senderImageUrl }} style={[s.avatar, { borderColor: FEEDBACK_ACCENT + '50' }]} />
        ) : (
          <View style={[s.avatar, s.avatarFallback, { backgroundColor: FEEDBACK_ACCENT + '1E', borderColor: FEEDBACK_ACCENT + '50' }]}>
            <Text style={[s.avatarInitials, { color: FEEDBACK_ACCENT }]}>{initials(m.senderName)}</Text>
          </View>
        )
      )}
      <View style={[s.bubbleCol, m.isMe && s.bubbleColMe]}>
        {!m.isMe && (
          <Text style={[s.senderName, { color: colors.mutedForeground }]}>{firstName(m.senderName)}</Text>
        )}
        {m.isMe ? (
          <ExpoLinearGradient
            colors={[FEEDBACK_ACCENT, FEEDBACK_ACCENT_DEEP]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[s.bubble, s.bubbleMe, { shadowColor: FEEDBACK_ACCENT_DEEP, shadowOpacity: 0.35 }]}
          >
            <Text style={[s.bubbleText, { color: '#FFFFFF' }]}>{m.message}</Text>
          </ExpoLinearGradient>
        ) : (
          <View style={[s.bubble, s.bubbleOther, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.bubbleText, { color: colors.text }]}>{m.message}</Text>
          </View>
        )}
        <TouchableOpacity style={[s.likeRow, m.isMe && s.likeRowMe, m.hasLiked && { backgroundColor: colors.primary + '16' }]} onPress={() => onLike(m.id)} hitSlop={6}>
          <Feather name="heart" size={12} color={m.hasLiked ? colors.primary : colors.mutedForeground} />
          {m.likeCount > 0 && (
            <Text style={[s.likeCount, { color: m.hasLiked ? colors.primary : colors.mutedForeground }]}>{m.likeCount}</Text>
          )}
          <Text style={[s.timeText, { color: colors.mutedForeground }]}>· {relativeTime(m.createdAt)}</Text>
        </TouchableOpacity>
      </View>
    </View>
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
  const scrollRef = useRef<ScrollView>(null);

  const send = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    impact(Haptics.ImpactFeedbackStyle.Light);
    setSending(true);
    setSendError(null);
    const ok = await sendMessage(trimmed);
    setSending(false);
    if (ok) {
      setInput('');
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } else {
      setSendError(t.feedbackSendError);
    }
  }, [input, sending, sendMessage, impact, t]);

  const handleLike = useCallback((id: string) => {
    impact(Haptics.ImpactFeedbackStyle.Light);
    toggleLike(id);
  }, [toggleLike, impact]);

  const topPad = Platform.OS === 'web' ? 16 : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

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

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
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
              messages.map(m => <Bubble key={m.id} m={m} onLike={handleLike} />)
            )}

            {sendError && <Text style={[s.errorText, { color: colors.red }]}>{sendError}</Text>}
          </ScrollView>

          <View style={[s.inputBar, { paddingBottom: botPad + 10, borderTopColor: colors.border, backgroundColor: colors.background }]}>
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
        </KeyboardAvoidingView>
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
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', borderRadius: 22, borderWidth: 1.5, paddingLeft: 16, paddingRight: 6, paddingVertical: 6, gap: 8 },
  input: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', maxHeight: 100, paddingVertical: 6 },
  sendBtn: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    shadowColor: FEEDBACK_ACCENT_DEEP, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 2,
  },
});
