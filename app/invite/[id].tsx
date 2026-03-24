import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import QRCode from 'react-native-qrcode-svg';

const BG = '#0a0f1a';
const SURFACE = '#111827';
const BORDER = '#1f2937';
const ACCENT = '#22c55e';
const ACCENT_DIM = '#16a34a';

function useCountdown(expiresAt: number | null) {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    if (!expiresAt) { setRemaining(''); return; }
    const tick = () => {
      const diff = expiresAt - Date.now();
      if (diff <= 0) { setRemaining('Expired'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setRemaining(`Expires in ${h}h ${m}m`);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return remaining;
}

export default function InviteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const createInvite = useMutation(api.invites.createInvite);
  const acceptByShortCode = useMutation(api.invites.acceptByShortCode);

  const [email, setEmail] = useState('');
  const [creating, setCreating] = useState(false);

  const [shortCode, setShortCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [qrVisible, setQrVisible] = useState(false);

  const [codeBoxes, setCodeBoxes] = useState(['', '', '', '', '', '']);
  const boxRefs = useRef<(TextInput | null)[]>([]);
  const [accepting, setAccepting] = useState(false);

  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [resultOk, setResultOk] = useState(true);

  const countdown = useCountdown(expiresAt);
  const enteredCode = codeBoxes.join('');
  const deepLink = shortCode ? `beatsyncbuddy://join?code=${shortCode}` : '';

  const onGenerate = async () => {
    setCreating(true);
    setShortCode(null);
    setExpiresAt(null);
    setResultMsg(null);
    try {
      const emailArg = email.trim() || undefined;
      const invite = await createInvite({ playlistId: id as any, email: emailArg });
      setShortCode(invite.shortCode ?? null);
      setExpiresAt(Date.now() + 1000 * 60 * 60 * 24);
      setEmail('');
    } catch (err: any) {
      setResultMsg(err?.message ?? 'Failed to create invite.');
      setResultOk(false);
    } finally {
      setCreating(false);
    }
  };

  const onShareSheet = async () => {
    if (!shortCode) return;
    await Share.share({
      message: `Join my Beat Sync Buddy playlist!\n\nInvite code: ${shortCode}\n\nOr open the app directly: ${deepLink}`,
    });
  };

  const onSMS = () => {
    if (!shortCode) return;
    const body = encodeURIComponent(`Join my Beat Sync Buddy playlist! Code: ${shortCode}`);
    Linking.openURL(`sms:?body=${body}`);
  };

  const onEmail = () => {
    if (!shortCode) return;
    const subject = encodeURIComponent('Beat Sync Buddy – Playlist Invite');
    const body = encodeURIComponent(
      `Hey!\n\nI'd like you to collaborate on my Beat Sync Buddy playlist.\n\nInvite code: ${shortCode}\n\nThis code expires in 24 hours.`
    );
    Linking.openURL(`mailto:?subject=${subject}&body=${body}`);
  };

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

  const onJoin = async () => {
    if (enteredCode.length < 6) return;
    setAccepting(true);
    setResultMsg(null);
    try {
      const response = await acceptByShortCode({ shortCode: enteredCode });
      setResultMsg(response.alreadyAccepted ? 'Already a collaborator on this playlist.' : 'You joined the playlist!');
      setResultOk(true);
      setCodeBoxes(['', '', '', '', '', '']);
      if (!response.alreadyAccepted) {
        setTimeout(() => router.replace(`/playlists/${response.playlistId}` as any), 1200);
      }
    } catch (err: any) {
      setResultMsg(err?.message ?? 'Failed to accept invite.');
      setResultOk(false);
    } finally {
      setAccepting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={{ padding: 24, gap: 20, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* Header */}
          <View style={{ gap: 4, paddingTop: 8 }}>
            <Text style={{ fontSize: 36, marginBottom: 4 }}>👥</Text>
            <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>Invite a collaborator</Text>
            <Text style={{ color: '#64748b', fontSize: 14, lineHeight: 20 }}>
              Generate a code or QR to share — your collaborator enters it to join the playlist.
            </Text>
          </View>

          {/* ── SEND SECTION ── */}
          <View style={{ backgroundColor: SURFACE, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: BORDER, gap: 14 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Send an invite</Text>

            <View style={{ gap: 6 }}>
              <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '600', letterSpacing: 0.5 }}>EMAIL (optional)</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                placeholder="friend@example.com  — or leave blank"
                placeholderTextColor="#334155"
                style={{
                  backgroundColor: BG,
                  color: '#f1f5f9',
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  fontSize: 15,
                  borderWidth: 1,
                  borderColor: BORDER,
                }}
              />
            </View>

            <Pressable
              onPress={onGenerate}
              disabled={creating}
              style={({ pressed }) => ({
                backgroundColor: creating ? '#1e293b' : pressed ? ACCENT_DIM : ACCENT,
                padding: 15,
                borderRadius: 12,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
              })}
            >
              {creating
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={{ color: '#020617', fontWeight: '800', fontSize: 15 }}>Generate invite code</Text>}
            </Pressable>
          </View>

          {/* ── GENERATED CODE CARD ── */}
          {shortCode ? (
            <View style={{ backgroundColor: '#052e16', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#166534', gap: 16 }}>

              {/* Code display */}
              <View style={{ alignItems: 'center', gap: 10 }}>
                <Text style={{ color: '#4ade80', fontSize: 13, fontWeight: '600' }}>INVITE CODE</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {shortCode.split('').map((ch, i) => (
                    <View
                      key={i}
                      style={{
                        width: 40,
                        height: 48,
                        borderRadius: 10,
                        backgroundColor: '#0a1f12',
                        borderWidth: 1,
                        borderColor: '#166534',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: '#4ade80', fontSize: 22, fontWeight: '800' }}>{ch}</Text>
                    </View>
                  ))}
                </View>
                <Text style={{ color: '#16a34a', fontSize: 12 }}>{countdown}</Text>
              </View>

              {/* Share buttons row */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <ShareBtn label="📤 Share" onPress={onShareSheet} flex />
                <ShareBtn label="💬 SMS" onPress={onSMS} />
                <ShareBtn label="✉️ Email" onPress={onEmail} />
              </View>

              {/* QR button */}
              <Pressable
                onPress={() => setQrVisible(true)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  backgroundColor: pressed ? '#166534' : '#14532d',
                  borderRadius: 12,
                  padding: 13,
                  borderWidth: 1,
                  borderColor: '#166534',
                })}
              >
                <Text style={{ fontSize: 18 }}>⬛</Text>
                <Text style={{ color: '#4ade80', fontWeight: '700', fontSize: 15 }}>Show QR code</Text>
              </Pressable>
            </View>
          ) : null}

          {/* Divider */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: BORDER }} />
            <Text style={{ color: '#475569', fontSize: 12, fontWeight: '600', letterSpacing: 1 }}>OR JOIN</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: BORDER }} />
          </View>

          {/* ── ACCEPT SECTION ── */}
          <View style={{ backgroundColor: SURFACE, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: BORDER, gap: 14 }}>
            <View style={{ gap: 4 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Enter an invite code</Text>
              <Text style={{ color: '#64748b', fontSize: 13 }}>Got a 6-character code? Type it here to join the playlist.</Text>
            </View>

            {/* 6-box entry */}
            <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
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
                    width: 44,
                    height: 54,
                    borderRadius: 10,
                    backgroundColor: BG,
                    color: '#4ade80',
                    fontSize: 24,
                    fontWeight: '800',
                    textAlign: 'center',
                    borderWidth: 1.5,
                    borderColor: ch ? '#166534' : BORDER,
                  }}
                />
              ))}
            </View>

            <Pressable
              onPress={onJoin}
              disabled={accepting || enteredCode.length < 6}
              style={({ pressed }) => ({
                backgroundColor: accepting || enteredCode.length < 6 ? '#1e293b' : pressed ? '#1d4ed8' : '#2563eb',
                padding: 15,
                borderRadius: 12,
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8,
              })}
            >
              {accepting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={{ color: enteredCode.length < 6 ? '#475569' : '#fff', fontWeight: '800', fontSize: 15 }}>
                    Join playlist
                  </Text>}
            </Pressable>
          </View>

          {/* Result banner */}
          {resultMsg ? (
            <View style={{
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

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── QR MODAL ── */}
      <Modal visible={qrVisible} transparent animationType="fade" onRequestClose={() => setQrVisible(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => setQrVisible(false)}
        >
          <Pressable
            onPress={() => {}}
            style={{ backgroundColor: '#fff', borderRadius: 24, padding: 28, alignItems: 'center', gap: 18, width: 300 }}
          >
            <Text style={{ color: '#111827', fontWeight: '800', fontSize: 18 }}>Scan to join</Text>
            {shortCode ? (
              <QRCode
                value={deepLink}
                size={200}
                color="#111827"
                backgroundColor="#ffffff"
              />
            ) : null}
            <View style={{ alignItems: 'center', gap: 4 }}>
              <Text style={{ color: '#6b7280', fontSize: 13 }}>or enter code manually</Text>
              <Text style={{ color: '#111827', fontWeight: '800', fontSize: 22, letterSpacing: 6 }}>{shortCode}</Text>
              <Text style={{ color: '#9ca3af', fontSize: 12 }}>{countdown}</Text>
            </View>
            <Pressable onPress={() => setQrVisible(false)} style={{ marginTop: 4 }}>
              <Text style={{ color: '#6b7280', fontWeight: '600' }}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function ShareBtn({ label, onPress, flex }: { label: string; onPress: () => void; flex?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: flex ? 1 : undefined,
        backgroundColor: pressed ? '#166534' : '#14532d',
        borderRadius: 10,
        paddingVertical: 11,
        paddingHorizontal: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#166534',
      })}
    >
      <Text style={{ color: '#4ade80', fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}
