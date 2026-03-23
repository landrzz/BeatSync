import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth, useUser } from '@clerk/expo';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button, Card, Muted, Screen } from '@/components/ui';

export default function HomeScreen() {
  const { user, isSignedIn } = useUser();
  const { signOut } = useAuth();
  const router = useRouter();
  const me = useQuery(api.users.me);
  const createUser = useMutation(api.users.createUserIfNotExists);
  const playlists = useQuery(api.playlists.getUserPlaylists, me ? {} : 'skip');

  useEffect(() => {
    if (isSignedIn && me === null) {
      createUser({
        email: user?.emailAddresses?.[0]?.emailAddress,
        name: user?.fullName ?? undefined,
        imageUrl: user?.imageUrl ?? undefined,
      }).catch((err) => console.error('createUser failed:', err));
    }
  }, [isSignedIn, me, user, createUser]);

  return (
    <Screen>
      {!isSignedIn ? (
        <Card title="Login" subtitle="Clerk auth is now wired into the Expo app.">
          <Muted>Use sign up to create an account or sign in if you already have one.</Muted>
          <Button title="Create account" onPress={() => router.push('/sign-up' as any)} />
          <Button title="Sign in" onPress={() => router.push('/sign-in' as any)} />
        </Card>
      ) : !me ? (
        <Card title="Setting up your BeatSync account...">
          <Muted>Syncing your Clerk identity with Convex...</Muted>
          <Button title="Sign out" onPress={() => signOut()} />
        </Card>
      ) : (
        <Card title={`Welcome, ${me.name ?? me.email ?? 'User'}`} subtitle="Your collaborative music playlists">
          <Muted>BeatSync playlists you own or collaborate on will appear below.</Muted>
          {playlists && playlists.length > 0 ? (
            playlists.map((playlist: any) => (
              <Button
                key={playlist._id}
                title={`${playlist.name} (${playlist.trackCount} tracks)`}
                onPress={() => router.push(`/playlists/${playlist._id}` as any)}
              />
            ))
          ) : (
            <Muted>No playlists yet. Create one below.</Muted>
          )}
          <Button title="Create new playlist" onPress={() => router.push('/playlists/new' as any)} />
          <Button title="Connect Spotify" onPress={() => router.push('/connect-spotify' as any)} />
          <Muted>Apple Music is intentionally stubbed for the MVP.</Muted>
          <Button title="Sign out" onPress={() => signOut()} />
        </Card>
      )}
    </Screen>
  );
}
