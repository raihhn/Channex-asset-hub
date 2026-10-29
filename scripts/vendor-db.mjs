import fs from "node:fs/promises";
import pg from "pg";
const url = process.env.ASSETHUB_DATABASE_URL;
if (
  !url ||
  !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)
)
  throw new Error(
    "Use ASSETHUB_DATABASE_URL pointing to a local PostgreSQL database.",
  );
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query("begin");
  await client.query(
    await fs.readFile(
      new URL("../db/migrations/0003_vendor_master.sql", import.meta.url),
      "utf8",
    ),
  );
  await client.query(
    await fs.readFile(
      new URL("../db/migrations/0004_vendor_import_rows.sql", import.meta.url),
      "utf8",
    ),
  );
  if (process.argv.includes("--seed")) {
    const vendors = JSON.parse(
      await fs.readFile(
        new URL("../db/seeds/vendor_initial.json", import.meta.url),
        "utf8",
      ),
    );
    for (const vendor of vendors) {
      const inserted = await client.query(
        "insert into vendor_master.vendors(id,name,legal_name) values($1,$2,$3) on conflict(id) do nothing returning id",
        [vendor.id, vendor.name, vendor.legalName],
      );
      // Never overwrite records edited by the admin on a repeated import.
      if (!inserted.rowCount) continue;
      for (const c of vendor.contacts)
        await client.query(
          "insert into vendor_master.contacts(id,vendor_id,name,phone,email) values($1,$2,$3,$4,$5)",
          [c.id, vendor.id, c.name, c.phone, c.email],
        );
      for (const w of vendor.warehouses) {
        await client.query(
          "insert into vendor_master.warehouses(id,vendor_id,name,address,address_verified) values($1,$2,$3,$4,$5)",
          [w.id, vendor.id, w.name, w.address, w.addressVerified],
        );
        for (const id of w.contactIds)
          await client.query(
            "insert into vendor_master.warehouse_contacts(vendor_id,warehouse_id,contact_id) values($1,$2,$3)",
            [vendor.id, w.id, id],
          );
      }
      await client.query(
        "insert into vendor_master.audit_events(vendor_id,actor_id,actor_name,action,version,changed_fields) values($1,'local-import','Local initial import','VENDOR_IMPORTED',1,$2)",
        [vendor.id, ["name", "legalName", "contacts", "warehouses"]],
      );
    }
  }
  await client.query("commit");
  console.log(
    "Vendor database ready" +
      (process.argv.includes("--seed")
        ? " with initial vendor records (existing records preserved)."
        : "."),
  );
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
