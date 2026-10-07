import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import pg from "pg";
import type { RequestDraft } from "@/types/prototype";

vi.mock("server-only", () => ({}));

const url = process.env.ASSETHUB_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("/assethub_test")) {
  throw new Error("Booking integration tests require ASSETHUB_DATABASE_URL pointing to assethub_test.");
}
process.env.NEXT_PUBLIC_ASSETHUB_BOOKING_ENABLED = "true";

let booking: typeof import("@/lib/server/booking");
let client: pg.Client;

const actorId = "dev-user";
function draft(assetIds: string[], start = "2027-01-20", end = "2027-01-20", pickupTime = "10:00", returnTime = "12:00"): RequestDraft {
  return {
    items: assetIds.map((assetId) => ({ assetId, quantity: 1 })),
    startDate: start, endDate: end, pickupDate: start, returnDate: end, pickupTime, returnTime,
    destination: "Test venue", projectName: "Persistence test", projectAddress: "Test venue, Jakarta",
    purpose: "Persistence test", contact: "Test PIC", budgetCode: "TEST-001", wbsCodes: [],
    fulfillmentGroups: [{ id: "Fulfillment 1", method: "Delivery", source: "Jakarta Hub", destination: "Test venue", window: "Test", contact: "Test PIC", itemIds: assetIds }],
    returnGroups: [{ id: "Return 1", method: "User return", from: "Test venue", to: "Jakarta Hub", window: "Test", itemIds: assetIds }],
  };
}

async function clearTestRequests() {
  await client.query(`delete from booking.command_receipts where request_id in (select id from booking.requests where not is_demo);
    delete from booking.request_group_items where group_id in (select g.id from booking.request_groups g join booking.requests r on r.id=g.request_id where not r.is_demo);
    delete from booking.request_groups where request_id in (select id from booking.requests where not is_demo);
    delete from booking.request_wbs where request_id in (select id from booking.requests where not is_demo);
    delete from booking.review_history where request_id in (select id from booking.requests where not is_demo);
    delete from booking.approval_assignments where request_id in (select id from booking.requests where not is_demo);
    delete from booking.request_items where request_id in (select id from booking.requests where not is_demo);
    delete from booking.audit_events where related ? 'canonicalId';
    delete from booking.requests where not is_demo;`);
}

beforeAll(async () => {
  client = new pg.Client({ connectionString: url });
  await client.connect();
  booking = await import("@/lib/server/booking");
});
beforeEach(clearTestRequests);
afterAll(async () => { await booking?.closeBookingPool(); await client?.end(); });

describe("real PostgreSQL booking transactions", () => {
  it("allows exactly one of two concurrent overlapping submissions for one Asset", async () => {
    const actor = booking.prototypeActor(actorId);
    const results = await Promise.allSettled([
      booking.submitBooking(draft(["return-demo-pavilion"]), actor, crypto.randomUUID()),
      booking.submitBooking(draft(["return-demo-pavilion"]), actor, crypto.randomUUID()),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.reason).toMatchObject({ code: "CONFLICT", assetId: "return-demo-pavilion" });
    const count = await client.query("select count(*)::int as value from booking.requests where not is_demo");
    expect(count.rows[0].value).toBe(1);
  });

  it("allows concurrent different Assets and adjacent half-open windows", async () => {
    const actor = booking.prototypeActor(actorId);
    const different = await Promise.all([
      booking.submitBooking(draft(["return-demo-pavilion"]), actor, crypto.randomUUID()),
      booking.submitBooking(draft(["return-demo-counter"]), actor, crypto.randomUUID()),
    ]);
    expect(different).toHaveLength(2);
    await clearTestRequests();
    const first = await booking.submitBooking(draft(["return-demo-pavilion"]), actor, crypto.randomUUID());
    const adjacent = await booking.submitBooking(draft(["return-demo-pavilion"], "2027-01-20", "2027-01-20", "12:00", "14:00"), actor, crypto.randomUUID());
    expect(first.id).not.toBe(adjacent.id);
  });

  it("keeps item identity on resubmit, creates a new item ID, and preserves group membership", async () => {
    const actor = booking.prototypeActor(actorId);
    const initial = await booking.submitBooking(draft(["return-demo-pavilion"]), actor, crypto.randomUUID());
    await client.query("update booking.requests set status='Needs update' where request_number=$1", [initial.id]);
    const revised = await booking.resubmitBooking(initial.id, draft(["return-demo-pavilion", "return-demo-counter"], "2027-01-21", "2027-01-21"), actor, 1, crypto.randomUUID());
    expect(revised.id).toBe(initial.id);
    expect(revised.version).toBe(2);
    expect(revised.reviewRound).toBe(2);
    expect(revised.items[0].id).toBe(initial.items[0].id);
    expect(revised.items[1].id).not.toBe(initial.items[0].id);
    expect(revised.fulfillmentGroups?.[0].itemIds).toEqual(expect.arrayContaining(revised.items.map((item) => item.id)));
    expect(revised.returnGroups?.[0].itemIds).toEqual(expect.arrayContaining(revised.items.map((item) => item.id)));
    await expect(booking.resubmitBooking(initial.id, draft(["return-demo-pavilion"], "2027-01-22", "2027-01-22"), actor, 1, crypto.randomUUID())).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("detects a new conflict when Needs Update resubmits without self-conflicting", async () => {
    const actor = booking.prototypeActor(actorId);
    const original = await booking.submitBooking(draft(["return-demo-pavilion"], "2027-02-01", "2027-02-01"), actor, crypto.randomUUID());
    await client.query("update booking.requests set status='Needs update' where request_number=$1", [original.id]);
    await booking.submitBooking(draft(["return-demo-pavilion"], "2027-02-04", "2027-02-04"), actor, crypto.randomUUID());
    await expect(booking.resubmitBooking(original.id, draft(["return-demo-pavilion"], "2027-02-04", "2027-02-04"), actor, 1, crypto.randomUUID())).rejects.toMatchObject({ code: "CONFLICT" });
    const unchanged = await booking.loadBooking(original.id);
    expect(unchanged?.status).toBe("Needs update");
    expect(unchanged?.items[0].id).toBe(original.items[0].id);
  });

  it("retries idempotently with one Request, item set, history and audit event", async () => {
    const actor = booking.prototypeActor(actorId);
    const key = crypto.randomUUID();
    const input = draft(["return-demo-pavilion"]);
    const first = await booking.submitBooking(input, actor, key);
    const second = await booking.submitBooking(input, actor, key);
    expect(second.id).toBe(first.id);
    const counts = await client.query(`select
      (select count(*)::int from booking.requests where not is_demo) as requests,
      (select count(*)::int from booking.request_items i join booking.requests r on r.id=i.request_id where not r.is_demo) as items,
      (select count(*)::int from booking.review_history h join booking.requests r on r.id=h.request_id where not r.is_demo) as history,
      (select count(*)::int from booking.audit_events where related ? 'canonicalId') as audit`);
    expect(counts.rows[0]).toMatchObject({ requests: 1, items: 1, history: 1, audit: 1 });
  });

  it("rolls back Request, RequestItems and AuditEvent when group membership is invalid", async () => {
    const actor = booking.prototypeActor(actorId);
    const invalid = draft(["return-demo-pavilion"]);
    invalid.fulfillmentGroups![0].itemIds = ["unmapped-asset"];
    await expect(booking.submitBooking(invalid, actor, crypto.randomUUID())).rejects.toThrow(/Cannot map group member/);
    const counts = await client.query(`select (select count(*)::int from booking.requests where not is_demo) as requests,
      (select count(*)::int from booking.audit_events where related ? 'canonicalId') as audit`);
    expect(counts.rows[0]).toMatchObject({ requests: 0, audit: 0 });
  });

  it("enforces Request/Asset foreign keys and rejects quantity-based booking", async () => {
    await expect(client.query("insert into booking.request_items (request_id,asset_id,quantity) values ($1,$2,1)", [crypto.randomUUID(), "return-demo-pavilion"])).rejects.toMatchObject({ code: "23503" });
    const saved = await booking.submitBooking(draft(["return-demo-pavilion"]), booking.prototypeActor(actorId), crypto.randomUUID());
    await expect(client.query("insert into booking.request_items (request_id,asset_id,quantity) values ((select id from booking.requests where request_number=$1),$2,1)", [saved.id, "missing-asset"])).rejects.toMatchObject({ code: "23503" });
    await expect(booking.submitBooking(draft(["wardah-posm-kit"]), booking.prototypeActor(actorId), crypto.randomUUID())).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("persists reviewer assignment, decision, and a new review cycle on resubmission", async () => {
    const requester = booking.prototypeActor(actorId);
    const reviewer = booking.prototypeActor("user-storedev");
    const first = await booking.submitBooking(draft(["return-demo-pavilion"]), requester, crypto.randomUUID());
    const assigned = await booking.assignBookingReviewer(first.id, reviewer.id, requester, first.version!);
    expect(assigned.assignments.find((item) => item.requestId === first.id)?.reviewerUserId).toBe(reviewer.id);
    const current = assigned.requests.find((item) => item.id === first.id)!;
    const decided = await booking.decideBookingReview(first.id, "Needs update", "Change loading window", reviewer, current.version!);
    expect(decided.requests.find((item) => item.id === first.id)?.status).toBe("Needs update");
    const revision = await booking.resubmitBooking(first.id, draft(["return-demo-pavilion"], "2027-01-22", "2027-01-22"), requester, decided.requests.find((item) => item.id === first.id)!.version!, crypto.randomUUID());
    expect(revision.reviewRound).toBe(2);
    expect(revision.items[0].id).toBe(first.items[0].id);
    expect(revision.reviewHistory?.map((item) => item.action)).toEqual(["Submitted", "Assigned", "Needs update", "Resubmitted"]);
    expect((await booking.loadBookings()).assignments.find((item) => item.requestId === first.id)?.status).toBe("Needs update");
  });

  it("does not release a sibling item when only one item has an inbound receipt", async () => {
    const rows = await client.query("select asset_id,actual_inbound_at from booking.request_items where request_id=md5('REQ-2026-030')::uuid order by asset_id");
    expect(rows.rows.find((item) => item.asset_id === "return-demo-pavilion")?.actual_inbound_at).toBeTruthy();
    expect(rows.rows.find((item) => item.asset_id === "return-demo-display")?.actual_inbound_at).toBeNull();
  });
});
