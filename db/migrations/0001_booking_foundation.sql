-- Slice 10. Private schema: no browser/Data API write path. Apply with psql -v ON_ERROR_STOP=1.
create schema if not exists booking;
revoke all on schema booking from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema booking from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on schema booking from authenticated';
  end if;
end $$;

create sequence if not exists booking.request_number_seq start with 1000;

create table if not exists booking.assets (
  id text primary key,
  category text not null,
  classification text not null check (classification in ('ASSET', 'INVENTORY')),
  tracking_type text not null check (tracking_type in ('Individual', 'Quantity-based')),
  availability_hint text not null,
  maintenance_hold boolean not null default false,
  inspection_hold boolean not null default false,
  issue_hold boolean not null default false,
  blocked_ranges jsonb not null default '[]'::jsonb,
  available_quantity integer,
  updated_at timestamptz not null default now()
);

create table if not exists booking.requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique,
  status text not null check (status in ('Draft', 'Pending approval', 'Needs update', 'Approved', 'Rejected', 'Cancelled', 'Ready', 'Return due', 'Inspection pending', 'Overdue', 'In use', 'Completed')),
  start_date date not null,
  end_date date not null,
  outbound_at timestamp without time zone not null,
  inbound_at timestamp without time zone not null,
  actual_inbound_at timestamp without time zone,
  submitted_by_user_id text not null,
  review_round integer not null default 1 check (review_round > 0),
  version integer not null default 1 check (version > 0),
  payload jsonb not null,
  is_demo boolean not null default false,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (inbound_at >= outbound_at)
);

create table if not exists booking.request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references booking.requests(id) on delete restrict,
  asset_id text not null references booking.assets(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, asset_id)
);
create index if not exists request_items_asset_id_idx on booking.request_items(asset_id);

create table if not exists booking.request_groups (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references booking.requests(id) on delete restrict,
  kind text not null check (kind in ('Fulfillment', 'Return')),
  position integer not null check (position >= 0),
  payload jsonb not null,
  unique (request_id, kind, position)
);
create table if not exists booking.request_group_items (
  group_id uuid not null references booking.request_groups(id) on delete restrict,
  request_item_id uuid not null references booking.request_items(id) on delete restrict,
  primary key (group_id, request_item_id)
);

create table if not exists booking.wbs_references (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists booking.request_wbs (
  request_id uuid not null references booking.requests(id) on delete restrict,
  wbs_id uuid not null references booking.wbs_references(id) on delete restrict,
  primary key (request_id, wbs_id)
);

create table if not exists booking.review_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references booking.requests(id) on delete restrict,
  cycle integer not null,
  action text not null,
  actor_user_id text not null,
  actor_name_snapshot text not null,
  reviewer_user_id text,
  assignment_id uuid,
  note text,
  occurred_at timestamptz not null default now()
);
create table if not exists booking.approval_assignments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references booking.requests(id) on delete restrict,
  cycle integer not null,
  sequence integer not null,
  reviewer_user_id text not null,
  status text not null,
  assigned_at timestamptz not null default now(),
  assigned_by_user_id text not null,
  decided_at timestamptz,
  decided_by_user_id text,
  decision text,
  note text
);
create unique index if not exists one_pending_assignment_per_request on booking.approval_assignments(request_id) where status = 'Pending';

create table if not exists booking.audit_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_user_id text not null,
  actor_name_snapshot text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  summary text not null,
  related jsonb not null default '{}'::jsonb
);

create table if not exists booking.command_receipts (
  key uuid primary key,
  kind text not null,
  fingerprint text not null,
  request_id uuid not null references booking.requests(id) on delete restrict,
  created_at timestamptz not null default now()
);

-- Supabase public schema may have broad default grants. This booking schema is private.
revoke all on all tables in schema booking from public;
revoke all on all sequences in schema booking from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema booking from anon';
    execute 'revoke all on all sequences in schema booking from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on all tables in schema booking from authenticated';
    execute 'revoke all on all sequences in schema booking from authenticated';
  end if;
end $$;
