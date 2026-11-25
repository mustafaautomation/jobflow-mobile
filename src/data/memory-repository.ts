import { JobflowError } from '@/domain/errors';
import { canDispatch } from '@/domain/permissions';
import type {
  Actor,
  AppNotification,
  Database,
  DispatchBoard,
  JobAction,
  JobDetail,
  JobSummary,
  MagicLink,
  MembershipSummary,
  PaymentInput,
  PhotoInput,
  RouteStop,
  SignatureInput,
  User,
} from '@/domain/types';
import {
  addNote,
  addPhoto,
  collectPayment,
  markInvoiced,
  markNotificationRead,
  reassignJob,
  registerPushToken,
  saveSignature,
  sendTestNotification,
  toggleChecklistItem,
  transitionJob,
} from '@/data/mutate';
import {
  actorFor,
  dispatchBoard,
  findUserByEmail,
  membershipsForUser,
  myJobsToday,
  myRoute,
  scheduleToday,
  toDetail,
} from '@/data/project';
import type { Repository } from '@/data/repository';

export interface MemoryRepositoryOptions {
  now?: () => Date;
  persist?: (db: Database) => void;
}

export class MemoryRepository implements Repository {
  readonly remote = false;
  private listeners = new Set<() => void>();

  constructor(
    private db: Database,
    private options: MemoryRepositoryOptions = {},
  ) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  snapshot(): Database {
    return this.db;
  }

  reset(next: Database): void {
    this.commit(next);
  }

  lookupUser(email: string): User | null {
    return findUserByEmail(this.db, email);
  }

  membershipsForUser(userId: string): MembershipSummary[] {
    return membershipsForUser(this.db, userId);
  }

  actorFor(userId: string, organizationId: string): Actor {
    return actorFor(this.db, userId, organizationId);
  }

  insertMagicLink(link: MagicLink): void {
    this.commit({ ...this.db, magicLinks: [...this.db.magicLinks, link] });
  }

  takeMagicLink(token: string): MagicLink | null {
    const link = this.db.magicLinks.find((item) => item.token === token) ?? null;
    if (!link) return null;
    this.commit({ ...this.db, magicLinks: this.db.magicLinks.filter((item) => item.token !== token) });
    return link;
  }

  async listMemberships(actor: Actor): Promise<MembershipSummary[]> {
    return membershipsForUser(this.db, actor.userId);
  }

  async listTodayJobs(actor: Actor): Promise<JobSummary[]> {
    return myJobsToday(this.db, actor, this.now());
  }

  async listMyRoute(actor: Actor): Promise<RouteStop[]> {
    return myRoute(this.db, actor, this.now());
  }

  async listSchedule(actor: Actor, query = ''): Promise<JobSummary[]> {
    this.assertDispatch(actor);
    return scheduleToday(this.db, actor, this.now(), query);
  }

  async listDispatchBoard(actor: Actor): Promise<DispatchBoard> {
    this.assertDispatch(actor);
    return dispatchBoard(this.db, actor, this.now());
  }

  async getJob(actor: Actor, jobId: string): Promise<JobDetail> {
    return toDetail(this.db, actor, jobId);
  }

  async transitionJob(actor: Actor, jobId: string, action: JobAction): Promise<JobDetail> {
    this.commit(transitionJob(this.db, actor, jobId, action, this.now()));
    return toDetail(this.db, actor, jobId);
  }

  async toggleChecklistItem(actor: Actor, jobId: string, itemId: string, completed: boolean): Promise<JobDetail> {
    this.commit(toggleChecklistItem(this.db, actor, jobId, itemId, completed, this.now()));
    return toDetail(this.db, actor, jobId);
  }

  async addNote(actor: Actor, jobId: string, body: string): Promise<JobDetail> {
    this.commit(addNote(this.db, actor, jobId, body, this.now()));
    return toDetail(this.db, actor, jobId);
  }

  async addPhoto(actor: Actor, jobId: string, input: PhotoInput): Promise<JobDetail> {
    this.commit(addPhoto(this.db, actor, jobId, input, this.now()));
    return toDetail(this.db, actor, jobId);
  }

  async saveSignature(actor: Actor, jobId: string, input: SignatureInput): Promise<JobDetail> {
    this.commit(saveSignature(this.db, actor, jobId, input, this.now()));
    return toDetail(this.db, actor, jobId);
  }

  async collectPayment(actor: Actor, jobId: string, input: PaymentInput): Promise<JobDetail> {
    this.commit(collectPayment(this.db, actor, jobId, input, this.now()));
    return toDetail(this.db, actor, jobId);
  }

  async markInvoiced(actor: Actor, jobId: string): Promise<JobDetail> {
    this.commit(markInvoiced(this.db, actor, jobId, this.now()));
    return toDetail(this.db, actor, jobId);
  }

  async reassignJob(actor: Actor, jobId: string, memberId: string): Promise<JobDetail> {
    this.commit(reassignJob(this.db, actor, jobId, memberId, this.now()));
    return toDetail(this.db, actor, jobId);
  }

  async listNotifications(actor: Actor): Promise<AppNotification[]> {
    return this.db.notifications
      .filter((item) => item.recipientUserId === actor.userId && item.organizationId === actor.organizationId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async markNotificationRead(actor: Actor, id: string): Promise<void> {
    this.commit(markNotificationRead(this.db, actor, id, this.now()));
  }

  async registerPushToken(actor: Actor, token: string, platform: string): Promise<void> {
    this.commit(registerPushToken(this.db, actor, token, platform, this.now()));
  }

  async sendTestNotification(actor: Actor): Promise<AppNotification> {
    this.commit(sendTestNotification(this.db, actor, this.now()));
    const created = this.db.notifications.find(
      (item) => item.recipientUserId === actor.userId && item.title === 'Jobflow test alert',
    );
    if (!created) throw new JobflowError('invalid', 'The test alert was not saved.');
    return created;
  }

  private assertDispatch(actor: Actor): void {
    if (!canDispatch(actor)) {
      throw new JobflowError('forbidden', 'The dispatch board is for dispatchers and owners.');
    }
  }

  private now(): Date {
    return this.options.now?.() ?? new Date();
  }

  private commit(next: Database): void {
    this.db = next;
    this.options.persist?.(next);
    for (const listener of this.listeners) listener();
  }
}
