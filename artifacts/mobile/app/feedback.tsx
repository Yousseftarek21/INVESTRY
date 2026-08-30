import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image, KeyboardAvoidingView, Platform, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { backChevron } from '@/utils/rtl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { apiFetch } from '@/utils/api';

// Shared app-wide accent for this screen, distinct from the AI Assistant's
// violet (AI_ACCENT in ai-assistant.tsx) and the app's own gold — this is a
// general product feature, not tied to either of those identities.
const FEEDBACK_ACCENT = '#EC4899';

interface FeedbackMessage {
  id: string;
  userId: string;
  message: string;
  likeCount: number;
  hasLiked: boolean;
  createdAt: string;
  senderName: string;
  senderImageUrl: string | null;
  isMe: boolean;
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

export default function FeedbackScreen() {
  const colors = useColors();
  const t = useT();
  const { impact } = useHaptic();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();

  const [messages, setMessages] = useState<FeedbackMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('no-token');
      const res = await apiFetch('/api/feedback', token);
      if (!res.ok) throw new Error(`status-${res.status}`);
      const data = (await res.json()) as FeedbackMessage[];
      setMessages(data);
    } catch {
      setError(t.feedbackLoadError);
    } finally {
      if (isRefresh) setRefreshing(false); else setLoading(false);
    }
  }, [getToken, t]);

  useEffect(() => { load(false); }, [load]);

  const send = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    impact(Haptics.ImpactFeedbackStyle.Light);
    setSending(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('no-token');
      const res = await apiFetch('/api/feedback', token, {
        method: 'POST',
        body: JSON.stringify({ message: trimmed }),
      });
      if (!res.ok) throw new Error(`status-${res.status}`);
      const created = (await res.json()) as FeedbackMessage;
      setInput('');
      setMessages(prev => [...prev, created]);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    } catch {
      setError(t.feedbackSendError);
    } finally {
      setSending(false);
    }
  }, [input, sending, getToken, impact, t]);

  const toggleLike = useCallback(async (id: string) => {
    impact(Haptics.ImpactFeedbackStyle.Light);
    // Optimistic — flip immediately, roll back only if the request fails.
    const prevState = messages;
    setMessages(prev => prev.map(m => m.id === id
      ? { ...m, hasLiked: !m.hasLiked, likeCount: m.likeCount + (m.hasLiked ? -1 : 1) }
      : m));
    try {
      const token = await getToken();
      if (!token) throw new Error('no-token');
      const res = await apiFetch(`/api/feedback/${id}/like`, token, { method: 'POST' });
      if (!res.ok) throw new Error(`status-${res.status}`);
      const { likeCount, hasLiked } = (await res.json()) as { likeCount: number; hasLiked: boolean };
      setMessages(prev => prev.map(m => m.id === id ? { ...m, likeCount, hasLiked } : m));
    } catch {
      setMessages(prevState);
    }
  }, [messages, getToken, impact]);

  const topPad = Platform.OS === 'web' ? 16 : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.screen, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Feather name={backChevron()} size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={[s.headerTitle, { color: colors.text }]}>{t.feedbackChatTitle}</Text>
            <Text style={[s.headerSub, { color: colors.mutedForeground }]}>{t.feedbackChatSubtitle}</Text>
          </View>
          <View style={{ width: 22 }} />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} colors={[colors.primary]} />
            }
          >
            {loading ? (
              <View style={s.empty}>
                <Text style={[s.emptyHint, { color: colors.mutedForeground }]}>{t.loadingLabel}</Text>
              </View>
            ) : messages.length === 0 ? (
              <View style={s.empty}>
                <View style={[s.emptyIcon, { backgroundColor: FEEDBACK_ACCENT + '18' }]}>
                  <Feather name="message-circle" size={28} color={FEEDBACK_ACCENT} />
                </View>
                <Text style={[s.emptyTitle, { color: colors.text }]}>{t.feedbackEmptyTitle}</Text>
                <Text style={[s.emptyHint, { color: colors.mutedForeground }]}>{t.feedbackEmptyHint}</Text>
              </View>
            ) : (
              messages.map(m => (
                <View key={m.id} style={[s.row, m.isMe && s.rowMe]}>
                  {!m.isMe && (
                    m.senderImageUrl ? (
                      <Image source={{ uri: m.senderImageUrl }} style={s.avatar} />
                    ) : (
                      <View style={[s.avatar, s.avatarFallback, { backgroundColor: colors.primary + '22' }]}>
                        <Text style={[s.avatarInitials, { color: colors.primary }]}>{initials(m.senderName)}</Text>
                      </View>
                    )
                  )}
                  <View style={[s.bubbleCol, m.isMe && s.bubbleColMe]}>
                    {!m.isMe && (
                      <Text style={[s.senderName, { color: colors.mutedForeground }]}>{firstName(m.senderName)}</Text>
                    )}
                    <View
                      style={[
                        s.bubble,
                        m.isMe
                          ? [s.bubbleMe, { backgroundColor: FEEDBACK_ACCENT }]
                          : [s.bubbleOther, { backgroundColor: colors.card, borderColor: colors.border }],
                      ]}
                    >
                      <Text style={[s.bubbleText, { color: m.isMe ? '#FFFFFF' : colors.text }]}>{m.message}</Text>
                    </View>
                    <TouchableOpacity
                      style={[s.likeRow, m.isMe && s.likeRowMe]}
                      onPress={() => toggleLike(m.id)}
                      hitSlop={6}
                    >
                      <Feather name="heart" size={12} color={m.hasLiked ? colors.primary : colors.mutedForeground} />
                      {m.likeCount > 0 && (
                        <Text style={[s.likeCount, { color: m.hasLiked ? colors.primary : colors.mutedForeground }]}>
                          {m.likeCount}
                        </Text>
                      )}
                      <Text style={[s.timeText, { color: colors.mutedForeground }]}>· {relativeTime(m.createdAt)}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}

            {error && <Text style={[s.errorText, { color: colors.red }]}>{error}</Text>}
          </ScrollView>

          <View style={[s.inputBar, { paddingBottom: botPad + 10, borderTopColor: colors.border }]}>
            <View style={[s.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[s.input, { color: colors.text }]}
                placeholder={t.feedbackPlaceholder}
                placeholderTextColor={colors.mutedForeground}
                value={input}
                onChangeText={setInput}
                multiline
                editable={!sending}
                onSubmitEditing={send}
              />
              <TouchableOpacity
                onPress={send}
                disabled={sending || !input.trim()}
                style={[s.sendBtn, { backgroundColor: FEEDBACK_ACCENT, opacity: sending || !input.trim() ? 0.4 : 1 }]}
              >
                <Feather name="arrow-up" size={18} color="#FFFFFF" />
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
  headerTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  headerSub: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 1 },
  content: { padding: 16, gap: 14, flexGrow: 1 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 60 },
  emptyIcon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  emptyHint: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19, paddingHorizontal: 24 },

  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  rowMe: { justifyContent: 'flex-end' },
  avatar: { width: 26, height: 26, borderRadius: 13 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  bubbleCol: { maxWidth: '78%', gap: 3 },
  bubbleColMe: { alignItems: 'flex-end' },
  senderName: { fontSize: 11, fontFamily: 'Inter_600SemiBold', marginLeft: 2 },
  bubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMe: { borderBottomRightRadius: 4 },
  bubbleOther: { borderWidth: 1, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14.5, fontFamily: 'Inter_400Regular', lineHeight: 21 },
  likeRow: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 4 },
  likeRowMe: { alignSelf: 'flex-end' },
  likeCount: { fontSize: 11, fontFamily: 'Inter_600SemiBold' },
  timeText: { fontSize: 10.5, fontFamily: 'Inter_400Regular', marginLeft: 2 },

  errorText: { fontSize: 12.5, fontFamily: 'Inter_500Medium', textAlign: 'center', paddingTop: 4 },

  inputBar: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', borderRadius: 20, borderWidth: 1, paddingLeft: 16, paddingRight: 6, paddingVertical: 6, gap: 8 },
  input: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', maxHeight: 100, paddingVertical: 6 },
  sendBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
