import { SEED_VERSION, type Database, type Job, type Member, type User } from '@/domain/types';

export type Row = Record<string, unknown>;

export interface SelectQuery {
  filters?: Record<string, string>;
  gte?: Record<string, string>;
  lt?: Record<string, string>;
}

export interface DataGateway {
  select(table: string, query?: SelectQuery): Promise<Row[]>;
  insert(table: string, row: Row): Promise<Row>;
  update(table: string, filters: Record<string, string>, patch: Row): Promise<void>;
}

export function matchesQuery(row: Row, query: SelectQuery = {}): boolean {
  for (const [key, value] of Object.entries(query.filters ?? {})) {
    if (String(row[key] ?? '') !== value) return false;
  }
  for (const [key, value] of Object.entries(query.gte ?? {})) {
    if (String(row[key] ?? '') < value) return false;
  }
  for (const [key, value] of Object.entries(query.lt ?? {})) {
    if (String(row[key] ?? '') >= value) return false;
  }
  return true;
}

function text(row: Row, key: string): string {
  return String(row[key] ?? '');
}

function nullable(row: Row, key: string): string | null {
  const value = row[key];
  return value == null || value === '' ? null : String(value);
}

function num(row: Row, key: string): number {
  return Number(row[key] ?? 0);
}

function bool(row: Row, key: string): boolean {
  return Boolean(row[key]);
}

export function jobFromRow(row: Row): Job {
  return {
    id: text(row, 'id'),
    organizationId: text(row, 'organization_id'),
    customerId: text(row, 'customer_id'),
    locationId: text(row, 'location_id'),
    assignedMemberId: nullable(row, 'assigned_member_id'),
    title: text(row, 'title'),
    summary: text(row, 'summary'),
    service: text(row, 'service'),
    priority: text(row, 'priority') === 'urgent' ? 'urgent' : 'routine',
    status: text(row, 'status') as Job['status'],
    scheduledStart: text(row, 'scheduled_start'),
    scheduledEnd: text(row, 'scheduled_end'),
    routePosition: row.route_position == null ? null : num(row, 'route_position'),
    amountCents: num(row, 'amount_cents'),
    currency: 'usd',
    invoiceStatus: text(row, 'invoice_status') as Job['invoiceStatus'],
    travelStartedAt: nullable(row, 'travel_started_at'),
    startedAt: nullable(row, 'started_at'),
    pausedAt: nullable(row, 'paused_at'),
    completedAt: nullable(row, 'completed_at'),
    updatedAt: text(row, 'updated_at'),
  };
}

export function jobToRow(job: Job): Row {
  return {
    id: job.id,
    organization_id: job.organizationId,
    customer_id: job.customerId,
    location_id: job.locationId,
    assigned_member_id: job.assignedMemberId,
    title: job.title,
    summary: job.summary,
    service: job.service,
    priority: job.priority,
    status: job.status,
    scheduled_start: job.scheduledStart,
    scheduled_end: job.scheduledEnd,
    route_position: job.routePosition,
    amount_cents: job.amountCents,
    currency: job.currency,
    invoice_status: job.invoiceStatus,
    travel_started_at: job.travelStartedAt,
    started_at: job.startedAt,
    paused_at: job.pausedAt,
    completed_at: job.completedAt,
    updated_at: job.updatedAt,
  };
}

export function memberFromRow(row: Row): Member {
  return {
    id: text(row, 'id'),
    organizationId: text(row, 'organization_id'),
    userId: text(row, 'user_id'),
    role: text(row, 'role') as Member['role'],
    status: text(row, 'status') as Member['status'],
  };
}

export function userFromRow(row: Row): User {
  return {
    id: text(row, 'id'),
    email: text(row, 'email'),
    fullName: text(row, 'full_name'),
    phone: text(row, 'phone'),
  };
}

export function databaseFromGatewayRows(input: {
  organizationId: string;
  organizationName: string;
  jobs: Row[];
  members: Row[];
  users: Row[];
  customers: Row[];
  locations: Row[];
  checklist: Row[];
  notes: Row[];
  photos: Row[];
  signatures: Row[];
  payments: Row[];
  notifications: Row[];
  pushTokens: Row[];
}): Database {
  const org = input.organizationId;
  const keep = (row: Row) => text(row, 'organization_id') === org || text(row, 'organization_id') === '';
  return {
    version: SEED_VERSION,
    organizations: [
      { id: org, name: input.organizationName, slug: org, trade: 'hvac', city: '', region: '' },
    ],
    users: input.users.map(userFromRow),
    members: input.members.filter(keep).map(memberFromRow),
    customers: input.customers.filter(keep).map((row) => ({
      id: text(row, 'id'),
      organizationId: text(row, 'organization_id'),
      name: text(row, 'name'),
      phone: text(row, 'phone'),
      email: text(row, 'email'),
    })),
    locations: input.locations.filter(keep).map((row) => ({
      id: text(row, 'id'),
      organizationId: text(row, 'organization_id'),
      customerId: text(row, 'customer_id'),
      label: text(row, 'label'),
      line1: text(row, 'line1'),
      city: text(row, 'city'),
      region: text(row, 'region'),
      postalCode: text(row, 'postal_code'),
      lat: num(row, 'lat'),
      lng: num(row, 'lng'),
    })),
    jobs: input.jobs.filter(keep).map(jobFromRow),
    checklistItems: input.checklist.filter(keep).map((row) => ({
      id: text(row, 'id'),
      organizationId: text(row, 'organization_id'),
      jobId: text(row, 'job_id'),
      label: text(row, 'label'),
      required: bool(row, 'required'),
      completed: bool(row, 'completed'),
      position: num(row, 'position'),
      completedAt: nullable(row, 'completed_at'),
    })),
    notes: input.notes.filter(keep).map((row) => ({
      id: text(row, 'id'),
      organizationId: text(row, 'organization_id'),
      jobId: text(row, 'job_id'),
      authorMemberId: text(row, 'author_member_id'),
      body: text(row, 'body'),
      createdAt: text(row, 'created_at'),
    })),
    photos: input.photos.filter(keep).map((row) => ({
      id: text(row, 'id'),
      organizationId: text(row, 'organization_id'),
      jobId: text(row, 'job_id'),
      authorMemberId: text(row, 'author_member_id'),
      uri: text(row, 'uri'),
      caption: text(row, 'caption'),
      createdAt: text(row, 'created_at'),
    })),
    signatures: input.signatures.filter(keep).map((row) => ({
      id: text(row, 'id'),
      organizationId: text(row, 'organization_id'),
      jobId: text(row, 'job_id'),
      signerName: text(row, 'signer_name'),
      strokes: Array.isArray(row.strokes) ? (row.strokes as Database['signatures'][number]['strokes']) : [],
      signedAt: text(row, 'signed_at'),
    })),
    payments: input.payments.filter(keep).map((row) => ({
      id: text(row, 'id'),
      organizationId: text(row, 'organization_id'),
      jobId: text(row, 'job_id'),
      amountCents: num(row, 'amount_cents'),
      method: text(row, 'method') as Database['payments'][number]['method'],
      status: text(row, 'status') as Database['payments'][number]['status'],
      stripePaymentIntentId: nullable(row, 'stripe_payment_intent_id'),
      createdAt: text(row, 'created_at'),
    })),
    notifications: input.notifications.filter(keep).map((row) => ({
      id: text(row, 'id'),
      organizationId: text(row, 'organization_id'),
      recipientUserId: text(row, 'recipient_user_id'),
      title: text(row, 'title'),
      body: text(row, 'body'),
      jobId: nullable(row, 'job_id'),
      readAt: nullable(row, 'read_at'),
      createdAt: text(row, 'created_at'),
    })),
    pushTokens: input.pushTokens
      .filter((row) => input.members.some((member) => text(member, 'user_id') === text(row, 'user_id')))
      .map((row) => ({
        id: text(row, 'id'),
        userId: text(row, 'user_id'),
        token: text(row, 'token'),
        platform: text(row, 'platform'),
        createdAt: text(row, 'created_at'),
      })),
    magicLinks: [],
  };
}

export function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stable(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
