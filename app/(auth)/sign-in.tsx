import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSignIn, useSSO } from '@clerk/expo';
import * as AuthSession from 'expo-auth-session';
import { Button, Card, Field, Label, Muted, Screen } from '@/components/ui';

type Method = 'select' | 'email';
type Step = 'input' | 'verify';

export default function SignInScreen() {
  const { signIn, errors, fetchStatus } = useSignIn();
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
      console.error('[SignIn] Clerk errors:', JSON.stringify(errors.raw));
    }
  }, [errors]);

  const onGoogleSignIn = async () => {
    setErrorMsg(null);
    setGoogleLoading(true);
    try {
      const redirectUrl = AuthSession.makeRedirectUri({ scheme: 'beatsyncbuddy' });
      console.log('[SignIn] Google SSO redirectUrl:', redirectUrl);
      const { createdSessionId, setActive } = await startSSOFlow({ strategy: 'oauth_google', redirectUrl });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace('/');
      }
    } catch (err: any) {
      console.error('[SignIn] Google SSO error:', JSON.stringify(err));
      setErrorMsg(err?.message ?? 'Google sign-in failed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const onEmailSignIn = async () => {
    if (!signIn) return;
    setErrorMsg(null);
    const { error } = await signIn.password({ identifier: email, password });
    if (error) {
      const msg = (error as any)?.longMessage ?? (error as any)?.message ?? 'Sign-in failed.';
      console.error('[SignIn] password() error:', JSON.stringify(error));
      setErrorMsg(msg);
      return;
    }
    if (signIn.status === 'complete') {
      const { error: fe } = await signIn.finalize();
      if (fe) { console.error('[SignIn] finalize() error:', JSON.stringify(fe)); setErrorMsg((fe as any)?.message ?? 'Could not activate session.'); return; }
    }
    router.replace('/');
  };

  const goSelect = () => { setMethod('select'); setStep('input'); setErrorMsg(null); };
  const onBack = () => { setStep('input'); setCode(''); setErrorMsg(null); };

  if (method === 'select') {
    return (
      <Screen>
        <Card title="Welcome back" subtitle="Sign in to your BeatSync account.">
          <GoogleButton onPress={onGoogleSignIn} loading={googleLoading} />
          <OrDivider />
          <MethodButton icon="✉️" label="Continue with email" onPress={() => { setMethod('email'); setErrorMsg(null); }} />
          {errorMsg ? <ErrorBanner message={errorMsg} /> : null}
        </Card>
        <Button title="Don't have an account? Sign up" onPress={() => router.replace('/sign-up' as any)} />
      </Screen>
    );
  }

  if (method === 'email') {
    return (
      <Screen>
        <BackRow label="Email sign-in" onBack={goSelect} />
        <Card title="Sign in" subtitle="Enter your email and password.">
          <Label>Email</Label>
          <Field value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@example.com" />
          <Label>Password</Label>
          <Field value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" placeholder="Your password" />
          {errorMsg ? <ErrorBanner message={errorMsg} /> : null}
          <Button title={loading ? 'Signing in…' : 'Sign in'} onPress={onEmailSignIn} disabled={loading || !email || !password} />
          {loading ? <ActivityIndicator color="#22c55e" style={{ marginTop: 4 }} /> : null}
        </Card>
      </Screen>
    );
  }

  return null;
}

function GoogleButton({ onPress, loading }: { onPress: () => void; loading: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 12, padding: 14, opacity: loading ? 0.6 : 1 }}
    >
      {loading
        ? <ActivityIndicator color="#1f2937" />
        : <Text style={{ fontSize: 16 }}>G</Text>}
      <Text style={{ color: '#1f2937', fontWeight: '700', fontSize: 15 }}>Continue with Google</Text>
    </Pressable>
  );
}

function OrDivider() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: '#1f2937' }} />
      <Text style={{ color: '#475569', fontSize: 12, fontWeight: '600' }}>OR</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: '#1f2937' }} />
    </View>
  );
}

function MethodButton({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1f2937', borderRadius: 12, padding: 14 }}
    >
      <Text style={{ fontSize: 18 }}>{icon}</Text>
      <Text style={{ color: '#e2e8f0', fontWeight: '600', fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

function BackRow({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Pressable onPress={onBack} style={{ padding: 6 }}>
        <Text style={{ color: '#22c55e', fontWeight: '700', fontSize: 15 }}>← Back</Text>
      </Pressable>
      <Text style={{ color: '#475569', fontSize: 12 }}>{label}</Text>
    </View>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={{ backgroundColor: '#450a0a', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#991b1b' }}>
      <Muted style={{ color: '#fca5a5' }}>{message}</Muted>
    </View>
  );
}
