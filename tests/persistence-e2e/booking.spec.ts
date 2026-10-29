import { expect, test } from "@playwright/test";
import pg from "pg";

const url = process.env.ASSETHUB_DATABASE_URL;
if (!url || !new URL(url).pathname.endsWith("/assethub_test")) throw new Error("Booking E2E requires an isolated assethub_test database.");
const headers = { "x-prototype-actor-id": "dev-user" };
const baseDraft = {
  startDate: "2027-03-10", endDate: "2027-03-10", pickupDate: "2027-03-10", returnDate: "2027-03-10", pickupTime: "10:00", returnTime: "12:00",
  destination: "Test venue", projectName: "Durable browser test", projectAddress: "Test venue, Jakarta", purpose: "Test", contact: "Test PIC", budgetCode: "TEST-001", wbsCodes: [],
};

test.beforeEach(async () => {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(`delete from booking.command_receipts where request_id in (select id from booking.requests where not is_demo);
      delete from booking.request_group_items where request_id in (select id from booking.requests where not is_demo);
      delete from booking.request_groups where request_id in (select id from booking.requests where not is_demo);
      delete from booking.request_wbs where request_id in (select id from booking.requests where not is_demo);
      delete from booking.review_history where request_id in (select id from booking.requests where not is_demo);
      delete from booking.approval_assignments where request_id in (select id from booking.requests where not is_demo);
      delete from booking.request_items where request_id in (select id from booking.requests where not is_demo);
      delete from booking.audit_events where related ? 'canonicalId';
      delete from booking.requests where not is_demo;`);
  } finally { await client.end(); }
});

test("Custom Booth persists without a fake Asset after browser refresh", async ({ request, page }) => {
  const created = await request.post("/api/booking/requests", { headers, data: { draft: { ...baseDraft, items: [], boothType: "Custom Booth" }, commandKey: crypto.randomUUID() } });
  expect(created.status()).toBe(201);
  const saved = await created.json();
  expect(saved.items).toEqual([]);
  await page.goto(`/requests/${saved.id}`);
  await expect(page.getByText(saved.id).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(saved.id).first()).toBeVisible();
  const reread = await request.get(`/api/booking/requests/${saved.id}`);
  expect((await reread.json()).canonicalId).toBe(saved.canonicalId);
});

test("overlapping booking returns a conflict while adjacent window succeeds", async ({ request }) => {
  const draft = { ...baseDraft, items: [{ assetId: "return-demo-pavilion", quantity: 1 }] };
  const first = await request.post("/api/booking/requests", { headers, data: { draft, commandKey: crypto.randomUUID() } });
  expect(first.status()).toBe(201);
  const conflicting = await request.post("/api/booking/requests", { headers, data: { draft, commandKey: crypto.randomUUID() } });
  expect(conflicting.status()).toBe(409);
  expect(await conflicting.json()).toMatchObject({ code: "CONFLICT", assetId: "return-demo-pavilion" });
  const adjacent = await request.post("/api/booking/requests", { headers, data: { draft: { ...draft, pickupTime: "12:00", returnTime: "14:00" }, commandKey: crypto.randomUUID() } });
  expect(adjacent.status()).toBe(201);
});

test("Needs Update review cycle persists through resubmit and refresh", async ({ request }) => {
  const draft = { ...baseDraft, items: [{ assetId: "return-demo-pavilion", quantity: 1 }] };
  const created = await request.post("/api/booking/requests", { headers, data: { draft, commandKey: crypto.randomUUID() } });
  expect(created.status()).toBe(201);
  const saved = await created.json();
  const assignedResponse = await request.post(`/api/booking/requests/${saved.id}/review`, { headers, data: { action: "assign", reviewerId: "user-storedev", expectedVersion: saved.version } });
  expect(assignedResponse.status()).toBe(200);
  const assigned = await assignedResponse.json();
  const current = assigned.requests.find((item: { id: string }) => item.id === saved.id);
  const decidedResponse = await request.post(`/api/booking/requests/${saved.id}/review`, { headers: { "x-prototype-actor-id": "user-storedev" }, data: { action: "decide", decision: "Needs update", note: "Adjust loading", expectedVersion: current.version } });
  expect(decidedResponse.status()).toBe(200);
  const decided = await decidedResponse.json();
  const revision = decided.requests.find((item: { id: string }) => item.id === saved.id);
  const resubmitted = await request.patch(`/api/booking/requests/${saved.id}`, { headers, data: { draft: { ...draft, pickupTime: "09:00" }, expectedVersion: revision.version, commandKey: crypto.randomUUID() } });
  expect(resubmitted.status()).toBe(200);
  const final = await resubmitted.json();
  expect(final.items[0].id).toBe(saved.items[0].id);
  expect(final.reviewRound).toBe(2);
  expect((await (await request.get(`/api/booking/requests/${saved.id}`)).json()).reviewHistory).toHaveLength(4);
});
