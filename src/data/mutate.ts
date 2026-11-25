import { createId } from '@/domain/ids';
import { JobflowError } from '@/domain/errors';
import {
  canCollectPayment,
  canDispatch,
  canEditChecklist,
  canMarkInvoiced,
  canSign,
  canTransition,
  canAddPhoto,
} from '@/domain/permissions';
import type {
  Actor,
  Database,
  Job,
  JobAction,
  JobStatus,
  MemberStatus,
  PaymentInput,
  PhotoInput,
  SignatureInput,
} from '@/domain/types';
import { requireJob } from '@/data/project';

const ALLOWED: Record<JobAction, JobStatus[]> = {
  start_travel: ['scheduled'],
  start: ['scheduled', 'en_route'],
  pause: ['in_progress'],
  resume: ['paused'],
  complete: ['in_progress', 'paused'],
};

export function deriveMemberStatus(db: Database, memberId: string): MemberStatus {
  const member = db.members.find((item) => item.id === memberId);
  if (!member) return 'available';
  const jobs = db.jobs.filter(
    (job) => job.assignedMemberId === memberId && job.organizationId === member.organizationId,
  );
  if (jobs.some((job) => job.status === 'in_progress')) return 'on_job';
  if (jobs.some((job) => job.status === 'paused')) return 'paused';
  if (jobs.some((job) => job.status === 'en_route')) return 'en_route';
  if (member.status === 'offline') return 'offline';
  return 'available';
}

function replaceJob(db: Database, next: Job): Database {
  return { ...db, jobs: db.jobs.map((job) => (job.id === next.id ? next : job)) };
}

function withStatus(db: Database, memberIds: (string | null)[]): Database {
  let next = db;
  for (const memberId of memberIds) {
    if (!memberId) continue;
    const status = deriveMemberStatus(next, memberId);
    next = {
      ...next,
      members: next.members.map((member) => (member.id === memberId ? { ...member, status } : member)),
    };
  }
  return next;
}

export function transitionJob(db: Database, actor: Actor, jobId: string, action: JobAction, now: Date): Database {
  const job = requireJob(db, actor, jobId);
  if (!canTransition(actor, job.assignedMemberId)) {
    throw new JobflowError('forbidden', 'Only the assigned technician can update this job.');
  }
  if (!ALLOWED[action].includes(job.status)) {
    throw new JobflowError('conflict', `You cannot ${action.replaceAll('_', ' ')} a job that is ${job.status.replaceAll('_', ' ')}.`);
  }
  const iso = now.toISOString();
  const next: Job = { ...job, updatedAt: iso };
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
    next.status = 'in_progress';
    next.pausedAt = null;
  } else if (action === 'complete') {
    next.status = 'completed';
    next.completedAt = iso;
    next.pausedAt = null;
  }
  return withStatus(replaceJob(db, next), [job.assignedMemberId]);
}

export function reassignJob(db: Database, actor: Actor, jobId: string, memberId: string, now: Date): Database {
  if (!canDispatch(actor)) {
    throw new JobflowError('forbidden', 'Only a dispatcher or owner can reassign a job.');
  }
  const job = requireJob(db, actor, jobId);
  if (job.status === 'completed' || job.status === 'cancelled') {
    throw new JobflowError('conflict', 'Completed jobs stay with the technician who closed them.');
  }
  const target = db.members.find((member) => member.id === memberId && member.organizationId === actor.organizationId);
  if (!target) throw new JobflowError('not_found', 'That technician is not in this workspace.');
  if (target.role !== 'technician') {
    throw new JobflowError('invalid', 'Jobs are assigned to technicians.');
  }
  if (job.assignedMemberId === target.id) {
    throw new JobflowError('invalid', 'That technician already has this job.');
  }
  const active = job.status === 'en_route' || job.status === 'in_progress' || job.status === 'paused';
  const iso = now.toISOString();
  const next: Job = {
    ...job,
    assignedMemberId: target.id,
    status: active ? 'scheduled' : job.status,
    travelStartedAt: active ? null : job.travelStartedAt,
    startedAt: active ? null : job.startedAt,
    pausedAt: active ? null : job.pausedAt,
    updatedAt: iso,
  };
  const previous = job.assignedMemberId;
  let updated = withStatus(replaceJob(db, next), [previous, target.id]);
  const customer = db.customers.find((item) => item.id === job.customerId);
  updated = {
    ...updated,
    notifications: [
      {
        id: createId('ntf'),
        organizationId: actor.organizationId,
        recipientUserId: target.userId,
        title: 'A job was assigned to you',
        body: `${job.title} · ${customer?.name ?? 'Customer'}`,
        jobId: job.id,
        readAt: null,
        createdAt: iso,
      },
      ...updated.notifications,
    ],
  };
  return updated;
}

export function toggleChecklistItem(
  db: Database,
  actor: Actor,
  jobId: string,
  itemId: string,
  completed: boolean,
  now: Date,
): Database {
  const job = requireJob(db, actor, jobId);
  if (!canEditChecklist(actor, job.assignedMemberId, job.status)) {
    throw new JobflowError('forbidden', 'Only the assigned technician can check off this list.');
  }
  const item = db.checklistItems.find((entry) => entry.id === itemId && entry.jobId === job.id);
  if (!item) throw new JobflowError('not_found', 'That checklist item is not on this job.');
  return {
    ...db,
    checklistItems: db.checklistItems.map((entry) =>
      entry.id === item.id
        ? { ...entry, completed, completedAt: completed ? now.toISOString() : null }
        : entry,
    ),
  };
}

export function addNote(db: Database, actor: Actor, jobId: string, body: string, now: Date): Database {
  const job = requireJob(db, actor, jobId);
  const text = body.trim();
  if (!text) throw new JobflowError('invalid', 'Write a note before saving it.');
  if (text.length > 2000) throw new JobflowError('invalid', 'Notes are limited to 2000 characters.');
  return {
    ...db,
    notes: [
      ...db.notes,
      {
        id: createId('note'),
        organizationId: job.organizationId,
        jobId: job.id,
        authorMemberId: actor.memberId,
        body: text,
        createdAt: now.toISOString(),
      },
    ],
  };
}

export function addPhoto(db: Database, actor: Actor, jobId: string, input: PhotoInput, now: Date): Database {
  const job = requireJob(db, actor, jobId);
  if (!canAddPhoto(actor, job.assignedMemberId, job.status)) {
    throw new JobflowError('forbidden', 'Only the assigned technician can add photos.');
  }
  const uri = input.uri.trim();
  if (!uri) throw new JobflowError('invalid', 'That photo did not come through. Try again.');
  const caption = (input.caption ?? '').trim().slice(0, 140);
  return {
    ...db,
    photos: [
      ...db.photos,
      {
        id: createId('photo'),
        organizationId: job.organizationId,
        jobId: job.id,
        authorMemberId: actor.memberId,
        uri,
        caption: caption || 'Site photo',
        createdAt: now.toISOString(),
      },
    ],
  };
}

export function saveSignature(db: Database, actor: Actor, jobId: string, input: SignatureInput, now: Date): Database {
  const job = requireJob(db, actor, jobId);
  if (!canSign(actor, job.assignedMemberId, job.status)) {
    throw new JobflowError('forbidden', 'Only the assigned technician can capture a signature.');
  }
  const signerName = input.signerName.trim();
  if (!signerName) throw new JobflowError('invalid', 'Enter the customer’s name before saving the signature.');
  if (signerName.length > 80) throw new JobflowError('invalid', 'That name is too long.');
  const signature = {
    id: db.signatures.find((item) => item.jobId === job.id)?.id ?? createId('sig'),
    organizationId: job.organizationId,
    jobId: job.id,
    signerName,
    strokes: input.strokes,
    signedAt: now.toISOString(),
  };
  return {
    ...db,
    signatures: [...db.signatures.filter((item) => item.jobId !== job.id), signature],
  };
}

export function collectPayment(db: Database, actor: Actor, jobId: string, input: PaymentInput, now: Date): Database {
  const job = requireJob(db, actor, jobId);
  if (!canCollectPayment(actor, job.assignedMemberId, job.status)) {
    throw new JobflowError('forbidden', 'Only the assigned technician can collect payment.');
  }
  if (job.invoiceStatus === 'paid') throw new JobflowError('conflict', 'This job is already paid.');
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new JobflowError('invalid', 'Enter an amount greater than zero.');
  }
  const iso = now.toISOString();
  const id = createId('pay');
  return {
    ...replaceJob(db, { ...job, invoiceStatus: 'paid', updatedAt: iso }),
    payments: [
      ...db.payments,
      {
        id,
        organizationId: job.organizationId,
        jobId: job.id,
        amountCents: input.amountCents,
        method: input.method,
        status: 'succeeded',
        stripePaymentIntentId: input.method === 'card' ? `pi_demo_${id}` : null,
        createdAt: iso,
      },
    ],
  };
}

export function markInvoiced(db: Database, actor: Actor, jobId: string, now: Date): Database {
  const job = requireJob(db, actor, jobId);
  if (!canMarkInvoiced(actor, job.assignedMemberId, job.status)) {
    throw new JobflowError('forbidden', 'You cannot invoice this job.');
  }
  if (job.invoiceStatus === 'paid') throw new JobflowError('conflict', 'This job is already paid.');
  if (job.invoiceStatus === 'invoiced') return db;
  if (job.amountCents <= 0) throw new JobflowError('invalid', 'This job has no amount to invoice.');
  const iso = now.toISOString();
  return {
    ...replaceJob(db, { ...job, invoiceStatus: 'invoiced', updatedAt: iso }),
    payments: [
      ...db.payments,
      {
        id: createId('pay'),
        organizationId: job.organizationId,
        jobId: job.id,
        amountCents: job.amountCents,
        method: 'invoice',
        status: 'invoiced',
        stripePaymentIntentId: null,
        createdAt: iso,
      },
    ],
  };
}

export function sendTestNotification(db: Database, actor: Actor, now: Date): Database {
  return {
    ...db,
    notifications: [
      {
        id: createId('ntf'),
        organizationId: actor.organizationId,
        recipientUserId: actor.userId,
        title: 'Jobflow test alert',
        body: 'Alerts for new assignments show up here, and on the phone when notifications are allowed.',
        jobId: null,
        readAt: null,
        createdAt: now.toISOString(),
      },
      ...db.notifications,
    ],
  };
}

export function markNotificationRead(db: Database, actor: Actor, notificationId: string, now: Date): Database {
  const note = db.notifications.find(
    (item) => item.id === notificationId && item.recipientUserId === actor.userId && item.organizationId === actor.organizationId,
  );
  if (!note) throw new JobflowError('not_found', 'That alert is not in this workspace.');
  return {
    ...db,
    notifications: db.notifications.map((item) =>
      item.id === note.id ? { ...item, readAt: item.readAt ?? now.toISOString() } : item,
    ),
  };
}

export function registerPushToken(db: Database, actor: Actor, token: string, platform: string, now: Date): Database {
  const trimmed = token.trim();
  if (!trimmed) throw new JobflowError('invalid', 'Missing push token.');
  const existing = db.pushTokens.find((item) => item.userId === actor.userId && item.token === trimmed);
  if (existing) return db;
  return {
    ...db,
    pushTokens: [
      ...db.pushTokens,
      { id: createId('push'), userId: actor.userId, token: trimmed, platform, createdAt: now.toISOString() },
    ],
  };
}
