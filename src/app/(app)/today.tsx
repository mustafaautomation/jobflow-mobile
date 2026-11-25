import { useRouter } from 'expo-router';
import { TodayView } from '@/features/today/TodayView';

export default function TodayRoute() {
  const router = useRouter();
  return <TodayView onOpenJob={(id) => router.push(`/job/${id}`)} />;
}
