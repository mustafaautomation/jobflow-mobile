import { isSameLocalDay } from '@/data/clock';
import { JobflowError } from '@/domain/errors';
import { distanceMiles } from '@/domain/geo';
import { canDispatch } from '@/domain/permissions';
import type {
  Actor,
  Database,
  DispatchBoard,
  Job,
  JobDetail,
  JobSummary,
  MembershipSummary,
  RouteStop,
  TechnicianCard,
  User,
} from '@/domain/types';

export function findUserByEmail(db: Database, email: string): User | null {
  const normalized = email.trim().toLowerCase();
  return db.users.find((user) => user.email.toLowerCase() === normalized) ?? null;
}

export function membershipsForUser(db: Database, userId: string): MembershipSummary[] {
  return db.members
    .filter((member) => member.userId === userId)
    .map((member) => {
      const organization = db.organizations.find((org) => org.id === member.organizationId);
      return {
        organizationId: member.organizationId,
        organizationName: organization?.name ?? 'Workspace',
        organizationCity: organization ? `${organization.city}, ${organization.region}` : '',
        role: member.role,
        memberId: member.id,
      };
    });
}

export function actorFor(db: Database, userId: string, organizationId: string): Actor {
  const user = db.users.find((item) => item.id === userId);
  const member = db.members.find((item) => item.userId === userId && item.organizationId === organizationId);
  const organization = db.organizations.find((item) => item.id === organizationId);
  if (!user || !member || !organization) {
    throw new JobflowError('not_found', 'You are not a member of that workspace.');
  }
  return {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    organizationId: organization.id,
    organizationName: organization.name,
    memberId: member.id,
    role: member.role,
  };
}

export function requireJob(db: Database, actor: Actor, jobId: string): Job {
  const job = db.jobs.find((item) => item.id === jobId && item.organizationId === actor.organizationId);
  if (!job) throw new JobflowError('not_found', 'That job is not in this workspace.');
  return job;
}

export function toSummary(db: Database, job: Job): JobSummary {
  const customer = db.customers.find((item) => item.id === job.customerId);
  const location = db.locations.find((item) => item.id === job.locationId);
  const member = job.assignedMemberId
    ? db.members.find((item) => item.id === job.assignedMemberId)
    : undefined;
  const assignee = member ? db.users.find((item) => item.id === member.userId) : undefined;
  return {
    id: job.id,
    title: job.title,
    summary: job.summary,
    service: job.service,
    priority: job.priority,
    status: job.status,
    scheduledStart: job.scheduledStart,
    scheduledEnd: job.scheduledEnd,
    routePosition: job.routePosition,
    amountCents: job.amountCents,
    currency: job.currency,
    invoiceStatus: job.invoiceStatus,
    customerName: customer?.name ?? 'Customer',
    customerPhone: customer?.phone ?? '',
    addressLine: location?.line1 ?? '',
    locality: location ? `${location.city}, ${location.region} ${location.postalCode}` : '',
    assignedMemberId: job.assignedMemberId,
    assigneeName: assignee?.fullName ?? null,
  };
}

export function toDetail(db: Database, actor: Actor, jobId: string): JobDetail {
  const job = requireJob(db, actor, jobId);
  const summary = toSummary(db, job);
  const customer = db.customers.find((item) => item.id === job.customerId);
  const location = db.locations.find((item) => item.id === job.locationId);
  return {
    ...summary,
    customerEmail: customer?.email ?? '',
    locationLabel: location?.label ?? 'Site',
    line1: location?.line1 ?? '',
    region: location?.region ?? '',
    postalCode: location?.postalCode ?? '',
    lat: location?.lat ?? 0,
    lng: location?.lng ?? 0,
    checklist: db.checklistItems
      .filter((item) => item.jobId === job.id)
      .sort((a, b) => a.position - b.position),
    notes: db.notes
      .filter((item) => item.jobId === job.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((note) => {
        const authorMember = db.members.find((item) => item.id === note.authorMemberId);
        const author = authorMember ? db.users.find((item) => item.id === authorMember.userId) : undefined;
        return { ...note, authorName: author?.fullName ?? 'Teammate' };
      }),
    photos: db.photos
      .filter((item) => item.jobId === job.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    signature: db.signatures.find((item) => item.jobId === job.id) ?? null,
    payments: db.payments
      .filter((item) => item.jobId === job.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    travelStartedAt: job.travelStartedAt,
    startedAt: job.startedAt,
    pausedAt: job.pausedAt,
    completedAt: job.completedAt,
  };
}

export function jobsToday(db: Database, actor: Actor, now: Date): Job[] {
  return db.jobs
    .filter((job) => job.organizationId === actor.organizationId && isSameLocalDay(job.scheduledStart, now))
    .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
}

export function myJobsToday(db: Database, actor: Actor, now: Date): JobSummary[] {
  return jobsToday(db, actor, now)
    .filter((job) => job.assignedMemberId === actor.memberId)
    .map((job) => toSummary(db, job));
}

export function myRoute(db: Database, actor: Actor, now: Date): RouteStop[] {
  const jobs = jobsToday(db, actor, now)
    .filter((job) => job.assignedMemberId === actor.memberId)
    .sort((a, b) => (a.routePosition ?? 99) - (b.routePosition ?? 99) || a.scheduledStart.localeCompare(b.scheduledStart));
  let previous: { lat: number; lng: number } | null = null;
  return jobs.map((job) => {
    const summary = toSummary(db, job);
    const location = db.locations.find((item) => item.id === job.locationId);
    const point = { lat: location?.lat ?? 0, lng: location?.lng ?? 0 };
    const distance = previous ? distanceMiles(previous, point) : null;
    previous = point;
    return { ...summary, ...point, distanceFromPreviousMiles: distance };
  });
}

export function scheduleToday(db: Database, actor: Actor, now: Date, query = ''): JobSummary[] {
  if (!canDispatch(actor)) {
    throw new JobflowError('forbidden', 'The dispatch board is for dispatchers and owners.');
  }
  const needle = query.trim().toLowerCase();
  return jobsToday(db, actor, now)
    .map((job) => toSummary(db, job))
    .filter((job) => {
      if (!needle) return true;
      return [job.title, job.customerName, job.addressLine, job.locality, job.assigneeName ?? '', job.service]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
}

export function dispatchBoard(db: Database, actor: Actor, now: Date): DispatchBoard {
  if (!canDispatch(actor)) {
    throw new JobflowError('forbidden', 'The dispatch board is for dispatchers and owners.');
  }
  const today = jobsToday(db, actor, now);
  const technicians: TechnicianCard[] = db.members
    .filter((member) => member.organizationId === actor.organizationId && member.role === 'technician')
    .map((member) => {
      const user = db.users.find((item) => item.id === member.userId);
      const mine = today.filter((job) => job.assignedMemberId === member.id);
      const active = mine.find((job) => job.status === 'in_progress' || job.status === 'paused' || job.status === 'en_route');
      return {
        memberId: member.id,
        userId: member.userId,
        fullName: user?.fullName ?? 'Technician',
        status: member.status,
        phone: user?.phone ?? '',
        activeJobTitle: active?.title ?? null,
        activeJobId: active?.id ?? null,
        remainingStops: mine.filter((job) => job.status !== 'completed' && job.status !== 'cancelled').length,
      };
    })
    .sort((a, b) => statusRank(a.status) - statusRank(b.status) || a.fullName.localeCompare(b.fullName));
  const unassigned = today
    .filter((job) => !job.assignedMemberId && job.status !== 'completed' && job.status !== 'cancelled')
    .map((job) => toSummary(db, job));
  return { technicians, unassigned };
}

function statusRank(status: TechnicianCard['status']): number {
  switch (status) {
    case 'on_job':
      return 0;
    case 'paused':
      return 1;
    case 'en_route':
      return 2;
    case 'available':
      return 3;
    case 'offline':
      return 4;
  }
}
