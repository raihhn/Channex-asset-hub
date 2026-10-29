-- Development-only fixture identities. Never treat this as production migration.
insert into booking.assets (id, category, classification, tracking_type, availability_hint, maintenance_hold, inspection_hold, issue_hold, blocked_ranges, available_quantity) values
('wardah-glow-pavilion','Booth','ASSET','Individual','available',false,false,false,'[{"start":"2026-09-12","end":"2026-09-15"}]',1),
('kahf-mountain-booth','Booth','ASSET','Individual','in-use',false,false,false,'[]',1),
('emina-play-modular','Booth','ASSET','Individual','reserved',false,false,false,'[]',1),
('make-over-studio-counter','Display','ASSET','Individual','available',false,false,false,'[]',1),
('labore-derma-display','Display','ASSET','Individual','maintenance',true,true,false,'[]',1),
('wardah-posm-kit','POSM','ASSET','Quantity-based','available',false,false,false,'[]',12),
('wardah-lighting-kit','Supporting asset','ASSET','Quantity-based','available',false,false,false,'[]',4),
('wardah-curved-counter','Supporting asset','ASSET','Individual','available',false,true,false,'[]',1),
('tavi-reuse-display','Display','INVENTORY','Individual','unavailable',false,false,true,'[]',1),
('return-demo-pavilion','Booth','ASSET','Individual','reserved',false,false,false,'[]',1),
('return-demo-display','Display','ASSET','Individual','in-use',false,false,false,'[]',1),
('return-demo-counter','Display','ASSET','Individual','reserved',false,false,false,'[]',1),
('return-demo-kit','Supporting asset','ASSET','Individual','reserved',false,true,true,'[]',1)
on conflict (id) do nothing;

-- Legacy fixture occupancy snapshots. They protect local demonstrations from
-- forgetting fixture bookings; they are NOT production-imported Requests.
insert into booking.requests (id, request_number, status, start_date, end_date, outbound_at, inbound_at, actual_inbound_at, submitted_by_user_id, payload, is_demo) values
(md5('REQ-2026-022')::uuid,'REQ-2026-022','Pending approval','2026-10-12','2026-10-14','2026-10-10 09:00','2026-10-15 17:00',null,'legacy','{}',true),
(md5('REQ-2026-018')::uuid,'REQ-2026-018','Pending approval','2026-09-03','2026-09-05','2026-09-03 00:00','2026-09-05 23:59',null,'legacy','{}',true),
(md5('REQ-2026-014')::uuid,'REQ-2026-014','Approved','2026-08-22','2026-08-24','2026-08-22 00:00','2026-08-24 23:59',null,'legacy','{}',true),
(md5('REQ-2026-009')::uuid,'REQ-2026-009','In use','2026-08-08','2026-08-17','2026-08-08 00:00','2026-08-17 23:59',null,'legacy','{}',true),
(md5('REQ-2026-004')::uuid,'REQ-2026-004','Completed','2026-07-08','2026-07-10','2026-07-08 00:00','2026-07-10 23:59',null,'legacy','{}',true),
(md5('REQ-2026-030')::uuid,'REQ-2026-030','Return due','2026-09-29','2026-10-01','2026-09-28 09:00','2026-10-03 14:00','2026-10-03 13:50','legacy','{}',true),
(md5('REQ-2026-031')::uuid,'REQ-2026-031','Return due','2026-10-02','2026-10-04','2026-10-01 09:00','2026-10-12 16:00','2026-10-04 16:00','legacy','{}',true),
(md5('REQ-2026-032')::uuid,'REQ-2026-032','Inspection pending','2026-09-30','2026-10-01','2026-09-29 09:00','2026-10-02 17:00','2026-10-02 16:15','legacy','{}',true)
on conflict (id) do nothing;

insert into booking.request_items (id, request_id, asset_id, quantity) values
(md5('REQ-2026-022:item:1')::uuid,md5('REQ-2026-022')::uuid,'wardah-glow-pavilion',1),
(md5('REQ-2026-018:item:1')::uuid,md5('REQ-2026-018')::uuid,'emina-play-modular',1),
(md5('REQ-2026-018:item:2')::uuid,md5('REQ-2026-018')::uuid,'wardah-posm-kit',2),
(md5('REQ-2026-014:item:1')::uuid,md5('REQ-2026-014')::uuid,'wardah-posm-kit',4),
(md5('REQ-2026-014:item:2')::uuid,md5('REQ-2026-014')::uuid,'wardah-lighting-kit',1),
(md5('REQ-2026-009:item:1')::uuid,md5('REQ-2026-009')::uuid,'kahf-mountain-booth',1),
(md5('REQ-2026-004:item:1')::uuid,md5('REQ-2026-004')::uuid,'make-over-studio-counter',1),
(md5('REQ-2026-030:item:1')::uuid,md5('REQ-2026-030')::uuid,'return-demo-pavilion',1),
(md5('REQ-2026-030:item:2')::uuid,md5('REQ-2026-030')::uuid,'return-demo-display',1),
(md5('REQ-2026-031:item:1')::uuid,md5('REQ-2026-031')::uuid,'return-demo-counter',1),
(md5('REQ-2026-032:item:1')::uuid,md5('REQ-2026-032')::uuid,'return-demo-kit',1)
on conflict (id) do nothing;

-- Only these individual items have authoritative inbound receipts. Other items
-- on the same Request remain reserved until their own receipt exists.
update booking.request_items set actual_inbound_at = '2026-10-03 13:50'
where id = md5('REQ-2026-030:item:1')::uuid;
update booking.request_items set actual_inbound_at = '2026-10-04 16:00'
where id = md5('REQ-2026-031:item:1')::uuid;
update booking.request_items set actual_inbound_at = '2026-10-02 16:15'
where id = md5('REQ-2026-032:item:1')::uuid;
