import { buildSeed } from '@/data/seed';
import { jobToRow, matchesQuery, type DataGateway, type Row, type SelectQuery } from '@/data/rows';
import { SupabaseRepository } from '@/data/supabase-repository';
import { mapSupabaseError } from '@/data/supabase-gateway';
import type { Database } from '@/domain/types';

const now = new Date(2026, 10, 25, 15, 0, 0);

class TableGateway implements DataGateway {
  constructor(
    private tables: Record<string, Row[]>,
    private ignoreFilters = false,
  ) {}

  async select(table: string, query?: SelectQuery) {
    const rows = this.tables[table] ?? [];
    if (this.ignoreFilters) return rows;
    return rows.filter((row) => matchesQuery(row, query));
  }

  async insert(table: string, row: Row) {
    this.tables[table] = [...(this.tables[table] ?? []), row];
    return row;
  }

  async update(table: string, filters: Record<string, string>, patch: Row) {
    this.tables[table] = (this.tables[table] ?? []).map((row) =>
      matchesQuery(row, { filters }) ? { ...row, ...patch } : row,
    );
  }
}

function tablesFrom(db: Database): Record<string, Row[]> {
  return {
    jobs: db.jobs.map(jobToRow),
    organization_members: db.members.map((member) => ({
      id: member.id,
      organization_id: member.organizationId,
      user_id: member.userId,
      role: member.role,
      status: member.status,
    })),
    profiles: db.users.map((user) => ({
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      phone: user.phone,
    })),
    customers: db.customers.map((customer) => ({
      id: customer.id,
      organization_id: customer.organizationId,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
    })),
    service_locations: db.locations.map((location) => ({
      id: location.id,
      organization_id: location.organizationId,
      customer_id: location.customerId,
      label: location.label,
      line1: location.line1,
      city: location.city,
      region: location.region,
      postal_code: location.postalCode,
      lat: location.lat,
      lng: location.lng,
    })),
    checklist_items: db.checklistItems.map((item) => ({
      id: item.id,
      organization_id: item.organizationId,
      job_id: item.jobId,
      label: item.label,
      required: item.required,
      completed: item.completed,
      position: item.position,
      completed_at: item.completedAt,
    })),
    job_notes: db.notes.map((note) => ({
      id: note.id,
      organization_id: note.organizationId,
      job_id: note.jobId,
      author_member_id: note.authorMemberId,
      body: note.body,
      created_at: note.createdAt,
    })),
    job_photos: [],
    job_signatures: [],
    payments: [],
    notifications: [],
    push_tokens: [],
  };
}

describe('supabase repository', () => {
  it('filters another tenant even if the gateway returns every row', async () => {
    const gateway = new TableGateway(tablesFrom(buildSeed(now)), true);
    const repository = new SupabaseRepository(gateway, () => now);
    const actor = {
      userId: 'user_alex',
      email: 'alex.rivera@harborpine.demo',
      fullName: 'Alex Rivera',
      phone: '+1 512 555 0142',
      organizationId: 'org_harbor',
      organizationName: 'Harbor & Pine HVAC',
      memberId: 'member_alex_harbor',
      role: 'technician' as const,
    };
    await expect(repository.getJob(actor, 'job_summit_lohi')).rejects.toMatchObject({ code: 'not_found' });
    const today = await repository.listTodayJobs(actor);
    expect(today.every((job) => job.locality.includes('Austin'))).toBe(true);
    await expect(repository.reassignJob(actor, 'job_harbor_mueller', 'member_casey_harbor')).rejects.toMatchObject({
      code: 'forbidden',
    });
  });

  it('persists a dispatcher reassignment through the gateway', async () => {
    const tables = tablesFrom(buildSeed(now));
    const gateway = new TableGateway(tables);
    const repository = new SupabaseRepository(gateway, () => now);
    const actor = {
      userId: 'user_jordan',
      email: 'jordan.hale@harborpine.demo',
      fullName: 'Jordan Hale',
      phone: '+1 512 555 0174',
      organizationId: 'org_harbor',
      organizationName: 'Harbor & Pine HVAC',
      memberId: 'member_jordan_harbor',
      role: 'dispatcher' as const,
    };
    const moved = await repository.reassignJob(actor, 'job_harbor_hart', 'member_priya_harbor');
    expect(moved.assigneeName).toBe('Priya Shah');
    const row = tables.jobs?.find((item) => item.id === 'job_harbor_hart');
    expect(row?.assigned_member_id).toBe('member_priya_harbor');
    expect(tables.notifications?.some((item) => item.recipient_user_id === 'user_priya')).toBe(true);
  });

  it('maps network and RLS errors', () => {
    expect(mapSupabaseError({ message: 'Failed to fetch' }).code).toBe('network');
    expect(mapSupabaseError({ message: 'permission denied', code: '42501' }).code).toBe('forbidden');
  });
});
