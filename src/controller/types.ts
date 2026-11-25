import type { IncomingLink } from '@/linking/parse';
import type { Repository } from '@/data/repository';
import type { Actor, DemoPersona } from '@/domain/types';

export interface PendingMagicLink {
  email: string;
  devToken: string | null;
}

export interface AppSnapshot {
  ready: boolean;
  actor: Actor | null;
  pendingMagicLink: PendingMagicLink | null;
  offline: boolean;
  authError: string | null;
}

export interface AppController {
  readonly mode: 'mock' | 'supabase';
  readonly stripeConfigured: boolean;
  getSnapshot(): AppSnapshot;
  subscribe(listener: () => void): () => void;
  sendMagicLink(email: string): Promise<void>;
  consumeMagicLink(token: string): Promise<void>;
  completeAuthUrl(url: string): Promise<IncomingLink>;
  enterDemo(persona: DemoPersona): Promise<void>;
  switchOrganization(organizationId: string): Promise<void>;
  signOut(): Promise<void>;
  resetDemo(): Promise<void>;
  repository: Repository;
}

export const signedOutSnapshot: AppSnapshot = {
  ready: false,
  actor: null,
  pendingMagicLink: null,
  offline: false,
  authError: null,
};
