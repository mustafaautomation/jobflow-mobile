import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { Fraunces_600SemiBold, useFonts } from '@expo-google-fonts/fraunces';
import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold } from '@expo-google-fonts/outfit';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useAppState } from '@/controller/provider';
import { ThemeProvider, useTheme } from '@/ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Fraunces_600SemiBold,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppProvider>
            <ThemedStatus />
            <DeepLinks />
            <Stack screenOptions={{ headerShown: false }} />
          </AppProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ThemedStatus() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}

function DeepLinks() {
  const router = useRouter();
  const { controller } = useAppState();

  useEffect(() => {
    if (!controller) return;
    let cancel = false;
    const handle = async (url: string) => {
      const parsed = await controller.completeAuthUrl(url);
      if (cancel) return;
      if (parsed.type === 'job') router.push(`/job/${parsed.jobId}`);
      if (parsed.type === 'magic' || parsed.type === 'code' || parsed.type === 'session') router.replace('/');
    };
    Linking.getInitialURL()
      .then((url) => {
        if (url && (url.includes('token=') || url.includes('code=') || url.includes('access_token='))) {
          void handle(url);
        }
      })
      .catch(() => {});
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (url.includes('token=') || url.includes('code=') || url.includes('access_token=')) void handle(url);
    });
    return () => {
      cancel = true;
      subscription.remove();
    };
  }, [controller, router]);

  return null;
}
