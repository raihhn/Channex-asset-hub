/** Restore a verified bundle to a generated disposable database; never test against source. */
import fs from "node:fs/promises";
import path from "node:path";
import { parseEnv } from "node:util";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import pg from "pg";
import { assertLocal, checkBundle, manifest } from "./persistence-m0.mjs";
import {
  executeContactMigration,
  importContacts,
  contactModules,
} from "./internal-contacts.mjs";
process.umask(0o077);
const bundle = path.resolve(process.argv[2] ?? "");
const baseline = await checkBundle(bundle);
const env = parseEnv(await fs.readFile(".env.local", "utf8"));
const source = new URL(env.ASSETHUB_DATABASE_URL);
assertLocal(source.href);
const admin = new pg.Client({ connectionString: source.href });
await admin.connect();
const name =
  "assethub_test_contacts_" + randomUUID().replaceAll("-", "").slice(0, 24);
const testUrl = new URL(source);
testUrl.pathname = "/" + name;
const logDir = path.resolve(".local/internal-contacts");
await fs.mkdir(logDir, { recursive: true, mode: 0o700 });
let client;
try {
  if (baseline.databaseName !== decodeURIComponent(source.pathname.slice(1)))
    throw Error("Bundle does not match local source.");
  await admin.query(`create database "${name}" template template0`);
  const log = await fs.open(
    path.join(logDir, name + "-restore.log"),
    "wx",
    0o600,
  );
  try {
    await new Promise((resolve, reject) => {
      const c = admin.connectionParameters;
      const child = spawn(
        path.join(
          process.env.ASSETHUB_PG_BIN ?? "/opt/homebrew/opt/postgresql@17/bin",
          "pg_restore",
        ),
        [
          "--exit-on-error",
          "--single-transaction",
          "--dbname",
          name,
          path.join(bundle, "database.dump"),
        ],
        {
          env: {
            ...process.env,
            PGHOST: c.host,
            PGPORT: String(c.port),
            PGUSER: c.user,
            PGPASSWORD: c.password ?? "",
            PGSSLMODE: "disable",
            PGCONNECT_TIMEOUT: "5",
          },
          stdio: ["ignore", log.fd, log.fd],
        },
      );
      child.on("error", reject);
      child.on("exit", (code) =>
        code === 0
          ? resolve()
          : reject(Error("Isolated restore failed; inspect private log.")),
      );
    });
  } finally {
    await log.close();
  }
  client = new pg.Client({ connectionString: testUrl.href });
  await client.connect();
  const report = await executeContactMigration(client, bundle, "dev-user");
  await client.query("set timezone='UTC'");
  const beforeRepeat = await manifest(client);
  await client.query("begin");
  const repeated = await importContacts(
    client,
    "dev-user",
    await contactModules(),
  );
  await client.query("commit");
  const afterRepeat = await manifest(client);
  if (JSON.stringify(beforeRepeat) !== JSON.stringify(afterRepeat))
    throw Error("Repeat import changed stored records.");
  await fs.writeFile(
    path.join(logDir, "isolated-migration.json"),
    JSON.stringify(
      {
        database: name,
        report,
        repeated: repeated.summary,
        repeatUnchanged: true,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      database: name,
      migration: report.migration,
      import: report.summary,
      businessDataPreserved: report.businessDataPreserved,
      repeatUnchanged: true,
    }),
  );
  await client.end();
  client = undefined;
  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "node_modules/vitest/vitest.mjs",
        "run",
        "tests/server/internal-contacts-persistence.test.ts",
        "tests/internal-contacts.test.ts",
      ],
      {
        env: {
          ...process.env,
          ASSETHUB_DATABASE_URL: testUrl.href,
          ASSETHUB_CONTACTS_TEST_DATABASE_URL: testUrl.href,
          ASSETHUB_VENDOR_ENABLED: "true",
        },
        stdio: "inherit",
      },
    );
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(Error("Isolated contact tests failed.")),
    );
  });
} finally {
  if (client) await client.end();
  if (
    !/^assethub_test_contacts_[a-f0-9]{24}$/.test(name) ||
    name === decodeURIComponent(source.pathname.slice(1))
  )
    throw Error("Unsafe cleanup target refused.");
  await admin.query(
    "select pg_terminate_backend(pid) from pg_stat_activity where datname=$1 and pid<>pg_backend_pid()",
    [name],
  );
  await admin.query(`drop database if exists "${name}"`);
  await admin.end();
}
