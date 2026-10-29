-- Private documentation and receipt extension. Apply only after reviewed 0011.
alter table asset_master.asset_media alter column source_cell drop not null;
create table asset_master.asset_photos (
 id uuid primary key,
 asset_id text not null references asset_master.assets(id) on delete restrict,
 object_key text not null,
 category text not null check(category in ('Asset','Condition')),
 view text not null check(view in ('Front','Left side','Right side','Rear','Detail','Installed','Other')),
 caption text not null default '' check(length(caption)<=2000),
 is_primary boolean not null default false,
 revision integer not null default 1 check(revision>0),
 predecessor_id uuid,
 replaces_source_id text,
 superseded_at timestamptz,
 created_by text not null references identity_core.people(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(asset_id,id),
 foreign key(asset_id,object_key) references asset_master.asset_media(asset_id,object_key) on delete restrict,
 foreign key(asset_id,predecessor_id) references asset_master.asset_photos(asset_id,id) on delete restrict,
 check(not is_primary or category='Asset'),
 check(predecessor_id is null or replaces_source_id is null),
 unique(predecessor_id),
 unique(asset_id,replaces_source_id)
);
create unique index asset_photo_primary on asset_master.asset_photos(asset_id) where is_primary and superseded_at is null;
create index asset_photo_history on asset_master.asset_photos(asset_id,created_at,id);
create table asset_master.documentation_receipts (
 key uuid primary key,
 actor_user_id text not null references identity_core.people(id) on delete restrict,
 asset_id text not null references asset_master.assets(id) on delete restrict,
 fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
 result_photo_ids uuid[] not null,
 created_at timestamptz not null default now()
);
create index asset_documentation_receipts on asset_master.documentation_receipts(asset_id);
create index asset_business_history on asset_master.audit_events(asset_id,occurred_at,id);
alter table asset_master.registration_receipts drop constraint registration_receipts_fingerprint_version_check;
alter table asset_master.registration_receipts add check(fingerprint_version in (1,2));
alter table asset_master.asset_photos enable row level security;
alter table asset_master.documentation_receipts enable row level security;
revoke all on asset_master.asset_photos,asset_master.documentation_receipts from public;
do $$ declare role_name text; begin
 foreach role_name in array array['anon','authenticated'] loop
  if exists(select 1 from pg_roles where rolname=role_name) then
   execute format('revoke all on asset_master.asset_photos,asset_master.documentation_receipts from %I',role_name);
  end if;
 end loop;
end $$;
