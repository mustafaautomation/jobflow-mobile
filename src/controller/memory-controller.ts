import type { Connectivity } from '@/data/connectivity';
import { MemoryRepository } from '@/data/memory-repository';
import { buildSeed, parseDatabase } from '@/data/seed';
import { JobflowError, errorMessage } from '@/domain/errors';
import { createId } from '@/domain/ids';
import type { Actor, DemoPersona } from '@/domain/types';
import { parseIncomingUrl, type IncomingLink } from '@/linking/parse';
import type { KeyValue } from '@/storage/kv';
import type { AppController, AppSnapshot, PendingMagicLink } from '@/controller/types';

const DB_KEY = 'jobflow.db.v1';
const SESSION_KEY = 'jobflow.session.v1';
const PENDING_KEY = 'jobflow.pending.v1';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PERSONAS: Record<DemoPersona, { email: string; organizationId: string }> = {
  alex: { email: 'alex.rivera@harborpine.demo', organizationId: 'org_harbor' },
  jordan: { email: 'jordan.hale@harborpine.demo', organizationId: 'org_harbor' },
};

export class MemoryController implements AppController {
  readonly mode = 'mock' as const;
  readonly repository: MemoryRepository;
  private listeners = new Set<() => void>();
  private actor: Actor | null;
  private pending: PendingMagicLink | null;
  private offline = false;
  private authError: string | null = null;

  constructor(
    repository: MemoryRepository,
    private readonly storage: KeyValue,
    private readonly stripe: boolean,
    actor: Actor | null,
    pending: PendingMagicLink | null,
  ) {
    this.repository = repository;
    this.actor = actor;
    this.pending = pending;
  }

  get stripeConfigured(): boolean {
    return this.stripe;
  }

  getSnapshot(): AppSnapshot {
    return {
      ready: true,
      actor: this.actor,
      pendingMagicLink: this.pending,
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

  async sendMagicLink(email: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    if (!EMAIL.test(normalized)) {
      throw new JobflowError('invalid', 'Enter a valid email address.');
    }
    const token = createId('ml');
    this.repository.insertMagicLink({ token, email: normalized, createdAt: new Date().toISOString() });
    this.pending = { email: normalized, devToken: token };
    this.authError = null;
    await this.storage.setItem(PENDING_KEY, JSON.stringify(this.pending));
    this.emit();
  }

  async consumeMagicLink(token: string): Promise<void> {
    const link = this.repository.takeMagicLink(token);
    if (!link) throw new JobflowError('auth', 'That sign-in link is invalid or already used.');
    const user = this.repository.lookupUser(link.email);
    const memberships = user ? this.repository.membershipsForUser(user.id) : [];
    if (!user || memberships.length === 0) {
      this.pending = null;
      await this.storage.removeItem(PENDING_KEY);
      this.authError = 'No Jobflow workspace for this email.';
      this.emit();
      throw new JobflowError('auth', 'No Jobflow workspace for this email.');
    }
    const home = memberships.find((item) => item.organizationId === 'org_harbor') ?? memberships[0];
    if (!home) throw new JobflowError('auth', 'No Jobflow workspace for this email.');
    this.actor = this.repository.actorFor(user.id, home.organizationId);
    this.pending = null;
    this.authError = null;
    await this.persistSession();
    this.emit();
  }

  async completeAuthUrl(url: string): Promise<IncomingLink> {
    const parsed = parseIncomingUrl(url);
    if (parsed.type === 'magic') await this.consumeMagicLink(parsed.token);
    if (parsed.type === 'code' || parsed.type === 'session') {
      throw new JobflowError('auth', 'This demo build opens the magic link shown on the sign-in screen.');
    }
    return parsed;
  }

  async enterDemo(persona: DemoPersona): Promise<void> {
    const choice = PERSONAS[persona];
    const user = this.repository.lookupUser(choice.email);
    if (!user) throw new JobflowError('auth', 'The demo workspace is missing.');
    this.actor = this.repository.actorFor(user.id, choice.organizationId);
    this.pending = null;
    this.authError = null;
    await this.persistSession();
    this.emit();
  }

  async switchOrganization(organizationId: string): Promise<void> {
    if (!this.actor) throw new JobflowError('auth', 'Sign in before switching workspaces.');
    this.actor = this.repository.actorFor(this.actor.userId, organizationId);
    await this.persistSession();
    this.emit();
  }

  async signOut(): Promise<void> {
    this.actor = null;
    this.pending = null;
    this.authError = null;
    await this.storage.removeItem(SESSION_KEY);
    await this.storage.removeItem(PENDING_KEY);
    this.emit();
  }

  async resetDemo(): Promise<void> {
    this.repository.reset(buildSeed(new Date()));
    if (this.actor) {
      try {
        this.actor = this.repository.actorFor(this.actor.userId, this.actor.organizationId);
      } catch (error) {
        this.authError = errorMessage(error);
        this.actor = null;
      }
    }
    this.emit();
  }

  private async persistSession(): Promise<void> {
    if (!this.actor) {
      await this.storage.removeItem(SESSION_KEY);
    } else {
      await this.storage.setItem(
        SESSION_KEY,
        JSON.stringify({ userId: this.actor.userId, organizationId: this.actor.organizationId }),
      );
    }
    await this.storage.removeItem(PENDING_KEY);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

export async function bootMock(
  storage: KeyValue,
  connectivity: Connectivity,
  stripe = false,
): Promise<MemoryController> {
  const db = parseDatabase(await storage.getItem(DB_KEY), new Date());
  const repository = new MemoryRepository(db, {
    persist: (next) => {
      void storage.setItem(DB_KEY, JSON.stringify(next));
    },
  });
  let actor: Actor | null = null;
  const sessionRaw = await storage.getItem(SESSION_KEY);
  if (sessionRaw) {
    try {
      const session = JSON.parse(sessionRaw) as { userId: string; organizationId: string };
      actor = repository.actorFor(session.userId, session.organizationId);
    } catch {
      actor = null;
    }
  }
  let pending: PendingMagicLink | null = null;
  const pendingRaw = await storage.getItem(PENDING_KEY);
  if (pendingRaw) {
    try {
      pending = JSON.parse(pendingRaw) as PendingMagicLink;
    } catch {
      pending = null;
    }
  }
  const controller = new MemoryController(repository, storage, stripe, actor, pending);
  const online = await connectivity.isOnline();
  controller.setOffline(!online);
  connectivity.subscribe((next) => controller.setOffline(!next));
  return controller;
}
