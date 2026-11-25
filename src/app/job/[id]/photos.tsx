import { useLocalSearchParams, useRouter } from 'expo-router';
import { PhotosView } from '@/features/job/JobViews';

export default function PhotosRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return <PhotosView jobId={typeof id === 'string' ? id : ''} onBack={() => router.back()} />;
}
