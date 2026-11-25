import { useRouter } from 'expo-router';
import { ScheduleView } from '@/features/schedule/ScheduleView';

export default function ScheduleRoute() {
  const router = useRouter();
  return <ScheduleView onOpenJob={(id) => router.push(`/job/${id}`)} />;
}
