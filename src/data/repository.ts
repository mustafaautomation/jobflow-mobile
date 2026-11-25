import type {
  Actor,
  AppNotification,
  DispatchBoard,
  JobAction,
  JobDetail,
  JobSummary,
  MembershipSummary,
  PaymentInput,
  PhotoInput,
  RouteStop,
  SignatureInput,
} from '@/domain/types';

export interface Repository {
  readonly remote: boolean;
  subscribe(listener: () => void): () => void;
  listMemberships(actor: Actor): Promise<MembershipSummary[]>;
  listTodayJobs(actor: Actor): Promise<JobSummary[]>;
  listMyRoute(actor: Actor): Promise<RouteStop[]>;
  listSchedule(actor: Actor, query?: string): Promise<JobSummary[]>;
  listDispatchBoard(actor: Actor): Promise<DispatchBoard>;
  getJob(actor: Actor, jobId: string): Promise<JobDetail>;
  transitionJob(actor: Actor, jobId: string, action: JobAction): Promise<JobDetail>;
  toggleChecklistItem(actor: Actor, jobId: string, itemId: string, completed: boolean): Promise<JobDetail>;
  addNote(actor: Actor, jobId: string, body: string): Promise<JobDetail>;
  addPhoto(actor: Actor, jobId: string, input: PhotoInput): Promise<JobDetail>;
  saveSignature(actor: Actor, jobId: string, input: SignatureInput): Promise<JobDetail>;
  collectPayment(actor: Actor, jobId: string, input: PaymentInput): Promise<JobDetail>;
  markInvoiced(actor: Actor, jobId: string): Promise<JobDetail>;
  reassignJob(actor: Actor, jobId: string, memberId: string): Promise<JobDetail>;
  listNotifications(actor: Actor): Promise<AppNotification[]>;
  markNotificationRead(actor: Actor, id: string): Promise<void>;
  registerPushToken(actor: Actor, token: string, platform: string): Promise<void>;
  sendTestNotification(actor: Actor): Promise<AppNotification>;
}
