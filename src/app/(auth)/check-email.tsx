import { useRouter } from 'expo-router';
import { CheckEmailView } from '@/features/auth/AuthViews';

export default function CheckEmailRoute() {
  const router = useRouter();
  return <CheckEmailView onSignedIn={() => router.replace('/')} onBack={() => router.replace('/sign-in')} />;
}
