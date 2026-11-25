import { useLocalSearchParams, useRouter } from 'expo-router';
import { PaymentView } from '@/features/job/JobViews';

export default function PaymentRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return <PaymentView jobId={typeof id === 'string' ? id : ''} onBack={() => router.back()} />;
}
