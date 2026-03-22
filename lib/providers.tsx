import { ReactNode } from 'react';
import { ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { View, Text } from 'react-native';
import { env } from './env';

const convex = env.convexUrl ? new ConvexReactClient(env.convexUrl) : null;

function MissingConfig() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#0b1020' }}>
      <Text style={{ color: 'white', fontSize: 18, fontWeight: '700', marginBottom: 10 }}>BeatSync MVP</Text>
      <Text style={{ color: '#cbd5e1', textAlign: 'center' }}>
        Add Clerk and Convex environment variables to use the live app. The UI scaffold is ready, but auth/data calls need real project keys.
      </Text>
    </View>
  );
}

function ProvidersInner({ children }: { children: ReactNode }) {
  if (!convex) return <MissingConfig />;
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  if (!env.clerkPublishableKey || !convex) {
    return <MissingConfig />;
  }

  return (
    <ClerkProvider publishableKey={env.clerkPublishableKey} tokenCache={tokenCache}>
      <ProvidersInner>{children}</ProvidersInner>
    </ClerkProvider>
  );
}
