import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppState } from '@/controller/provider';
import { errorMessage } from '@/domain/errors';
import { Button, Muted, Screen, Title } from '@/ui/components';

export default function CallbackRoute() {
  const params = useLocalSearchParams<{ token?: string; code?: string }>();
  const router = useRouter();
  const { controller } = useAppState();
  const [message, setMessage] = useState('Signing you in…');
  const token = typeof params.token === 'string' ? params.token : '';
  const code = typeof params.code === 'string' ? params.code : '';
  const href = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : '';
  const target = token
    ? `jobflow://auth/callback?token=${encodeURIComponent(token)}`
    : code
      ? `https://jobflow-app.quvantic.com/auth/callback?code=${encodeURIComponent(code)}`
      : href;

  useEffect(() => {
    if (!controller || !target) return;
    let cancel = false;
    controller
      .completeAuthUrl(target)
      .then((parsed) => {
        if (cancel) return;
        if (parsed.type === 'ignore') {
          setMessage('This sign-in link is missing a token.');
          return;
        }
        router.replace('/');
      })
      .catch((error: unknown) => {
        if (!cancel) setMessage(errorMessage(error));
      });
    return () => {
      cancel = true;
    };
  }, [controller, target, router]);

  return (
    <Screen testID="auth-callback">
      <Title>Jobflow</Title>
      <Muted>{target ? message : 'This sign-in link is missing a token.'}</Muted>
      <Button label="Back to sign in" onPress={() => router.replace('/welcome')} testID="callback-back" />
    </Screen>
  );
}
