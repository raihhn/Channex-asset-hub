import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({
  query: vi.fn(),
  release: vi.fn(),
  connect: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("pg", () => ({
  default: {
    Pool: class {
      connect() {
        return db.connect();
      }
    },
  },
}));
vi.mock("@/lib/server/vendors", () => ({ operationalVendorActor: vi.fn() }));
import { operationalVendorActor } from "@/lib/server/vendors";
import { editCatalogAsset } from "@/lib/server/assets";
import { assetEditDefaults } from "@/lib/domain/asset-edit";
import { prototypeAssets } from "@/lib/fixtures/prototype-data";
import { peopleFixtures } from "@/lib/fixtures/people";
const asset = prototypeAssets[0];
const request = (overrides = {}, headers = {}) =>
  new Request("http://localhost:3000/api/assets/test", {
    method: "PATCH",
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify({
      edit: assetEditDefaults(asset),
      revision: "v1",
      ...overrides,
    }),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(operationalVendorActor).mockReturnValue({
    ...peopleFixtures[0],
    roles: ["STORE_DEV"],
  });
  db.connect.mockResolvedValue({ query: db.query, release: db.release });
  db.query.mockImplementation(async (sql: string) =>
    sql.startsWith("select")
      ? { rows: [{ payload: asset, revision: "v1" }] }
      : sql.startsWith("update")
        ? { rows: [{ revision: "v2" }] }
        : { rows: [] },
  );
});
describe("catalog metadata command (isolated database double)", () => {
  it.each(["STORE_DEV", "SUPER_ADMIN"] as const)(
    "permits %s and atomically writes metadata and audit",
    async (role) => {
      vi.mocked(operationalVendorActor).mockReturnValue({
        ...peopleFixtures[0],
        roles: [role],
      });
      const result = await editCatalogAsset(request(), asset.id);
      expect(result.revision).toBe("v2");
      expect(db.query.mock.calls.map((call) => call[0])).toEqual([
        "begin",
        expect.stringContaining("for update"),
        expect.stringContaining("to_regclass"),
        expect.stringContaining("update asset_master.assets"),
        expect.stringContaining("insert into asset_master.audit_events"),
        "commit",
      ]);
      const payload = JSON.parse(
        db.query.mock.calls.find((call) =>
          String(call[0]).startsWith("update asset_master.assets"),
        )![1][1],
      );
      expect(payload.photos).toEqual(asset.photos);
      expect(payload.availability).toBe(asset.availability);
      expect(payload.totalQuantity).toBe(asset.totalQuantity);
      expect(db.release).toHaveBeenCalled();
    },
  );
  it("stores paired contacts in the existing JSON payload and metadata audit", async () => {
    const managementContacts = [
      { name: "First", email: "first@example.com", phone: "123" },
      { name: "Second", email: "second@example.com", phone: "456" },
    ];
    const result = await editCatalogAsset(
      request({ edit: { ...assetEditDefaults(asset), managementContacts } }),
      asset.id,
    );
    const payload = JSON.parse(
      db.query.mock.calls.find((call) =>
        String(call[0]).startsWith("update asset_master.assets"),
      )![1][1],
    );
    const changes = JSON.parse(
      db.query.mock.calls.find((call) =>
        String(call[0]).startsWith("insert into asset_master.audit_events"),
      )![1][2],
    );
    expect(result.edit.managementContacts).toEqual(managementContacts);
    expect(payload.managementContacts).toEqual(managementContacts);
    expect(changes.after.managementContacts).toEqual(managementContacts);
    expect(payload.id).toBe(asset.id);
    expect(payload.importInfo).toEqual(asset.importInfo);
    expect(payload.photos).toEqual(asset.photos);
  });
  it("preserves stored contacts when a legacy client omits the new field", async () => {
    const managementContacts = [{ name: "Existing", email: "", phone: "123" }];
    db.query.mockImplementation(async (sql: string) =>
      sql.startsWith("select")
        ? {
            rows: [
              { payload: { ...asset, managementContacts }, revision: "v1" },
            ],
          }
        : { rows: [{ revision: "v2" }] },
    );
    const edit = assetEditDefaults(asset);
    delete edit.managementContacts;
    await editCatalogAsset(request({ edit }), asset.id);
    expect(
      JSON.parse(
        db.query.mock.calls.find((call) =>
          String(call[0]).startsWith("update asset_master.assets"),
        )![1][1],
      ).managementContacts,
    ).toEqual(managementContacts);
  });
  it("rejects other roles before opening a database connection", async () => {
    vi.mocked(operationalVendorActor).mockReturnValue({
      ...peopleFixtures[0],
      roles: ["VENDOR"],
    });
    await expect(editCatalogAsset(request(), asset.id)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.connect).not.toHaveBeenCalled();
  });
  it("rejects cross-site requests", async () => {
    await expect(
      editCatalogAsset(
        request({}, { "sec-fetch-site": "cross-site" }),
        asset.id,
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.connect).not.toHaveBeenCalled();
  });
  it("rejects stale edits and rolls back", async () => {
    await expect(
      editCatalogAsset(request({ revision: "stale" }), asset.id),
    ).rejects.toMatchObject({ code: "STALE" });
    expect(db.query).toHaveBeenLastCalledWith("rollback");
    expect(
      db.query.mock.calls.some((call) => call[0].startsWith("update")),
    ).toBe(false);
  });
  it("rolls back the update when audit fails", async () => {
    db.query.mockImplementation(async (sql: string) => {
      if (sql.startsWith("insert")) throw new Error("audit failure");
      return { rows: [{ payload: asset, revision: "v1" }] };
    });
    await expect(editCatalogAsset(request(), asset.id)).rejects.toThrow(
      "audit failure",
    );
    expect(db.query).toHaveBeenLastCalledWith("rollback");
    expect(db.query).not.toHaveBeenCalledWith("commit");
  });
});
