import { useMemo, useState } from 'react';
import * as AuthSession from 'expo-auth-session';
import { useAuth } from '@clerk/expo';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button, Card, Muted, Screen } from '@/components/ui';
import { env } from '@/lib/env';

const discovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

export default function ConnectSpotifyScreen() {
  const { isSignedIn } = useAuth();
  const connectSpotify = useMutation(api.spotify.connectSpotify);
  const refreshSpotifyToken = useMutation(api.spotify.refreshSpotifyToken);
  const [status, setStatus] = useState<string>('Not connected yet.');
  const redirectUri = useMemo(() => env.spotifyRedirectUri ?? AuthSession.makeRedirectUri({ scheme: 'beatsync' }), []);

  const [request, _, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: env.spotifyClientId ?? 'missing-client-id',
      scopes: ['playlist-modify-private', 'playlist-modify-public', 'playlist-read-private', 'user-read-email'],
      usePKCE: true,
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
    },
    discovery,
  );

  const onConnect = async () => {
    if (!env.spotifyClientId) {
      setStatus('Missing EXPO_PUBLIC_SPOTIFY_CLIENT_ID');
      return;
    }
    const result = await promptAsync();
    if (result.type !== 'success' || !result.params.code) {
      setStatus('Spotify auth was cancelled or failed.');
      return;
    }
    await connectSpotify({ code: result.params.code, codeVerifier: request?.codeVerifier });
    setStatus('Spotify connected. Token stored in Convex.');
  };

  const onRefresh = async () => {
    const result = await refreshSpotifyToken({});
    setStatus(`Spotify token refreshed. Expires at ${new Date(result.expiresAt).toLocaleString()}.`);
  };

  return (
    <Screen>
      <Card title="Connect Spotify" subtitle="Required before BeatSync can search or sync to Spotify.">
        {!isSignedIn ? <Muted>Sign in first so Clerk can pass your identity through to Convex.</Muted> : null}
        <Muted>Redirect URI: {redirectUri}</Muted>
        <Button title="Start Spotify OAuth" onPress={onConnect} />
        <Button title="Refresh Spotify token" onPress={onRefresh} />
      </Card>
      <Card title="Apple Music">
        <Muted>Stub only for MVP. Keep BeatSync canonical and add an Apple Music sync adapter later.</Muted>
      </Card>
      <Card title="Status"><Muted>{status}</Muted></Card>
    </Screen>
  );
}
