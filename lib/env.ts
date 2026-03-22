import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

export const env = {
  clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? extra.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
  convexUrl: process.env.EXPO_PUBLIC_CONVEX_URL ?? extra.EXPO_PUBLIC_CONVEX_URL,
  spotifyClientId: process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? extra.EXPO_PUBLIC_SPOTIFY_CLIENT_ID,
  spotifyRedirectUri: process.env.EXPO_PUBLIC_SPOTIFY_REDIRECT_URI ?? extra.EXPO_PUBLIC_SPOTIFY_REDIRECT_URI,
};

export const appConfigWarnings = [
  !env.convexUrl ? 'Missing EXPO_PUBLIC_CONVEX_URL' : null,
  !env.clerkPublishableKey ? 'Missing EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY' : null,
  !env.spotifyClientId ? 'Missing EXPO_PUBLIC_SPOTIFY_CLIENT_ID' : null,
].filter(Boolean) as string[];
