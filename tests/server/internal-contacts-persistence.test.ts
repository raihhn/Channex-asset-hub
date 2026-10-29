// Opt-in only. The driver restores M0 to a generated disposable PostgreSQL 17 DB.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import pg from "pg";
import { createHash, randomUUID } from "node:crypto";
import { assetEditDefaults } from "@/lib/domain/asset-edit";
import type { RequestDraft } from "@/types/prototype";
const target = process.env.ASSETHUB_CONTACTS_TEST_DATABASE_URL;
if (target) {
  const u = new URL(target);
  if (
    !["127.0.0.1", "localhost"].includes(u.hostname) ||
    !/^\/assethub_test_contacts_[a-f0-9]{24}$/.test(u.pathname)
  )
    throw Error("Disposable contacts database required.");
  process.env.ASSETHUB_DATABASE_URL = target;
  process.env.ASSETHUB_VENDOR_ENABLED = "true";
}
vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/loopback-listener", () => ({
  hasOnlyLoopbackListener: async () => true,
}));
const base = "http://localhost:4318";
const request = (path: string, cookie = "", body?: unknown, extra = {}) =>
  new Request(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      host: "localhost:4318",
      origin: base,
      "sec-fetch-site": "same-origin",
      ...(cookie ? { cookie } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...extra,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
describe.skipIf(!target)(
  "internal contacts PostgreSQL and canonical actor integration",
  () => {
    const pool = target ? new pg.Pool({ connectionString: target }) : undefined;
    let cookie: string,
      service: typeof import("@/server/contacts/service"),
      assets: typeof import("@/lib/server/assets"),
      select: typeof import("@/server/auth/local-actor").selectLocalActor;
    beforeAll(async () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv(
        "ASSETHUB_MEDIA_SIGNING_KEY",
        "isolated-contact-test-media-key",
      );
      vi.stubEnv("ASSETHUB_ACTOR_MODE", "local-development");
      vi.stubEnv("ASSETHUB_LOCAL_ACTOR_ORIGIN", base);
      vi.stubEnv("NEXT_PUBLIC_ASSETHUB_BOOKING_ENABLED", "true");
      service = await import("@/server/contacts/service");
      assets = await import("@/lib/server/assets");
      select = (await import("@/server/auth/local-actor")).selectLocalActor;
      cookie = (
        await select(
          request("/api/development/session", "", { personId: "dev-user" }),
        )
      ).headers
        .get("set-cookie")!
        .split(";")[0];
    });
    afterAll(async () => {
      await (await import("@/lib/server/booking")).closeBookingPool();
      await pool?.end();
      vi.unstubAllEnvs();
    });
    it("uses real canonical cookies and denies missing/forged identity and Vendor role", async () => {
      expect(
        (
          await service.listInternalContacts(
            request("/api/internal-contacts", cookie),
          )
        ).length,
      ).toBeGreaterThan(0);
      await expect(
        service.listInternalContacts(request("/api/internal-contacts")),
      ).rejects.toMatchObject({ code: "LOCAL_SESSION_REQUIRED" });
      await expect(
        service.listInternalContacts(
          request("/api/internal-contacts", "", undefined, {
            "x-assethub-actor": "dev-user",
          }),
        ),
      ).rejects.toMatchObject({ code: "LOCAL_SESSION_REQUIRED" });
      const vendor = (
        await select(
          request("/api/development/session", "", { personId: "user-vendor" }),
        )
      ).headers
        .get("set-cookie")!
        .split(";")[0];
      await expect(
        service.createInternalContact(
          request("/api/internal-contacts", vendor, {
            name: "Denied",
            email: "",
            phone: "",
          }),
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        service.createInternalContact(
          request(
            "/api/internal-contacts",
            cookie,
            { name: "Denied", email: "", phone: "" },
            { origin: "http://example.com" },
          ),
        ),
      ).rejects.toMatchObject({ code: "LOCAL_ORIGIN_REJECTED" });
    });
    it("creates a reusable contact once without creating People or linking by email", async () => {
      const count = (
        await pool!.query("select count(*)::int as n from identity_core.people")
      ).rows[0].n;
      const input = {
        name: "Isolated Contact",
        email: "same@example.com",
        phone: "00123",
      };
      const first = await service.createInternalContact(
        request("/api/internal-contacts", cookie, input),
      );
      const again = await service.createInternalContact(
        request("/api/internal-contacts", cookie, {
          ...input,
          name: " isolated  contact ",
        }),
      );
      const different = await service.createInternalContact(
        request("/api/internal-contacts", cookie, {
          ...input,
          name: "Different Person",
        }),
      );
      expect(first.id).toBe(again.id);
      expect(first.phone).toBe("00123");
      expect(different.id).not.toBe(first.id);
      expect(
        (
          await pool!.query(
            "select count(*)::int as n from identity_core.people",
          )
        ).rows[0].n,
      ).toBe(count);
      expect(
        (
          await pool!.query(
            "select count(*)::int as n from contact_core.audit_events where contact_id=$1",
            [first.id],
          )
        ).rows[0].n,
      ).toBe(1);
    });
    it("atomically links IDs, rejects spoofed contact channels, survives fresh reads and preserves business evidence", async () => {
      const before = (
        await pool!.query(
          "select *,updated_at::text as revision from asset_master.assets order by id limit 1",
        )
      ).rows[0];
      const contact = await service.createInternalContact(
        request("/api/internal-contacts", cookie, {
          name: "Authoritative",
          email: "canonical@example.com",
          phone: "456",
        }),
      );
      const edit = {
        ...assetEditDefaults(before.payload),
        managementContactIds: [contact.id],
        managementContacts: [
          { name: "Spoof", email: "spoof@example.com", phone: "999" },
        ],
      };
      const patch = () =>
        new Request(base + "/api/assets/" + before.id, {
          method: "PATCH",
          headers: {
            host: "localhost:4318",
            origin: base,
            "sec-fetch-site": "same-origin",
            cookie,
            "content-type": "application/json",
          },
          body: JSON.stringify({ edit, revision: before.revision }),
        });
      const saved = await assets.editCatalogAsset(patch(), before.id);
      expect(saved.edit.managementContacts?.[0].name).toBe("Authoritative");
      const after = (
        await pool!.query("select * from asset_master.assets where id=$1", [
          before.id,
        ])
      ).rows[0];
      for (const key of [
        "id",
        "importInfo",
        "photos",
        "availability",
        "condition",
        "location",
        "totalQuantity",
        "inspectionState",
      ])
        expect(after.payload[key]).toEqual(before.payload[key]);
      expect(after.source).toEqual(before.source);
      expect(after.vendor_id).toBe(before.vendor_id);
      expect(after.warehouse_id).toBe(before.warehouse_id);
      const catalog = await assets.readAssetCatalog(
        request("/api/assets", cookie),
      );
      const loaded = catalog.find((a) => a.id === before.id)!;
      expect(loaded.managementContactIds).toEqual([contact.id]);
      expect(loaded.managementContacts?.[0].email).toBe(
        "canonical@example.com",
      );
      await expect(
        assets.editCatalogAsset(patch(), before.id),
      ).rejects.toMatchObject({ code: "STALE" });
      const audit = (
        await pool!.query(
          "select changes from asset_master.audit_events where asset_id=$1 and action='EDIT_METADATA' order by occurred_at desc limit 1",
          [before.id],
        )
      ).rows[0];
      expect(audit.changes.after.managementContactIds).toEqual([contact.id]);
      expect(audit.changes.after.managementContacts).toBeUndefined();
    });
    it("rejects inactive/nonexistent contacts and rolls back the asset and relationships", async () => {
      const before = (
        await pool!.query(
          "select id,payload,updated_at::text as revision from asset_master.assets order by id limit 1",
        )
      ).rows[0];
      const links = (
        await pool!.query(
          "select contact_id from contact_core.asset_management_contacts where asset_id=$1 order by position",
          [before.id],
        )
      ).rows;
      const dead = await service.createInternalContact(
        request("/api/internal-contacts", cookie, {
          name: "Inactive Contact",
          email: "",
          phone: "",
        }),
      );
      await pool!.query(
        "update contact_core.internal_contacts set active=false where id=$1",
        [dead.id],
      );
      for (const id of [dead.id, "11111111-1111-4111-8111-111111111111"]) {
        const r = new Request(base + "/api/assets/" + before.id, {
          method: "PATCH",
          headers: {
            host: "localhost:4318",
            origin: base,
            "sec-fetch-site": "same-origin",
            cookie,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            edit: {
              ...assetEditDefaults(before.payload),
              managementContactIds: [id],
            },
            revision: before.revision,
          }),
        });
        await expect(
          assets.editCatalogAsset(r, before.id),
        ).rejects.toMatchObject({ code: "VALIDATION" });
      }
      expect(
        (
          await pool!.query(
            "select payload from asset_master.assets where id=$1",
            [before.id],
          )
        ).rows[0].payload,
      ).toEqual(before.payload);
      expect(
        (
          await pool!.query(
            "select contact_id from contact_core.asset_management_contacts where asset_id=$1 order by position",
            [before.id],
          )
        ).rows,
      ).toEqual(links);
    });
    it("persists a Request contact ID with canonical snapshot, preserves receipt fingerprints/replay and resubmits through real cookie APIs", async () => {
      const post = (await import("@/app/api/booking/requests/route")).POST;
      const patch = (
        await import("@/app/api/booking/requests/[requestNumber]/route")
      ).PATCH;
      const contact = await service.createInternalContact(
        request("/api/internal-contacts", cookie, {
          name: "Request Site Person",
          email: "request-site@example.com",
          phone: "123",
        }),
      );
      const storedevCookie = (
        await select(
          request("/api/development/session", "", {
            personId: "user-storedev",
          }),
        )
      ).headers
        .get("set-cookie")!
        .split(";")[0];
      const draft: RequestDraft = {
        items: [],
        boothType: "Custom Booth",
        startDate: "2027-03-01",
        endDate: "2027-03-01",
        destination: "Test venue",
        projectName: "Isolated contact Request",
        projectAddress: "Test venue, Jakarta",
        purpose: "Contact persistence test",
        contact: "Requesting actor stays separate",
        budgetCode: "TEST",
        wbsCodes: [],
        siteContactInternalId: contact.id,
        siteContact: "Spoofed channels",
      };
      const commandKey = randomUUID();
      const response = await post(
        request("/api/booking/requests", storedevCookie, { draft, commandKey }),
      );
      expect(response.status).toBe(201);
      const saved = await response.json();
      expect(saved.siteContactInternalId).toBe(contact.id);
      expect(saved.siteContact).toBe(
        "Request Site Person · 123 · request-site@example.com",
      );
      expect(saved.contact).toBe(draft.contact);
      expect(saved.submittedByUserId).toBe("user-storedev");
      expect(saved.version).toBe(1);
      const row = (
        await pool!.query(
          "select payload from booking.requests where request_number=$1",
          [saved.id],
        )
      ).rows[0];
      expect(row.payload.siteContact).toBe(saved.siteContact);
      expect(row.payload.siteContactInternalId).toBe(contact.id);
      expect(
        (
          await pool!.query(
            "select fingerprint from booking.command_receipts where key=$1",
            [commandKey],
          )
        ).rows[0].fingerprint,
      ).toBe(
        createHash("sha256")
          .update(
            JSON.stringify({ draft, actor: "user-storedev", kind: "submit" }),
          )
          .digest("hex"),
      );
      await pool!.query(
        "update contact_core.internal_contacts set active=false where id=$1",
        [contact.id],
      );
      const replay = await post(
        request("/api/booking/requests", storedevCookie, { draft, commandKey }),
      );
      expect(replay.status).toBe(201);
      expect((await replay.json()).id).toBe(saved.id);
      expect(
        (
          await post(
            request("/api/booking/requests", storedevCookie, {
              draft,
              commandKey: randomUUID(),
            }),
          )
        ).status,
      ).toBe(400);
      expect(
        (
          await post(
            request("/api/booking/requests", storedevCookie, {
              draft: { ...draft, siteContact: "Different" },
              commandKey,
            }),
          )
        ).status,
      ).toBe(409);
      expect(
        (
          await pool!.query(
            "select count(*)::int as n from booking.command_receipts where request_id=$1",
            [saved.canonicalId],
          )
        ).rows[0].n,
      ).toBe(1);
      await pool!.query(
        "update contact_core.internal_contacts set active=true where id=$1",
        [contact.id],
      );
      await pool!.query(
        "update booking.requests set status='Needs update' where request_number=$1",
        [saved.id],
      );
      const revision = await patch(
        new Request(
          request("/api/booking/requests/" + saved.id, storedevCookie, {
            draft,
            commandKey: randomUUID(),
            expectedVersion: 1,
          }),
          { method: "PATCH" },
        ),
        { params: Promise.resolve({ requestNumber: saved.id }) },
      );
      expect(revision.status).toBe(200);
      const revised = await revision.json();
      expect(revised.id).toBe(saved.id);
      expect(revised.version).toBe(2);
      expect(revised.reviewRound).toBe(2);
      expect(revised.siteContact).toBe(saved.siteContact);
      expect(revised.siteContactInternalId).toBe(contact.id);
    });
    it("rejects directory reads and forged Request contact selections for other roles, while preserving their existing manual-submit behavior", async () => {
      const post = (await import("@/app/api/booking/requests/route")).POST;
      const id = (
        await service.listInternalContacts(
          request("/api/internal-contacts", cookie),
        )
      )[0].id;
      for (const personId of ["user-brand", "user-vendor", "user-management"]) {
        const actorCookie = (
          await select(request("/api/development/session", "", { personId }))
        ).headers
          .get("set-cookie")!
          .split(";")[0];
        await expect(
          service.listInternalContacts(
            request("/api/internal-contacts", actorCookie),
          ),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
        const draft: RequestDraft = {
          items: [],
          boothType: "Custom Booth",
          startDate: "2027-03-02",
          endDate: "2027-03-02",
          destination: "Test",
          projectName: "Manual compatibility",
          projectAddress: "Test",
          purpose: "Test",
          contact: "Requesting PIC",
          budgetCode: "TEST",
          wbsCodes: [],
          siteContact: "Manual site PIC",
        };
        const denied = await post(
          request("/api/booking/requests", actorCookie, {
            draft: { ...draft, siteContactInternalId: id },
            commandKey: randomUUID(),
          }),
        );
        expect(denied.status).toBe(400);
        expect((await denied.json()).code).toBe("VALIDATION");
        const commandKey = randomUUID();
        const manual = await post(
          request("/api/booking/requests", actorCookie, { draft, commandKey }),
        );
        expect(manual.status).toBe(201);
        const saved = await manual.json();
        expect(saved.siteContact).toBe(draft.siteContact);
        expect(saved.siteContactInternalId).toBeUndefined();
        expect(
          (
            await pool!.query(
              "select fingerprint from booking.command_receipts where key=$1",
              [commandKey],
            )
          ).rows[0].fingerprint,
        ).toBe(
          createHash("sha256")
            .update(JSON.stringify({ draft, actor: personId, kind: "submit" }))
            .digest("hex"),
        );
      }
    });
  },
);
