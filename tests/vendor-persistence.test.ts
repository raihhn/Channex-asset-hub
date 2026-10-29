import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import pg from "pg";
import { peopleFixtures } from "@/lib/fixtures/people";
import type { VendorDraft } from "@/types/vendor";
vi.mock("server-only", () => ({}));
const url = process.env.ASSETHUB_VENDOR_TEST_DATABASE_URL;
describe.skipIf(!url)("vendor PostgreSQL persistence", () => {
  let api: typeof import("@/lib/server/vendors");
  let client: pg.Client;
  const ids: string[] = [];
  const admin = peopleFixtures.find((p) => p.id === "dev-user")!;
  function draft(): VendorDraft {
    const pic = randomUUID();
    return {
      name: `Test vendor ${randomUUID()}`,
      legalName: "Test legal name",
      active: true,
      contacts: [
        {
          id: pic,
          name: "PIC A",
          phone: "08123456789",
          email: "pic@example.com",
          active: true,
        },
      ],
      warehouses: [
        {
          id: randomUUID(),
          name: "Jakarta",
          address: "Free text address",
          addressVerified: true,
          active: true,
          contactIds: [pic],
        },
        {
          id: randomUUID(),
          name: "Surabaya",
          address: "Other warehouse",
          addressVerified: false,
          active: true,
          contactIds: [pic],
        },
      ],
    };
  }
  beforeAll(async () => {
    if (
      !url ||
      !new URL(url).pathname.endsWith("/assethub_test") ||
      !["localhost", "127.0.0.1"].includes(new URL(url).hostname)
    )
      throw Error("Vendor tests require local assethub_test database.");
    process.env.ASSETHUB_DATABASE_URL = url;
    process.env.ASSETHUB_VENDOR_ENABLED = "true";
    client = new pg.Client({ connectionString: url });
    await client.connect();
    await client.query(
      await fs.readFile("db/migrations/0003_vendor_master.sql", "utf8"),
    );
    await client.query(
      await fs.readFile("db/migrations/0004_vendor_import_rows.sql", "utf8"),
    );
    api = await import("@/lib/server/vendors");
  });
  afterAll(async () => {
    if (!client) return;
    for (const id of ids)
      for (const table of [
        "import_rows",
        "audit_events",
        "warehouse_contacts",
        "warehouses",
        "contacts",
        "vendors",
      ])
        await client.query(
          `delete from vendor_master.${table} where ${table === "vendors" ? "id" : "vendor_id"}=$1`,
          [id],
        );
    await client.end();
    await api?.closeVendorPool();
  });
  it("persists reusable PIC links, contact changes and immutable IDs", async () => {
    const saved = await api.saveVendor(draft(), admin);
    ids.push(saved.id);
    const reloaded = (await api.listVendors(admin)).find(
      (v) => v.id === saved.id,
    )!;
    expect(reloaded.warehouses).toHaveLength(2);
    expect(reloaded.contacts).toHaveLength(1);
    const update = structuredClone(reloaded);
    update.contacts[0].phone = "08999999999";
    const next = await api.saveVendor(update, admin, saved.id, saved.version);
    expect(next.version).toBe(2);
    expect(next.warehouses.map((w) => w.id)).toEqual(
      reloaded.warehouses.map((w) => w.id),
    );
    expect(
      (await api.listVendors(admin)).find((v) => v.id === saved.id)?.contacts[0]
        .phone,
    ).toBe("08999999999");
    expect(await api.vendorAudit(admin, saved.id)).toHaveLength(2);
    await expect(
      api.saveVendor(update, admin, saved.id, 1),
    ).rejects.toMatchObject({ code: "STALE" });
  });
  it("rejects non-admin requests, remote hosts and cross-origin calls", async () => {
    await expect(
      api.listVendors(peopleFixtures.find((p) => p.id === "user-vendor")!),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    // Without explicit local mode, even forged legacy actor headers cannot activate access.
    for(const request of [new Request("http://localhost/api/vendors"),new Request("https://example.com/api/vendors",{headers:{"x-prototype-actor-id":"dev-user"}}),new Request("http://localhost/api/vendors",{headers:{"x-prototype-actor-id":"dev-user",origin:"https://example.com"}})]) {
      await expect(api.vendorActor(request)).rejects.toMatchObject({code:"LOCAL_ACTOR_DISABLED"});
    }
  });
  it("rolls back foreign record reuse, duplicate names and destructive omission", async () => {
    const a = await api.saveVendor(draft(), admin);
    ids.push(a.id);
    const d = draft();
    d.contacts[0].id = a.contacts[0].id;
    d.warehouses.forEach((w) => (w.contactIds = [a.contacts[0].id]));
    await expect(api.saveVendor(d, admin)).rejects.toMatchObject({
      code: "VALIDATION",
    });
    expect(
      (await api.listVendors(admin)).filter((v) => v.name === d.name),
    ).toHaveLength(0);
    const duplicate = draft();
    duplicate.name = a.name.toUpperCase();
    await expect(api.saveVendor(duplicate, admin)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(
      api.saveVendor(
        { ...a, warehouses: [a.warehouses[0]] },
        admin,
        a.id,
        a.version,
      ),
    ).rejects.toThrow("inactivate");
    expect(
      (await api.listVendors(admin)).find((v) => v.id === a.id)?.version,
    ).toBe(1);
  });
  it("projects only active complete locations for operational users and validates UUID associations", async () => {
    const saved = await api.saveVendor(draft(), admin);
    ids.push(saved.id);
    const rows = await api.operationalVendorLocations(
      peopleFixtures.find((p) => p.id === "user-storedev")!,
    );
    expect(rows.filter((w) => w.vendorId === saved.id)).toHaveLength(1);
    expect(rows.find((w) => w.vendorId === saved.id)).not.toHaveProperty(
      "importNotes",
    );
    await expect(
      api.assertVendorDestination(
        client as never,
        saved.warehouses.find((w) => w.addressVerified)!.id,
        saved.id,
      ),
    ).resolves.toBeUndefined();
    await expect(
      api.assertVendorDestination(
        client as never,
        saved.warehouses.find((w) => !w.addressVerified)!.id,
        saved.id,
      ),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await api.saveVendor(
      { ...saved, active: false },
      admin,
      saved.id,
      saved.version,
    );
    expect(
      (await api.operationalVendorLocations(admin)).some(
        (w) => w.vendorId === saved.id,
      ),
    ).toBe(false);
  });
  it("database rejects a warehouse linked to a different vendor PIC", async () => {
    const a = await api.saveVendor(draft(), admin),
      b = await api.saveVendor(draft(), admin);
    ids.push(a.id, b.id);
    await expect(
      client.query(
        "insert into vendor_master.warehouse_contacts(vendor_id,warehouse_id,contact_id) values($1,$2,$3)",
        [a.id, a.warehouses[0].id, b.contacts[0].id],
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });
});

// Vendor SQL business-rule suite retains its schema-only test setup. Canonical
// authentication is exercised with real People/session storage by test-m1d-runtime.
vi.mock("@/server/people/canonical",()=>({requireCanonicalPerson:async(id:string)=>{
 const person=peopleFixtures.find(p=>p.id===id&&p.status==="ACTIVE");
 if(!person)throw new Error("Unknown isolated test Person");return person;
}}));
