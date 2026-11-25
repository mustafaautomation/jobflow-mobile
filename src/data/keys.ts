import { JobflowError } from '@/domain/errors';

function decodeBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  if (typeof globalThis.atob !== 'function') {
    throw new JobflowError('auth', 'This Supabase key could not be read.');
  }
  return globalThis.atob(padded);
}

/** Rejects secret and service-role keys before a client is created. Publishable and anon keys pass. */
export function assertPublishableKey(key: string): void {
  const trimmed = key.trim();
  if (!trimmed) {
    throw new JobflowError('auth', 'The Supabase anon key is empty.');
  }
  if (trimmed.startsWith('sb_secret') || trimmed.startsWith('sb_service')) {
    throw new JobflowError(
      'auth',
      'This build was given a secret Supabase key. Use the anon or publishable key.',
    );
  }
  const parts = trimmed.split('.');
  if (parts.length < 3) return;
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1] ?? '')) as { role?: string };
    if (payload.role === 'service_role') {
      throw new JobflowError(
        'auth',
        'This build was given a service-role key. Use the anon or publishable key.',
      );
    }
  } catch (error) {
    if (error instanceof JobflowError) throw error;
  }
}

export function readSupabaseConfig(env: Record<string, string | undefined> = process.env): {
  url: string;
  anonKey: string;
} | null {
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';
  if (!url || !anonKey) return null;
  assertPublishableKey(anonKey);
  return { url, anonKey };
}

export function stripeConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim());
}
