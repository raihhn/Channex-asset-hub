import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const url = process.env.ASSETHUB_DATABASE_URL;
if (!url) throw new Error("ASSETHUB_DATABASE_URL is required.");
if (process.argv.includes("--seed") && !/localhost|127\.0\.0\.1/.test(new URL(url).hostname)) {
  throw new Error("Demo seed is restricted to a local database.");
}
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  const root = process.cwd();
  const migrationDir = path.join(root, "db/migrations");
  for (const file of (await fs.readdir(migrationDir)).filter((name) => /^\d+.*\.sql$/.test(name)).sort()) {
    await client.query(await fs.readFile(path.join(migrationDir, file), "utf8"));
  }
  if (process.argv.includes("--seed")) {
    const seed = await fs.readFile(path.join(root, "db/seeds/booking_demo.sql"), "utf8");
    await client.query(seed);
  }
  process.stdout.write("Booking schema ready" + (process.argv.includes("--seed") ? " with demo Asset identities" : "") + ".\n");
} finally {
  await client.end();
}
