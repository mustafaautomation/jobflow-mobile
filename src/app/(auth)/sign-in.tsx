import { useRouter } from 'expo-router';
import { SignInView } from '@/features/auth/AuthViews';

export default function SignInRoute() {
  const router = useRouter();
  return <SignInView onBack={() => router.back()} onSent={() => router.push('/check-email')} />;
}
