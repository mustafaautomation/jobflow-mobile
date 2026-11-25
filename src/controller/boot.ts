import { readSupabaseConfig, stripeConfigured } from '@/data/keys';
import { ConnectivityMonitor } from '@/data/connectivity';
import { asyncStorageKv } from '@/storage/kv';
import type { AppController } from '@/controller/types';

export async function bootDefault(): Promise<AppController> {
  const connectivity = new ConnectivityMonitor();
  void connectivity.attachNative();
  const config = readSupabaseConfig();
  if (!config) {
    const { bootMock } = await import('@/controller/memory-controller');
    return bootMock(asyncStorageKv(), connectivity, stripeConfigured());
  }
  const { bootSupabase } = await import('@/controller/supabase-controller');
  const Linking = await import('expo-linking');
  return bootSupabase({
    url: config.url,
    anonKey: config.anonKey,
    storage: asyncStorageKv(),
    connectivity,
    redirectTo: Linking.createURL('/auth/callback'),
    stripeConfigured: stripeConfigured(),
  });
}
