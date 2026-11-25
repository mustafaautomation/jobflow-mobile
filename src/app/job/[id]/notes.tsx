import { useLocalSearchParams, useRouter } from 'expo-router';
import { NotesView } from '@/features/job/JobViews';

export default function NotesRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return <NotesView jobId={typeof id === 'string' ? id : ''} onBack={() => router.back()} />;
}
