import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth, useClerk, useSignUp } from '@clerk/expo';
import { View, Platform } from 'react-native';
import { Button, Card, Field, Label, Muted, Screen } from '@/components/ui';

export default function SignUpScreen() {
  const { signUp, errors, fetchStatus } = useSignUp();
  const { isLoaded } = useAuth();
  const { setActive } = useClerk();
  const router = useRouter();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const awaitingVerification =
    signUp.status === 'missing_requirements' &&
    signUp.unverifiedFields.includes('email_address') &&
    signUp.missingFields.length === 0;

  const onSignUp = async () => {
    if (!isLoaded) return;
    try {
      await signUp.password({ emailAddress, password });
      await signUp.verifications.sendEmailCode();
      setStatus('Verification code sent. Check your email.');
    } catch (error: any) {
      setStatus(error?.errors?.[0]?.longMessage ?? error?.errors?.[0]?.message ?? 'Sign-up failed');
    }
  };

  const onVerify = async () => {
    if (!isLoaded) return;
    try {
      await signUp.verifications.verifyEmailCode({ code });
      if (signUp.status === 'complete' && signUp.createdSessionId) {
        await setActive({ session: signUp.createdSessionId });
        router.replace('/');
      } else {
        await signUp.finalize();
        if (signUp.createdSessionId) {
          await setActive({ session: signUp.createdSessionId });
          router.replace('/');
        } else {
          setStatus(`Verification result: ${signUp.status}`);
        }
      }
    } catch (error: any) {
      setStatus(error?.errors?.[0]?.longMessage ?? error?.errors?.[0]?.message ?? 'Verification failed');
    }
  };

  return (
    <Screen>
      {!awaitingVerification ? (
        <Card title="Sign up" subtitle="Create a BeatSync account with Clerk.">
          <Label>Email</Label>
          <Field value={emailAddress} onChangeText={setEmailAddress} autoCapitalize="none" keyboardType="email-address" />
          <Label>Password</Label>
          <Field value={password} onChangeText={setPassword} secureTextEntry />
          <Button title="Create account" onPress={onSignUp} disabled={!isLoaded || !emailAddress || !password || fetchStatus === 'fetching'} />
          <Button title="Already have an account? Sign in" onPress={() => router.push('/sign-in' as any)} />
          {Platform.OS === 'web' ? (
            <div id="clerk-captcha" style={{ marginTop: 16 }} />
          ) : (
            <View nativeID="clerk-captcha" style={{ marginTop: 16 }} />
          )}
        </Card>
      ) : (
        <Card title="Verify your email" subtitle="Enter the code Clerk sent you.">
          <Label>Verification code</Label>
          <Field value={code} onChangeText={setCode} keyboardType="numeric" autoCapitalize="none" />
          <Button title="Verify email" onPress={onVerify} disabled={!isLoaded || !code || fetchStatus === 'fetching'} />
        </Card>
      )}
      {errors ? <Card title="Clerk debug"><Muted>{JSON.stringify(errors)}</Muted></Card> : null}
      {status ? <Card title="Status"><Muted>{status}</Muted></Card> : null}
    </Screen>
  );
}
