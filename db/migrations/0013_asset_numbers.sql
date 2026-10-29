-- Permanent user-facing numbering, independent of import provenance and internal IDs.
-- PostgreSQL populates existing rows and allocates concurrent inserts atomically.
alter table asset_master.assets add column asset_number bigint generated always as identity;
alter table asset_master.assets add constraint asset_number_unique unique(asset_number);
alter table asset_master.assets add constraint asset_number_positive check(asset_number>0);
create function asset_master.preserve_asset_number() returns trigger
language plpgsql set search_path=pg_catalog as $$
begin
 if new.asset_number is distinct from old.asset_number then
  raise exception using errcode='23514',message='Asset number is immutable';
 end if;
 return new;
end $$;
create trigger preserve_asset_number before update of asset_number on asset_master.assets
 for each row execute function asset_master.preserve_asset_number();
revoke all on sequence asset_master.assets_asset_number_seq from public;
revoke all on function asset_master.preserve_asset_number() from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on sequence asset_master.assets_asset_number_seq from %I',role_name);
   execute format('revoke all on function asset_master.preserve_asset_number() from %I',role_name);
  end if;
 end loop;
end $$;
