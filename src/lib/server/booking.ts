import "server-only";

import { createHash, randomUUID } from "node:crypto";
import pg, { type PoolClient } from "pg";

import { getBoothUsageValidation } from "@/lib/domain/events";
import { validateReviewerAssignment, validateReviewDecision } from "@/lib/domain/approvals";
import { normalizeGroupItemIds, preserveRequestItemIds } from "@/lib/domain/request-item-identity";
import { getOperationalWindowFromFields, validateOperationalWindow } from "@/lib/domain/reservations";
import { uniqueWbsCodes } from "@/lib/domain/wbs-references";
import { peopleFixtures } from "@/lib/fixtures/people";
import type { AuditEvent, Person } from "@/types/identity";
import type { ApprovalAssignment, ApprovalDecision, PrototypeRequest, RequestDraft, RequestItem, WbsReference } from "@/types/prototype";

export class BookingError extends Error {
  constructor(public code: "VALIDATION" | "CONFLICT" | "STALE" | "NOT_FOUND" | "DISABLED", message: string, public assetId?: string) {
    super(message);
    this.name = "BookingError";
  }
}

const pool = new pg.Pool({
  connectionString: process.env.ASSETHUB_DATABASE_URL,
  max: 10,
});

export function bookingConfigured() {
  // No production auth exists. The bridge is intentionally restricted to a
  // loopback database, including local `next start` preview builds.
  const url = process.env.ASSETHUB_DATABASE_URL;
  if (!url || process.env.NEXT_PUBLIC_ASSETHUB_BOOKING_ENABLED !== "true") return false;
  try { return process.env.NODE_ENV !== "production" || ["localhost", "127.0.0.1"].includes(new URL(url).hostname); }
  catch { return false; }
}

function configuredPool() {
  if (!bookingConfigured()) throw new BookingError("DISABLED", "Durable booking is not configured.");
  return pool;
}

/** Prototype-only: allowlisted browser-selected Person, NOT authenticated identity. */
export function prototypeActor(actorId: string | null): Person {
  const actor = peopleFixtures.find((person) => person.id === actorId && person.status === "ACTIVE");
  if (!actor) throw new BookingError("VALIDATION", "Choose an active prototype user.");
  return actor;
}

type AssetRow = {
  id: string;
  category: string;
  classification: string;
  tracking_type: string;
  availability_hint: string;
  maintenance_hold: boolean;
  inspection_hold: boolean;
  issue_hold: boolean;
  blocked_ranges: Array<{ start: string; end: string }>;
  available_quantity: number | null;
};

async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await configuredPool().connect();
  try {
    await client.query("begin");
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

function validateDraft(draft: RequestDraft) {
  if (!draft.projectName?.trim() || !draft.projectAddress?.trim() || !draft.destination?.trim() || !draft.contact?.trim() || !draft.budgetCode?.trim()) {
    throw new BookingError("VALIDATION", "Complete the project, destination, contact, and budget code before submitting.");
  }
  if (!draft.items.length && draft.boothType !== "Custom Booth") throw new BookingError("VALIDATION", "Choose at least one Asset or a Custom Booth requirement.");
  const window = getOperationalWindowFromFields(draft.pickupDate ?? draft.startDate, draft.pickupTime ?? "00:00", draft.returnDate ?? draft.endDate, draft.returnTime ?? "23:59");
  const dates = validateOperationalWindow(draft.startDate, draft.endDate, window);
  if (!dates.valid || window.outboundAt === window.inboundAt) throw new BookingError("VALIDATION", dates.error || "Choose a non-empty operational window.");
  const booth = getBoothUsageValidation(draft.boothType, draft.startDate, draft.endDate);
  if (booth.invalidDateRange || booth.exceedsLimit) throw new BookingError("VALIDATION", "Booth use over 30 calendar days requires extension approval before continuing.");
  const seen = new Set<string>();
  for (const item of draft.items) {
    if (!item.assetId || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || seen.has(item.assetId)) throw new BookingError("VALIDATION", "Each selected Asset needs one valid, unique RequestItem.");
    seen.add(item.assetId);
  }
  return window;
}

async function lockAndValidateAssets(client: PoolClient, draft: RequestDraft, excludeRequestId?: string) {
  const window = validateDraft(draft);
  const assets: AssetRow[] = [];
  for (const item of [...draft.items].sort((a, b) => a.assetId.localeCompare(b.assetId))) {
    const result = await client.query<AssetRow>("select * from booking.assets where id = $1 for update", [item.assetId]);
    const asset = result.rows[0];
    if (!asset || asset.classification !== "ASSET") throw new BookingError("VALIDATION", "Selected Asset is not bookable.", item.assetId);
    // Stock allocation is not a Slice 10 guarantee. Reject it, do not silently double-book a pool.
    if (asset.tracking_type !== "Individual") throw new BookingError("VALIDATION", "Quantity-based Asset booking is not yet supported by durable booking.", item.assetId);
    if (item.quantity !== 1) throw new BookingError("VALIDATION", "Individual Assets have quantity one.", item.assetId);
    if (asset.availability_hint === "unavailable" || asset.maintenance_hold || asset.inspection_hold || asset.issue_hold || asset.blocked_ranges.some((range) => draft.startDate <= range.end && draft.endDate >= range.start)) {
      throw new BookingError("CONFLICT", "This Asset is not operationally ready for the selected dates.", item.assetId);
    }
    assets.push(asset);
    const conflict = await client.query<{ request_number: string }>(
      `select r.request_number from booking.request_items i join booking.requests r on r.id = i.request_id
       where i.asset_id = $1 and r.status not in ('Draft','Rejected','Cancelled')
         and ($4::uuid is null or r.id <> $4::uuid)
         and r.outbound_at < $3::timestamp
         and coalesce(i.actual_inbound_at, case when r.inbound_at < timezone('Asia/Jakarta', now()) then 'infinity'::timestamp else r.inbound_at end) > $2::timestamp
       limit 1`,
      [item.assetId, window.outboundAt, window.inboundAt, excludeRequestId ?? null],
    );
    if (conflict.rowCount) throw new BookingError("CONFLICT", `This Asset is no longer available for the selected operational window (${conflict.rows[0].request_number}).`, item.assetId);
  }
  if (draft.boothType === "Regular Booth" && !assets.some((asset) => asset.category === "Booth")) throw new BookingError("VALIDATION", "Regular Booth requires an existing physical Booth Asset.");
  return window;
}

async function saveChildren(client: PoolClient, requestUuid: string, draft: RequestDraft, oldItems: RequestItem[] = []) {
  const items = preserveRequestItemIds(oldItems, draft.items, randomUUID);
  const fulfillmentGroups = normalizeGroupItemIds(draft.fulfillmentGroups, items) ?? [];
  const returnGroups = normalizeGroupItemIds(draft.returnGroups, items) ?? [];
  await client.query("delete from booking.request_group_items where group_id in (select id from booking.request_groups where request_id=$1)", [requestUuid]);
  await client.query("delete from booking.request_groups where request_id=$1", [requestUuid]);
  const keepIds = items.map((item) => item.id);
  await client.query("delete from booking.request_items where request_id=$1 and not (id = any($2::uuid[]))", [requestUuid, keepIds]);
  for (const item of items) {
    await client.query(`insert into booking.request_items (id, request_id, asset_id, quantity, payload) values ($1,$2,$3,$4,$5::jsonb)
      on conflict (id) do update set quantity=excluded.quantity, payload=excluded.payload, updated_at=now()`,
    [item.id, requestUuid, item.assetId, item.quantity, JSON.stringify(item)]);
  }
  for (const [kind, groups] of [["Fulfillment", fulfillmentGroups], ["Return", returnGroups]] as const) {
    for (const [position, group] of groups.entries()) {
      const groupId = randomUUID();
      const { itemIds, ...payload } = group;
      await client.query("insert into booking.request_groups (id,request_id,kind,position,payload) values ($1,$2,$3,$4,$5::jsonb)", [groupId, requestUuid, kind, position, JSON.stringify(payload)]);
      for (const itemId of itemIds) await client.query("insert into booking.request_group_items (request_id,group_id,request_item_id) values ($1,$2,$3)", [requestUuid, groupId, itemId]);
    }
  }
  await client.query("delete from booking.request_wbs where request_id=$1", [requestUuid]);
  for (const code of uniqueWbsCodes(draft.wbsCodes)) {
    const wbs = await client.query<{ id: string }>("insert into booking.wbs_references (code) values ($1) on conflict (code) do update set code=excluded.code returning id", [code]);
    await client.query("insert into booking.request_wbs (request_id,wbs_id) values ($1,$2)", [requestUuid, wbs.rows[0].id]);
  }
  return { items, fulfillmentGroups, returnGroups };
}

function requestPayload(draft: RequestDraft) {
  const { items: _items, fulfillmentGroups: _fulfillmentGroups, returnGroups: _returnGroups, wbsCodes: _wbsCodes, ...fields } = draft;
  return { ...fields, supportingDocuments: fields.supportingDocuments?.map(({ dataUrl: _dataUrl, ...document }) => document) };
}

async function recordAudit(client: PoolClient, actor: Person, action: string, requestNumber: string, summary: string, requestUuid: string) {
  await client.query(`insert into booking.audit_events (actor_user_id,actor_name_snapshot,action,entity_type,entity_id,summary,related)
    values ($1,$2,$3,'REQUEST',$4,$5,$6::jsonb)`, [actor.id, actor.name, action, requestNumber, summary, JSON.stringify({ requestId: requestNumber, canonicalId: requestUuid })]);
}

async function recordHistory(client: PoolClient, requestUuid: string, actor: Person, action: string, cycle: number) {
  await client.query(`insert into booking.review_history (request_id,cycle,action,actor_user_id,actor_name_snapshot) values ($1,$2,$3,$4,$5)`, [requestUuid, cycle, action, actor.id, actor.name]);
}

type AssignmentRow = { id: string; cycle: number; sequence: number; reviewer_user_id: string; status: ApprovalAssignment["status"]; assigned_at: string; assigned_by_user_id: string };

function toAssignment(row: AssignmentRow, requestNumber: string): ApprovalAssignment {
  return { id: row.id, requestId: requestNumber, cycle: row.cycle, sequence: row.sequence, reviewerUserId: row.reviewer_user_id, status: row.status, assignedAt: row.assigned_at, assignedByUserId: row.assigned_by_user_id };
}

async function lockedRequest(client: PoolClient, requestNumber: string) {
  const rows = await client.query<RequestRow>("select id,request_number,status,start_date::text,end_date::text,submitted_by_user_id,review_round,version,payload,submitted_at from booking.requests where request_number=$1 and not is_demo for update", [requestNumber]);
  if (!rows.rows[0]) throw new BookingError("NOT_FOUND", "Persisted Request not found.");
  return rows.rows[0];
}

export async function assignBookingReviewer(requestNumber: string, reviewerId: string, actor: Person, expectedVersion: number) {
  await withTransaction(async (client) => {
    const row = await lockedRequest(client, requestNumber);
    if (row.version !== expectedVersion) throw new BookingError("STALE", "Request changed. Refresh before assigning a reviewer.");
    const active = await client.query<AssignmentRow>("select * from booking.approval_assignments where request_id=$1 and status='Pending' for update", [row.id]);
    const previous = active.rows[0] ? toAssignment(active.rows[0], requestNumber) : undefined;
    const reviewer = peopleFixtures.find((person) => person.id === reviewerId);
    let request: PrototypeRequest;
    try {
      request = await assembleRequest(client, row);
      validateReviewerAssignment(request, reviewer, actor, previous ? [previous] : []);
    } catch (error) { throw new BookingError("VALIDATION", error instanceof Error ? error.message : "Invalid reviewer assignment."); }
    if (previous) await client.query("update booking.approval_assignments set status='Superseded' where id=$1", [previous.id]);
    const assignment = await client.query<{ id: string }>(`insert into booking.approval_assignments (request_id,cycle,sequence,reviewer_user_id,status,assigned_by_user_id)
      values ($1,$2,$3,$4,'Pending',$5) returning id`, [row.id, row.review_round, (previous?.sequence ?? 0) + 1, reviewerId, actor.id]);
    await client.query("update booking.requests set version=version+1,updated_at=now() where id=$1", [row.id]);
    await client.query(`insert into booking.review_history (request_id,cycle,action,actor_user_id,actor_name_snapshot,reviewer_user_id,assignment_id,note)
      values ($1,$2,$3,$4,$5,$6,$7,$8)`, [row.id, row.review_round, previous ? "Reassigned" : "Assigned", actor.id, actor.name, reviewerId, assignment.rows[0].id, previous ? `Previous reviewer: ${previous.reviewerUserId}` : null]);
    await recordAudit(client, actor, previous ? "REVIEWER_REASSIGNED" : "REVIEWER_ASSIGNED", requestNumber, `Assigned reviewer ${reviewer!.name} for ${requestNumber}`, row.id);
  });
  return loadBookings();
}

export async function decideBookingReview(requestNumber: string, decision: ApprovalDecision, note: string, actor: Person, expectedVersion: number) {
  if (!["Approved", "Needs update", "Rejected"].includes(decision)) throw new BookingError("VALIDATION", "Invalid review decision.");
  await withTransaction(async (client) => {
    const row = await lockedRequest(client, requestNumber);
    if (row.version !== expectedVersion) throw new BookingError("STALE", "Request changed. Refresh before recording a decision.");
    const active = await client.query<AssignmentRow>("select * from booking.approval_assignments where request_id=$1 and status='Pending' for update", [row.id]);
    const assignment = active.rows[0] ? toAssignment(active.rows[0], requestNumber) : undefined;
    try { validateReviewDecision(await assembleRequest(client, row), assignment, actor, decision, note); }
    catch (error) { throw new BookingError("VALIDATION", error instanceof Error ? error.message : "Invalid review decision."); }
    const trimmed = note.trim();
    await client.query(`update booking.approval_assignments set status=$2,decision=$2,note=$3,decided_at=now(),decided_by_user_id=$4 where id=$1`, [assignment!.id, decision, trimmed || null, actor.id]);
    await client.query(`update booking.requests set status=$2,payload=jsonb_set(jsonb_set(payload,'{approvalComment}',$3::jsonb,true),'{approver}',$4::jsonb,true),version=version+1,updated_at=now() where id=$1`, [row.id, decision, JSON.stringify(trimmed || null), JSON.stringify(actor.name)]);
    await client.query(`insert into booking.review_history (request_id,cycle,action,actor_user_id,actor_name_snapshot,reviewer_user_id,assignment_id,note)
      values ($1,$2,$3,$4,$5,$6,$7,$8)`, [row.id, row.review_round, decision, actor.id, actor.name, assignment!.reviewerUserId, assignment!.id, trimmed || null]);
    await recordAudit(client, actor, decision === "Approved" ? "REVIEW_APPROVED" : decision === "Rejected" ? "REVIEW_REJECTED" : "REVIEW_NEEDS_UPDATE", requestNumber, `${decision} ${requestNumber} by ${actor.name}`, row.id);
  });
  return loadBookings();
}

function fingerprint(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

export async function submitBooking(draft: RequestDraft, actor: Person, commandKey: string): Promise<PrototypeRequest> {
  if (!/^[\da-f]{8}-[\da-f-]{27,}$/i.test(commandKey)) throw new BookingError("VALIDATION", "Invalid submission key.");
  const hash = fingerprint({ draft, actor: actor.id, kind: "submit" });
  const requestNumber = await withTransaction(async (client) => {
    await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [commandKey]);
    const prior = await client.query<{ fingerprint: string; request_number: string }>("select c.fingerprint,r.request_number from booking.command_receipts c join booking.requests r on r.id=c.request_id where c.key=$1", [commandKey]);
    if (prior.rows[0]) {
      if (prior.rows[0].fingerprint !== hash) throw new BookingError("STALE", "Submission key was reused with different content.");
      return prior.rows[0].request_number;
    }
    const window = await lockAndValidateAssets(client, draft);
    const requestUuid = randomUUID();
    const numberResult = await client.query<{ request_number: string }>("select 'REQ-' || to_char(now(),'YYYY') || '-' || lpad(nextval('booking.request_number_seq')::text,4,'0') as request_number");
    const number = numberResult.rows[0].request_number;
    await client.query(`insert into booking.requests (id,request_number,status,start_date,end_date,outbound_at,inbound_at,submitted_by_user_id,payload)
      values ($1,$2,'Pending approval',$3,$4,$5,$6,$7,$8::jsonb)`, [requestUuid, number, draft.startDate, draft.endDate, window.outboundAt, window.inboundAt, actor.id, JSON.stringify(requestPayload(draft))]);
    const { items } = await saveChildren(client, requestUuid, draft);
    await recordHistory(client, requestUuid, actor, "Submitted", 1);
    await recordAudit(client, actor, "REQUEST_SUBMITTED", number, `Submitted ${items.length}-item request ${number}; reviewer assignment required`, requestUuid);
    await client.query("insert into booking.command_receipts (key,kind,fingerprint,request_id) values ($1,'submit',$2,$3)", [commandKey, hash, requestUuid]);
    return number;
  });
  const result = await loadBooking(requestNumber);
  if (!result) throw new Error("Committed booking was not readable.");
  return result;
}

export async function resubmitBooking(requestNumber: string, draft: RequestDraft, actor: Person, expectedVersion: number, commandKey: string): Promise<PrototypeRequest> {
  if (!/^[\da-f]{8}-[\da-f-]{27,}$/i.test(commandKey)) throw new BookingError("VALIDATION", "Invalid submission key.");
  const hash = fingerprint({ draft, actor: actor.id, kind: "resubmit", requestNumber, expectedVersion });
  await withTransaction(async (client) => {
    await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [commandKey]);
    const receipt = await client.query<{ fingerprint: string }>("select fingerprint from booking.command_receipts where key=$1", [commandKey]);
    if (receipt.rows[0]) {
      if (receipt.rows[0].fingerprint !== hash) throw new BookingError("STALE", "Submission key was reused with different content.");
      return;
    }
    const existing = await client.query<{ id: string; status: string; version: number; review_round: number; submitted_by_user_id: string }>("select id,status,version,review_round,submitted_by_user_id from booking.requests where request_number=$1 and not is_demo for update", [requestNumber]);
    const request = existing.rows[0];
    if (!request) throw new BookingError("NOT_FOUND", "Persisted Request not found.");
    if (request.status !== "Needs update") throw new BookingError("VALIDATION", "Only a Request needing an update can be resubmitted.");
    if (request.submitted_by_user_id !== actor.id && !actor.roles.includes("SUPER_ADMIN")) throw new BookingError("VALIDATION", "Only the requester or prototype Super Admin can resubmit this Request.");
    if (request.version !== expectedVersion) throw new BookingError("STALE", "This Request changed. Refresh before resubmitting.");
    const window = await lockAndValidateAssets(client, draft, request.id);
    const previous = await client.query<RequestItem>("select id,asset_id as \"assetId\",quantity from booking.request_items where request_id=$1", [request.id]);
    await client.query(`update booking.requests set status='Pending approval',start_date=$2,end_date=$3,outbound_at=$4,inbound_at=$5,
      review_round=review_round+1,version=version+1,payload=$6::jsonb,submitted_at=now(),updated_at=now()
      where id=$1`, [request.id, draft.startDate, draft.endDate, window.outboundAt, window.inboundAt, JSON.stringify(requestPayload(draft))]);
    const { items } = await saveChildren(client, request.id, draft, previous.rows);
    await recordHistory(client, request.id, actor, "Resubmitted", request.review_round + 1);
    await recordAudit(client, actor, "REQUEST_RESUBMITTED", requestNumber, `Resubmitted ${requestNumber} for review cycle ${request.review_round + 1}; reviewer assignment required`, request.id);
    await client.query("insert into booking.command_receipts (key,kind,fingerprint,request_id) values ($1,'resubmit',$2,$3)", [commandKey, hash, request.id]);
    if (!items.length && draft.boothType !== "Custom Booth") throw new BookingError("VALIDATION", "Request requires an Asset or Custom Booth.");
  });
  const result = await loadBooking(requestNumber);
  if (!result) throw new Error("Committed booking was not readable.");
  return result;
}

type RequestRow = {
  id: string; request_number: string; status: PrototypeRequest["status"]; start_date: string; end_date: string;
  submitted_by_user_id: string; review_round: number; version: number; payload: Omit<PrototypeRequest, "id" | "items">; submitted_at: string;
};

async function assembleRequest(client: PoolClient, row: RequestRow): Promise<PrototypeRequest> {
  const items = await client.query<{ id: string; asset_id: string; quantity: number; payload: RequestItem }>("select id,asset_id,quantity,payload from booking.request_items where request_id=$1 order by created_at,id", [row.id]);
  const groups = await client.query<{ id: string; kind: string; payload: Record<string, unknown>; item_ids: string[] }>(`select g.id,g.kind,g.payload,coalesce(array_agg(gi.request_item_id::text order by gi.request_item_id) filter (where gi.request_item_id is not null),array[]::text[]) as item_ids
    from booking.request_groups g left join booking.request_group_items gi on gi.group_id=g.id where g.request_id=$1 group by g.id order by g.position`, [row.id]);
  const wbs = await client.query<{ id: string }>("select w.id from booking.request_wbs rw join booking.wbs_references w on w.id=rw.wbs_id where rw.request_id=$1", [row.id]);
  const history = await client.query<{ id: string; cycle: number; action: string; actor_user_id: string; actor_name_snapshot: string; reviewer_user_id: string | null; assignment_id: string | null; note: string | null; occurred_at: string }>("select * from booking.review_history where request_id=$1 order by occurred_at,id", [row.id]);
  return {
    ...row.payload, id: row.request_number, canonicalId: row.id, version: row.version, status: row.status,
    startDate: row.start_date, endDate: row.end_date, submittedAt: row.submitted_at,
    submittedByUserId: row.submitted_by_user_id, reviewRound: row.review_round,
    items: items.rows.map((item) => ({ ...item.payload, id: item.id, assetId: item.asset_id, quantity: item.quantity })),
    fulfillmentGroups: groups.rows.filter((group) => group.kind === "Fulfillment").map((group) => ({ ...group.payload, itemIds: group.item_ids })) as PrototypeRequest["fulfillmentGroups"],
    returnGroups: groups.rows.filter((group) => group.kind === "Return").map((group) => ({ ...group.payload, itemIds: group.item_ids })) as PrototypeRequest["returnGroups"],
    wbsReferenceIds: wbs.rows.map((item) => item.id),
    reviewHistory: history.rows.map((entry) => ({ id: entry.id, cycle: entry.cycle, timestamp: entry.occurred_at, action: entry.action as NonNullable<PrototypeRequest["reviewHistory"]>[number]["action"], actorUserId: entry.actor_user_id, actorNameSnapshot: entry.actor_name_snapshot, reviewerUserId: entry.reviewer_user_id ?? undefined, assignmentId: entry.assignment_id ?? undefined, note: entry.note ?? undefined })),
  };
}

export async function loadBooking(requestNumber: string): Promise<PrototypeRequest | undefined> {
  const client = await configuredPool().connect();
  try {
    const rows = await client.query<RequestRow>("select id,request_number,status,start_date::text,end_date::text,submitted_by_user_id,review_round,version,payload,submitted_at from booking.requests where request_number=$1 and not is_demo", [requestNumber]);
    return rows.rows[0] ? assembleRequest(client, rows.rows[0]) : undefined;
  } finally { client.release(); }
}

export async function loadBookings(): Promise<{ requests: PrototypeRequest[]; wbsReferences: WbsReference[]; assignments: ApprovalAssignment[]; auditEvents: AuditEvent[] }> {
  const client = await configuredPool().connect();
  try {
    const rows = await client.query<RequestRow>("select id,request_number,status,start_date::text,end_date::text,submitted_by_user_id,review_round,version,payload,submitted_at from booking.requests where not is_demo order by submitted_at desc", []);
    const requests = await Promise.all(rows.rows.map((row) => assembleRequest(client, row)));
    const wbs = await client.query<{ id: string; code: string; created_at: string }>("select id,code,created_at::text from booking.wbs_references");
    const assignments = await client.query<{ id: string; request_number: string; cycle: number; sequence: number; reviewer_user_id: string; status: ApprovalAssignment["status"]; assigned_at: string; assigned_by_user_id: string; decided_at: string | null; decided_by_user_id: string | null; decision: ApprovalAssignment["decision"] | null; note: string | null }>("select a.*,r.request_number from booking.approval_assignments a join booking.requests r on r.id=a.request_id where not r.is_demo order by a.assigned_at desc");
    const audit = await client.query<{ id: string; occurred_at: string; actor_user_id: string; actor_name_snapshot: string; action: AuditEvent["action"]; entity_type: AuditEvent["entityType"]; entity_id: string; summary: string; related: AuditEvent["related"] }>("select * from booking.audit_events order by occurred_at desc");
    return { requests, wbsReferences: wbs.rows.map((entry) => ({ id: entry.id, code: entry.code, createdAt: entry.created_at })), assignments: assignments.rows.map((entry) => ({ id: entry.id, requestId: entry.request_number, cycle: entry.cycle, sequence: entry.sequence, reviewerUserId: entry.reviewer_user_id, status: entry.status, assignedAt: entry.assigned_at, assignedByUserId: entry.assigned_by_user_id, decidedAt: entry.decided_at ?? undefined, decidedByUserId: entry.decided_by_user_id ?? undefined, decision: entry.decision ?? undefined, note: entry.note ?? undefined })), auditEvents: audit.rows.map((entry) => ({ id: entry.id, timestamp: entry.occurred_at, actorUserId: entry.actor_user_id, actorNameSnapshot: entry.actor_name_snapshot, action: entry.action, entityType: entry.entity_type, entityId: entry.entity_id, summary: entry.summary, related: entry.related })) };
  } finally { client.release(); }
}

export async function closeBookingPool() { await pool.end(); }
