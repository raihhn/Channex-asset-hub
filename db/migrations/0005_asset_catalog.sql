-- Private local asset catalog, provenance, media references and import audit.
create schema if not exists asset_master;
revoke all on schema asset_master from public;
create table if not exists asset_master.assets (
 id text primary key,
 source_key text unique not null,
 source_hash text not null,
 vendor_id uuid references vendor_master.vendors(id),
 warehouse_id uuid references vendor_master.warehouses(id),
 payload jsonb not null,
 source jsonb not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists asset_master.media (
 object_key text primary key,
 mime_type text not null check(mime_type in ('image/png','image/jpeg','image/gif','image/webp')),
 byte_size integer not null check(byte_size>0),
 storage_provider text not null default 'local-development'
);
create table if not exists asset_master.asset_media (
 asset_id text not null references asset_master.assets(id),
 object_key text not null references asset_master.media(object_key),
 source_cell text not null,
 primary key(asset_id,object_key)
);
create table if not exists asset_master.import_runs (
 source_hash text primary key,
 source_name text not null,
 imported_at timestamptz not null default now(),
 actor_user_id text not null,
 summary jsonb not null
);
alter table asset_master.assets enable row level security;
alter table asset_master.media enable row level security;
alter table asset_master.asset_media enable row level security;
alter table asset_master.import_runs enable row level security;
revoke all on all tables in schema asset_master from public;
do $$ begin
 if exists(select 1 from pg_roles where rolname='anon') then
  execute 'revoke all on schema asset_master from anon';
  execute 'revoke all on all tables in schema asset_master from anon';
 end if;
 if exists(select 1 from pg_roles where rolname='authenticated') then
  execute 'revoke all on schema asset_master from authenticated';
  execute 'revoke all on all tables in schema asset_master from authenticated';
 end if;
end $$;
