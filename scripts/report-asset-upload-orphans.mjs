/** Read-only manifest reconciliation. Never deletes files, rows, or directories. */
import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";
const url = new URL(process.env.ASSETHUB_DATABASE_URL ?? "invalid:");
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
  throw Error("Loopback database required");
const root = path.resolve(
  process.env.ASSETHUB_ASSET_MEDIA_ROOT ?? ".local/asset-media",
);
const directory = path.join(path.dirname(root), "asset-upload-manifests");
const client = new pg.Client({ connectionString: url.href });
try {
  await client.connect();
  await client.query("begin read only");
  const keys = new Set();
  for (const file of await fs.readdir(directory)) {
    if (!file.endsWith(".json")) continue;
    const filename = path.join(directory, file);
    if ((await fs.lstat(filename)).isSymbolicLink())
      throw Error("Manifest symlink refused");
    const manifest = JSON.parse(await fs.readFile(filename, "utf8"));
    for (const key of manifest.created ?? [])
      if (/^[a-f0-9]{64}\.(png|jpeg|webp)$/.test(key)) keys.add(key);
  }
  const rows = [];
  for (const key of keys) {
    const references = Number(
      (
        await client.query(
          "select count(*) as n from asset_master.asset_media where object_key=$1",
          [key],
        )
      ).rows[0].n,
    );
    rows.push({
      key,
      references,
      status: references ? "referenced" : "unreferenced-review-only",
    });
  }
  await client.query("rollback");
  console.log(
    JSON.stringify(
      { reportOnly: true, deletionAuthorized: false, objects: rows },
      null,
      2,
    ),
  );
} finally {
  await client.end();
}
