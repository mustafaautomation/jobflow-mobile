import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { JobDetailView } from '@/features/job/JobViews';
import { useActor } from '@/features/data-hooks';

export default function JobRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const actor = useActor();
  const jobId = typeof id === 'string' ? id : '';
  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace(actor?.role === 'technician' ? '/today' : '/board');
  };
  return (
    <JobDetailView
      jobId={jobId}
      onBack={back}
      onOpen={(path) => router.push(`/job/${jobId}/${path}`)}
      onOpenUrl={(url) => void Linking.openURL(url)}
    />
  );
}
