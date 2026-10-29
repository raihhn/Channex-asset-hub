// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:net";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import pg from "pg";
import type { RegistrationIntent } from "@/lib/domain/asset-registration";
vi.mock("server-only", () => ({})); // package marker only, not authorization/storage.
const target = process.env.ASSETHUB_REGISTRATION_TEST_DATABASE_URL;
const token = process.env.ASSETHUB_REGISTRATION_TEST_TOKEN ?? "";
if (target) {
  const url = new URL(target);
  if (
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    !/^\/assethub_test_registration_[a-f0-9]{24}$/.test(url.pathname) ||
    !/^[a-f0-9]{48}$/.test(token)
  )
    throw Error("Owned isolated target required");
  process.env.ASSETHUB_DATABASE_URL = target;
}
describe.skipIf(!target)(
  "Gate 1 owned PostgreSQL foundation (real cookies, canonical People, SQL and OS listener)",
  () => {
    const pool = target
      ? new pg.Pool({ connectionString: target, max: 5 })
      : undefined;
    let listener: Server, origin: string, contacts: string[], internal: string;
    let register: typeof import("@/lib/server/asset-registration").registerIsolatedRelationalAsset;
    let publicRegister: typeof import("@/lib/server/asset-registration").registerCatalogAsset;
    let selectActor: typeof import("@/server/auth/local-actor").selectLocalActor;
    let cookie: string;
    const vendor = randomUUID(),
      warehouse = randomUUID(),
      inactive = randomUUID(),
      unverified = randomUUID();
    const req = (session = cookie, extra: Record<string, string> = {}) =>
      new Request(origin + "/api/assets", {
        method: "POST",
        headers: {
          host: new URL(origin).host,
          origin,
          cookie: session,
          ...extra,
        },
      });
    const draft = (): RegistrationIntent => ({
      commandKey: randomUUID(),
      asset: {
        name: "Gate 1 Wall",
        legacyReference: "DUPLICATE-OK",
        brand: "All Brand",
        category: "Supporting asset",
        classification: "ASSET",
        trackingType: "Individual",
        quantity: 1,
        unitPolicy: { stockUnit: "Set" },
        condition: "Good",
        conditionNotes: "Declared, not inspected",
        description: "Isolated relational fixture only",
        location: { kind: "internal", warehouseId: internal },
        group: { mode: "standalone" },
        ownerContactId: contacts[0],
        managementContactIds: contacts.slice(0, 2),
        metadata: {
          receivedDate: "2024-02-29",
          assetValue: { amount: "123.4500", currency: "IDR" },
          eventProjectReference: "BST-2025 metadata only",
          additionalNotes: "not a usage event",
        },
      },
    });
    const execute = (value = draft(), session = cookie) =>
      register(req(session), value, pool!, token);
    const size = async () =>
      (
        await pool!.query(
          `select (select count(*) from asset_master.assets) as assets,(select count(*) from asset_master.asset_groups) as groups,(select count(*) from asset_master.asset_group_memberships) as members,(select count(*) from contact_core.asset_owner_contacts) as owners,(select count(*) from contact_core.asset_management_contacts) as pics,(select count(*) from booking.assets) as mirror,(select count(*) from asset_master.audit_events) as audit,(select count(*) from asset_master.registration_receipts) as receipts`,
        )
      ).rows[0];
    const grouped = (group: RegistrationIntent["asset"]["group"]) => {
      const value = draft();
      delete value.asset.ownerContactId;
      delete value.asset.managementContactIds;
      value.asset.group = group;
      return value;
    };
    const actorCookie = async (id: string) => {
      const response = await selectActor(
        new Request(origin + "/api/development/session", {
          method: "POST",
          headers: {
            host: new URL(origin).host,
            origin,
            "content-type": "application/json",
          },
          body: JSON.stringify({ personId: id }),
        }),
      );
      return response.headers.get("set-cookie")!.split(";")[0];
    };
    beforeAll(async () => {
      listener = createServer();
      await new Promise<void>((resolve) =>
        listener.listen(0, "127.0.0.1", resolve),
      );
      const address = listener.address();
      if (!address || typeof address === "string")
        throw Error("Dedicated loopback listener required");
      origin = `http://127.0.0.1:${address.port}`;
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("ASSETHUB_ACTOR_MODE", "local-development");
      vi.stubEnv("ASSETHUB_LOCAL_ACTOR_ORIGIN", origin);
      vi.stubEnv("ASSETHUB_VENDOR_ENABLED", "true");
      const registrationModule =
        await import("@/lib/server/asset-registration");
      register = registrationModule.registerIsolatedRelationalAsset;
      publicRegister = registrationModule.registerCatalogAsset;
      await registrationModule.assertIsolatedRegistrationTarget(pool!, token);
      selectActor = (await import("@/server/auth/local-actor"))
        .selectLocalActor;
      cookie = await actorCookie("dev-user");
      contacts = (
        await pool!.query(
          "select id from contact_core.internal_contacts where active order by id limit 2",
        )
      ).rows.map((r) => r.id);
      if (contacts.length < 2) throw Error("Fixture contacts missing");
      internal = (
        await pool!.query(
          "select id from asset_master.internal_warehouses order by id limit 1",
        )
      ).rows[0].id;
      await pool!.query(
        "insert into vendor_master.vendors(id,name) values($1,$2)",
        [vendor, "Gate1 isolated vendor " + vendor],
      );
      await pool!.query(
        "insert into vendor_master.warehouses(id,vendor_id,name,address,address_verified,active) values($1,$4,'Eligible no contact','Fixture address',true,true),($2,$4,'Inactive','Fixture address',true,false),($3,$4,'Unverified','Fixture address',false,true)",
        [warehouse, inactive, unverified, vendor],
      );
    }, 30000);
    afterAll(async () => {
      await pool?.end();
      if (listener)
        await new Promise<void>((resolve) => listener.close(() => resolve()));
      vi.unstubAllEnvs();
    });
    it("end-user registration rejects a photo-free request", async () => {
      await expect(publicRegister(req(), draft())).rejects.toThrow();
      const source = await fs.readFile("src/app/api/assets/route.ts", "utf8");
      expect(source).toContain("registerCatalogAsset");
    });
    it("isolation proof fails closed", async () => {
      await expect(
        register(req(), draft(), pool!, "0".repeat(48)),
      ).rejects.toThrow("Owned isolated");
    });
    it("G1-01/13/14/17/18 standalone persists canonical state, metadata, provenance and held booking projection", async () => {
      const saved = await execute();
      expect(saved.replayed).toBe(false);
      expect(saved.asset).toMatchObject({
        ownerContactId: contacts[0],
        assignmentSource: "asset",
        managementContactIds: contacts.slice(0, 2),
        warehouseId: internal,
        availability: "unavailable",
        inspectionState: "Inspection pending",
        condition: "Good",
        producedAt: "",
        totalQuantity: 1,
        trackingType: "Individual",
        registrationMetadata: draft().asset.metadata,
      });
      expect(saved.asset.importInfo).toBeUndefined();
      expect(saved.asset.photos).toEqual([]);
      expect(saved.asset.history[0].kind).toBeUndefined();
      const record = (
        await pool!.query("select * from asset_master.assets where id=$1", [
          saved.asset.id,
        ])
      ).rows[0];
      expect(record.source_key).toBe("manual:" + saved.asset.id);
      expect(record.internal_warehouse_id).toBe(internal);
      expect(record.vendor_id).toBeNull();
      expect(
        (
          await pool!.query("select * from booking.assets where id=$1", [
            saved.asset.id,
          ])
        ).rows[0],
      ).toMatchObject({
        classification: "ASSET",
        tracking_type: "Individual",
        inspection_hold: true,
        availability_hint: "unavailable",
        available_quantity: 1,
      });
      const audit = (
        await pool!.query(
          "select * from asset_master.audit_events where asset_id=$1",
          [saved.asset.id],
        )
      ).rows;
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({
        actor_user_id: "dev-user",
        action: "REGISTER_ASSET",
      });
      expect(audit[0].changes.assignmentSource).toBe("asset");
      // Reconnect independent SQL client: data is not kept in service memory.
      const other = new pg.Client({ connectionString: target });
      await other.connect();
      try {
        expect(
          (
            await other.query(
              "select id from asset_master.assets where id=$1",
              [saved.asset.id],
            )
          ).rowCount,
        ).toBe(1);
      } finally {
        await other.end();
      }
    });
    it("G1-02/03/04 group creation/join share contacts without copying links; individuals remain independent", async () => {
      const first = await execute(
        grouped({
          mode: "create",
          name: "TOTEM SKYBRIDGE",
          ownerContactId: contacts[0],
          managingContactId: contacts[1],
        }),
      );
      const id = first.asset.assetGroup!.id;
      const secondDraft = grouped({ mode: "existing", id, expectedVersion: 1 });
      secondDraft.asset.location = {
        kind: "vendor",
        vendorId: vendor,
        warehouseId: warehouse,
      };
      secondDraft.asset.condition = "Fair";
      const second = await execute(secondDraft);
      expect(second.asset.assetGroup).toMatchObject({ id, memberCount: 2 });
      expect(second.asset.ownerContactId).toBe(first.asset.ownerContactId);
      expect(second.asset.managementContactIds).toEqual([contacts[1]]);
      expect(second.asset.condition).toBe("Fair");
      expect(second.asset.warehouseId).toBe(warehouse);
      expect(
        (
          await pool!.query(
            "select count(*)::int as n from contact_core.asset_management_contacts where asset_id=any($1::text[])",
            [[first.asset.id, second.asset.id]],
          )
        ).rows[0].n,
      ).toBe(0);
      expect(
        (
          await pool!.query(
            "select count(*)::int as n from contact_core.asset_owner_contacts where asset_id=any($1::text[])",
            [[first.asset.id, second.asset.id]],
          )
        ).rows[0].n,
      ).toBe(0);
    });
    it("G1-05 invalid owner/PIC and stale/missing group roll back", async () => {
      for (const change of [
        { ownerContactId: randomUUID() },
        { managementContactIds: [randomUUID()] },
      ]) {
        const before = await size();
        await expect(
          execute({ ...draft(), asset: { ...draft().asset, ...change } }),
        ).rejects.toMatchObject({ code: "VALIDATION" });
        expect(await size()).toEqual(before);
      }
      await expect(
        execute(
          grouped({ mode: "existing", id: randomUUID(), expectedVersion: 1 }),
        ),
      ).rejects.toMatchObject({ code: "VALIDATION" });
    });
    it.each(["inactive", "unverified", "missing", "mismatch"])(
      "G1-06/07 rejects %s warehouse",
      async (kind) => {
        const before = await size();
        const value = draft();
        value.asset.location = {
          kind: "vendor",
          vendorId: kind === "mismatch" ? randomUUID() : vendor,
          warehouseId:
            kind === "inactive"
              ? inactive
              : kind === "unverified"
                ? unverified
                : kind === "missing"
                  ? randomUUID()
                  : warehouse,
        };
        await expect(execute(value)).rejects.toMatchObject({
          code: "VALIDATION",
        });
        expect(await size()).toEqual(before);
      },
    );
    it("T05 eligible vendor warehouse needs no contact and retains exact IDs", async () => {
      const value = draft();
      value.asset.location = {
        kind: "vendor",
        vendorId: vendor,
        warehouseId: warehouse,
      };
      const saved = await execute(value);
      expect(saved.asset).toMatchObject({
        vendorId: vendor,
        warehouseId: warehouse,
      });
      expect(
        (
          await pool!.query(
            "select count(*)::int as n from vendor_master.warehouse_contacts where warehouse_id=$1",
            [warehouse],
          )
        ).rows[0].n,
      ).toBe(0);
    });
    it("G1-09/10 concurrent identical keys create exactly one record and audit", async () => {
      const value = grouped({
        mode: "create",
        name: "Concurrent group",
        ownerContactId: contacts[0],
        managingContactId: contacts[1],
      });
      const before = await size();
      const results = await Promise.all([
        execute(value),
        execute(value),
        execute(value),
      ]);
      expect(new Set(results.map((r) => r.asset.id)).size).toBe(1);
      expect(results.filter((r) => !r.replayed)).toHaveLength(1);
      expect((await size()).assets).toBe(String(Number(before.assets) + 1));
      expect(
        (
          await pool!.query(
            "select count(*)::int as n from asset_master.audit_events where asset_id=$1",
            [results[0].asset.id],
          )
        ).rows[0].n,
      ).toBe(1);
      const changed = structuredClone(value);
      changed.asset.name = "Different intent";
      await expect(execute(changed)).rejects.toMatchObject({
        code: "CONFLICT",
      });
    });
    it("different keys do not merge identical legacy references", async () => {
      const a = await execute();
      const b = await execute();
      expect(a.asset.id).not.toBe(b.asset.id);
    });
    it("G1-11 injected failures at every relational step roll back all rows", async () => {
      await pool!.query(
        "create function asset_master.gate1_failure() returns trigger language plpgsql as $$ begin raise exception 'Gate1 injected failure'; end $$",
      );
      try {
        for (const table of [
          "asset_master.assets",
          "asset_master.asset_groups",
          "asset_master.asset_group_memberships",
          "contact_core.asset_owner_contacts",
          "contact_core.asset_management_contacts",
          "booking.assets",
          "asset_master.audit_events",
          "asset_master.registration_receipts",
        ]) {
          const before = await size();
          await pool!.query(
            `create trigger gate1_failure before insert on ${table} for each row execute function asset_master.gate1_failure()`,
          );
          try {
            const groupedPath = /asset_groups|asset_group_memberships/.test(
              table,
            );
            await expect(
              execute(
                groupedPath
                  ? grouped({
                      mode: "create",
                      name: "Fail atomically",
                      ownerContactId: contacts[0],
                      managingContactId: contacts[1],
                    })
                  : draft(),
              ),
            ).rejects.toThrow();
          } finally {
            await pool!.query(`drop trigger gate1_failure on ${table}`);
          }
          expect(await size()).toEqual(before);
        }
      } finally {
        await pool!.query("drop function asset_master.gate1_failure()");
      }
    });
    it("G1-12 real canonical roles/cookies, not actor headers, authorize commands", async () => {
      for (const actor of ["user-brand", "user-vendor", "user-management"]) {
        await expect(
          execute(draft(), await actorCookie(actor)),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
      await expect(
        register(
          req("", { "x-prototype-actor-id": "dev-user" }),
          draft(),
          pool!,
          token,
        ),
      ).rejects.toMatchObject({ code: "LOCAL_SESSION_REQUIRED" });
      await expect(
        execute(draft(), "assethub_local_actor=forged.invalid"),
      ).rejects.toMatchObject({ code: "LOCAL_SESSION_INVALID" });
      const saved = await execute(draft(), await actorCookie("user-storedev"));
      expect(saved.asset.registrationProvenance).toMatchObject({
        actorId: "user-storedev",
      });
    });
    it("G1-15 FK/exclusion and deferred group-change boundaries are real constraints", async () => {
      const saved = await execute(
        grouped({
          mode: "create",
          name: "Constraints",
          ownerContactId: contacts[0],
          managingContactId: contacts[1],
        }),
      );
      for (const table of [
        "contact_core.asset_owner_contacts",
        "contact_core.asset_management_contacts",
      ]) {
        const c = await pool!.connect();
        try {
          await c.query("begin");
          const extra = table.endsWith("asset_management_contacts")
            ? ",position"
            : "";
          const values = extra ? ",0" : "";
          await c.query(
            `insert into ${table}(asset_id,contact_id,assigned_by${extra}) values($1,$2,'dev-user'${values})`,
            [saved.asset.id, contacts[0]],
          );
          await expect(c.query("commit")).rejects.toMatchObject({
            code: "23514",
          });
        } finally {
          await c.query("rollback");
          c.release();
        }
      }
      await expect(
        pool!.query(
          "update asset_master.asset_groups set owner_contact_id=$1 where id=$2",
          [contacts[1], saved.asset.assetGroup!.id],
        ),
      ).rejects.toMatchObject({ code: "23514" });
      await expect(
        pool!.query(
          "delete from asset_master.asset_group_memberships where asset_id=$1",
          [saved.asset.id],
        ),
      ).rejects.toMatchObject({ code: "23514" });
      await expect(
        pool!.query(
          "insert into contact_core.asset_owner_contacts(asset_id,contact_id,assigned_by) values($1,$2,'dev-user')",
          [randomUUID(), contacts[0]],
        ),
      ).rejects.toMatchObject({ code: "23503" });
    });
    it("inactive referenced contacts reject new registrations, existing projections preserve warning", async () => {
      const value = draft();
      const saved = await execute(value);
      await pool!.query(
        "update contact_core.internal_contacts set active=false where id=$1",
        [contacts[0]],
      );
      try {
        await expect(execute()).rejects.toMatchObject({ code: "VALIDATION" });
        const { readAssetCatalog } = await import("@/lib/server/assets");
        expect(
          (await readAssetCatalog(req())).find((a) => a.id === saved.asset.id)
            ?.ownerContact?.active,
        ).toBe(false);
      } finally {
        await pool!.query(
          "update contact_core.internal_contacts set active=true where id=$1",
          [contacts[0]],
        );
      }
    });
    it("inactive canonical Person cannot register even with an existing signed cookie", async () => {
      const session = await actorCookie("user-storedev");
      await pool!.query(
        "update identity_core.people set status='INACTIVE' where id='user-storedev'",
      );
      try {
        const before = await size();
        await expect(execute(draft(), session)).rejects.toThrow();
        expect(await size()).toEqual(before);
      } finally {
        await pool!.query(
          "update identity_core.people set status='ACTIVE' where id='user-storedev'",
        );
      }
    });
    it("stale group version and inactive inherited contact reject without changing group", async () => {
      const saved = await execute(
        grouped({
          mode: "create",
          name: "Stable inherited assignment",
          ownerContactId: contacts[0],
          managingContactId: contacts[1],
        }),
      );
      const groupId = saved.asset.assetGroup!.id;
      await expect(
        execute(grouped({ mode: "existing", id: groupId, expectedVersion: 2 })),
      ).rejects.toMatchObject({ code: "STALE" });
      await pool!.query(
        "update contact_core.internal_contacts set active=false where id=$1",
        [contacts[1]],
      );
      try {
        await expect(
          execute(
            grouped({ mode: "existing", id: groupId, expectedVersion: 1 }),
          ),
        ).rejects.toMatchObject({ code: "VALIDATION" });
      } finally {
        await pool!.query(
          "update contact_core.internal_contacts set active=true where id=$1",
          [contacts[1]],
        );
      }
    });
    it("retry by another authorized actor conflicts; spoofed headers cannot elevate a valid denied session", async () => {
      const value = draft();
      await execute(value);
      await expect(
        execute(value, await actorCookie("user-storedev")),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(
        register(
          req(await actorCookie("user-brand"), {
            "x-prototype-actor-id": "dev-user",
            "x-actor-id": "dev-user",
          }),
          draft(),
          pool!,
          token,
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        register(
          req(cookie, { origin: "http://evil.invalid" }),
          draft(),
          pool!,
          token,
        ),
      ).rejects.toMatchObject({ code: "LOCAL_ORIGIN_REJECTED" });
    });
    it("new tables stay private and RLS-enabled", async () => {
      const rows = (
        await pool!.query(
          "select n.nspname,c.relname,c.relrowsecurity,exists(select 1 from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) p where p.grantee=0 and p.privilege_type='SELECT') as public_read from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname,c.relname) in (('asset_master','asset_groups'),('asset_master','asset_group_memberships'),('asset_master','registration_receipts'),('contact_core','asset_owner_contacts')) order by c.relname",
        )
      ).rows;
      expect(rows).toHaveLength(4);
      expect(rows.every((r) => r.relrowsecurity && !r.public_read)).toBe(true);
    });
    it("existing imported metadata/PIC editing still works under additive constraints", async () => {
      const original = (
        await pool!.query(
          "select a.*,a.updated_at::text as revision from asset_master.assets a where a.source_key not like 'manual:%' and (select count(*) from contact_core.asset_management_contacts c where c.asset_id=a.id)>1 order by a.id limit 1",
        )
      ).rows[0];
      const links = (
        await pool!.query(
          "select *,assigned_at::text as assigned_at_exact from contact_core.asset_management_contacts where asset_id=$1 order by position",
          [original.id],
        )
      ).rows;
      const { assetEditDefaults } = await import("@/lib/domain/asset-edit");
      const { editCatalogAsset } = await import("@/lib/server/assets");
      const edit = assetEditDefaults(original.payload);
      edit.description = "Isolated legacy compatibility verification";
      edit.managementContactIds = links.map((row) => row.contact_id);
      try {
        const result = await editCatalogAsset(
          new Request(origin + "/api/assets/" + original.id, {
            method: "PATCH",
            headers: {
              host: new URL(origin).host,
              origin,
              cookie,
              "content-type": "application/json",
            },
            body: JSON.stringify({ edit, revision: original.revision }),
          }),
          original.id,
        );
        expect(result.revision).not.toBe(original.revision);
        expect(
          (
            await pool!.query(
              "select payload from asset_master.assets where id=$1",
              [original.id],
            )
          ).rows[0].payload.description,
        ).toBe(edit.description);
      } finally {
        // Restore original clone fixtures exactly; preserve added audit as test evidence.
        const c = await pool!.connect();
        try {
          await c.query("begin");
          await c.query(
            "delete from contact_core.asset_management_contacts where asset_id=$1",
            [original.id],
          );
          for (const link of links)
            await c.query(
              "insert into contact_core.asset_management_contacts(asset_id,contact_id,position,assigned_by,assigned_at) values($1,$2,$3,$4,$5)",
              [
                link.asset_id,
                link.contact_id,
                link.position,
                link.assigned_by,
                link.assigned_at_exact,
              ],
            );
          await c.query(
            "update asset_master.assets set payload=$2::jsonb,updated_at=$3::timestamptz where id=$1",
            [original.id, JSON.stringify(original.payload), original.revision],
          );
          await c.query("commit");
        } catch (error) {
          await c.query("rollback");
          throw error;
        } finally {
          c.release();
        }
      }
    });
    it("G1-16 active API URL and UI registration code remain unintegrated", async () => {
      const text = await fs.readFile(
        "src/features/assets/add-asset-screen.tsx",
        "utf8",
      );
      expect(text).not.toContain("registerIsolatedRelationalAsset");
      expect(text).not.toContain("registerCatalogAsset");
    });
  },
);
