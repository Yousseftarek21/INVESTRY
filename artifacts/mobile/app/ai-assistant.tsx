import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
// See feedback.tsx for the full rationale — every "behavior"-driven
// keyboard-avoidance approach relies on some component's own automatic
// keyboard-height measurement, which is what's unreliable here. This reads
// the real keyboard height directly, via a Reanimated shared value driven
// straight from the native keyboard event (not React state, which lands a
// frame or two behind), and applies it as real-time literal padding.
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
// Reanimated's own Animated.View — no naming collision in this file.
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';
import { router, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useAuth } from '@clerk/expo';
import { Feather } from '@expo/vector-icons';
import { backChevron } from '@/utils/rtl';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useT } from '@/hooks/useTranslation';
import { useHaptic } from '@/hooks/useHaptic';
import { useAppSettings } from '@/context/AppSettingsContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { LockedFeatureCard } from '@/components/LockedFeatureCard';
import { apiFetch } from '@/utils/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

type VoiceLang = 'en' | 'ar';

// Matches the violet accent on the Analytics-tab entry card — the AI
// Assistant keeps this identity throughout its own screen instead of
// reverting to the app-wide gold accent once you're inside it.
const AI_ACCENT = '#8B5CF6';

// FileReader is the standard RN-polyfilled way to turn a fetch Blob into a
// base64 string — used to hand the /api/tts response to expo-audio, which
// needs a file it can play, not raw response bytes sitting in memory.
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('blob-read-failed'));
    reader.onloadend = () => {
      const result = reader.result as string; // "data:audio/mpeg;base64,AAAA..."
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

export default function AIAssistantScreen() {
  const colors = useColors();
  const t = useT();
  const { impact } = useHaptic();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const { language } = useAppSettings();
  const { featuresUnlocked } = useSubscription();

  // Always starts blank — this screen is a fresh conversation every time
  // it's opened, not a restore of wherever the last one left off. Past
  // turns are still persisted server-side (POST /api/chat) so they show up
  // in the separate read-only History screen instead.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  // iOS has no reliable way to detect which language is being spoken (see
  // ai-assistant voice-conversation plan) — the app's own language is just
  // the starting point, overridable per use via the EN/AR pill.
  const [voiceLang, setVoiceLang] = useState<VoiceLang>(language === 'ar' ? 'ar' : 'en');
  // True from the moment voice starts a turn until the user explicitly
  // stops it (or types) — drives the "listen -> reply -> speak -> listen
  // again" loop. Mirrored into a ref because it's read from inside async
  // TTS callbacks, where a stale closure would otherwise keep the loop
  // going (or stop it) based on a value that's no longer true.
  const [conversationActive, setConversationActive] = useState(false);
  const conversationActiveRef = useRef(false);
  useEffect(() => { conversationActiveRef.current = conversationActive; }, [conversationActive]);
  // Set right before ExpoSpeechRecognitionModule.abort() so the 'end' event
  // it triggers knows not to send the (intentionally discarded) transcript.
  const cancelledRef = useRef(false);
  // Whether the turn currently in flight was asked by voice — only voice
  // turns get their reply spoken aloud; a typed question gets a typed
  // answer, not an unexpected voice interruption.
  const turnFromVoiceRef = useRef(false);
  // The transcript as of the most recent 'result' event — see that
  // handler below for why this can't just be read off `input` state.
  const latestTranscriptRef = useRef('');
  const scrollRef = useRef<ScrollView>(null);
  // The currently-playing (or most recently created) TTS player. Held
  // outside React state since it's an imperative handle, not something the
  // UI renders from directly — created fresh per reply, torn down before
  // the next one starts and on unmount.
  const audioPlayerRef = useRef<AudioPlayer | null>(null);

  useSpeechRecognitionEvent('start', () => {
    latestTranscriptRef.current = '';
    setIsRecording(true);
  });
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript;
    if (transcript) {
      // Mirrored into a ref, read by the 'end' handler below — 'end' can
      // fire before React has actually re-rendered with this result, so
      // reading the `input` state there risks a stale (often empty)
      // closure. The ref is updated synchronously, right here, so it's
      // never behind.
      latestTranscriptRef.current = transcript;
      setInput(transcript);
    }
  });
  useSpeechRecognitionEvent('error', (event) => {
    setIsRecording(false);
    // "no-speech"/"aborted"/"speech-timeout" are just the user stopping or
    // staying quiet — not failures worth interrupting them over. Every
    // other code ends the hands-free loop and says so: a silently
    // swallowed error here is exactly what made the Arabic locale bug look
    // like nothing was happening at all instead of a fixable failure.
    if (event.error === 'no-speech' || event.error === 'aborted' || event.error === 'speech-timeout') return;
    setConversationActive(false);
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      Alert.alert(t.voiceInputPermissionTitle, t.voiceInputPermissionBody);
    } else {
      Alert.alert(t.voiceInputErrorTitle, t.voiceInputErrorBody(event.error));
    }
  });
  // Fires once recognition genuinely ends — either a natural pause (the
  // final transcript is already in `input` from the 'result' event above)
  // or a manual abort. Only the natural-pause path sends anything: that's
  // what turns this into a hands-free loop instead of dictation.
  useSpeechRecognitionEvent('end', () => {
    setIsRecording(false);
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }
    if (conversationActiveRef.current) {
      const spoken = latestTranscriptRef.current.trim();
      if (spoken) {
        turnFromVoiceRef.current = true;
        send(spoken);
      }
    }
  });

  const startVoiceInput = useCallback(async () => {
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!result.granted) {
      Alert.alert(t.voiceInputPermissionTitle, t.voiceInputPermissionBody);
      setConversationActive(false);
      return;
    }
    impact(Haptics.ImpactFeedbackStyle.Light);
    setConversationActive(true);
    ExpoSpeechRecognitionModule.start({
      // ar-EG isn't in this platform's supported-locale list (confirmed via
      // getSupportedLocales() — only ar-SA is), so requesting it failed
      // with a silent "language-not-supported" error: no crash, no result,
      // just nothing, which is exactly what made this look broken.
      lang: voiceLang === 'ar' ? 'ar-SA' : 'en-US',
      interimResults: true,
      continuous: false,
      requiresOnDeviceRecognition: false,
    });
  }, [voiceLang, impact, t]);

  // Manual tap while listening: the user changed their mind. Abort (not
  // stop) so no partial transcript gets sent, and leave the hands-free
  // loop entirely rather than just skipping this one turn.
  const stopVoiceInput = useCallback(() => {
    cancelledRef.current = true;
    setConversationActive(false);
    ExpoSpeechRecognitionModule.abort();
  }, []);

  // Real cloud TTS (Azure neural voices, including an actual Egyptian
  // Arabic voice) rather than the phone's own on-device voice — the
  // on-device Arabic voice turned out to be Apple's lowest "super-compact"
  // quality tier, not something the app could improve by picking a
  // different locale string. See POST /api/tts on the backend.
  const speak = useCallback(async (text: string, lang: VoiceLang) => {
    setIsSpeaking(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('no-token');
      const res = await apiFetch('/api/tts', token, {
        method: 'POST',
        body: JSON.stringify({ text, language: lang }),
      });
      if (!res.ok) throw new Error(`tts-status-${res.status}`);
      const blob = await res.blob();
      const base64 = await blobToBase64(blob);
      const fileUri = `${FileSystem.cacheDirectory}investry-tts-${Date.now()}.mp3`;
      await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });

      audioPlayerRef.current?.remove();
      const player = createAudioPlayer({ uri: fileUri });
      audioPlayerRef.current = player;
      const sub = player.addListener('playbackStatusUpdate', (status) => {
        if (!status.didJustFinish) return;
        sub.remove();
        setIsSpeaking(false);
        // The loop continues on its own here — this is what makes it
        // hands-free instead of "voice dictation, one turn at a time."
        if (conversationActiveRef.current) startVoiceInput();
      });
      player.play();
    } catch {
      setIsSpeaking(false);
      setConversationActive(false);
      Alert.alert(t.voiceInputErrorTitle, t.voiceInputErrorBody('tts'));
    }
  }, [startVoiceInput, getToken, t]);

  // Manual tap while the AI is speaking: stop the sentence and leave the
  // loop. No barge-in for now (interrupt-and-immediately-listen) — that
  // needs careful iOS audio-session handoff timing to avoid the mic
  // picking up the tail end of the AI's own voice, and isn't worth the
  // risk of a flaky first version.
  const stopSpeaking = useCallback(() => {
    setConversationActive(false);
    setIsSpeaking(false);
    audioPlayerRef.current?.pause();
  }, []);

  useEffect(() => {
    return () => {
      ExpoSpeechRecognitionModule.stop();
      audioPlayerRef.current?.remove();
    };
  }, []);

  const topPad = Platform.OS === 'web' ? 16 : insets.top;
  const botPad = Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom;
  const { height: keyboardHeightSV } = useReanimatedKeyboardAnimation();
  const keyboardPaddingStyle = useAnimatedStyle(() => ({
    paddingBottom: -keyboardHeightSV.value,
  }));

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const fromVoice = turnFromVoiceRef.current;
    turnFromVoiceRef.current = false;

    impact(Haptics.ImpactFeedbackStyle.Light);
    setError(null);
    setInput('');
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    // The assistant's own bubble appears immediately as a spinner and fills
    // in once the (whole) reply arrives — not word-by-word. An earlier
    // version streamed this incrementally but shipped broken (see chat.ts's
    // callGemini comment) and was reverted to this plain request/response.
    setMessages([...nextMessages, { role: 'assistant', content: '' }]);
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
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: 'assistant', content: data.reply };
        return next;
      });
      if (fromVoice) speak(data.reply, voiceLang);
    } catch {
      setError(t.aiAssistantError);
      // Drop the still-empty placeholder bubble rather than leaving a blank one.
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        return last?.role === 'assistant' && !last.content ? prev.slice(0, -1) : prev;
      });
      // A failed voice turn shouldn't leave the loop silently hanging with
      // no way forward — end it, same as any other exit.
      if (fromVoice) setConversationActive(false);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages, loading, getToken, impact, t, language, speak, voiceLang]);

  const suggestions = [t.aiSuggestion1, t.aiSuggestion2, t.aiSuggestion3];

  const micState: 'idle' | 'listening' | 'speaking' = isSpeaking ? 'speaking' : isRecording ? 'listening' : 'idle';
  const micOnPress = micState === 'speaking' ? stopSpeaking : micState === 'listening' ? stopVoiceInput : startVoiceInput;
  const micIcon = micState === 'speaking' ? 'volume-2' : micState === 'listening' ? 'square' : 'mic';
  const micColor = micState === 'idle' ? AI_ACCENT : colors.red;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[s.screen, { backgroundColor: colors.background }]}>

        <View style={[s.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
            <Feather name={backChevron()} size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.text }]}>{t.aiAssistantTitle}</Text>
          <TouchableOpacity onPress={() => router.push('/ai-assistant-history' as any)} hitSlop={8}>
            <Feather name="clock" size={21} color={colors.text} />
          </TouchableOpacity>
        </View>

        {!featuresUnlocked ? (
          <View style={{ flex: 1, padding: 24 }}>
            <LockedFeatureCard feature={t.aiAssistantTitle} description={t.subAiAssistantFull} fullScreen fromModalScreen />
          </View>
        ) : (
        <Reanimated.View style={[{ flex: 1 }, keyboardPaddingStyle]}>
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.length === 0 ? (
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
              messages.map((m, i) => {
                const isPendingPlaceholder = loading && i === messages.length - 1 && m.role === 'assistant' && m.content === '';
                return (
                  <View
                    key={i}
                    style={[
                      s.bubble,
                      m.role === 'user'
                        ? [s.bubbleUser, { backgroundColor: AI_ACCENT }]
                        : [s.bubbleAssistant, { backgroundColor: colors.card, borderColor: colors.border }],
                    ]}
                  >
                    {isPendingPlaceholder ? (
                      <ActivityIndicator size="small" color={colors.mutedForeground} />
                    ) : (
                      <Text style={[s.bubbleText, { color: m.role === 'user' ? '#FFFFFF' : colors.text }]}>
                        {m.content}
                      </Text>
                    )}
                  </View>
                );
              })
            )}

            {error && <Text style={[s.errorText, { color: colors.red }]}>{error}</Text>}
          </ScrollView>

          <View style={[s.inputBar, { paddingBottom: botPad + 10, borderTopColor: colors.border }]}>
            {(micState !== 'idle') && (
              <Text style={[s.voiceStatus, { color: colors.mutedForeground }]}>
                {micState === 'listening' ? t.voiceListeningStatus : t.voiceSpeakingStatus}
              </Text>
            )}

            <View style={s.voiceRow}>
              <View style={s.langToggle}>
                {(['en', 'ar'] as VoiceLang[]).map((l) => {
                  const active = voiceLang === l;
                  return (
                    <TouchableOpacity
                      key={l}
                      onPress={() => setVoiceLang(l)}
                      disabled={isRecording || isSpeaking}
                      style={[
                        s.langChip,
                        { backgroundColor: active ? AI_ACCENT : colors.card, borderColor: active ? AI_ACCENT : colors.border },
                      ]}
                    >
                      <Text style={[s.langChipText, { color: active ? '#FFFFFF' : colors.mutedForeground }]}>
                        {l.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={[s.inputRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[s.input, { color: colors.text }]}
                placeholder={t.aiAssistantPlaceholder}
                placeholderTextColor={colors.mutedForeground}
                value={input}
                onChangeText={(v) => { setInput(v); if (conversationActive) setConversationActive(false); }}
                multiline
                editable={!loading}
                onSubmitEditing={() => send(input)}
              />
              {input.trim() ? (
                <TouchableOpacity
                  onPress={() => send(input)}
                  disabled={loading}
                  style={[s.sendBtn, { backgroundColor: AI_ACCENT, opacity: loading ? 0.5 : 1 }]}
                >
                  <Feather name="arrow-up" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={micOnPress}
                  disabled={loading}
                  style={[s.sendBtn, { backgroundColor: micColor, opacity: loading ? 0.5 : 1 }]}
                >
                  <Feather name={micIcon} size={16} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Reanimated.View>
        )}
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
  voiceStatus: { fontSize: 11.5, fontFamily: 'Inter_500Medium', textAlign: 'center', marginBottom: 4 },
  voiceRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 6 },
  langToggle: { flexDirection: 'row', gap: 6 },
  langChip: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 3 },
  langChipText: { fontSize: 10.5, fontFamily: 'Inter_700Bold', letterSpacing: 0.4 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', borderRadius: 20, borderWidth: 1, paddingLeft: 16, paddingRight: 6, paddingVertical: 6, gap: 8 },
  input: { flex: 1, fontSize: 15, fontFamily: 'Inter_400Regular', maxHeight: 100, paddingVertical: 6 },
  sendBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
