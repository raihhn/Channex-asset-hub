import fs from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import pg from "pg";
const rows = JSON.parse(
  await fs.readFile(
    new URL("../db/imports/vendors-2026-10-14.json", import.meta.url),
    "utf8",
  ),
);
const groups = new Map();
const phoneKey = (phone) => {
  const d = phone.replace(/\D/g, "");
  return d.startsWith("62") ? "0" + d.slice(2) : d;
};
for (const row of rows) {
  if (
    !row.vendor ||
    !Array.isArray(row.emails) ||
    row.emails.some((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()))
  )
    throw Error("Invalid source row");
  if (!groups.has(row.vendor)) groups.set(row.vendor, []);
  groups.get(row.vendor).push(row);
}
console.log(
  JSON.stringify({
    sourceRows: rows.length,
    vendors: groups.size,
    warehouses: rows.filter((r) => r.address).length,
    incomplete: rows
      .filter((r) => !r.address || !r.picName || !r.phone || !r.emails.length)
      .map((r) => `${r.vendor} ${r.warehouse}`),
  }),
);
if (!process.argv.includes("--apply")) process.exit(0);
const url = process.env.ASSETHUB_DATABASE_URL;
if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname))
  throw Error("Import requires a local PostgreSQL database URL.");
const db = new pg.Client({ connectionString: url });
await db.connect();
let applied = 0,
  skipped = 0;
try {
  await db.query("begin");
  await db.query(
    await fs.readFile(
      new URL("../db/migrations/0004_vendor_import_rows.sql", import.meta.url),
      "utf8",
    ),
  );
  for (const [name, sourceRows] of groups) {
    const pending = [];
    for (const row of sourceRows) {
      const key = createHash("sha256")
        .update(JSON.stringify(row))
        .digest("hex");
      if (
        (
          await db.query(
            "select 1 from vendor_master.import_rows where source_key=$1",
            [key],
          )
        ).rowCount
      ) {
        skipped++;
        continue;
      }
      pending.push({ row, key });
    }
    if (!pending.length) continue;
    let vendor = (
      await db.query(
        "select * from vendor_master.vendors where lower(trim(name))=lower($1) for update",
        [name],
      )
    ).rows[0];
    const legalName = sourceRows.find((r) => r.legalName)?.legalName ?? "";
    if (!vendor)
      vendor = (
        await db.query(
          "insert into vendor_master.vendors(id,name,legal_name,active) values($1,$2,$3,$4) returning *",
          [randomUUID(), name, legalName, sourceRows.some((r) => r.address)],
        )
      ).rows[0];
    else
      vendor = (
        await db.query(
          "update vendor_master.vendors set legal_name=case when $2<>'' then $2 else legal_name end,version=version+1,updated_at=now() where id=$1 returning *",
          [vendor.id, legalName],
        )
      ).rows[0];
    for (const { row, key } of pending) {
      const issues = [];
      if (!row.address) issues.push("Warehouse address missing");
      if (!row.picName) issues.push("PIC name missing");
      if (!row.phone) issues.push("PIC phone missing");
      if (!row.emails.length) issues.push("PIC email missing");
      if (row.emails.length > 1)
        issues.push("Additional email retained in source notes");
      let contactId = null;
      if (row.picName && row.phone && row.emails.length) {
        const contacts = (
          await db.query(
            "select * from vendor_master.contacts where vendor_id=$1",
            [vendor.id],
          )
        ).rows;
        const existing = contacts.find(
          (c) =>
            c.name.trim().toLowerCase() === row.picName.trim().toLowerCase() &&
            phoneKey(c.phone) === phoneKey(row.phone),
        );
        contactId = existing?.id ?? randomUUID();
        await db.query(
          `insert into vendor_master.contacts(id,vendor_id,name,phone,email,active) values($1,$2,$3,$4,$5,true)
      on conflict(id) do update set name=excluded.name,phone=excluded.phone,email=excluded.email`,
          [
            contactId,
            vendor.id,
            row.picName,
            row.phone,
            row.emails[0].trim().toLowerCase(),
          ],
        );
      }
      let warehouseId = null;
      if (row.address) {
        const existing = (
          await db.query(
            "select id from vendor_master.warehouses where vendor_id=$1 and lower(trim(name))=lower($2)",
            [vendor.id, row.warehouse],
          )
        ).rows[0];
        warehouseId = existing?.id ?? randomUUID();
        await db.query(
          `insert into vendor_master.warehouses(id,vendor_id,name,address,address_verified,active) values($1,$2,$3,$4,true,$5)
      on conflict(id) do update set address=excluded.address,address_verified=true`,
          [
            warehouseId,
            vendor.id,
            row.warehouse,
            row.address,
            Boolean(contactId),
          ],
        );
        if (contactId)
          await db.query(
            "insert into vendor_master.warehouse_contacts(vendor_id,warehouse_id,contact_id) values($1,$2,$3) on conflict do nothing",
            [vendor.id, warehouseId, contactId],
          );
      }
      await db.query(
        "insert into vendor_master.import_rows(source_key,vendor_id,warehouse_id,source,issues) values($1,$2,$3,$4,$5)",
        [key, vendor.id, warehouseId, row, issues],
      );
      applied++;
    }
    await db.query(
      `insert into vendor_master.audit_events(vendor_id,actor_id,actor_name,action,version,changed_fields) values($1,'dev-user','Raihan Pradana','VENDOR_IMPORTED',$2,$3)`,
      [
        vendor.id,
        vendor.version,
        ["source import", "warehouses", "contacts", "import notes"],
      ],
    );
  }
  await db.query("commit");
  console.log(JSON.stringify({ applied, skipped }));
} catch (error) {
  await db.query("rollback");
  throw error;
} finally {
  await db.end();
}
