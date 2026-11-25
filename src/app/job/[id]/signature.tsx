import { useLocalSearchParams, useRouter } from 'expo-router';
import { SignatureView } from '@/features/job/JobViews';

export default function SignatureRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return <SignatureView jobId={typeof id === 'string' ? id : ''} onBack={() => router.back()} />;
}
