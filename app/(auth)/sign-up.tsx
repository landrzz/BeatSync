import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSignUp, useSSO } from '@clerk/expo';
import * as AuthSession from 'expo-auth-session';
import { Button, Card, Field, Label, Muted, Screen } from '@/components/ui';

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
      console.log('[SignUp] Google SSO redirectUrl:', redirectUrl);
      const { createdSessionId, setActive } = await startSSOFlow({ strategy: 'oauth_google', redirectUrl });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace('/');
      }
    } catch (err: any) {
      console.error('[SignUp] Google SSO error:', JSON.stringify(err));
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
      const msg = (error as any)?.longMessage ?? (error as any)?.message ?? 'Sign-up failed.';
      console.error('[SignUp] password() error:', JSON.stringify(error));
      setErrorMsg(msg);
      return;
    }
    const { error: sendError } = await signUp.verifications.sendEmailCode();
    if (sendError) {
      const msg = (sendError as any)?.longMessage ?? (sendError as any)?.message ?? 'Failed to send code.';
      console.error('[SignUp] sendEmailCode() error:', JSON.stringify(sendError));
      setErrorMsg(msg);
      return;
    }
    setStep('verify');
  };

  const onVerifyEmail = async () => {
    if (!signUp) return;
    setErrorMsg(null);
    const { error } = await signUp.verifications.verifyEmailCode({ code });
    if (error) {
      const msg = (error as any)?.longMessage ?? (error as any)?.message ?? 'Verification failed.';
      console.error('[SignUp] verifyEmailCode() error:', JSON.stringify(error));
      setErrorMsg(msg);
      return;
    }
    if (signUp.status === 'complete') {
      const { error: fe } = await signUp.finalize();
      if (fe) { console.error('[SignUp] finalize() error:', JSON.stringify(fe)); setErrorMsg((fe as any)?.message ?? 'Could not activate session.'); return; }
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

  if (method === 'select') {
    return (
      <Screen>
        <Card title="Create account" subtitle="Choose how you'd like to sign up.">
          <GoogleButton onPress={onGoogleSignUp} loading={googleLoading} />
          <OrDivider />
          <MethodButton icon="✉️" label="Continue with email" onPress={() => { setMethod('email'); setErrorMsg(null); }} />
          {errorMsg ? <ErrorBanner message={errorMsg} /> : null}
        </Card>
        <Button title="Already have an account? Sign in" onPress={() => router.replace('/sign-in' as any)} />
      </Screen>
    );
  }

  if (method === 'email') {
    if (step === 'input') {
      return (
        <Screen>
          <BackRow label="Email sign-up  ·  Step 1 of 2" onBack={goSelect} />
          <Card title="Your details" subtitle="Enter your email and a strong password.">
            <Label>Email</Label>
            <Field value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@example.com" />
            <Label>Password</Label>
            <Field value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" placeholder="At least 8 characters" />
            {errorMsg ? <ErrorBanner message={errorMsg} /> : null}
            <Button title={loading ? 'Sending code…' : 'Continue'} onPress={onEmailContinue} disabled={loading || !email || !password} />
            {loading ? <ActivityIndicator color="#22c55e" style={{ marginTop: 4 }} /> : null}
          </Card>
        </Screen>
      );
    }
    return (
      <Screen>
        <BackRow label="Email sign-up  ·  Step 2 of 2" onBack={onBack} />
        <Card title="Verify your email" subtitle={`Enter the 6-digit code sent to ${email}`}>
          <Label>Verification code</Label>
          <Field value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" placeholder="123456" maxLength={6} />
          {errorMsg ? <ErrorBanner message={errorMsg} /> : null}
          <Button title={loading ? 'Verifying…' : 'Verify email'} onPress={onVerifyEmail} disabled={loading || code.length < 6} />
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
