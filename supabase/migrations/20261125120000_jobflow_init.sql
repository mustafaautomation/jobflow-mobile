-- Jobflow shared schema for the web app and this mobile client.
-- The mobile app uses the anon/publishable key only. RLS is the access boundary.
-- Do not put a service-role key in the mobile app.

create extension if not exists pgcrypto;

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_org_role(target_org uuid, allowed text[])
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = target_org
      and m.user_id = (select auth.uid())
      and m.role = any (allowed)
  );
$$;

revoke all on function public.is_org_member(uuid) from public, anon;
revoke all on function public.has_org_role(uuid, text[]) from public, anon;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  trade text not null default 'hvac' check (trade = 'hvac'),
  city text not null default '',
  region text not null default '',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'dispatcher', 'technician')),
  status text not null default 'available' check (status in ('available', 'en_route', 'on_job', 'paused', 'offline')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  phone text not null default '',
  email text not null default '',
  created_at timestamptz not null default now()
);

create table public.service_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  label text not null default 'Site',
  line1 text not null,
  city text not null,
  region text not null,
  postal_code text not null,
  lat double precision not null,
  lng double precision not null
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null references public.customers (id),
  location_id uuid not null references public.service_locations (id),
  assigned_member_id uuid references public.organization_members (id),
  title text not null,
  summary text not null default '',
  service text not null default 'Cooling',
  priority text not null default 'routine' check (priority in ('routine', 'urgent')),
  status text not null default 'scheduled' check (status in ('scheduled', 'en_route', 'in_progress', 'paused', 'completed', 'cancelled')),
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  route_position integer,
  amount_cents integer not null default 0 check (amount_cents >= 0),
  currency text not null default 'usd',
  invoice_status text not null default 'unbilled' check (invoice_status in ('unbilled', 'invoiced', 'paid')),
  travel_started_at timestamptz,
  started_at timestamptz,
  paused_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  label text not null,
  required boolean not null default true,
  completed boolean not null default false,
  position integer not null default 1,
  completed_at timestamptz
);

create table public.job_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  author_member_id uuid not null references public.organization_members (id),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create table public.job_photos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  author_member_id uuid not null references public.organization_members (id),
  uri text not null,
  caption text not null default '',
  created_at timestamptz not null default now()
);

create table public.job_signatures (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  signer_name text not null,
  strokes jsonb not null default '[]'::jsonb,
  signed_at timestamptz not null default now(),
  unique (job_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  method text not null check (method in ('card', 'cash', 'invoice')),
  status text not null check (status in ('succeeded', 'invoiced')),
  stripe_payment_intent_id text,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  recipient_user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  job_id uuid references public.jobs (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null,
  platform text not null,
  created_at timestamptz not null default now(),
  unique (user_id, token)
);

create index jobs_org_start_idx on public.jobs (organization_id, scheduled_start);
create index jobs_assignee_idx on public.jobs (assigned_member_id);
create index checklist_job_idx on public.checklist_items (job_id, position);
create index notes_job_idx on public.job_notes (job_id, created_at);
create index notifications_recipient_idx on public.notifications (recipient_user_id, created_at desc);

create or replace function public.jobs_keep_org()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  customer_org uuid;
  location_org uuid;
  member_org uuid;
begin
  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id is immutable';
  end if;
  select organization_id into customer_org from public.customers where id = new.customer_id;
  select organization_id into location_org from public.service_locations where id = new.location_id;
  if customer_org is distinct from new.organization_id or location_org is distinct from new.organization_id then
    raise exception 'job organization does not match customer or location';
  end if;
  if new.assigned_member_id is not null then
    select organization_id into member_org from public.organization_members where id = new.assigned_member_id;
    if member_org is distinct from new.organization_id then
      raise exception 'assignee is not in this organization';
    end if;
  end if;
  return new;
end;
$$;

create trigger jobs_keep_org before insert or update on public.jobs
for each row execute function public.jobs_keep_org();

create or replace function public.members_keep_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and (
    new.organization_id is distinct from old.organization_id
    or new.user_id is distinct from old.user_id
  ) then
    raise exception 'membership identity is immutable';
  end if;
  if tg_op = 'UPDATE'
    and new.role is distinct from old.role
    and not public.has_org_role(old.organization_id, array['owner', 'dispatcher'])
  then
    raise exception 'role cannot be changed';
  end if;
  return new;
end;
$$;

create trigger members_keep_identity before update on public.organization_members
for each row execute function public.members_keep_identity();

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.customers enable row level security;
alter table public.service_locations enable row level security;
alter table public.jobs enable row level security;
alter table public.checklist_items enable row level security;
alter table public.job_notes enable row level security;
alter table public.job_photos enable row level security;
alter table public.job_signatures enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'organizations', 'profiles', 'organization_members', 'customers', 'service_locations',
    'jobs', 'checklist_items', 'job_notes', 'job_photos', 'job_signatures',
    'payments', 'notifications', 'push_tokens'
  ]
  loop
    execute format('revoke all on table public.%I from public, anon', tbl);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', tbl);
  end loop;
end $$;

create policy organizations_select on public.organizations
for select to authenticated
using (public.is_org_member(id));

create policy profiles_select on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1
    from public.organization_members mine
    join public.organization_members theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = profiles.id
  )
);

create policy profiles_insert on public.profiles
for insert to authenticated
with check (id = (select auth.uid()));

create policy profiles_update on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy members_select on public.organization_members
for select to authenticated
using (public.is_org_member(organization_id));

create policy members_insert on public.organization_members
for insert to authenticated
with check (public.has_org_role(organization_id, array['owner', 'dispatcher']));

create policy members_update_self on public.organization_members
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()) and organization_id = organization_members.organization_id);

create policy members_update_dispatch on public.organization_members
for update to authenticated
using (public.has_org_role(organization_id, array['owner', 'dispatcher']))
with check (public.has_org_role(organization_id, array['owner', 'dispatcher']));

create policy customers_select on public.customers
for select to authenticated
using (public.is_org_member(organization_id));

create policy customers_write on public.customers
for all to authenticated
using (public.has_org_role(organization_id, array['owner', 'dispatcher']))
with check (public.has_org_role(organization_id, array['owner', 'dispatcher']));

create policy locations_select on public.service_locations
for select to authenticated
using (public.is_org_member(organization_id));

create policy locations_write on public.service_locations
for all to authenticated
using (public.has_org_role(organization_id, array['owner', 'dispatcher']))
with check (public.has_org_role(organization_id, array['owner', 'dispatcher']));

create policy jobs_select on public.jobs
for select to authenticated
using (public.is_org_member(organization_id));

create policy jobs_insert on public.jobs
for insert to authenticated
with check (public.has_org_role(organization_id, array['owner', 'dispatcher']));

create policy jobs_update_tech on public.jobs
for update to authenticated
using (
  exists (
    select 1 from public.organization_members m
    where m.id = jobs.assigned_member_id
      and m.user_id = (select auth.uid())
      and m.role = 'technician'
      and m.organization_id = jobs.organization_id
  )
)
with check (
  exists (
    select 1 from public.organization_members m
    where m.id = assigned_member_id
      and m.user_id = (select auth.uid())
      and m.role = 'technician'
      and m.organization_id = organization_id
  )
);

create policy jobs_update_dispatch on public.jobs
for update to authenticated
using (public.has_org_role(organization_id, array['owner', 'dispatcher']))
with check (public.has_org_role(organization_id, array['owner', 'dispatcher']));

create policy checklist_select on public.checklist_items
for select to authenticated
using (public.is_org_member(organization_id));

create policy checklist_update on public.checklist_items
for update to authenticated
using (
  exists (
    select 1
    from public.jobs j
    join public.organization_members m on m.id = j.assigned_member_id
    where j.id = checklist_items.job_id
      and m.user_id = (select auth.uid())
      and m.role = 'technician'
  )
)
with check (
  exists (
    select 1
    from public.jobs j
    join public.organization_members m on m.id = j.assigned_member_id
    where j.id = job_id
      and m.user_id = (select auth.uid())
      and m.role = 'technician'
      and j.organization_id = organization_id
  )
);

create policy notes_select on public.job_notes
for select to authenticated
using (public.is_org_member(organization_id));

create policy notes_insert on public.job_notes
for insert to authenticated
with check (
  public.is_org_member(organization_id)
  and exists (
    select 1 from public.organization_members m
    where m.id = author_member_id
      and m.user_id = (select auth.uid())
      and m.organization_id = organization_id
  )
);

create policy photos_select on public.job_photos
for select to authenticated
using (public.is_org_member(organization_id));

create policy photos_insert on public.job_photos
for insert to authenticated
with check (
  exists (
    select 1
    from public.jobs j
    join public.organization_members m on m.id = j.assigned_member_id
    where j.id = job_id
      and j.organization_id = organization_id
      and m.user_id = (select auth.uid())
      and m.role = 'technician'
      and m.id = author_member_id
  )
);

create policy signatures_select on public.job_signatures
for select to authenticated
using (public.is_org_member(organization_id));

create policy signatures_write on public.job_signatures
for all to authenticated
using (
  exists (
    select 1
    from public.jobs j
    join public.organization_members m on m.id = j.assigned_member_id
    where j.id = job_signatures.job_id
      and m.user_id = (select auth.uid())
      and m.role = 'technician'
  )
)
with check (
  exists (
    select 1
    from public.jobs j
    join public.organization_members m on m.id = j.assigned_member_id
    where j.id = job_id
      and j.organization_id = organization_id
      and m.user_id = (select auth.uid())
      and m.role = 'technician'
  )
);

create policy payments_select on public.payments
for select to authenticated
using (public.is_org_member(organization_id));

create policy payments_insert on public.payments
for insert to authenticated
with check (
  public.is_org_member(organization_id)
  and (
    (
      method in ('card', 'cash')
      and exists (
        select 1
        from public.jobs j
        join public.organization_members m on m.id = j.assigned_member_id
        where j.id = job_id
          and j.organization_id = organization_id
          and m.user_id = (select auth.uid())
          and m.role = 'technician'
      )
    )
    or (
      method = 'invoice'
      and (
        public.has_org_role(organization_id, array['owner', 'dispatcher'])
        or exists (
          select 1
          from public.jobs j
          join public.organization_members m on m.id = j.assigned_member_id
          where j.id = job_id
            and m.user_id = (select auth.uid())
            and m.role = 'technician'
        )
      )
    )
  )
);

create policy notifications_select on public.notifications
for select to authenticated
using (recipient_user_id = (select auth.uid()));

create policy notifications_update on public.notifications
for update to authenticated
using (recipient_user_id = (select auth.uid()))
with check (recipient_user_id = (select auth.uid()));

create policy notifications_insert on public.notifications
for insert to authenticated
with check (
  public.is_org_member(organization_id)
  and exists (
    select 1 from public.organization_members m
    where m.organization_id = organization_id
      and m.user_id = recipient_user_id
  )
);

create policy push_tokens_all on public.push_tokens
for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
