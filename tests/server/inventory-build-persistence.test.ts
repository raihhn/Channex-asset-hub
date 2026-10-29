// @vitest-environment node
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { createServer, type Server } from "node:net";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import sharp from "sharp";
vi.mock("server-only", () => ({}));
const target = process.env.ASSETHUB_REGISTRATION_TEST_DATABASE_URL;
if (target) {
  const u = new URL(target);
  if (
    !["localhost", "127.0.0.1"].includes(u.hostname) ||
    !/^\/assethub_test_registration_[a-f0-9]{24}$/.test(u.pathname)
  )
    throw Error("Isolated target required");
}
describe.skipIf(!target)(
  "Inventory combined real PostgreSQL/media commands",
  () => {
    const pool = new pg.Pool({ connectionString: target });
    let server: Server,
      origin: string,
      cookie: string,
      owner: string,
      pic: string,
      warehouse: string,
      image: Buffer;
    let register: typeof import("@/lib/server/asset-registration").registerCatalogAsset;
    let document: typeof import("@/lib/server/asset-documentation").saveAssetDocumentation;
    let select: typeof import("@/server/auth/local-actor").selectLocalActor;
    const request = (form: FormData, session = cookie) =>
      new Request(origin + "/api/assets", {
        method: "POST",
        headers: { host: new URL(origin).host, origin, cookie: session },
        body: form,
      });
    const intent = () => ({
      commandKey: randomUUID(),
      asset: {
        name: "Combined durable asset",
        legacyReference: "BST-A",
        brand: "Wardah",
        category: "Supporting asset",
        classification: "ASSET",
        trackingType: "Individual",
        quantity: 1,
        unitPolicy: { stockUnit: "Set" },
        condition: "Good",
        description: "Actual image evidence",
        location: { kind: "internal", warehouseId: warehouse },
        group: { mode: "standalone" },
        ownerContactId: owner,
        managementContactIds: [pic],
        metadata: {
          receivedDate: "2026-10-28",
          assetValue: { amount: "250.50", currency: "IDR" },
          eventProjectReference: "BST source metadata",
        },
      },
    });
    function upload(value: unknown, bytes = image, specs?: unknown[]) {
      const input = structuredClone(value) as Record<string, unknown>;
      const asset = (input.asset ?? input) as Record<string, unknown>;
      asset.photos = specs ?? [
        {
          partId: "photo",
          category: "Asset",
          isPrimary: true,
          view: "Front",
          caption: "Real image",
        },
      ];
      const form = new FormData();
      form.set("intent", JSON.stringify(input));
      form.set(
        "photo",
        new Blob([new Uint8Array(bytes)], { type: "application/octet-stream" }),
        "spoofed.extension",
      );
      return form;
    }
    beforeAll(async () => {
      server = createServer();
      await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
      const addr = server.address();
      if (!addr || typeof addr === "string") throw Error();
      origin = `http://127.0.0.1:${addr.port}`;
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("ASSETHUB_ACTOR_MODE", "local-development");
      vi.stubEnv("ASSETHUB_LOCAL_ACTOR_ORIGIN", origin);
      const { assertIsolatedRegistrationTarget } =
        await import("@/lib/server/asset-registration");
      await assertIsolatedRegistrationTarget(
        pool,
        process.env.ASSETHUB_REGISTRATION_TEST_TOKEN!,
      );
      register = (await import("@/lib/server/asset-registration"))
        .registerCatalogAsset;
      document = (await import("@/lib/server/asset-documentation"))
        .saveAssetDocumentation;
      select = (await import("@/server/auth/local-actor")).selectLocalActor;
      const response = await select(
        new Request(origin + "/api/development/session", {
          method: "POST",
          headers: {
            host: new URL(origin).host,
            origin,
            "content-type": "application/json",
          },
          body: JSON.stringify({ personId: "dev-user" }),
        }),
      );
      cookie = response.headers.get("set-cookie")!.split(";")[0];
      const contacts = (
        await pool.query(
          "select id from contact_core.internal_contacts where active order by id limit 2",
        )
      ).rows;
      owner = contacts[0].id;
      pic = contacts[1].id;
      warehouse = (
        await pool.query(
          "select id from asset_master.internal_warehouses order by id limit 1",
        )
      ).rows[0].id;
      image = await sharp({
        create: { width: 40, height: 30, channels: 3, background: "#2299cc" },
      })
        .png()
        .toBuffer();
    }, 30000);
    afterAll(async () => {
      await pool.end();
      if (server) await new Promise<void>((r) => server.close(() => r()));
      vi.unstubAllEnvs();
    });
    it("registers real private primary image, metadata and canonical relationships", async () => {
      const saved = await register(request(upload(intent())));
      expect(saved.asset).toMatchObject({
        ownerContactId: owner,
        managementContactIds: [pic],
        availability: "unavailable",
        inspectionState: "Inspection pending",
      });
      expect(saved.asset.photos).toHaveLength(1);
      const photo = saved.asset.photos[0];
      expect(photo.category).toBe("Asset");
      expect(photo.url).toContain("signature=");
      expect(
        await fs.readFile(
          path.join(process.env.ASSETHUB_ASSET_MEDIA_ROOT!, photo.objectKey!),
        ),
      ).toEqual(image);
      const { readAssetMedia } = await import("@/lib/server/assets");
      const url = origin + photo.url;
      const response = await readAssetMedia(
        new Request(url, { headers: { host: new URL(origin).host, cookie } }),
        photo.objectKey!,
      );
      expect(response.status).toBe(200);
      expect(Buffer.from(await response.arrayBuffer())).toEqual(image);
      await expect(
        readAssetMedia(
          new Request(url, { headers: { host: new URL(origin).host } }),
          photo.objectKey!,
        ),
      ).rejects.toThrow();
      const { assetHistory } =
        await import("@/lib/server/asset-inventory-reads");
      const history = await assetHistory(
        new Request(origin + "/api/assets", {
          headers: { host: new URL(origin).host, cookie },
        }),
        saved.asset.id,
      );
      expect(history.filter((e) => e.kind === "Registration")).toHaveLength(1);
      expect(history.some((e) => e.kind === "Usage")).toBe(false);
    });
    it.each(["jpeg", "webp"] as const)(
      "accepts actual %s bytes and optional captions",
      async (format) => {
        const bytes = await sharp({
          create: { width: 20, height: 25, channels: 3, background: "#882244" },
        })
          .toFormat(format)
          .toBuffer();
        const saved = await register(
          request(
            upload(intent(), bytes, [
              {
                partId: "photo",
                category: "Asset",
                isPrimary: true,
                view: "Front",
              },
            ]),
          ),
        );
        expect(saved.asset.photos[0].caption).toBe("");
        expect(saved.asset.photos[0].objectKey?.endsWith("." + format)).toBe(
          true,
        );
      },
    );
    it("rejects a declared oversized request before buffering its body", async () => {
      const base = request(upload(intent()));
      const headers = new Headers(base.headers);
      headers.set("content-length", String(32 * 1024 * 1024));
      await expect(
        register(new Request(base, { headers })),
      ).rejects.toMatchObject({ status: 413 });
    });
    it("same actual-photo retry and concurrent submissions create one documented asset", async () => {
      const value = intent();
      const results = await Promise.all([
        register(request(upload(value))),
        register(request(upload(value))),
      ]);
      expect(results[0].asset.id).toBe(results[1].asset.id);
      expect(results.filter((r) => !r.replayed)).toHaveLength(1);
      expect(
        (
          await pool.query(
            "select count(*)::int as n from asset_master.asset_photos where asset_id=$1",
            [results[0].asset.id],
          )
        ).rows[0].n,
      ).toBe(1);
    });
    it("groups with actual images inherit assignment and keep child documentation independent", async () => {
      const a = intent();
      delete (a.asset as Partial<typeof a.asset>).ownerContactId;
      delete (a.asset as Partial<typeof a.asset>).managementContactIds;
      Object.assign(a.asset, {
        group: {
          mode: "create",
          name: "Documented group",
          ownerContactId: owner,
          managingContactId: pic,
        },
      });
      const first = await register(request(upload(a)));
      const b = structuredClone(a);
      b.commandKey = randomUUID();
      Object.assign(b.asset, {
        name: "Another individual",
        condition: "Fair",
        group: {
          mode: "existing",
          id: first.asset.assetGroup!.id,
          expectedVersion: 1,
        },
      });
      const second = await register(request(upload(b)));
      expect(second.asset.assetGroup?.memberCount).toBe(2);
      expect(second.asset.ownerContactId).toBe(owner);
      expect(second.asset.photos[0].id).not.toBe(first.asset.photos[0].id);
    });
    it.each([
      "missing",
      "condition-only",
      "corrupt",
      "spoof",
      "too-many",
      "too-large",
    ])("rejects %s documentation with no relational rows", async (kind) => {
      const before = (
        await pool.query("select count(*)::int as n from asset_master.assets")
      ).rows[0].n;
      const v = intent();
      let form: FormData;
      if (kind === "missing") form = upload(v, image, []);
      else if (kind === "condition-only")
        form = upload(v, image, [
          {
            partId: "photo",
            category: "Condition",
            isPrimary: false,
            view: "Detail",
            caption: "",
          },
        ]);
      else if (kind === "too-many")
        form = upload(
          v,
          image,
          Array.from({ length: 7 }, (_, i) => ({
            partId: "p" + i,
            category: "Asset",
            isPrimary: i === 0,
            view: "Front",
            caption: "",
          })),
        );
      else if (kind === "too-large")
        form = upload(v, Buffer.alloc(10 * 1024 * 1024 + 1));
      else
        form = upload(
          v,
          Buffer.from(
            kind === "spoof" ? "<svg><script>bad</script></svg>" : "not image",
          ),
        );
      await expect(register(request(form))).rejects.toThrow();
      expect(
        (await pool.query("select count(*)::int as n from asset_master.assets"))
          .rows[0].n,
      ).toBe(before);
    });
    it("rejects decoded images exceeding 40 MP without accepting compressed dimensions alone", async () => {
      const bytes = await sharp({
        create: {
          width: 6400,
          height: 6400,
          channels: 3,
          background: "#ffffff",
        },
      })
        .png()
        .toBuffer();
      await expect(
        register(request(upload(intent(), bytes))),
      ).rejects.toThrow();
    });
    it("storage failure rolls back catalog, audit, receipt and projection", async () => {
      const root = process.env.ASSETHUB_ASSET_MEDIA_ROOT!;
      const blocker = path.join(path.dirname(root), "not-a-directory");
      await fs.writeFile(blocker, "fixture", { flag: "wx" });
      vi.stubEnv("ASSETHUB_ASSET_MEDIA_ROOT", blocker);
      const value = intent();
      try {
        await expect(register(request(upload(value)))).rejects.toThrow();
        expect(
          (
            await pool.query(
              "select * from asset_master.registration_receipts where key=$1",
              [value.commandKey],
            )
          ).rowCount,
        ).toBe(0);
      } finally {
        vi.stubEnv("ASSETHUB_ASSET_MEDIA_ROOT", root);
        await fs.unlink(blocker);
      }
    });
    it("SQL failure after byte publication leaves safe orphans, never false success", async () => {
      const image2 = await sharp({
        create: { width: 31, height: 29, channels: 3, background: "#aa4422" },
      })
        .webp()
        .toBuffer();
      await pool.query(
        "create function asset_master.inventory_fail() returns trigger language plpgsql as $$begin raise exception 'Injected receipt failure';end$$",
      );
      await pool.query(
        "create trigger inventory_fail before insert on asset_master.registration_receipts for each row execute function asset_master.inventory_fail()",
      );
      const value = intent();
      try {
        await expect(
          register(request(upload(value, image2))),
        ).rejects.toThrow();
        expect(
          (
            await pool.query(
              "select * from asset_master.assets where source->>'commandKey'=$1",
              [value.commandKey],
            )
          ).rowCount,
        ).toBe(0);
      } finally {
        await pool.query(
          "drop trigger inventory_fail on asset_master.registration_receipts",
        );
        await pool.query("drop function asset_master.inventory_fail()");
      }
    });
    it("durable manual edit and documentation supersession preserve original evidence", async () => {
      const saved = await register(request(upload(intent())));
      const { assetEditDefaults } = await import("@/lib/domain/asset-edit");
      const { editCatalogAsset, readAssetCatalog } =
        await import("@/lib/server/assets");
      const edit = assetEditDefaults(saved.asset);
      edit.name = "Edited durable manual";
      edit.ownerContactId = pic;
      await editCatalogAsset(
        new Request(origin + "/api/assets/" + saved.asset.id, {
          method: "PATCH",
          headers: {
            host: new URL(origin).host,
            origin,
            cookie,
            "content-type": "application/json",
          },
          body: JSON.stringify({ edit, revision: saved.asset.catalogRevision }),
        }),
        saved.asset.id,
      );
      let current = (
        await readAssetCatalog(
          new Request(origin + "/api/assets", {
            headers: { host: new URL(origin).host, cookie },
          }),
        )
      ).find((a) => a.id === saved.asset.id)!;
      expect(current.name).toBe("Edited durable manual");
      expect(current.ownerContactId).toBe(pic);
      const command = {
        commandKey: randomUUID(),
        revision: current.catalogRevision,
      };
      const docForm = () =>
        upload(command, image, [
          {
            partId: "photo",
            category: "Asset",
            isPrimary: true,
            view: "Front",
            caption: "Replacement",
            replacesId: saved.asset.photos[0].id,
          },
        ]);
      const result = await document(request(docForm()), saved.asset.id);
      expect(result.asset?.photos[0].revision).toBe(2);
      await document(request(docForm()), saved.asset.id);
      expect(
        (
          await pool.query(
            "select count(*)::int as n from asset_master.asset_photos where asset_id=$1",
            [saved.asset.id],
          )
        ).rows[0].n,
      ).toBe(2);
      expect(
        (
          await pool.query(
            "select superseded_at from asset_master.asset_photos where id=$1",
            [saved.asset.photos[0].id],
          )
        ).rows[0].superseded_at,
      ).not.toBeNull();
    });
    it("forged/missing session and denied canonical roles cannot upload/register", async () => {
      await expect(register(request(upload(intent()), ""))).rejects.toThrow();
      const denied = await select(
        new Request(origin + "/api/development/session", {
          method: "POST",
          headers: {
            host: new URL(origin).host,
            origin,
            "content-type": "application/json",
          },
          body: JSON.stringify({ personId: "user-brand" }),
        }),
      );
      await expect(
        register(
          request(
            upload(intent()),
            denied.headers.get("set-cookie")!.split(";")[0],
          ),
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  },
);
