import "server-only";
import pg from "pg";
import { createHash } from "node:crypto";
import { operationalVendorActor } from "./vendors";
import { readAssetCatalog } from "./assets";
import { VendorError, validateVendorId } from "@/lib/domain/vendor-master";
import {
  parsePhotoUpload,
  persistPhotos,
  requireDocumentationSchema,
} from "@/server/assets/local-media-storage";
const pool = new pg.Pool({
  connectionString: process.env.ASSETHUB_DATABASE_URL,
  max: 3,
});
export async function saveAssetDocumentation(request: Request, id: string) {
  const actor = await operationalVendorActor(request);
  if (!actor.roles.some((r) => r === "STORE_DEV" || r === "SUPER_ADMIN"))
    throw new VendorError(
      "FORBIDDEN",
      "Documentation requires StoreDev or Super Admin.",
    );
  await requireDocumentationSchema(pool);
  const { input, media } = await parsePhotoUpload(request, false);
  const body = input as Record<string, unknown>;
  if (
    Object.keys(body).some((k) => !["commandKey", "revision"].includes(k)) ||
    typeof body.revision !== "string" ||
    !body.revision
  )
    throw new VendorError("VALIDATION", "Reload the asset before documenting.");
  const key = validateVendorId(body.commandKey);
  const hash = createHash("sha256")
    .update(
      JSON.stringify({
        id,
        actor: actor.id,
        key,
        revision: body.revision,
        media: media.fingerprint,
      }),
    )
    .digest("hex");
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("set local lock_timeout='3000ms'");
    await client.query("set local statement_timeout='30000ms'");
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
      "assethub:documentation:" + key,
    ]);
    const person = (
      await client.query(
        "select id from identity_core.people where id=$1 and status='ACTIVE' and roles && array['STORE_DEV','SUPER_ADMIN']::text[] for share",
        [actor.id],
      )
    ).rows[0];
    if (!person)
      throw new VendorError("FORBIDDEN", "Actor is no longer eligible.");
    const prior = (
      await client.query(
        "select fingerprint from asset_master.documentation_receipts where key=$1",
        [key],
      )
    ).rows[0];
    if (prior) {
      if (prior.fingerprint !== hash)
        throw new VendorError(
          "CONFLICT",
          "Documentation key reused with different intent.",
        );
    } else {
      const old = (
        await client.query(
          "select payload,updated_at::text as revision from asset_master.assets where id=$1 for update",
          [id],
        )
      ).rows[0];
      if (!old) throw new VendorError("NOT_FOUND", "Asset not found.");
      if (old.revision !== body.revision)
        throw new VendorError("STALE", "Reload the asset before documenting.");
      const hasPrimary = (
        await client.query(
          "select id from asset_master.asset_photos where asset_id=$1 and is_primary and superseded_at is null",
          [id],
        )
      ).rowCount;
      if (
        !hasPrimary &&
        !old.payload.photos.some((p: { objectKey?: string }) => p.objectKey) &&
        !media.photos.some((p) => p.isPrimary && p.category === "Asset")
      )
        throw new VendorError(
          "VALIDATION",
          "A primary Asset Photo is required.",
        );
      const photoIds = await persistPhotos(
        client,
        id,
        media,
        actor.id,
        old.payload.photos,
      );
      await client.query(
        "update asset_master.assets set updated_at=clock_timestamp() where id=$1",
        [id],
      );
      await client.query(
        "insert into asset_master.audit_events(asset_id,actor_user_id,action,changes) values($1,$2,'DOCUMENTATION_UPDATED',$3::jsonb)",
        [
          id,
          actor.id,
          JSON.stringify({
            photoIds,
            replacedIds: media.photos.flatMap((p) =>
              p.replacesId ? [p.replacesId] : [],
            ),
          }),
        ],
      );
      await client.query(
        "insert into asset_master.documentation_receipts(key,actor_user_id,asset_id,fingerprint,result_photo_ids) values($1,$2,$3,$4,$5::uuid[])",
        [key, actor.id, id, hash, photoIds],
      );
    }
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
  return { asset: (await readAssetCatalog(request)).find((a) => a.id === id) };
}
