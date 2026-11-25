import { Redirect, useRouter } from 'expo-router';
import { WelcomeView } from '@/features/auth/AuthViews';
import { useAppState } from '@/controller/provider';

export default function WelcomeRoute() {
  const router = useRouter();
  const { snapshot } = useAppState();
  if (snapshot.ready && snapshot.actor) return <Redirect href="/" />;
  return <WelcomeView onSignedIn={() => router.replace('/')} onSignIn={() => router.push('/sign-in')} />;
}
