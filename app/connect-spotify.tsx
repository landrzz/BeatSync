import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import * as AuthSession from 'expo-auth-session';
import { useAuth, useUser } from '@clerk/expo';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { env } from '@/lib/env';

const BG = '#0a0f1a';
const SURFACE = '#111827';
const BORDER = '#1f2937';
const ACCENT = '#22c55e';
const ACCENT_DIM = '#16a34a';
const SPOTIFY_GREEN = '#1DB954';
const SPOTIFY_DIM = '#17a349';

const discovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

const SCOPES = [
  { icon: '📋', label: 'Read your playlists' },
  { icon: '✏️', label: 'Create & edit playlists' },
  { icon: '📧', label: 'Read your email (identity)' },
];

export default function ConnectSpotifyScreen() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const connectSpotify = useAction(api.spotify.connectSpotify);
  const refreshSpotifyToken = useAction(api.spotify.refreshSpotifyToken);
  const spotifyConnected = useQuery(api.spotify.isSpotifyConnected);

  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [resultOk, setResultOk] = useState(true);

  const redirectUri = useMemo(() => {
    const uri = env.spotifyRedirectUri ?? AuthSession.makeRedirectUri({ scheme: 'beatsyncbuddy', path: 'redirect', preferLocalhost: true });
    console.log('[BeatSync] Spotify redirectUri:', uri);
    return uri;
  }, []);

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
      setResultMsg('Missing Spotify Client ID. Add EXPO_PUBLIC_SPOTIFY_CLIENT_ID to your env.');
      setResultOk(false);
      return;
    }
    setConnecting(true);
    setResultMsg(null);
    try {
      const result = await promptAsync();
      if (result.type !== 'success' || !result.params.code) {
        setResultMsg('Spotify auth was cancelled or failed.');
        setResultOk(false);
        return;
      }
      await connectSpotify({ code: result.params.code, codeVerifier: request?.codeVerifier });
      setResultMsg('Spotify connected! Your playlists will now sync automatically.');
      setResultOk(true);
    } catch (err: any) {
      setResultMsg(err?.message ?? 'Failed to connect Spotify.');
      setResultOk(false);
    } finally {
      setConnecting(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setResultMsg(null);
    try {
      const result = await refreshSpotifyToken({});
      setResultMsg(`Token refreshed — valid until ${new Date(result.expiresAt).toLocaleTimeString()}.`);
      setResultOk(true);
    } catch (err: any) {
      setResultMsg(err?.message ?? 'Failed to refresh token.');
      setResultOk(false);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={{ padding: 24, gap: 20, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >

        {/* Header */}
        <View style={{ gap: 6, paddingTop: 8 }}>
          <Text style={{ fontSize: 40, marginBottom: 4 }}>🎧</Text>
          <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800', letterSpacing: -0.5 }}>
            Connect Spotify
          </Text>
          <Text style={{ color: '#64748b', fontSize: 14, lineHeight: 20 }}>
            Link your Spotify account so Beat Sync Buddy can sync your collaborative playlists.
          </Text>
        </View>

        {/* Connection status card */}
        <View style={{
          backgroundColor: spotifyConnected ? '#052e16' : SURFACE,
          borderRadius: 16,
          padding: 18,
          borderWidth: 1,
          borderColor: spotifyConnected ? '#166534' : BORDER,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
        }}>
          <View style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: spotifyConnected ? '#14532d' : '#1a1a2e',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 24 }}>🎵</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: spotifyConnected ? '#4ade80' : '#e2e8f0', fontWeight: '700', fontSize: 15 }}>
              {spotifyConnected ? 'Spotify Connected' : 'Not connected'}
            </Text>
            <Text style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>
              {spotifyConnected
                ? `Linked to ${user?.emailAddresses?.[0]?.emailAddress ?? 'your account'}`
                : 'Connect to enable playlist syncing'}
            </Text>
          </View>
          {spotifyConnected
            ? <Text style={{ color: '#4ade80', fontSize: 22 }}>✓</Text>
            : <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#475569' }} />}
        </View>

        {/* Not signed in warning */}
        {!isSignedIn ? (
          <View style={{
            backgroundColor: '#451a03',
            borderRadius: 12,
            padding: 14,
            borderWidth: 1,
            borderColor: '#92400e',
            flexDirection: 'row',
            gap: 10,
            alignItems: 'flex-start',
          }}>
            <Text style={{ fontSize: 16 }}>⚠️</Text>
            <Text style={{ color: '#fde68a', fontSize: 14, flex: 1, lineHeight: 20 }}>
              You need to be signed in before connecting Spotify.
            </Text>
          </View>
        ) : null}

        {/* Permissions section */}
        <View style={{ backgroundColor: SURFACE, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: BORDER, gap: 14 }}>
          <View style={{ gap: 4 }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>What we'll access</Text>
            <Text style={{ color: '#64748b', fontSize: 13 }}>Beat Sync Buddy only requests what it needs.</Text>
          </View>
          <View style={{ gap: 12 }}>
            {SCOPES.map((s) => (
              <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: BG,
                  borderWidth: 1,
                  borderColor: BORDER,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 16 }}>{s.icon}</Text>
                </View>
                <Text style={{ color: '#cbd5e1', fontSize: 14, flex: 1 }}>{s.label}</Text>
                <Text style={{ color: ACCENT, fontSize: 16 }}>✓</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Connect button */}
        {!spotifyConnected ? (
          <Pressable
            onPress={onConnect}
            disabled={connecting || !isSignedIn}
            style={({ pressed }) => ({
              backgroundColor: connecting || !isSignedIn ? '#1e293b' : pressed ? SPOTIFY_DIM : SPOTIFY_GREEN,
              padding: 17,
              borderRadius: 14,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 10,
            })}
          >
            {connecting
              ? <ActivityIndicator color="#fff" size="small" />
              : (
                <>
                  <Text style={{ fontSize: 20 }}>🎵</Text>
                  <Text style={{ color: !isSignedIn ? '#475569' : '#fff', fontWeight: '800', fontSize: 16 }}>
                    Connect with Spotify
                  </Text>
                </>
              )}
          </Pressable>
        ) : (
          <Pressable
            onPress={onRefresh}
            disabled={refreshing}
            style={({ pressed }) => ({
              backgroundColor: refreshing ? '#1e293b' : pressed ? ACCENT_DIM : ACCENT,
              padding: 17,
              borderRadius: 14,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 10,
            })}
          >
            {refreshing
              ? <ActivityIndicator color="#020617" size="small" />
              : (
                <>
                  <Text style={{ fontSize: 18 }}>🔄</Text>
                  <Text style={{ color: '#020617', fontWeight: '800', fontSize: 16 }}>Refresh Spotify token</Text>
                </>
              )}
          </Pressable>
        )}

        {/* Apple Music stub */}
        <View style={{ backgroundColor: SURFACE, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: BORDER, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: '#1a0a0a',
              borderWidth: 1,
              borderColor: '#3f0f0f',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 20 }}>🍎</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#e2e8f0', fontWeight: '700', fontSize: 15 }}>Apple Music</Text>
              <Text style={{ color: '#64748b', fontSize: 13, marginTop: 1 }}>Coming soon</Text>
            </View>
            <View style={{
              backgroundColor: '#1f2937',
              borderRadius: 8,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}>
              <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '600' }}>SOON</Text>
            </View>
          </View>
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
    </View>
  );
}
