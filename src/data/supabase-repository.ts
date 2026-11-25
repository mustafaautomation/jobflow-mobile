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
  membershipsForUser,
  myJobsToday,
  myRoute,
  scheduleToday,
  toDetail,
} from '@/data/project';
import type { Repository } from '@/data/repository';
import { databaseFromGatewayRows, jobToRow, stable, type DataGateway, type Row } from '@/data/rows';
import type {
  Actor,
  AppNotification,
  ChecklistItem,
  Database,
  DispatchBoard,
  JobAction,
  JobDetail,
  JobNote,
  JobPhoto,
  JobSignature,
  JobSummary,
  MembershipSummary,
  Payment,
  PaymentInput,
  PhotoInput,
  RouteStop,
  SignatureInput,
} from '@/domain/types';

/**
 * Talks to the same Postgres schema as the Jobflow web app.
 * Every read is still filtered to the signed-in organization. RLS is the backstop;
 * this client never uses a service-role key.
 */
export class SupabaseRepository implements Repository {
  readonly remote = true;
  private listeners = new Set<() => void>();

  constructor(
    private readonly gateway: DataGateway,
    private readonly now: () => Date = () => new Date(),
  ) {}

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async listMemberships(actor: Actor): Promise<MembershipSummary[]> {
    const db = await this.read(actor);
    return membershipsForUser(db, actor.userId);
  }

  async listTodayJobs(actor: Actor): Promise<JobSummary[]> {
    return myJobsToday(await this.read(actor), actor, this.now());
  }

  async listMyRoute(actor: Actor): Promise<RouteStop[]> {
    return myRoute(await this.read(actor), actor, this.now());
  }

  async listSchedule(actor: Actor, query = ''): Promise<JobSummary[]> {
    return scheduleToday(await this.read(actor), actor, this.now(), query);
  }

  async listDispatchBoard(actor: Actor): Promise<DispatchBoard> {
    return dispatchBoard(await this.read(actor), actor, this.now());
  }

  async getJob(actor: Actor, jobId: string): Promise<JobDetail> {
    return toDetail(await this.read(actor), actor, jobId);
  }

  async transitionJob(actor: Actor, jobId: string, action: JobAction): Promise<JobDetail> {
    return this.change(actor, jobId, (db) => transitionJob(db, actor, jobId, action, this.now()));
  }

  async toggleChecklistItem(actor: Actor, jobId: string, itemId: string, completed: boolean): Promise<JobDetail> {
    return this.change(actor, jobId, (db) => toggleChecklistItem(db, actor, jobId, itemId, completed, this.now()));
  }

  async addNote(actor: Actor, jobId: string, body: string): Promise<JobDetail> {
    return this.change(actor, jobId, (db) => addNote(db, actor, jobId, body, this.now()));
  }

  async addPhoto(actor: Actor, jobId: string, input: PhotoInput): Promise<JobDetail> {
    return this.change(actor, jobId, (db) => addPhoto(db, actor, jobId, input, this.now()));
  }

  async saveSignature(actor: Actor, jobId: string, input: SignatureInput): Promise<JobDetail> {
    return this.change(actor, jobId, (db) => saveSignature(db, actor, jobId, input, this.now()));
  }

  async collectPayment(actor: Actor, jobId: string, input: PaymentInput): Promise<JobDetail> {
    return this.change(actor, jobId, (db) => collectPayment(db, actor, jobId, input, this.now()));
  }

  async markInvoiced(actor: Actor, jobId: string): Promise<JobDetail> {
    return this.change(actor, jobId, (db) => markInvoiced(db, actor, jobId, this.now()));
  }

  async reassignJob(actor: Actor, jobId: string, memberId: string): Promise<JobDetail> {
    return this.change(actor, jobId, (db) => reassignJob(db, actor, jobId, memberId, this.now()));
  }

  async listNotifications(actor: Actor): Promise<AppNotification[]> {
    const db = await this.read(actor);
    return db.notifications
      .filter((item) => item.recipientUserId === actor.userId && item.organizationId === actor.organizationId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async markNotificationRead(actor: Actor, id: string): Promise<void> {
    await this.apply(actor, (db) => markNotificationRead(db, actor, id, this.now()));
  }

  async registerPushToken(actor: Actor, token: string, platform: string): Promise<void> {
    await this.apply(actor, (db) => registerPushToken(db, actor, token, platform, this.now()));
  }

  async sendTestNotification(actor: Actor): Promise<AppNotification> {
    const after = await this.apply(actor, (db) => sendTestNotification(db, actor, this.now()));
    const created = after.notifications.find(
      (item) => item.title === 'Jobflow test alert' && item.recipientUserId === actor.userId,
    );
    if (!created) throw new Error('The test alert was not saved.');
    return created;
  }

  private async change(actor: Actor, jobId: string, mutate: (db: Database) => Database): Promise<JobDetail> {
    const after = await this.apply(actor, mutate);
    return toDetail(after, actor, jobId);
  }

  private async apply(actor: Actor, mutate: (db: Database) => Database): Promise<Database> {
    const before = await this.read(actor);
    const after = mutate(before);
    await this.persist(before, after);
    this.emit();
    return after;
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  private async read(actor: Actor): Promise<Database> {
    const org = actor.organizationId;
    const filters = { organization_id: org };
    const [jobs, members, users, customers, locations, checklist, notes, photos, signatures, payments, notifications, pushTokens] =
      await Promise.all([
        this.gateway.select('jobs', { filters }),
        this.gateway.select('organization_members', { filters }),
        this.gateway.select('profiles'),
        this.gateway.select('customers', { filters }),
        this.gateway.select('service_locations', { filters }),
        this.gateway.select('checklist_items', { filters }),
        this.gateway.select('job_notes', { filters }),
        this.gateway.select('job_photos', { filters }),
        this.gateway.select('job_signatures', { filters }),
        this.gateway.select('payments', { filters }),
        this.gateway.select('notifications', { filters }),
        this.gateway.select('push_tokens'),
      ]);
    const db = databaseFromGatewayRows({
      organizationId: org,
      organizationName: actor.organizationName,
      jobs,
      members,
      users,
      customers,
      locations,
      checklist,
      notes,
      photos,
      signatures,
      payments,
      notifications,
      pushTokens,
    });
    // Touch actorFor so a swapped organization id cannot be papered over by a stale actor object.
    actorFor(db, actor.userId, actor.organizationId);
    return db;
  }

  private async persist(before: Database, after: Database): Promise<void> {
    await diffUpdate(this.gateway, 'jobs', before.jobs, after.jobs, jobToRow);
    await diffUpdate(this.gateway, 'organization_members', before.members, after.members, (member) => ({
      id: member.id,
      organization_id: member.organizationId,
      user_id: member.userId,
      role: member.role,
      status: member.status,
    }));
    await diffUpdate(this.gateway, 'checklist_items', before.checklistItems, after.checklistItems, (item: ChecklistItem) => ({
      id: item.id,
      organization_id: item.organizationId,
      job_id: item.jobId,
      label: item.label,
      required: item.required,
      completed: item.completed,
      position: item.position,
      completed_at: item.completedAt,
    }));
    await diffUpdate(this.gateway, 'job_notes', before.notes, after.notes, (note: JobNote) => ({
      id: note.id,
      organization_id: note.organizationId,
      job_id: note.jobId,
      author_member_id: note.authorMemberId,
      body: note.body,
      created_at: note.createdAt,
    }));
    await diffUpdate(this.gateway, 'job_photos', before.photos, after.photos, (photo: JobPhoto) => ({
      id: photo.id,
      organization_id: photo.organizationId,
      job_id: photo.jobId,
      author_member_id: photo.authorMemberId,
      uri: photo.uri,
      caption: photo.caption,
      created_at: photo.createdAt,
    }));
    await diffUpdate(this.gateway, 'job_signatures', before.signatures, after.signatures, (signature: JobSignature) => ({
      id: signature.id,
      organization_id: signature.organizationId,
      job_id: signature.jobId,
      signer_name: signature.signerName,
      strokes: signature.strokes,
      signed_at: signature.signedAt,
    }));
    await diffUpdate(this.gateway, 'payments', before.payments, after.payments, (payment: Payment) => ({
      id: payment.id,
      organization_id: payment.organizationId,
      job_id: payment.jobId,
      amount_cents: payment.amountCents,
      method: payment.method,
      status: payment.status,
      stripe_payment_intent_id: payment.stripePaymentIntentId,
      created_at: payment.createdAt,
    }));
    await diffUpdate(this.gateway, 'notifications', before.notifications, after.notifications, (note) => ({
      id: note.id,
      organization_id: note.organizationId,
      recipient_user_id: note.recipientUserId,
      title: note.title,
      body: note.body,
      job_id: note.jobId,
      read_at: note.readAt,
      created_at: note.createdAt,
    }));
    await diffUpdate(this.gateway, 'push_tokens', before.pushTokens, after.pushTokens, (token) => ({
      id: token.id,
      user_id: token.userId,
      token: token.token,
      platform: token.platform,
      created_at: token.createdAt,
    }));
  }
}

async function diffUpdate<T extends { id: string }>(
  gateway: DataGateway,
  table: string,
  before: T[],
  after: T[],
  toRow: (item: T) => Row,
): Promise<void> {
  const previous = new Map(before.map((item) => [item.id, item]));
  for (const item of after) {
    const prior = previous.get(item.id);
    const row = toRow(item);
    if (!prior) {
      await gateway.insert(table, row);
      continue;
    }
    if (stable(prior) !== stable(item)) {
      const { id: _id, ...patch } = row;
      await gateway.update(table, { id: item.id }, patch);
    }
  }
}
