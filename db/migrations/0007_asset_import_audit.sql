create table if not exists asset_master.audit_events (
 id uuid primary key default gen_random_uuid(),
 asset_id text references asset_master.assets(id),
 actor_user_id text not null,
 action text not null,
 changes jsonb not null,
 occurred_at timestamptz not null default now()
);
alter table asset_master.audit_events enable row level security;
revoke all on asset_master.audit_events from public;
do $$ begin
 if exists(select 1 from pg_roles where rolname='anon') then execute 'revoke all on asset_master.audit_events from anon'; end if;
 if exists(select 1 from pg_roles where rolname='authenticated') then execute 'revoke all on asset_master.audit_events from authenticated'; end if;
end $$;
