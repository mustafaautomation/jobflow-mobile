import { createId } from '@/domain/ids';
import { isNetworkError, JobflowError } from '@/domain/errors';
import { availableActions } from '@/domain/permissions';
import type {
  Actor,
  AppNotification,
  JobAction,
  JobDetail,
  JobStatus,
  JobSummary,
  PaymentInput,
  PhotoInput,
  SignatureInput,
} from '@/domain/types';
import type { Connectivity } from '@/data/connectivity';
import type { Repository } from '@/data/repository';
import type { KeyValue } from '@/storage/kv';

interface CacheEnvelope<T> {
  savedAt: string;
  data: T;
}

type OutboxOp =
  | { type: 'transition'; jobId: string; action: JobAction }
  | { type: 'checklist'; jobId: string; itemId: string; completed: boolean }
  | { type: 'note'; jobId: string; body: string }
  | { type: 'photo'; jobId: string; input: PhotoInput }
  | { type: 'signature'; jobId: string; input: SignatureInput }
  | { type: 'payment'; jobId: string; input: PaymentInput }
  | { type: 'invoice'; jobId: string }
  | { type: 'reassign'; jobId: string; memberId: string };

interface OutboxEntry {
  id: string;
  actor: Actor;
  op: OutboxOp;
}

const OUTBOX = 'jobflow.outbox.v1';

export class CachingRepository implements Repository {
  readonly remote = true;
  private listeners = new Set<() => void>();
  private flushing: Promise<void> | null = null;

  constructor(
    private readonly inner: Repository,
    private readonly storage: KeyValue,
    private readonly connectivity: Connectivity,
    private readonly now: () => Date = () => new Date(),
  ) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    const innerUnsub = this.inner.subscribe(listener);
    return () => {
      this.listeners.delete(listener);
      innerUnsub();
    };
  }

  async listMemberships(actor: Actor) {
    return this.readThrough(actor, 'memberships', () => this.inner.listMemberships(actor));
  }

  async listTodayJobs(actor: Actor) {
    return this.readThrough(actor, 'today', () => this.inner.listTodayJobs(actor));
  }

  async listMyRoute(actor: Actor) {
    return this.readThrough(actor, 'route', () => this.inner.listMyRoute(actor));
  }

  async listSchedule(actor: Actor, query = '') {
    return this.readThrough(actor, `schedule:${query.trim().toLowerCase()}`, () => this.inner.listSchedule(actor, query));
  }

  async listDispatchBoard(actor: Actor) {
    return this.readThrough(actor, 'board', () => this.inner.listDispatchBoard(actor));
  }

  async getJob(actor: Actor, jobId: string) {
    return this.readThrough(actor, jobKey(jobId), () => this.inner.getJob(actor, jobId));
  }

  async transitionJob(actor: Actor, jobId: string, action: JobAction) {
    return this.writeThrough(actor, { type: 'transition', jobId, action }, () => this.inner.transitionJob(actor, jobId, action));
  }

  async toggleChecklistItem(actor: Actor, jobId: string, itemId: string, completed: boolean) {
    return this.writeThrough(actor, { type: 'checklist', jobId, itemId, completed }, () =>
      this.inner.toggleChecklistItem(actor, jobId, itemId, completed),
    );
  }

  async addNote(actor: Actor, jobId: string, body: string) {
    return this.writeThrough(actor, { type: 'note', jobId, body }, () => this.inner.addNote(actor, jobId, body));
  }

  async addPhoto(actor: Actor, jobId: string, input: PhotoInput) {
    return this.writeThrough(actor, { type: 'photo', jobId, input }, () => this.inner.addPhoto(actor, jobId, input));
  }

  async saveSignature(actor: Actor, jobId: string, input: SignatureInput) {
    return this.writeThrough(actor, { type: 'signature', jobId, input }, () =>
      this.inner.saveSignature(actor, jobId, input),
    );
  }

  async collectPayment(actor: Actor, jobId: string, input: PaymentInput) {
    return this.writeThrough(actor, { type: 'payment', jobId, input }, () =>
      this.inner.collectPayment(actor, jobId, input),
    );
  }

  async markInvoiced(actor: Actor, jobId: string) {
    return this.writeThrough(actor, { type: 'invoice', jobId }, () => this.inner.markInvoiced(actor, jobId));
  }

  async reassignJob(actor: Actor, jobId: string, memberId: string) {
    return this.writeThrough(actor, { type: 'reassign', jobId, memberId }, () =>
      this.inner.reassignJob(actor, jobId, memberId),
    );
  }

  async listNotifications(actor: Actor) {
    return this.readThrough(actor, 'notifications', () => this.inner.listNotifications(actor));
  }

  async markNotificationRead(actor: Actor, id: string) {
    if (!(await this.connectivity.isOnline())) {
      const cached = await this.readCache<AppNotification[]>(actor, 'notifications').catch(() => []);
      await this.writeCache(
        actor,
        'notifications',
        cached.map((item) => (item.id === id ? { ...item, readAt: item.readAt ?? this.now().toISOString() } : item)),
      );
      return;
    }
    await this.inner.markNotificationRead(actor, id);
  }

  async registerPushToken(actor: Actor, token: string, platform: string) {
    if (await this.connectivity.isOnline()) await this.inner.registerPushToken(actor, token, platform);
  }

  async sendTestNotification(actor: Actor) {
    return this.inner.sendTestNotification(actor);
  }

  async pendingCount(): Promise<number> {
    return (await this.readOutbox()).length;
  }

  private async readThrough<T>(actor: Actor, name: string, load: () => Promise<T>): Promise<T> {
    await this.flush();
    if (!(await this.connectivity.isOnline())) return this.readCache<T>(actor, name);
    try {
      const data = await load();
      await this.writeCache(actor, name, data);
      return data;
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      return this.readCache<T>(actor, name);
    }
  }

  private async writeThrough(actor: Actor, op: OutboxOp, send: () => Promise<JobDetail>): Promise<JobDetail> {
    if (!(await this.connectivity.isOnline())) {
      const detail = await this.applyOptimistic(actor, op);
      await this.enqueue({ id: createId('out'), actor, op });
      this.emit();
      return detail;
    }
    await this.flush();
    try {
      const detail = await send();
      await this.writeCache(actor, jobKey(detail.id), detail);
      return detail;
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      const detail = await this.applyOptimistic(actor, op);
      await this.enqueue({ id: createId('out'), actor, op });
      this.emit();
      return detail;
    }
  }

  private async flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    this.flushing = this.flushNow().finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private async flushNow(): Promise<void> {
    if (!(await this.connectivity.isOnline())) return;
    const entries = await this.readOutbox();
    const remaining: OutboxEntry[] = [];
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      if (!entry) continue;
      try {
        await this.replay(entry);
      } catch (error) {
        if (isNetworkError(error)) {
          remaining.push(...entries.slice(index));
          break;
        }
      }
    }
    await this.storage.setItem(OUTBOX, JSON.stringify(remaining));
  }

  private async replay(entry: OutboxEntry): Promise<void> {
    const { actor, op } = entry;
    switch (op.type) {
      case 'transition':
        await this.inner.transitionJob(actor, op.jobId, op.action);
        return;
      case 'checklist':
        await this.inner.toggleChecklistItem(actor, op.jobId, op.itemId, op.completed);
        return;
      case 'note':
        await this.inner.addNote(actor, op.jobId, op.body);
        return;
      case 'photo':
        await this.inner.addPhoto(actor, op.jobId, op.input);
        return;
      case 'signature':
        await this.inner.saveSignature(actor, op.jobId, op.input);
        return;
      case 'payment':
        await this.inner.collectPayment(actor, op.jobId, op.input);
        return;
      case 'invoice':
        await this.inner.markInvoiced(actor, op.jobId);
        return;
      case 'reassign':
        await this.inner.reassignJob(actor, op.jobId, op.memberId);
        return;
    }
  }

  private async applyOptimistic(actor: Actor, op: OutboxOp): Promise<JobDetail> {
    const jobId = 'jobId' in op ? op.jobId : '';
    const current = await this.readCache<JobDetail>(actor, jobKey(jobId));
    const iso = this.now().toISOString();
    let next = current;
    if (op.type === 'transition') {
      if (!availableActions(current.status).includes(op.action)) {
        throw new JobflowError('conflict', 'That update does not match the saved job.');
      }
      next = applyStatus(current, op.action, iso);
    } else if (op.type === 'checklist') {
      next = {
        ...current,
        checklist: current.checklist.map((item) =>
          item.id === op.itemId ? { ...item, completed: op.completed, completedAt: op.completed ? iso : null } : item,
        ),
      };
    } else if (op.type === 'note') {
      next = {
        ...current,
        notes: [
          ...current.notes,
          {
            id: createId('note'),
            organizationId: actor.organizationId,
            jobId: current.id,
            authorMemberId: actor.memberId,
            body: op.body.trim(),
            createdAt: iso,
            authorName: actor.fullName,
          },
        ],
      };
    } else if (op.type === 'photo') {
      next = {
        ...current,
        photos: [
          ...current.photos,
          {
            id: createId('photo'),
            organizationId: actor.organizationId,
            jobId: current.id,
            authorMemberId: actor.memberId,
            uri: op.input.uri,
            caption: op.input.caption?.trim() || 'Site photo',
            createdAt: iso,
          },
        ],
      };
    } else if (op.type === 'signature') {
      next = {
        ...current,
        signature: {
          id: current.signature?.id ?? createId('sig'),
          organizationId: actor.organizationId,
          jobId: current.id,
          signerName: op.input.signerName.trim(),
          strokes: op.input.strokes,
          signedAt: iso,
        },
      };
    } else if (op.type === 'payment') {
      next = {
        ...current,
        invoiceStatus: 'paid',
        payments: [
          ...current.payments,
          {
            id: createId('pay'),
            organizationId: actor.organizationId,
            jobId: current.id,
            amountCents: op.input.amountCents,
            method: op.input.method,
            status: 'succeeded',
            stripePaymentIntentId: op.input.method === 'card' ? 'pi_demo_offline' : null,
            createdAt: iso,
          },
        ],
      };
    } else if (op.type === 'invoice') {
      next = { ...current, invoiceStatus: 'invoiced' };
    } else if (op.type === 'reassign') {
      next = { ...current, assignedMemberId: op.memberId, status: current.status === 'completed' ? current.status : 'scheduled' };
    }
    await this.writeCache(actor, jobKey(next.id), next);
    await this.patchList(actor, 'today', next);
    await this.patchList(actor, 'route', next);
    return next;
  }

  private async patchList(actor: Actor, name: string, detail: JobDetail): Promise<void> {
    try {
      const list = await this.readCache<JobSummary[]>(actor, name);
      await this.writeCache(
        actor,
        name,
        list.map((job) => (job.id === detail.id ? { ...job, ...detail } : job)),
      );
    } catch {
      // The list was never opened on this device.
    }
  }

  private async readCache<T>(actor: Actor, name: string): Promise<T> {
    const raw = await this.storage.getItem(this.cacheKey(actor, name));
    if (!raw) {
      throw new JobflowError('network', 'You are offline, and this has not been saved on this device yet.');
    }
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    return parsed.data;
  }

  private async writeCache<T>(actor: Actor, name: string, data: T): Promise<void> {
    const envelope: CacheEnvelope<T> = { savedAt: this.now().toISOString(), data };
    await this.storage.setItem(this.cacheKey(actor, name), JSON.stringify(envelope));
  }

  private cacheKey(actor: Actor, name: string): string {
    return `jobflow.cache.v1:${actor.userId}:${actor.organizationId}:${name}`;
  }

  private async readOutbox(): Promise<OutboxEntry[]> {
    const raw = await this.storage.getItem(OUTBOX);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OutboxEntry[];
    return Array.isArray(parsed) ? parsed : [];
  }

  private async enqueue(entry: OutboxEntry): Promise<void> {
    const entries = await this.readOutbox();
    entries.push(entry);
    await this.storage.setItem(OUTBOX, JSON.stringify(entries));
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

function jobKey(jobId: string): string {
  return `job:${jobId}`;
}

function applyStatus(detail: JobDetail, action: JobAction, iso: string): JobDetail {
  const next: JobDetail = { ...detail };
  if (action === 'start_travel') {
    next.status = 'en_route';
    next.travelStartedAt = iso;
  } else if (action === 'start') {
    next.status = 'in_progress';
    next.startedAt = iso;
  } else if (action === 'pause') {
    next.status = 'paused';
    next.pausedAt = iso;
  } else if (action === 'resume') {
    next.status = 'in_progress' satisfies JobStatus;
    next.pausedAt = null;
  } else if (action === 'complete') {
    next.status = 'completed';
    next.completedAt = iso;
    next.pausedAt = null;
  }
  return next;
}
