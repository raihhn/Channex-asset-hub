-- M1-C additive storage only. No existing business table or actor reference changes.
create schema identity_core;
revoke all on schema identity_core from public;

create function identity_core.distinct_nonblank(values_ text[]) returns boolean
language sql immutable parallel safe as $$
  select values_ is not null and not exists (
    select 1 from unnest(values_) v where v is null or btrim(v) = ''
  ) and cardinality(values_) = (select count(distinct v) from unnest(values_) v)
$$;

create table identity_core.people (
  id text primary key check (btrim(id) <> ''),
  name text not null check (btrim(name) <> ''),
  email text not null check (btrim(email) <> ''),
  status text not null check (status in ('ACTIVE','INACTIVE')),
  roles text[] not null check (cardinality(roles) > 0 and identity_core.distinct_nonblank(roles)
    and roles <@ array['REQUESTER','STORE_DEV','BRAND','VENDOR','SUPER_ADMIN','MANAGEMENT']::text[]),
  brand_ids text[] not null default '{}' check (identity_core.distinct_nonblank(brand_ids)),
  category_ids text[] not null default '{}' check (identity_core.distinct_nonblank(category_ids)),
  area_ids text[] not null default '{}' check (identity_core.distinct_nonblank(area_ids)),
  dc_ids text[] not null default '{}' check (identity_core.distinct_nonblank(dc_ids)),
  legacy_vendor_id text,
  vendor_id uuid references vendor_master.vendors(id) on delete restrict,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  check (not ('VENDOR' = any(roles)) or legacy_vendor_id is not null or vendor_id is not null)
);
create unique index people_email_unique on identity_core.people (lower(btrim(email)));
comment on column identity_core.people.legacy_vendor_id is 'Original unresolved fixture vendor association; never guessed from name/email.';
comment on column identity_core.people.vendor_id is 'Explicit future resolved directory association; M1-C imports leave NULL.';

create table identity_core.identity_links (
  id uuid primary key,
  issuer text collate "C" not null check (length(issuer) between 1 and 512 and issuer = btrim(issuer)),
  subject text collate "C" not null check (length(subject) between 1 and 512 and subject = btrim(subject)),
  person_id text not null references identity_core.people(id) on delete restrict,
  linked_by_person_id text not null references identity_core.people(id) on delete restrict,
  linked_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by_person_id text references identity_core.people(id) on delete restrict,
  revocation_reason text,
  version integer not null default 1 check (version > 0),
  unique (issuer,subject),
  check ((revoked_at is null and revoked_by_person_id is null and revocation_reason is null)
      or (revoked_at is not null and revoked_by_person_id is not null and length(btrim(revocation_reason)) > 0 and revocation_reason is not null))
);
create index identity_links_person on identity_core.identity_links(person_id);
comment on table identity_core.identity_links is 'Explicit controlled mappings only. Revoked issuer/subject pairs remain reserved; no reactivation or auto-linking.';

create table identity_core.development_imports (
  id uuid primary key,
  source_name text not null check (source_name = 'development-people-fixtures-v1'),
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  imported_at timestamptz not null default now(),
  inserted_ids text[] not null,
  skipped_ids text[] not null
);

alter table identity_core.people enable row level security;
alter table identity_core.identity_links enable row level security;
alter table identity_core.development_imports enable row level security;
revoke all on all tables in schema identity_core from public;
revoke all on all functions in schema identity_core from public;
do $$ declare browser_role text; begin
  foreach browser_role in array array['anon','authenticated'] loop
    if exists (select 1 from pg_roles where rolname=browser_role) then
      execute format('revoke all on schema identity_core from %I',browser_role);
      execute format('revoke all on all tables in schema identity_core from %I',browser_role);
      execute format('revoke all on all functions in schema identity_core from %I',browser_role);
    end if;
  end loop;
end $$;
