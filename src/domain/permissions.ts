import type { Actor, JobAction, JobStatus } from '@/domain/types';

export function canDispatch(actor: Actor): boolean {
  return actor.role === 'dispatcher' || actor.role === 'owner';
}

export function isAssignedTechnician(actor: Actor, assignedMemberId: string | null): boolean {
  return actor.role === 'technician' && assignedMemberId === actor.memberId;
}

export function canTransition(actor: Actor, assignedMemberId: string | null): boolean {
  return isAssignedTechnician(actor, assignedMemberId);
}

export function canReassign(actor: Actor): boolean {
  return canDispatch(actor);
}

export function canEditChecklist(actor: Actor, assignedMemberId: string | null, status: JobStatus): boolean {
  return status !== 'cancelled' && isAssignedTechnician(actor, assignedMemberId);
}

export function canAddPhoto(actor: Actor, assignedMemberId: string | null, status: JobStatus): boolean {
  return status !== 'cancelled' && isAssignedTechnician(actor, assignedMemberId);
}

export function canSign(actor: Actor, assignedMemberId: string | null, status: JobStatus): boolean {
  return status !== 'cancelled' && isAssignedTechnician(actor, assignedMemberId);
}

export function canCollectPayment(actor: Actor, assignedMemberId: string | null, status: JobStatus): boolean {
  return status !== 'cancelled' && isAssignedTechnician(actor, assignedMemberId);
}

export function canMarkInvoiced(actor: Actor, assignedMemberId: string | null, status: JobStatus): boolean {
  if (status === 'cancelled') return false;
  return isAssignedTechnician(actor, assignedMemberId) || canDispatch(actor);
}

export function availableActions(status: JobStatus): JobAction[] {
  switch (status) {
    case 'scheduled':
      return ['start_travel', 'start'];
    case 'en_route':
      return ['start'];
    case 'in_progress':
      return ['pause', 'complete'];
    case 'paused':
      return ['resume', 'complete'];
    default:
      return [];
  }
}

export function actionLabel(action: JobAction): string {
  switch (action) {
    case 'start_travel':
      return 'Start travel';
    case 'start':
      return 'Start job';
    case 'pause':
      return 'Pause';
    case 'resume':
      return 'Resume';
    case 'complete':
      return 'Complete job';
  }
}
