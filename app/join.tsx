import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

const BG = '#0a0f1a';
const SURFACE = '#111827';
const BORDER = '#1f2937';
const ACCENT = '#22c55e';
const ACCENT_DIM = '#16a34a';

export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const router = useRouter();
  const acceptByShortCode = useMutation(api.invites.acceptByShortCode);

  const [codeBoxes, setCodeBoxes] = useState(['', '', '', '', '', '']);
  const boxRefs = useRef<(TextInput | null)[]>([]);
  const [accepting, setAccepting] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [resultOk, setResultOk] = useState(true);
  const [autoTriggered, setAutoTriggered] = useState(false);

  const enteredCode = codeBoxes.join('');

  useEffect(() => {
    if (code && code.length === 6 && !autoTriggered) {
      const normalized = code.toUpperCase().split('');
      setCodeBoxes(normalized);
      setAutoTriggered(true);
    }
  }, [code, autoTriggered]);

  useEffect(() => {
    if (autoTriggered && enteredCode.length === 6) {
      onJoin(enteredCode);
    }
  }, [autoTriggered, enteredCode]);

  const onBoxChange = (text: string, idx: number) => {
    const char = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(-1);
    const next = [...codeBoxes];
    next[idx] = char;
    setCodeBoxes(next);
    if (char && idx < 5) boxRefs.current[idx + 1]?.focus();
  };

  const onBoxKeyPress = (key: string, idx: number) => {
    if (key === 'Backspace' && !codeBoxes[idx] && idx > 0) {
      const next = [...codeBoxes];
      next[idx - 1] = '';
      setCodeBoxes(next);
      boxRefs.current[idx - 1]?.focus();
    }
  };

  const onJoin = async (codeToUse?: string) => {
    const c = codeToUse ?? enteredCode;
    if (c.length < 6) return;
    setAccepting(true);
    setResultMsg(null);
    try {
      const response = await acceptByShortCode({ shortCode: c });
      setResultMsg(response.alreadyAccepted ? 'Already a collaborator!' : "You're in! Opening playlist…");
      setResultOk(true);
      setCodeBoxes(['', '', '', '', '', '']);
      setTimeout(() => router.replace(`/playlists/${response.playlistId}` as any), 1200);
    } catch (err: any) {
      setResultMsg(err?.message ?? 'Invalid or expired code.');
      setResultOk(false);
      setAutoTriggered(false);
    } finally {
      setAccepting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
      <StatusBar barStyle="light-content" />

      <View style={{ width: '100%', gap: 24, alignItems: 'center' }}>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 48 }}>🎵</Text>
          <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>Join a playlist</Text>
          <Text style={{ color: '#64748b', fontSize: 14, textAlign: 'center' }}>
            Enter the 6-character invite code to collaborate.
          </Text>
        </View>

        {/* 6-box entry */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {codeBoxes.map((ch, i) => (
            <TextInput
              key={i}
              ref={(r) => { boxRefs.current[i] = r; }}
              value={ch}
              onChangeText={(t) => onBoxChange(t, i)}
              onKeyPress={({ nativeEvent }) => onBoxKeyPress(nativeEvent.key, i)}
              maxLength={1}
              autoCapitalize="characters"
              autoCorrect={false}
              selectTextOnFocus
              style={{
                width: 46,
                height: 58,
                borderRadius: 12,
                backgroundColor: SURFACE,
                color: '#4ade80',
                fontSize: 26,
                fontWeight: '800',
                textAlign: 'center',
                borderWidth: 1.5,
                borderColor: ch ? '#166534' : BORDER,
              }}
            />
          ))}
        </View>

        {/* Join button */}
        <Pressable
          onPress={() => onJoin()}
          disabled={accepting || enteredCode.length < 6}
          style={({ pressed }) => ({
            width: '100%',
            backgroundColor: accepting || enteredCode.length < 6 ? '#1e293b' : pressed ? ACCENT_DIM : ACCENT,
            padding: 16,
            borderRadius: 14,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
          })}
        >
          {accepting
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: enteredCode.length < 6 ? '#475569' : '#020617', fontWeight: '800', fontSize: 16 }}>
                Join playlist
              </Text>}
        </Pressable>

        {/* Result banner */}
        {resultMsg ? (
          <View style={{
            width: '100%',
            backgroundColor: resultOk ? '#052e16' : '#450a0a',
            borderRadius: 12,
            padding: 14,
            borderWidth: 1,
            borderColor: resultOk ? '#166534' : '#991b1b',
            flexDirection: 'row',
            gap: 10,
            alignItems: 'flex-start',
          }}>
            <Text style={{ fontSize: 16 }}>{resultOk ? '✓' : '⚠️'}</Text>
            <Text style={{ color: resultOk ? '#4ade80' : '#fca5a5', fontSize: 14, flex: 1, lineHeight: 20 }}>
              {resultMsg}
            </Text>
          </View>
        ) : null}

        <Pressable onPress={() => router.back()} style={{ marginTop: 8 }}>
          <Text style={{ color: '#475569', fontSize: 14 }}>← Go back</Text>
        </Pressable>
      </View>
    </View>
  );
}
