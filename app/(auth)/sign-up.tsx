import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSignUp, useSSO } from '@clerk/expo';
import * as AuthSession from 'expo-auth-session';

const BG = '#0a0f1a';
const SURFACE = '#111827';
const BORDER = '#1f2937';
const ACCENT = '#22c55e';
const ACCENT_DIM = '#16a34a';

type Method = 'select' | 'email';
type Step = 'input' | 'verify';

export default function SignUpScreen() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const { startSSOFlow } = useSSO();
  const router = useRouter();

  const [method, setMethod] = useState<Method>('select');
  const [step, setStep] = useState<Step>('input');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const loading = fetchStatus === 'fetching';

  useEffect(() => {
    if (errors?.raw && errors.raw.length > 0) {
      console.error('[SignUp] Clerk errors:', JSON.stringify(errors.raw));
    }
  }, [errors]);

  const onGoogleSignUp = async () => {
    setErrorMsg(null);
    setGoogleLoading(true);
    try {
      const redirectUrl = AuthSession.makeRedirectUri({ scheme: 'beatsyncbuddy' });
      const { createdSessionId, setActive } = await startSSOFlow({ strategy: 'oauth_google', redirectUrl });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace('/');
      }
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Google sign-up failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const onEmailContinue = async () => {
    if (!signUp) return;
    setErrorMsg(null);
    const { error } = await signUp.password({ emailAddress: email, password });
    if (error) {
      setErrorMsg((error as any)?.longMessage ?? (error as any)?.message ?? 'Sign-up failed.');
      return;
    }
    const { error: sendError } = await signUp.verifications.sendEmailCode();
    if (sendError) {
      setErrorMsg((sendError as any)?.longMessage ?? (sendError as any)?.message ?? 'Failed to send code.');
      return;
    }
    setStep('verify');
  };

  const onVerifyEmail = async () => {
    if (!signUp) return;
    setErrorMsg(null);
    const { error } = await signUp.verifications.verifyEmailCode({ code });
    if (error) {
      setErrorMsg((error as any)?.longMessage ?? (error as any)?.message ?? 'Verification failed.');
      return;
    }
    if (signUp.status === 'complete') {
      const { error: fe } = await signUp.finalize();
      if (fe) { setErrorMsg((fe as any)?.message ?? 'Could not activate session.'); return; }
    }
    router.replace('/');
  };

  const onBack = async () => {
    if (signUp) await signUp.reset();
    setStep('input');
    setCode('');
    setErrorMsg(null);
  };

  const goSelect = () => { setMethod('select'); setStep('input'); setErrorMsg(null); };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 28 }} keyboardShouldPersistTaps="handled">

          {/* Logo */}
          <View style={{ alignItems: 'center', marginBottom: 40 }}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>🎵</Text>
            <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800', letterSpacing: -0.5 }}>Create account</Text>
            <Text style={{ color: '#64748b', fontSize: 15, marginTop: 6 }}>Start syncing music with friends</Text>
          </View>

          {method === 'select' && (
            <View style={{ gap: 12 }}>
              <Pressable
                onPress={onGoogleSignUp}
                disabled={googleLoading}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  backgroundColor: pressed ? '#e5e7eb' : '#fff',
                  borderRadius: 14,
                  padding: 16,
                  opacity: googleLoading ? 0.6 : 1,
                })}
              >
                {googleLoading
                  ? <ActivityIndicator color="#1f2937" />
                  : <Text style={{ fontSize: 18 }}>G</Text>}
                <Text style={{ color: '#111827', fontWeight: '700', fontSize: 16 }}>Continue with Google</Text>
              </Pressable>

              <OrDivider />

              <Pressable
                onPress={() => { setMethod('email'); setErrorMsg(null); }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 14,
                  backgroundColor: pressed ? '#1a2233' : SURFACE,
                  borderRadius: 14,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: BORDER,
                })}
              >
                <Text style={{ fontSize: 20 }}>✉️</Text>
                <Text style={{ color: '#e2e8f0', fontWeight: '600', fontSize: 16 }}>Continue with email</Text>
                <Text style={{ color: '#475569', marginLeft: 'auto', fontSize: 18 }}>›</Text>
              </Pressable>

              {errorMsg ? <ErrorBanner message={errorMsg} /> : null}
            </View>
          )}

          {method === 'email' && step === 'input' && (
            <View style={{ gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Pressable onPress={goSelect} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: ACCENT, fontSize: 16 }}>←</Text>
                  <Text style={{ color: ACCENT, fontWeight: '600', fontSize: 14 }}>Back</Text>
                </Pressable>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <View style={{ width: 20, height: 4, borderRadius: 2, backgroundColor: ACCENT }} />
                  <View style={{ width: 20, height: 4, borderRadius: 2, backgroundColor: BORDER }} />
                </View>
              </View>

              <View style={{ gap: 6 }}>
                <Text style={{ color: '#94a3b8', fontSize: 13, fontWeight: '600', marginBottom: 2 }}>EMAIL</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  placeholder="you@example.com"
                  placeholderTextColor="#475569"
                  style={{
                    backgroundColor: SURFACE,
                    color: '#f1f5f9',
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    fontSize: 16,
                    borderWidth: 1,
                    borderColor: BORDER,
                  }}
                />
              </View>

              <View style={{ gap: 6 }}>
                <Text style={{ color: '#94a3b8', fontSize: 13, fontWeight: '600', marginBottom: 2 }}>PASSWORD</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  placeholderTextColor="#475569"
                  style={{
                    backgroundColor: SURFACE,
                    color: '#f1f5f9',
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    fontSize: 16,
                    borderWidth: 1,
                    borderColor: BORDER,
                  }}
                />
              </View>

              {errorMsg ? <ErrorBanner message={errorMsg} /> : null}

              <Pressable
                onPress={onEmailContinue}
                disabled={loading || !email || !password}
                style={({ pressed }) => ({
                  backgroundColor: loading || !email || !password ? '#1e293b' : pressed ? ACCENT_DIM : ACCENT,
                  padding: 16,
                  borderRadius: 14,
                  alignItems: 'center',
                  marginTop: 4,
                })}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ color: loading || !email || !password ? '#475569' : '#020617', fontWeight: '800', fontSize: 16 }}>Continue</Text>}
              </Pressable>
            </View>
          )}

          {method === 'email' && step === 'verify' && (
            <View style={{ gap: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <Pressable onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: ACCENT, fontSize: 16 }}>←</Text>
                  <Text style={{ color: ACCENT, fontWeight: '600', fontSize: 14 }}>Back</Text>
                </Pressable>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <View style={{ width: 20, height: 4, borderRadius: 2, backgroundColor: ACCENT }} />
                  <View style={{ width: 20, height: 4, borderRadius: 2, backgroundColor: ACCENT }} />
                </View>
              </View>

              <View style={{ backgroundColor: SURFACE, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: BORDER, gap: 4 }}>
                <Text style={{ color: '#94a3b8', fontSize: 13, fontWeight: '600' }}>CODE SENT TO</Text>
                <Text style={{ color: '#f1f5f9', fontSize: 15, fontWeight: '600' }}>{email}</Text>
              </View>

              <View style={{ gap: 6 }}>
                <Text style={{ color: '#94a3b8', fontSize: 13, fontWeight: '600', marginBottom: 2 }}>VERIFICATION CODE</Text>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  placeholderTextColor="#475569"
                  maxLength={6}
                  style={{
                    backgroundColor: SURFACE,
                    color: '#f1f5f9',
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    fontSize: 24,
                    fontWeight: '700',
                    letterSpacing: 8,
                    borderWidth: 1,
                    borderColor: code.length === 6 ? ACCENT : BORDER,
                    textAlign: 'center',
                  }}
                />
              </View>

              {errorMsg ? <ErrorBanner message={errorMsg} /> : null}

              <Pressable
                onPress={onVerifyEmail}
                disabled={loading || code.length < 6}
                style={({ pressed }) => ({
                  backgroundColor: loading || code.length < 6 ? '#1e293b' : pressed ? ACCENT_DIM : ACCENT,
                  padding: 16,
                  borderRadius: 14,
                  alignItems: 'center',
                  marginTop: 4,
                })}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={{ color: loading || code.length < 6 ? '#475569' : '#020617', fontWeight: '800', fontSize: 16 }}>Verify email</Text>}
              </Pressable>
            </View>
          )}

          {/* Footer */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 36 }}>
            <Text style={{ color: '#64748b', fontSize: 14 }}>Already have an account?</Text>
            <Pressable onPress={() => router.replace('/sign-in' as any)}>
              <Text style={{ color: ACCENT, fontWeight: '700', fontSize: 14 }}>Sign in</Text>
            </Pressable>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function OrDivider() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: BORDER }} />
      <Text style={{ color: '#475569', fontSize: 12, fontWeight: '600', letterSpacing: 1 }}>OR</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: BORDER }} />
    </View>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={{ backgroundColor: '#450a0a', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#991b1b', flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <Text style={{ fontSize: 16 }}>⚠️</Text>
      <Text style={{ color: '#fca5a5', fontSize: 14, flex: 1, lineHeight: 20 }}>{message}</Text>
    </View>
  );
}
