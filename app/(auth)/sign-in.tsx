import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth, useClerk, useSignIn } from '@clerk/expo';
import { Button, Card, Field, Label, Muted, Screen } from '@/components/ui';

export default function SignInScreen() {
  const { signIn, errors, fetchStatus } = useSignIn();
  const { isLoaded } = useAuth();
  const { setActive } = useClerk();
  const router = useRouter();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const onSignIn = async () => {
    if (!isLoaded) return;
    try {
      await signIn.password({ identifier: emailAddress, password });
      if (signIn.status === 'complete' && signIn.createdSessionId) {
        await setActive({ session: signIn.createdSessionId });
        router.replace('/');
      } else {
        setStatus(`Sign-in result: ${signIn.status}`);
      }
    } catch (error: any) {
      setStatus(error?.errors?.[0]?.longMessage ?? error?.errors?.[0]?.message ?? 'Sign-in failed');
    }
  };

  return (
    <Screen>
      <Card title="Sign in" subtitle="Use your Clerk account to access BeatSync.">
        <Label>Email</Label>
        <Field value={emailAddress} onChangeText={setEmailAddress} autoCapitalize="none" keyboardType="email-address" />
        <Label>Password</Label>
        <Field value={password} onChangeText={setPassword} secureTextEntry />
        <Button title="Sign in" onPress={onSignIn} disabled={!isLoaded || !emailAddress || !password || fetchStatus === 'fetching'} />
        <Button title="Need an account? Sign up" onPress={() => router.push('/sign-up' as any)} />
        {errors ? <Muted>{JSON.stringify(errors)}</Muted> : null}
      </Card>
      {status ? <Card title="Status"><Muted>{status}</Muted></Card> : null}
    </Screen>
  );
}
