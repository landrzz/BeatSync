import React, { useEffect } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth, useUser } from '@clerk/expo';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button, Card, Muted, Screen } from '@/components/ui';

const ACCENT = '#22c55e';
const ACCENT_DIM = '#16a34a';
const BG = '#0a0f1a';
const SURFACE = '#111827';
const BORDER = '#1f2937';

export default function HomeScreen() {
  const { user, isSignedIn } = useUser();
  const { signOut } = useAuth();
  const router = useRouter();
  const me = useQuery(api.users.me);
  const createUser = useMutation(api.users.createUserIfNotExists);
  const playlists = useQuery(api.playlists.getUserPlaylists, me ? {} : 'skip');
  const spotifyConnected = useQuery(api.spotify.isSpotifyConnected, me ? {} : 'skip');

  useEffect(() => {
    if (isSignedIn && me === null) {
      createUser({
        email: user?.emailAddresses?.[0]?.emailAddress,
        name: user?.fullName ?? undefined,
        imageUrl: user?.imageUrl ?? undefined,
      }).catch((err) => console.error('createUser failed:', err));
    }
  }, [isSignedIn, me, user, createUser]);

  if (!isSignedIn) {
    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        <StatusBar barStyle="light-content" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 8 }}>
          <Text style={{ fontSize: 52, marginBottom: 8 }}>🎵</Text>
          <Text style={{ color: '#fff', fontSize: 32, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' }}>
            Beat Sync Buddy
          </Text>
          <Text style={{ color: '#64748b', fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 24 }}>
            Collaborative playlists.{'\n'}Any platform, any friend.
          </Text>
          <Pressable
            onPress={() => router.push('/sign-up' as any)}
            style={{ backgroundColor: ACCENT, width: '100%', padding: 16, borderRadius: 14, alignItems: 'center' }}
          >
            <Text style={{ color: '#020617', fontWeight: '800', fontSize: 16 }}>Create account</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/sign-in' as any)}
            style={{ backgroundColor: SURFACE, width: '100%', padding: 16, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: BORDER }}
          >
            <Text style={{ color: '#e2e8f0', fontWeight: '700', fontSize: 16 }}>Sign in</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!me) {
    return (
      <View style={{ flex: 1, backgroundColor: BG, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
        <Text style={{ fontSize: 36 }}>🎵</Text>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>Setting up your account…</Text>
        <Text style={{ color: '#64748b', fontSize: 14 }}>Just a moment</Text>
        <Pressable onPress={() => signOut()} style={{ marginTop: 24 }}>
          <Text style={{ color: '#475569', fontSize: 14 }}>Sign out</Text>
        </Pressable>
      </View>
    );
  }

  const firstName = me.name?.split(' ')[0] ?? me.email?.split('@')[0] ?? 'there';
  const hasPlaylists = playlists && playlists.length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

        {/* Hero Header */}
        <View style={{
          paddingTop: 56,
          paddingHorizontal: 24,
          paddingBottom: 32,
          backgroundColor: BG,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#64748b', fontSize: 14, fontWeight: '500', marginBottom: 4 }}>
                Good {getTimeOfDay()} 👋
              </Text>
              <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }}>
                {firstName}
              </Text>
            </View>
            <Pressable
              onPress={() => Alert.alert('Sign out', 'Are you sure you want to sign out?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
              ])}
              style={{ marginTop: 4 }}
            >
              {me.imageUrl
                ? <Image source={{ uri: me.imageUrl }} style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: BORDER }} />
                : <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: SURFACE, borderWidth: 2, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
                      {(firstName[0] ?? '?').toUpperCase()}
                    </Text>
                  </View>}
            </Pressable>
          </View>

          {/* Spotify Status Banner */}
          <Pressable
            onPress={() => { if (!spotifyConnected) router.push('/connect-spotify' as any); }}
            style={{
              marginTop: 20,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: spotifyConnected ? '#052e16' : '#1a1a2e',
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: spotifyConnected ? '#166534' : '#2d2d4e',
            }}
          >
            <Text style={{ fontSize: 20 }}>🎧</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: spotifyConnected ? '#4ade80' : '#a78bfa', fontWeight: '700', fontSize: 14 }}>
                {spotifyConnected ? 'Spotify Connected' : 'Connect Spotify'}
              </Text>
              <Text style={{ color: '#64748b', fontSize: 12, marginTop: 1 }}>
                {spotifyConnected ? 'Your playlists sync automatically' : 'Tap to link your Spotify account'}
              </Text>
            </View>
            {spotifyConnected
              ? <Text style={{ color: '#4ade80', fontSize: 18 }}>✓</Text>
              : <Text style={{ color: '#a78bfa', fontSize: 18 }}>→</Text>}
          </Pressable>
        </View>

        {/* Playlists Section */}
        <View style={{ paddingHorizontal: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>Your Playlists</Text>
            <Text style={{ color: '#64748b', fontSize: 13 }}>
              {hasPlaylists ? `${playlists.length} playlist${playlists.length !== 1 ? 's' : ''}` : ''}
            </Text>
          </View>

          {hasPlaylists ? (
            <View style={{ gap: 12 }}>
              {(playlists as any[]).map((playlist, index) => (
                <PlaylistCard
                  key={playlist._id}
                  playlist={playlist}
                  index={index}
                  onPress={() => router.push(`/playlists/${playlist._id}` as any)}
                />
              ))}
            </View>
          ) : (
            <View style={{
              alignItems: 'center',
              justifyContent: 'center',
              padding: 48,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: BORDER,
              borderStyle: 'dashed',
              gap: 8,
            }}>
              <Text style={{ fontSize: 40, marginBottom: 4 }}>🎼</Text>
              <Text style={{ color: '#e2e8f0', fontWeight: '700', fontSize: 16 }}>No playlists yet</Text>
              <Text style={{ color: '#475569', fontSize: 14, textAlign: 'center' }}>
                Create your first collaborative playlist below
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Action Buttons */}
      <View style={{
        position: 'absolute',
        bottom: 36,
        left: 24,
        right: 24,
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
      }}>
        {/* Join playlist button */}
        <Pressable
          onPress={() => router.push('/join' as any)}
          style={({ pressed }) => ({
            flex: 1,
            backgroundColor: pressed ? '#1e293b' : SURFACE,
            padding: 16,
            borderRadius: 16,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
            borderWidth: 1,
            borderColor: BORDER,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 6,
          })}
        >
          <Text style={{ fontSize: 18 }}>👥</Text>
          <Text style={{ color: '#e2e8f0', fontWeight: '700', fontSize: 15 }}>Join a playlist</Text>
        </Pressable>

        {/* Create playlist FAB */}
        <Pressable
          onPress={() => router.push('/playlists/new' as any)}
          style={({ pressed }) => ({
            backgroundColor: pressed ? ACCENT_DIM : ACCENT,
            width: 56,
            height: 56,
            borderRadius: 28,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: ACCENT,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.5,
            shadowRadius: 12,
            elevation: 8,
          })}
        >
          <Text style={{ color: '#020617', fontSize: 28, fontWeight: '300', lineHeight: 32 }}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const PLAYLIST_GRADIENTS = [
  ['#1a1a3e', '#2d1b69'],
  ['#1a2e1a', '#14532d'],
  ['#2e1a1a', '#7f1d1d'],
  ['#1a2a2e', '#164e63'],
  ['#2e2a1a', '#78350f'],
  ['#2a1a2e', '#581c87'],
];

function PlaylistCard({ playlist, index, onPress }: { playlist: any; index: number; onPress: () => void }) {
  const colors = PLAYLIST_GRADIENTS[index % PLAYLIST_GRADIENTS.length];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? '#1a2233' : SURFACE,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: BORDER,
        overflow: 'hidden',
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 14 }}>
        {/* Artwork placeholder with color accent */}
        <View style={{
          width: 56,
          height: 56,
          borderRadius: 12,
          backgroundColor: colors[0],
          borderWidth: 1,
          borderColor: colors[1],
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 24 }}>🎵</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ color: '#f1f5f9', fontWeight: '700', fontSize: 15 }} numberOfLines={1}>
            {playlist.name}
          </Text>
          <Text style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>
            {playlist.trackCount ?? 0} {playlist.trackCount === 1 ? 'track' : 'tracks'}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={{ color: '#334155', fontSize: 20 }}>›</Text>
        </View>
      </View>
    </Pressable>
  );
}

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
