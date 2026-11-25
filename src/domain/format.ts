import type { InvoiceStatus, JobStatus, MemberStatus, Role } from '@/domain/types';

export function formatMoney(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

export function greeting(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function statusLabel(status: JobStatus): string {
  switch (status) {
    case 'scheduled':
      return 'Scheduled';
    case 'en_route':
      return 'En route';
    case 'in_progress':
      return 'In progress';
    case 'paused':
      return 'Paused';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
  }
}

export function memberStatusLabel(status: MemberStatus): string {
  switch (status) {
    case 'available':
      return 'Available';
    case 'en_route':
      return 'En route';
    case 'on_job':
      return 'On job';
    case 'paused':
      return 'Paused';
    case 'offline':
      return 'Offline';
  }
}

export function roleLabel(role: Role): string {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'dispatcher':
      return 'Dispatcher';
    case 'technician':
      return 'Technician';
  }
}

export function invoiceLabel(status: InvoiceStatus): string {
  switch (status) {
    case 'unbilled':
      return 'Unbilled';
    case 'invoiced':
      return 'Invoiced';
    case 'paid':
      return 'Paid';
  }
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}
