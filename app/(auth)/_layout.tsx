import { useAuth } from '@clerk/expo';
import { Redirect, Stack } from 'expo-router';

export default function AuthRoutesLayout() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) return null;
  if (isSignedIn) return <Redirect href="/" />;

  return <Stack screenOptions={{ headerStyle: { backgroundColor: '#0f172a' }, headerTintColor: 'white', contentStyle: { backgroundColor: '#0f172a' } }} />;
}
