import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { useAuth } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { backChevron } from '@/utils/rtl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { apiFetch } from '@/utils/api';

interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

const AI_ACCENT = '#8B5CF6';

function dayKey(d: Date): string {
  return d.toLocaleDateString('en-CA');
}

// Read-only transcript, not separate named conversations — the underlying
// log (chat_messages) is one continuous per-user history, not split into
// sessions, so date dividers are what make a long scrollback feel navigable
// instead of a single undifferentiated wall of text.
export default function AIAssistantHistoryScreen() {
  const colors = useColors();
  const t = useT();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();

  const [messages, setMessages] = useState<HistoryMessage[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) { if (!cancelled) setMessages([]); return; }
        const res = await apiFetch('/api/chat/history', token);
        if (!res.ok) { if (!cancelled) setMessages([]); return; }
        const data = (await res.json()) as { messages: HistoryMessage[] };
        if (!cancelled) setMessages(data.messages);
      } catch {
        if (!cancelled) setMessages([]);
      }
    })();
    return () => { cancelled = true; };
  }, [getToken]);

  const dayLabel = (d: Date): string => {
    const key = dayKey(d);
    if (key === dayKey(new Date())) return t.todayLabel;
    if (key === dayKey(new Date(Date.now() - 86_400_000))) return t.aiHistoryYesterday;
    return d.toLocaleDateString('en-EG', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const topPad = Platform.OS === 'web' ? 16 : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;

  let lastDayKey = '';

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.screen, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Feather name={backChevron()} size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>{t.aiHistoryTitle}</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={[s.content, { paddingBottom: botPad + 24 }]}>
          {messages === null ? (
            <View style={s.empty}>
              <ActivityIndicator size="small" color={colors.mutedForeground} />
            </View>
          ) : messages.length === 0 ? (
            <View style={s.empty}>
              <View style={[s.emptyIcon, { backgroundColor: AI_ACCENT + '18' }]}>
                <Feather name="clock" size={26} color={AI_ACCENT} />
              </View>
              <Text style={[s.emptyTitle, { color: colors.text }]}>{t.aiHistoryEmpty}</Text>
              <Text style={[s.emptyHint, { color: colors.mutedForeground }]}>{t.aiHistoryEmptyHint}</Text>
            </View>
          ) : (
            messages.map((m, i) => {
              const created = new Date(m.createdAt);
              const key = dayKey(created);
              const showDivider = key !== lastDayKey;
              lastDayKey = key;
              return (
                <React.Fragment key={i}>
                  {showDivider && (
                    <Text style={[s.dayDivider, { color: colors.mutedForeground }]}>{dayLabel(created)}</Text>
                  )}
                  <View
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
                </React.Fragment>
              );
            })
          )}
        </ScrollView>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 17, fontFamily: 'Inter_600SemiBold' },
  content: { padding: 16, gap: 10, flexGrow: 1 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 60 },
  emptyIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  emptyHint: { fontSize: 13, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 19, paddingHorizontal: 24 },

  dayDivider: { fontSize: 12, fontFamily: 'Inter_500Medium', textAlign: 'center', marginTop: 8, marginBottom: 2 },

  bubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '85%' },
  bubbleUser: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleAssistant: { alignSelf: 'flex-start', borderWidth: 1, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14.5, fontFamily: 'Inter_400Regular', lineHeight: 21 },
});
