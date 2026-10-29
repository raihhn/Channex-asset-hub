-- Gate 1 additive foundation only. No active migration or end-user registration activation.
create table asset_master.asset_groups (
 id uuid primary key,
 name text not null check(length(btrim(name)) between 1 and 250),
 owner_contact_id uuid not null references contact_core.internal_contacts(id) on delete restrict,
 managing_contact_id uuid not null references contact_core.internal_contacts(id) on delete restrict,
 version integer not null default 1 check(version>0),
 created_by text not null references identity_core.people(id) on delete restrict,
 updated_by text not null references identity_core.people(id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table asset_master.asset_group_memberships (
 asset_id text primary key references asset_master.assets(id) on delete restrict,
 group_id uuid not null references asset_master.asset_groups(id) on delete restrict,
 joined_by text not null references identity_core.people(id) on delete restrict,
 joined_at timestamptz not null default now()
);
create index asset_group_members on asset_master.asset_group_memberships(group_id,asset_id);
create table contact_core.asset_owner_contacts (
 asset_id text primary key references asset_master.assets(id) on delete restrict,
 contact_id uuid not null references contact_core.internal_contacts(id) on delete restrict,
 assigned_by text not null references identity_core.people(id) on delete restrict,
 assigned_at timestamptz not null default now()
);
create index asset_owner_contact on contact_core.asset_owner_contacts(contact_id);
create table asset_master.registration_receipts (
 key uuid primary key,
 actor_user_id text not null references identity_core.people(id) on delete restrict,
 fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
 fingerprint_version integer not null check(fingerprint_version=1),
 asset_id text not null unique references asset_master.assets(id) on delete restrict,
 created_at timestamptz not null default now()
);
-- Lock the individual before every assignment mutation, including existing PIC operations.
create function asset_master.lock_assignment_asset() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 if TG_OP='UPDATE' and OLD.asset_id is distinct from NEW.asset_id then
  raise exception using errcode='23514',message='Assignment asset identity is immutable';
 end if;
 perform 1 from asset_master.assets where id=case when TG_OP='DELETE' then OLD.asset_id else NEW.asset_id end for update;
 if TG_OP='DELETE' then return OLD; else return NEW; end if;
end $$;
create function asset_master.check_assignment_source() returns trigger language plpgsql set search_path=pg_catalog as $$
declare aid text;
begin
 aid:=case when TG_OP='DELETE' then OLD.asset_id else NEW.asset_id end;
 if exists(select 1 from asset_master.asset_group_memberships where asset_id=aid) and
   (exists(select 1 from contact_core.asset_owner_contacts where asset_id=aid) or
    exists(select 1 from contact_core.asset_management_contacts where asset_id=aid)) then
  raise exception using errcode='23514',message='Group member cannot have competing direct assignments';
 end if;
 return null;
end $$;
create function asset_master.reject_group_change() returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 raise exception using errcode='23514',message='Group reassignment and membership changes are deferred';
end $$;
create trigger asset_group_immutable before update or delete on asset_master.asset_groups
 for each row execute function asset_master.reject_group_change();
create trigger asset_membership_immutable before update or delete on asset_master.asset_group_memberships
 for each row execute function asset_master.reject_group_change();
create trigger asset_membership_lock before insert on asset_master.asset_group_memberships
 for each row execute function asset_master.lock_assignment_asset();
create trigger asset_owner_lock before insert or update or delete on contact_core.asset_owner_contacts
 for each row execute function asset_master.lock_assignment_asset();
create trigger asset_pic_lock before insert or update or delete on contact_core.asset_management_contacts
 for each row execute function asset_master.lock_assignment_asset();
create constraint trigger membership_assignment_source after insert on asset_master.asset_group_memberships
 deferrable initially deferred for each row execute function asset_master.check_assignment_source();
create constraint trigger owner_assignment_source after insert or update or delete on contact_core.asset_owner_contacts
 deferrable initially deferred for each row execute function asset_master.check_assignment_source();
create constraint trigger pic_assignment_source after insert or update or delete on contact_core.asset_management_contacts
 deferrable initially deferred for each row execute function asset_master.check_assignment_source();
alter table asset_master.asset_groups enable row level security;
alter table asset_master.asset_group_memberships enable row level security;
alter table contact_core.asset_owner_contacts enable row level security;
alter table asset_master.registration_receipts enable row level security;
revoke all on asset_master.asset_groups,asset_master.asset_group_memberships,contact_core.asset_owner_contacts,asset_master.registration_receipts from public;
revoke all on function asset_master.lock_assignment_asset(),asset_master.check_assignment_source(),asset_master.reject_group_change() from public;
do $$ declare browser_role text; begin
 foreach browser_role in array array['anon','authenticated'] loop
  if exists(select 1 from pg_roles where rolname=browser_role) then
   execute format('revoke all on asset_master.asset_groups,asset_master.asset_group_memberships,contact_core.asset_owner_contacts,asset_master.registration_receipts from %I',browser_role);
   execute format('revoke all on function asset_master.lock_assignment_asset(),asset_master.check_assignment_source(),asset_master.reject_group_change() from %I',browser_role);
  end if;
 end loop;
end $$;
