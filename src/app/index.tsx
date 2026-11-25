import { Redirect } from 'expo-router';
import { useAppState } from '@/controller/provider';
import { LoadingState, Screen } from '@/ui/components';

export default function Index() {
  const { snapshot } = useAppState();
  if (!snapshot.ready) {
    return (
      <Screen>
        <LoadingState label="Opening Jobflow" />
      </Screen>
    );
  }
  if (!snapshot.actor) return <Redirect href="/welcome" />;
  if (snapshot.actor.role === 'technician') return <Redirect href="/today" />;
  return <Redirect href="/board" />;
}
