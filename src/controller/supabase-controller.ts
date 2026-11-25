import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { CachingRepository } from '@/data/cache';
import type { Connectivity } from '@/data/connectivity';
import { mapSupabaseError } from '@/data/supabase-gateway';
import { createSupabaseGateway, type SupabaseQueryClient } from '@/data/supabase-gateway';
import { SupabaseRepository } from '@/data/supabase-repository';
import { JobflowError } from '@/domain/errors';
import type { Actor, DemoPersona, Role } from '@/domain/types';
import { parseIncomingUrl, type IncomingLink } from '@/linking/parse';
import type { KeyValue } from '@/storage/kv';
import type { AppController, AppSnapshot } from '@/controller/types';

interface AuthUser {
  id: string;
  email?: string | null;
  user_metadata?: { full_name?: string };
}

interface MembershipRow {
  id: string;
  organization_id: string;
  role: Role;
  organizations: { name: string } | { name: string }[] | null;
}

const ORG_KEY = 'jobflow.org.v1';

export class SupabaseController implements AppController {
  readonly mode = 'supabase' as const;
  readonly repository: CachingRepository;
  private listeners = new Set<() => void>();
  private actor: Actor | null = null;
  private offline = false;
  private authError: string | null = null;
  private ready = false;

  constructor(
    private readonly supabase: SupabaseClient,
    repository: CachingRepository,
    private readonly storage: KeyValue,
    private readonly redirectTo: string,
    readonly stripeConfigured: boolean,
  ) {
    this.repository = repository;
  }

  getSnapshot(): AppSnapshot {
    return {
      ready: this.ready,
      actor: this.actor,
      pendingMagicLink: null,
      offline: this.offline,
      authError: this.authError,
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setOffline(offline: boolean): void {
    this.offline = offline;
    this.emit();
  }

  markReady(): void {
    this.ready = true;
    this.emit();
  }

  async sendMagicLink(email: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new JobflowError('invalid', 'Enter a valid email address.');
    }
    const { error } = await this.supabase.auth.signInWithOtp({
      email: normalized,
      options: { emailRedirectTo: this.redirectTo },
    });
    if (error) throw new JobflowError('auth', error.message);
    this.authError = null;
    this.emit();
  }

  async consumeMagicLink(_token: string): Promise<void> {
    throw new JobflowError('auth', 'Open the sign-in link from your email.');
  }

  async completeAuthUrl(url: string): Promise<IncomingLink> {
    const parsed = parseIncomingUrl(url);
    if (parsed.type === 'code') {
      const { error } = await this.supabase.auth.exchangeCodeForSession(parsed.code);
      if (error) throw new JobflowError('auth', error.message);
      await this.hydrate();
    } else if (parsed.type === 'session') {
      const { error } = await this.supabase.auth.setSession({
        access_token: parsed.accessToken,
        refresh_token: parsed.refreshToken,
      });
      if (error) throw new JobflowError('auth', error.message);
      await this.hydrate();
    } else if (parsed.type === 'magic') {
      throw new JobflowError('auth', 'Open the sign-in link from your email.');
    }
    return parsed;
  }

  async enterDemo(_persona: DemoPersona): Promise<void> {
    throw new JobflowError('invalid', 'Demo workspaces are available when Supabase is not configured.');
  }

  async switchOrganization(organizationId: string): Promise<void> {
    const user = await this.currentUser();
    if (!user) throw new JobflowError('auth', 'Sign in before switching workspaces.');
    await this.storage.setItem(ORG_KEY, organizationId);
    await this.loadActor(user, organizationId);
    this.emit();
  }

  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
    this.actor = null;
    this.authError = null;
    await this.storage.removeItem(ORG_KEY);
    this.emit();
  }

  async resetDemo(): Promise<void> {
    throw new JobflowError('invalid', 'Demo reset is only available in the offline demo.');
  }

  async hydrate(): Promise<void> {
    const { data } = await this.supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) {
      this.actor = null;
      this.ready = true;
      this.emit();
      return;
    }
    const preferred = await this.storage.getItem(ORG_KEY);
    await this.loadActor(user, preferred);
    this.ready = true;
    this.emit();
  }

  private async currentUser(): Promise<AuthUser | null> {
    const { data } = await this.supabase.auth.getUser();
    return data.user;
  }

  private async loadActor(user: AuthUser, preferredOrg: string | null): Promise<void> {
    const email = user.email ?? '';
    const fullName = user.user_metadata?.full_name?.trim() || email.split('@')[0] || 'Technician';
    const { error: profileError } = await this.supabase.from('profiles').upsert({
      id: user.id,
      email,
      full_name: fullName,
      phone: '',
    });
    if (profileError) throw mapSupabaseError(profileError);
    const { data, error } = await this.supabase
      .from('organization_members')
      .select('id, organization_id, role, organizations(name)')
      .eq('user_id', user.id);
    if (error) throw mapSupabaseError(error);
    const rows = (data ?? []) as unknown as MembershipRow[];
    if (rows.length === 0) {
      this.actor = null;
      this.authError = 'No Jobflow workspace for this email.';
      return;
    }
    const chosen = rows.find((row) => row.organization_id === preferredOrg) ?? rows[0];
    if (!chosen) return;
    const organization = Array.isArray(chosen.organizations) ? chosen.organizations[0] : chosen.organizations;
    this.actor = {
      userId: user.id,
      email,
      fullName,
      phone: '',
      organizationId: chosen.organization_id,
      organizationName: organization?.name ?? 'Workspace',
      memberId: chosen.id,
      role: chosen.role,
    };
    this.authError = null;
    await this.storage.setItem(ORG_KEY, chosen.organization_id);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

export async function bootSupabase(options: {
  url: string;
  anonKey: string;
  storage: KeyValue;
  connectivity: Connectivity;
  redirectTo: string;
  stripeConfigured: boolean;
}): Promise<SupabaseController> {
  const supabase = createClient(options.url, options.anonKey, {
    auth: {
      storage: options.storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  const repository = new CachingRepository(
    new SupabaseRepository(createSupabaseGateway(supabase as unknown as SupabaseQueryClient)),
    options.storage,
    options.connectivity,
  );
  const controller = new SupabaseController(
    supabase,
    repository,
    options.storage,
    options.redirectTo,
    options.stripeConfigured,
  );
  const online = await options.connectivity.isOnline();
  controller.setOffline(!online);
  options.connectivity.subscribe((next) => controller.setOffline(!next));
  await controller.hydrate();
  return controller;
}
