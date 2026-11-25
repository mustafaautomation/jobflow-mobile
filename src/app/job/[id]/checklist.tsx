import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChecklistView } from '@/features/job/JobViews';

export default function ChecklistRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return <ChecklistView jobId={typeof id === 'string' ? id : ''} onBack={() => router.back()} />;
}
