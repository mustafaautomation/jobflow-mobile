import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { RouteView } from '@/features/route/RouteView';

export default function RouteScreen() {
  const router = useRouter();
  return <RouteView onOpenJob={(id) => router.push(`/job/${id}`)} onOpenUrl={(url) => void Linking.openURL(url)} />;
}
