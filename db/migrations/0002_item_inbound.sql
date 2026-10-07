-- A receipt is physical evidence for one RequestItem, not its entire Request.
alter table booking.request_items add column if not exists actual_inbound_at timestamp without time zone;

-- A group may only contain items belonging to the same Request.
create unique index if not exists request_items_request_id_id_idx on booking.request_items(request_id, id);
create unique index if not exists request_groups_request_id_id_idx on booking.request_groups(request_id, id);
alter table booking.request_group_items add column if not exists request_id uuid;
update booking.request_group_items gi set request_id = g.request_id
from booking.request_groups g where gi.group_id = g.id and gi.request_id is null;
alter table booking.request_group_items alter column request_id set not null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'group_items_group_request_fk') then
    alter table booking.request_group_items add constraint group_items_group_request_fk
      foreign key (request_id, group_id) references booking.request_groups(request_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'group_items_item_request_fk') then
    alter table booking.request_group_items add constraint group_items_item_request_fk
      foreign key (request_id, request_item_id) references booking.request_items(request_id, id);
  end if;
end $$;
