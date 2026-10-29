/** Gate 1 isolated-only driver. Never migrates the source, imports data, or runs an app. */
import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { parseEnv } from "node:util";
import { spawn } from "node:child_process";
import pg from "pg";
import {
  assertLocal,
  checkBundle,
  manifest,
  mediaManifest,
} from "./persistence-m0.mjs";
process.umask(0o077);
const sha = (b) => createHash("sha256").update(b).digest("hex");
const same = (a, b, message) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw Error(message);
};
const bundle = path.resolve(process.argv[2] ?? "");
const baseline = await checkBundle(bundle);
const verification = JSON.parse(
  await fs.readFile(path.join(bundle, "verification.json"), "utf8"),
);
if (
  !verification.verified ||
  !verification.sourceUnchanged ||
  baseline.postgresMajor !== 17
)
  throw Error("Verified PostgreSQL 17 M0 bundle required");
const migration = "0011_asset_registration.sql";
const oldFiles = baseline.migrations.map((m) => m.name);
const files = (await fs.readdir("db/migrations"))
  .filter((n) => /^\d.*\.sql$/.test(n))
  .sort();
same(files, [...oldFiles, migration], "Only reviewed 0011 may be pending");
for (const m of baseline.migrations)
  if (sha(await fs.readFile("db/migrations/" + m.name)) !== m.sha256)
    throw Error("Historical migration changed");
const env = parseEnv(await fs.readFile(".env.local", "utf8"));
const sourceUrl =
  process.env.ASSETHUB_DATABASE_URL ?? env.ASSETHUB_DATABASE_URL;
assertLocal(sourceUrl);
const source = new pg.Client({ connectionString: sourceUrl });
await source.connect();
const target = "assethub_test_registration_" + randomBytes(12).toString("hex");
const token = randomBytes(24).toString("hex");
const url = new URL(sourceUrl);
url.pathname = "/" + target;
const run = path.resolve(".local/gate1/" + target);
await fs.mkdir(run, { recursive: true, mode: 0o700 });
let created = false,
  clone;
async function snapshot(client) {
  await client.query("begin isolation level repeatable read read only");
  try {
    await client.query("set local timezone='UTC'");
    return await manifest(client);
  } finally {
    await client.query("rollback");
  }
}
async function processRun(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { ...options, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(Error("Isolated subprocess exit " + code)),
    );
  });
}
try {
  const identity = (
    await source.query(
      "select current_database() as name,current_setting('server_version_num')::int as version",
    )
  ).rows[0];
  if (
    identity.name !== baseline.databaseName ||
    Math.floor(identity.version / 10000) !== 17 ||
    target === identity.name
  )
    throw Error("Source/target identity mismatch");
  same(
    await snapshot(source),
    baseline.databaseManifest,
    "Source drift since verified backup",
  );
  same(
    await mediaManifest(".local/asset-media"),
    baseline.media,
    "Source media drift",
  );
  await source.query(`create database "${target}" template template0`);
  created = true;
  const c = source.connectionParameters;
  const pgEnv = {
    ...process.env,
    PGHOST: c.host,
    PGPORT: String(c.port),
    PGUSER: c.user,
    PGPASSWORD: c.password ?? "",
    PGSSLMODE: "disable",
  };
  // No secrets in argv. Logs stay inside ignored private run directory.
  const log = await fs.open(path.join(run, "restore.log"), "wx", 0o600);
  try {
    await new Promise((resolve, reject) => {
      const p = spawn(
        path.join(
          process.env.ASSETHUB_PG_BIN ?? "/opt/homebrew/opt/postgresql@17/bin",
          "pg_restore",
        ),
        [
          "--exit-on-error",
          "--single-transaction",
          "--dbname",
          target,
          path.join(bundle, "database.dump"),
        ],
        { env: pgEnv, stdio: ["ignore", log.fd, log.fd] },
      );
      p.on("error", reject);
      p.on("exit", (code) =>
        code === 0 ? resolve() : reject(Error("Clone restore failed")),
      );
    });
  } finally {
    await log.close();
  }
  clone = new pg.Client({ connectionString: url.href });
  await clone.connect();
  same(
    await snapshot(clone),
    baseline.databaseManifest,
    "Clone restore differs",
  );
  await fs.cp(path.join(bundle, "media"), path.join(run, "media"), {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
  same(
    await mediaManifest(path.join(run, "media")),
    baseline.media,
    "Isolated media copy differs",
  );
  await clone.query(
    `comment on database "${target}" is 'assethub:gate1:${token}'`,
  );
  const ddl = await fs.readFile("db/migrations/" + migration, "utf8");
  await clone.query("begin");
  try {
    await clone.query("set local lock_timeout='1000ms'");
    await clone.query("set local statement_timeout='30000ms'");
    await clone.query("set local timezone='UTC'");
    const locked = (
      await clone.query(
        "select pg_try_advisory_xact_lock(hashtextextended('assethub:persistence:migration',0)) as locked",
      )
    ).rows[0].locked;
    if (!locked) throw Error("Migration lock unavailable");
    const ledger = (
      await clone.query(
        "select migration_id,artifact_sha256,provenance,executed_at from app_core.migration_provenance order by migration_id",
      )
    ).rows;
    same(
      ledger.map((r) => r.migration_id),
      oldFiles,
      "Unexpected ledger",
    );
    for (const r of ledger) {
      const old = baseline.migrations.find((m) => m.name === r.migration_id);
      if (
        r.artifact_sha256 !== old.sha256 ||
        r.provenance !==
          (/^000[1-7]_/.test(r.migration_id)
            ? "observed_historical"
            : "executed") ||
        (r.provenance === "executed") !== (r.executed_at !== null)
      )
        throw Error("Provenance conflict");
    }
    await clone.query(ddl);
    const id = randomUUID();
    await clone.query(
      "insert into app_core.persistence_baselines(id,observed_at,schema_sha256,manifest_sha256,table_manifest,media_manifest_sha256,migration_artifacts,recovery_bundle_id,note) values($1,$2,$3,$4,$5::jsonb,$6,$7::jsonb,$8,$9)",
      [
        id,
        baseline.observedAt,
        baseline.databaseManifest.schemaSha256,
        sha(await fs.readFile(path.join(bundle, "baseline.json"))),
        JSON.stringify(baseline.databaseManifest.tables),
        sha(JSON.stringify(baseline.media)),
        JSON.stringify(baseline.migrations),
        baseline.bundleId,
        "Gate 1 isolated migration; source database never migrated",
      ],
    );
    await clone.query(
      "insert into app_core.migration_provenance(migration_id,artifact_sha256,provenance,observed_at,executed_at,baseline_id) values($1,$2,'executed',now(),now(),$3)",
      [migration, sha(ddl), id],
    );
    await clone.query("commit");
  } catch (error) {
    await clone.query("rollback");
    throw error;
  }
  const migrated = await snapshot(clone);
  for (const [section, original] of Object.entries(
    baseline.databaseManifest.schema,
  )) {
    const current = new Set(
      migrated.schema[section].map((row) => JSON.stringify(row)),
    );
    if (original.some((row) => !current.has(JSON.stringify(row))))
      throw Error("Existing schema definition changed: " + section);
  }
  for (const [table, value] of Object.entries(baseline.databaseManifest.tables))
    if (!table.startsWith("app_core."))
      same(
        migrated.tables[table],
        value,
        "Migration changed original rows: " + table,
      );
  same(
    migrated.sequences,
    baseline.databaseManifest.sequences,
    "Migration changed sequences",
  );
  await fs.writeFile(
    path.join(run, "migration.json"),
    JSON.stringify(
      {
        migration,
        sha256: sha(ddl),
        target,
        restoreVerified: true,
        originalRowsPreserved: true,
      },
      null,
      2,
    ),
  );
  // Sanitize ambient test targets. Only this owned clone is supplied to opt-in tests.
  const testEnv = { ...process.env };
  for (const k of Object.keys(testEnv))
    if (/ASSETHUB.*(DATABASE_URL|TOKEN)/.test(k)) delete testEnv[k];
  Object.assign(testEnv, {
    ASSETHUB_DATABASE_URL: url.href,
    ASSETHUB_REGISTRATION_TEST_DATABASE_URL: url.href,
    ASSETHUB_REGISTRATION_TEST_TOKEN: token,
    ASSETHUB_VENDOR_ENABLED: "true",
    ASSETHUB_MEDIA_SIGNING_KEY: "gate1-isolated-media-not-active",
    ASSETHUB_GATE1_MEDIA_ROOT: path.join(run, "media"),
  });
  await processRun(
    process.execPath,
    [
      "node_modules/vitest/vitest.mjs",
      "run",
      "tests/asset-registration.test.ts",
      "tests/server/asset-registration-persistence.test.ts",
      "--reporter=default",
      "--reporter=json",
      "--outputFile=" + path.join(run, "vitest.json"),
    ],
    { env: testEnv },
  );
  // Existing rows must match the restored baseline even after tests (new test rows excluded).
  const integrity = [];
  for (const [table, value] of Object.entries(
    baseline.databaseManifest.tables,
  )) {
    const q = table
      .split(".")
      .map((n) => '"' + n + '"')
      .join(".");
    const rows = (
      await clone.query(
        `select to_jsonb(t)::text as value from ${q} t order by to_jsonb(t)::text collate "C"`,
      )
    ).rows.map((r) => r.value);
    // Restore SQL serialized rows are compared as a multiset subset, including old provenance.
    const sourceRows = (
      await source.query(
        `select to_jsonb(t)::text as value from ${q} t order by to_jsonb(t)::text collate "C"`,
      )
    ).rows.map((r) => r.value);
    const counts = new Map();
    for (const row of rows) counts.set(row, (counts.get(row) ?? 0) + 1);
    for (const row of sourceRows) {
      if (!counts.get(row))
        throw Error("Original row modified by tests: " + table);
      counts.set(row, counts.get(row) - 1);
    }
    integrity.push({
      table,
      originalRowsPreserved: true,
      originalCount: value.count,
    });
  }
  same(
    (await snapshot(clone)).sequences,
    baseline.databaseManifest.sequences,
    "Clone sequences changed",
  );
  same(
    await snapshot(source),
    baseline.databaseManifest,
    "ACTIVE SOURCE CHANGED",
  );
  same(
    await mediaManifest(".local/asset-media"),
    baseline.media,
    "ACTIVE MEDIA CHANGED",
  );
  same(
    await mediaManifest(path.join(run, "media")),
    baseline.media,
    "ISOLATED MEDIA CHANGED",
  );
  await fs.writeFile(
    path.join(run, "preservation.json"),
    JSON.stringify(
      {
        sourceSchemaRowsSequencesUnchanged: true,
        sourceMediaUnchanged: true,
        isolatedMediaUnchanged: true,
        originalCloneRows: integrity,
        migrationSha256: sha(ddl),
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ target, evidence: run, preservation: "PASS" }));
} finally {
  if (clone) await clone.end();
  if (created) {
    const ownership = (
      await source.query(
        "select shobj_description(oid,'pg_database') as token from pg_database where datname=$1",
        [target],
      )
    ).rows[0];
    if (ownership?.token !== `assethub:gate1:${token}`)
      throw Error("Cleanup ownership not verified; retained clone");
    await source.query(`drop database "${target}"`);
    await fs.writeFile(
      path.join(run, "cleanup.json"),
      JSON.stringify({ target, dropped: true }),
    );
  }
  await source.end();
}
