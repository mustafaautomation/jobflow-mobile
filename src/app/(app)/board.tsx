import { useRouter } from 'expo-router';
import { BoardView } from '@/features/board/BoardView';

export default function BoardRoute() {
  const router = useRouter();
  return <BoardView onOpenJob={(id) => router.push(`/job/${id}`)} />;
}
