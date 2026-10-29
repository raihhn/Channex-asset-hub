-- Private PostgreSQL master data; provider-neutral and not exposed to Data API.
create schema if not exists vendor_master;
revoke all on schema vendor_master from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema vendor_master from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on schema vendor_master from authenticated';
  end if;
end $$;
create table if not exists vendor_master.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 200),
  legal_name text not null default '' check (length(legal_name) <= 200),
  active boolean not null default true,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists vendors_name_unique on vendor_master.vendors (lower(trim(name)));
create table if not exists vendor_master.warehouses (
  id uuid primary key,
  vendor_id uuid not null references vendor_master.vendors(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 200),
  address text not null check (length(trim(address)) between 1 and 4000),
  address_verified boolean not null default false,
  active boolean not null default true,
  unique(vendor_id, id)
);
create unique index if not exists warehouse_name_unique on vendor_master.warehouses (vendor_id, lower(trim(name)));
create table if not exists vendor_master.contacts (
  id uuid primary key,
  vendor_id uuid not null references vendor_master.vendors(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 200),
  phone text not null check (length(trim(phone)) between 1 and 80),
  email text not null check (length(trim(email)) between 1 and 254),
  active boolean not null default true,
  unique(vendor_id, id)
);
create table if not exists vendor_master.warehouse_contacts (
  vendor_id uuid not null,
  warehouse_id uuid not null,
  contact_id uuid not null,
  primary key(warehouse_id, contact_id),
  foreign key(vendor_id, warehouse_id) references vendor_master.warehouses(vendor_id, id) on delete restrict,
  foreign key(vendor_id, contact_id) references vendor_master.contacts(vendor_id, id) on delete restrict
);
create table if not exists vendor_master.audit_events (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendor_master.vendors(id),
  actor_id text not null,
  actor_name text not null,
  action text not null check (action in ('VENDOR_CREATED','VENDOR_UPDATED','VENDOR_IMPORTED')),
  version integer not null,
  changed_fields text[] not null,
  occurred_at timestamptz not null default now()
);
create index if not exists vendor_audit_by_vendor on vendor_master.audit_events(vendor_id, occurred_at desc);
alter table vendor_master.vendors enable row level security;
alter table vendor_master.warehouses enable row level security;
alter table vendor_master.contacts enable row level security;
alter table vendor_master.warehouse_contacts enable row level security;
alter table vendor_master.audit_events enable row level security;
-- No browser roles have policies or privileges. The local server uses the DB owner.
