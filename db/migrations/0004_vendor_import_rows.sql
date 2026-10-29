-- Preserve supplied incomplete fields and additional emails without inventing PICs.
create table if not exists vendor_master.import_rows (
  source_key text primary key,
  vendor_id uuid not null references vendor_master.vendors(id) on delete restrict,
  warehouse_id uuid references vendor_master.warehouses(id) on delete restrict,
  source jsonb not null,
  issues text[] not null default '{}',
  imported_at timestamptz not null default now()
);
alter table vendor_master.import_rows enable row level security;
