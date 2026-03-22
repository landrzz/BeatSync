import 'react-native-url-polyfill/auto';
import { Stack } from 'expo-router';
import { AppProviders } from '@/lib/providers';

export default function RootLayout() {
  return (
    <AppProviders>
      <Stack screenOptions={{ headerStyle: { backgroundColor: '#0f172a' }, headerTintColor: 'white', contentStyle: { backgroundColor: '#0f172a' } }}>
        <Stack.Screen name="index" options={{ title: 'BeatSync' }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="playlists/[id]" options={{ title: 'Playlist' }} />
        <Stack.Screen name="invite/[id]" options={{ title: 'Invite collaborator' }} />
        <Stack.Screen name="connect-spotify" options={{ title: 'Connect Spotify' }} />
      </Stack>
    </AppProviders>
  );
}
