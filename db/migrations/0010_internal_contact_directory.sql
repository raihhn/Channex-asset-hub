-- Operational contacts only. No Person, login, role or identity mapping is created.
create schema contact_core;
revoke all on schema contact_core from public;
create table contact_core.internal_contacts (
  id uuid primary key,
  name text not null check (length(btrim(name)) between 1 and 250),
  email text not null default '' check (length(email) <= 250),
  phone text not null default '' check (length(phone) <= 250),
  dedupe_key text not null unique check (dedupe_key ~ '^[a-f0-9]{64}$'),
  active boolean not null default true,
  source text not null check (source in ('manual','catalog-import')),
  created_by text not null references identity_core.people(id) on delete restrict,
  created_at timestamptz not null default now()
);
create table contact_core.asset_management_contacts (
  asset_id text not null references asset_master.assets(id) on delete restrict,
  contact_id uuid not null references contact_core.internal_contacts(id) on delete restrict,
  position integer not null check (position >= 0),
  assigned_by text not null references identity_core.people(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  primary key(asset_id,contact_id),
  unique(asset_id,position)
);
create index asset_management_contacts_contact on contact_core.asset_management_contacts(contact_id);
create table contact_core.audit_events (
  id uuid primary key,
  actor_user_id text not null references identity_core.people(id) on delete restrict,
  action text not null check (action in ('CREATE_CONTACT','IMPORT_CONTACTS')),
  contact_id uuid references contact_core.internal_contacts(id) on delete restrict,
  created_at timestamptz not null default now(),
  summary jsonb not null
);
alter table contact_core.internal_contacts enable row level security;
alter table contact_core.asset_management_contacts enable row level security;
alter table contact_core.audit_events enable row level security;
revoke all on all tables in schema contact_core from public;
do $$ declare browser_role text; begin
  foreach browser_role in array array['anon','authenticated'] loop
    if exists (select 1 from pg_roles where rolname=browser_role) then
      execute format('revoke all on schema contact_core from %I',browser_role);
      execute format('revoke all on all tables in schema contact_core from %I',browser_role);
    end if;
  end loop;
end $$;
comment on schema contact_core is 'Private operational contact directory; never authentication authority.';
