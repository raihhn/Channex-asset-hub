import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import pg from "pg";
import {
  buildWarehouseAliases,
  mapSourceRow,
} from "./asset-import-mapping.mjs";
const root = new URL("../", import.meta.url);
const source = JSON.parse(
  await fs.readFile(
    new URL("db/imports/assets-storedev-source.json", root),
    "utf8",
  ),
);
const vendors = JSON.parse(
  await fs.readFile(
    new URL("db/imports/vendors-2026-10-14.json", root),
    "utf8",
  ),
);
const url = process.env.ASSETHUB_DATABASE_URL;
if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname))
  throw Error("Import requires the local PostgreSQL database.");
const db = new pg.Client({ connectionString: url });
await db.connect();
try {
  const warehouses = (
    await db.query(
      "select v.id vendor_id,v.name vendor,v.legal_name,w.id warehouse_id,w.name warehouse,w.address,w.active,w.address_verified from vendor_master.vendors v left join vendor_master.warehouses w on w.vendor_id=v.id",
    )
  ).rows;
  const aliases = buildWarehouseAliases(warehouses, vendors);
  const mapped = source.rows.map((row) => ({
    ...mapSourceRow(row, aliases),
    source: row,
  }));
  const summary = {
    sourceRows: mapped.length,
    withPhotos: mapped.filter((m) => m.record.photos.length).length,
    photoReferences: mapped.reduce((n, m) => n + m.record.photos.length, 0),
    vendorWarehouseMapped: mapped.filter((m) => m.warehouse).length,
    ready: mapped.filter((m) => m.record.availability === "available").length,
    requiresReview: mapped.filter((m) => m.record.importInfo.warnings.length)
      .length,
  };
  console.log(JSON.stringify(summary));
  await fs.writeFile(
    new URL("db/imports/assets-import-review.json", root),
    JSON.stringify(
      {
        summary,
        rows: mapped.map((m) => ({
          id: m.record.id,
          name: m.record.name,
          sheet: m.source.sheet,
          row: m.source.row,
          location: m.record.location,
          quantity: m.record.totalQuantity,
          unit: m.record.unitPolicy?.stockUnit,
          photos: m.record.photos.length,
          warnings: m.record.importInfo.warnings,
        })),
      },
      null,
      2,
    ),
  );
  if (!process.argv.includes("--apply")) process.exitCode = 0;
  else {
    // Verify all referenced binary objects exist before starting the transaction.
    for (const p of mapped.flatMap((m) => m.source.photos)) {
      const bytes = await fs.readFile(
        new URL(".local/asset-media/" + p.key, root),
      );
      if (
        bytes.length !== p.size ||
        createHash("sha256").update(bytes).digest("hex") !== p.key.split(".")[0]
      )
        throw Error("Extracted media integrity check failed.");
    }
    await db.query("begin");
    await db.query(
      await fs.readFile(
        new URL("db/migrations/0005_asset_catalog.sql", root),
        "utf8",
      ),
    );
    await db.query(
      await fs.readFile(
        new URL("db/migrations/0006_internal_warehouses.sql", root),
        "utf8",
      ),
    );
    for (const m of mapped.filter(
      (m) => m.source.values.M === "Internal" && m.source.values.N,
    )) {
      const label = m.source.values.N.trim();
      const id =
        "internal-" +
        createHash("sha256").update(label).digest("hex").slice(0, 20);
      await db.query(
        "insert into asset_master.internal_warehouses(id,name,address,source) values($1,$2,$3,$4) on conflict(id) do nothing",
        [id, label, m.source.values.O ?? "", m.source.sheet],
      );
      await db.query(
        "update asset_master.assets set internal_warehouse_id=$1,payload=jsonb_set(payload,'{warehouseId}',to_jsonb($1::text)) where source_key=$2 and internal_warehouse_id is null",
        [id, m.sourceKey],
      );
      m.record.warehouseId = id;
    }
    await db.query(
      await fs.readFile(
        new URL("db/migrations/0007_asset_import_audit.sql", root),
        "utf8",
      ),
    );
    let inserted = 0,
      skipped = 0;
    for (const m of mapped) {
      const existing = await db.query(
        "select id,source_hash from asset_master.assets where source_key=$1",
        [m.sourceKey],
      );
      if (existing.rowCount) {
        skipped++;
        continue;
      }
      await db.query(
        "insert into asset_master.assets(id,source_key,source_hash,vendor_id,warehouse_id,payload,source,internal_warehouse_id) values($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          m.record.id,
          m.sourceKey,
          source.sourceHash,
          m.record.vendorId ?? null,
          m.warehouse?.warehouse_id ?? null,
          JSON.stringify(m.record),
          JSON.stringify(m.source),
          m.source.values.M === "Internal"
            ? (m.record.warehouseId ?? null)
            : null,
        ],
      );
      for (const p of m.source.photos) {
        await db.query(
          "insert into asset_master.media(object_key,mime_type,byte_size) values($1,$2,$3) on conflict do nothing",
          [p.key, p.mimeType, p.size],
        );
        await db.query(
          "insert into asset_master.asset_media(asset_id,object_key,source_cell) values($1,$2,$3)",
          [m.record.id, p.key, p.sourceCell],
        );
      }
      // Mirror only verified classifications into the existing booking authority, without rewriting existing Asset rows.
      if (m.record.classification !== "UNCLASSIFIED")
        await db.query(
          `insert into booking.assets(id,category,classification,tracking_type,availability_hint,inspection_hold,available_quantity) values($1,$2,$3,$4,$5,$6,$7) on conflict(id) do nothing`,
          [
            m.record.id,
            m.record.category,
            m.record.classification,
            m.record.trackingType,
            m.record.availability,
            m.record.inspectionState !== "Clear",
            Number.isSafeInteger(m.record.availableQuantity)
              ? m.record.availableQuantity
              : 0,
          ],
        );
      inserted++;
    }
    await db.query(
      "insert into asset_master.import_runs(source_hash,source_name,actor_user_id,summary) values($1,$2,$3,$4) on conflict do nothing",
      [
        source.sourceHash,
        source.sourceName,
        "dev-user",
        JSON.stringify({ ...summary, inserted, skipped }),
      ],
    );
    await db.query("commit");
    console.log(JSON.stringify({ inserted, skipped }));
  }
} catch (e) {
  await db.query("rollback").catch(() => {});
  throw e;
} finally {
  await db.end();
}
