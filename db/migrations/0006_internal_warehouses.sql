create table if not exists asset_master.internal_warehouses (
 id text primary key,
 name text unique not null,
 address text not null default '',
 source text not null
);
alter table asset_master.internal_warehouses enable row level security;
revoke all on asset_master.internal_warehouses from public;
alter table asset_master.assets add column if not exists internal_warehouse_id text references asset_master.internal_warehouses(id);
do $$ begin
 if exists(select 1 from pg_roles where rolname='anon') then execute 'revoke all on asset_master.internal_warehouses from anon'; end if;
 if exists(select 1 from pg_roles where rolname='authenticated') then execute 'revoke all on asset_master.internal_warehouses from authenticated'; end if;
end $$;
