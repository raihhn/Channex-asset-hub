// Opt-in only: never use the active development database.
import { afterAll, describe, expect, it, vi } from "vitest";
import pg from "pg";
const target = process.env.ASSETHUB_ASSET_EDIT_TEST_DATABASE_URL;
if (target) {
  const url = new URL(target);
  if (
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    !/^\/assethub_test_asset_edit_[a-f0-9]+$/.test(url.pathname)
  )
    throw new Error("Dedicated disposable asset edit database required.");
  process.env.ASSETHUB_DATABASE_URL = target;
  process.env.ASSETHUB_VENDOR_ENABLED = "true";
}
vi.mock("server-only", () => ({}));
// Real cookies/canonical People, with only OS ingress mocked in this in-process test.
vi.mock("@/server/auth/loopback-listener",()=>({hasOnlyLoopbackListener:async()=>true}));
describe.skipIf(!target)("asset metadata PostgreSQL persistence", () => {
  const pool = target ? new pg.Pool({ connectionString: target }) : undefined;
  afterAll(async () => {
    await pool?.end();
  });
  it("persists metadata and audit while preserving evidence and business fields", async () => {
    const { editCatalogAsset } = await import("@/lib/server/assets");
    const { assetEditDefaults } = await import("@/lib/domain/asset-edit");
    const { peopleFixtures } = await import("@/lib/fixtures/people");
    const actor = peopleFixtures.find(
      (person) =>
        person.status === "ACTIVE" && person.roles.includes("SUPER_ADMIN"),
    )!;
    const before = (
      await pool!.query(
        "select *,updated_at::text as revision from asset_master.assets order by id limit 1",
      )
    ).rows[0];
    const edit = assetEditDefaults(before.payload);
    edit.details.ownerName = "Isolated QA owner";
    edit.details.composition = "Whole";
    vi.stubEnv("NODE_ENV","development");
    vi.stubEnv("ASSETHUB_ACTOR_MODE","local-development");
    vi.stubEnv("ASSETHUB_LOCAL_ACTOR_ORIGIN","http://localhost:4318");
    const {selectLocalActor}=await import("@/server/auth/local-actor");
    const selected=await selectLocalActor(new Request("http://localhost:4318/api/development/session",{method:"POST",headers:{host:"localhost:4318",origin:"http://localhost:4318","content-type":"application/json"},body:JSON.stringify({personId:actor.id})}));
    const cookie=selected.headers.get("set-cookie")!.split(";")[0];
    const request = () =>
      new Request("http://localhost:4318/api/assets/test", {
        method: "PATCH",
        headers: {
          host: "localhost:4318",
          origin: "http://localhost:4318",
          cookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({ edit, revision: before.revision }),
      });
    const result = await editCatalogAsset(request(), before.id);
    const after = (
      await pool!.query("select * from asset_master.assets where id=$1", [
        before.id,
      ])
    ).rows[0];
    expect(after.payload.details.ownerName).toBe("Isolated QA owner");
    expect(after.source).toEqual(before.source);
    expect(after.source_hash).toEqual(before.source_hash);
    expect(after.vendor_id).toEqual(before.vendor_id);
    expect(after.warehouse_id).toEqual(before.warehouse_id);
    for (const key of [
      "id",
      "importInfo",
      "photos",
      "availability",
      "totalQuantity",
      "availableQuantity",
      "unitPolicy",
      "condition",
      "location",
      "inspectionState",
    ])
      expect(after.payload[key]).toEqual(before.payload[key]);
    expect(result.revision).not.toBe(before.revision);
    expect(
      (
        await pool!.query(
          "select * from asset_master.audit_events where asset_id=$1 and action='EDIT_METADATA'",
          [before.id],
        )
      ).rows,
    ).toHaveLength(1);
    await expect(editCatalogAsset(request(), before.id)).rejects.toMatchObject({
      code: "STALE",
    });
  });
});
