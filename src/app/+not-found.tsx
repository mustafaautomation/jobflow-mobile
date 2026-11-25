import { useRouter } from 'expo-router';
import { Button, Screen, Title, Muted } from '@/ui/components';

export default function NotFound() {
  const router = useRouter();
  return (
    <Screen testID="not-found">
      <Title>That screen is not on the route.</Title>
      <Muted>The link may be old. Head back to today’s work.</Muted>
      <Button label="Go to Jobflow" onPress={() => router.replace('/')} testID="not-found-home" />
    </Screen>
  );
}
