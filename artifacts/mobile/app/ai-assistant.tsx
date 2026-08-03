import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
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
import { useAppSettings } from '@/context/AppSettingsContext';
import { apiFetch } from '@/utils/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Matches the violet accent on the Analytics-tab entry card — the AI
// Assistant keeps this identity throughout its own screen instead of
// reverting to the app-wide gold accent once you're inside it.
const AI_ACCENT = '#8B5CF6';

export default function AIAssistantScreen() {
  const colors = useColors();
  const t = useT();
  const { impact } = useHaptic();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const { language } = useAppSettings();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const topPad = Platform.OS === 'web' ? 16 : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  // Restores the conversation from where it left off, rather than starting
  // blank every time this screen opens — the server persists every turn
  // (see POST /api/chat) precisely so this can happen.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await apiFetch('/api/chat/history', token);
        if (!res.ok) return;
        const data = (await res.json()) as { messages: ChatMessage[] };
        if (!cancelled) setMessages(data.messages);
      } catch {
        // Best-effort — worst case the screen just starts blank, same as before.
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    impact(Haptics.ImpactFeedbackStyle.Light);
    setError(null);
    setInput('');
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setLoading(true);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

    try {
      const token = await getToken();
      if (!token) throw new Error('no-token');
      const res = await apiFetch('/api/chat', token, {
        method: 'POST',
        body: JSON.stringify({ messages: nextMessages, language }),
      });
      if (!res.ok) throw new Error(`status-${res.status}`);
      const data = (await res.json()) as { reply: string };
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
      setError(t.aiAssistantError);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages, loading, getToken, impact, t]);

  const suggestions = [t.aiSuggestion1, t.aiSuggestion2, t.aiSuggestion3];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.screen, { backgroundColor: colors.background }]}>

        <View style={[s.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Feather name={backChevron()} size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>{t.aiAssistantTitle}</Text>
          <View style={{ width: 22 }} />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {historyLoading ? (
              <View style={s.empty}>
                <ActivityIndicator size="small" color={colors.mutedForeground} />
              </View>
            ) : messages.length === 0 ? (
              <View style={s.empty}>
                <View style={[s.emptyIcon, { backgroundColor: AI_ACCENT + '18' }]}>
                  <Feather name="cpu" size={28} color={AI_ACCENT} />
                </View>
                <Text style={[s.emptyTitle, { color: colors.text }]}>{t.aiAssistantTitle}</Text>
                <Text style={[s.emptyHint, { color: colors.mutedForeground }]}>{t.aiAssistantEmptyHint}</Text>
                <View style={s.suggestions}>
                  {suggestions.map((sugg) => (
                    <TouchableOpacity
                      key={sugg}
                      style={[s.suggestionChip, { backgroundColor: colors.card, borderColor: AI_ACCENT + '30' }]}
                      onPress={() => send(sugg)}
                      activeOpacity={0.85}
                    >
                      <Text style={[s.suggestionText, { color: colors.text }]}>{sugg}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : (
              messages.map((m, i) => (
                <View
                  key={i}
                  style={[
                    s.bubble,
                    m.role === 'user'
                      ? [s.bubbleUser, { backgroundColor: AI_ACCENT }]
                      : [s.bubbleAssistant, { backgroundColor: colors.card, borderColor: colors.border }],
                  ]}
                >
                  <Text style={[s.bubbleText, { color: m.role === 'user' ? '#FFFFFF' : colors.text }]}>
                    {m.content}
                  </Text>
                </View>
              ))
            )}

            {loading && (
              <View style={[s.bubble, s.bubbleAssistant, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <ActivityIndicator size="small" color={colors.mutedForeground} />
              </View>
            )}

            {error && <Text style={[s.errorText, { color: colors.red }]}>{error}</Text>}
          </ScrollView>

          <View style={[s.inputBar, { paddingBottom: botPad + 10, borderTopColor: colors.border }]}>
            <View style={[s.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[s.input, { color: colors.text }]}
                placeholder={t.aiAssistantPlaceholder}
                placeholderTextColor={colors.mutedForeground}
                value={input}
                onChangeText={setInput}
                multiline
                editable={!loading}
                onSubmitEditing={() => send(input)}
              />
              <TouchableOpacity
                onPress={() => send(input)}
                disabled={loading || !input.trim()}
                style={[s.sendBtn, { backgroundColor: AI_ACCENT, opacity: loading || !input.trim() ? 0.5 : 1 }]}
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
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  content: { padding: 16, gap: 10, flexGrow: 1 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 40 },
  emptyIcon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  emptyHint: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19, paddingHorizontal: 24 },
  suggestions: { gap: 8, marginTop: 12, width: '100%' },
  suggestionChip: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  suggestionText: { fontSize: 13.5, fontFamily: 'Inter_500Medium' },

  bubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '85%' },
  bubbleUser: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleAssistant: { alignSelf: 'flex-start', borderWidth: 1, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14.5, fontFamily: 'Inter_400Regular', lineHeight: 21 },

  errorText: { fontSize: 12.5, fontFamily: 'Inter_500Medium', textAlign: 'center', paddingTop: 4 },

  inputBar: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', borderRadius: 20, borderWidth: 1, paddingLeft: 16, paddingRight: 6, paddingVertical: 6, gap: 8 },
  input: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', maxHeight: 100, paddingVertical: 6 },
  sendBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
