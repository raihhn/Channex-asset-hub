-- M0 only. No application tables or historical data are changed.
-- Rows are recorded by the explicit M0 command after verified recovery.
create schema if not exists app_core;
revoke all on schema app_core from public;

create table if not exists app_core.persistence_baselines (
  id uuid primary key,
  observed_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  schema_sha256 text not null check (schema_sha256 ~ '^[a-f0-9]{64}$'),
  manifest_sha256 text not null check (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  table_manifest jsonb not null,
  media_manifest_sha256 text not null,
  migration_artifacts jsonb not null,
  recovery_bundle_id text not null,
  note text not null
);

create table if not exists app_core.migration_provenance (
  migration_id text primary key,
  artifact_sha256 text not null check (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  provenance text not null check (provenance in ('observed_historical', 'executed')),
  observed_at timestamptz not null,
  executed_at timestamptz,
  baseline_id uuid not null references app_core.persistence_baselines(id) on delete restrict,
  check ((provenance = 'observed_historical' and executed_at is null)
      or (provenance = 'executed' and executed_at is not null))
);

alter table app_core.persistence_baselines enable row level security;
alter table app_core.migration_provenance enable row level security;
revoke all on all tables in schema app_core from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema app_core from anon';
    execute 'revoke all on all tables in schema app_core from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on schema app_core from authenticated';
    execute 'revoke all on all tables in schema app_core from authenticated';
  end if;
end $$;
