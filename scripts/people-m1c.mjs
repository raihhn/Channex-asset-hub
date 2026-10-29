/** Explicit operator tool; no application/startup hook. Executes only 0009. */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseEnv } from "node:util";
import { createHash, randomUUID } from "node:crypto";
import { registerHooks } from "node:module";
import pg from "pg";
import {
  assertLocal,
  checkBundle,
  manifest,
  mediaManifest,
} from "./persistence-m0.mjs";
export const migration = "0009_canonical_people.sql";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sha = (value) => createHash("sha256").update(value).digest("hex");
const quote = (name) => '"' + name.replaceAll('"', '""') + '"';
const same = (a, b, label) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw Error(label);
};

/** Explicit CLI-only Node TS import resolution. No global config or startup hook.
 * The server-only marker is a Next bundler guard, skipped only in this operator
 * process; application imports retain it. No application source is rewritten. */
export async function operatorModules() {
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "server-only")
        return { url: "data:text/javascript,export{}", shortCircuit: true };
      if (specifier.startsWith("@/"))
        return nextResolve(
          pathToFileURL(path.join(root, "src", specifier.slice(2) + ".ts"))
            .href,
          context,
        );
      return nextResolve(specifier, context);
    },
  });
  try {
    const [{ PeopleRepository }, { peopleFixtures }] = await Promise.all([
      import("../src/server/people/repository.ts"),
      import("../src/lib/fixtures/people.ts"),
    ]);
    return { PeopleRepository, peopleFixtures };
  } finally {
    hooks.deregister();
  }
}

export function assertTarget(url, expectedDatabase) {
  const parsed = assertLocal(url),
    database = decodeURIComponent(parsed.pathname.slice(1));
  if (
    database !== expectedDatabase ||
    !(
      /^assethub_m1c_test_[a-f0-9]{24}$/.test(database) ||
      database === "assethub_dev"
    )
  )
    throw Error("Explicit development or generated M1-C test target required.");
  return database;
}
async function snapshot(client) {
  await client.query("begin isolation level repeatable read read only");
  try {
    await client.query("set local timezone='UTC'");
    return await manifest(client);
  } finally {
    await client.query("rollback");
  }
}
async function verifyLedger(client, allowApplied = false) {
  const rows = (
    await client.query(
      "select * from app_core.migration_provenance order by migration_id",
    )
  ).rows;
  const files = (await fs.readdir(path.join(root, "db/migrations")))
    .filter((n) => /^\d.*\.sql$/.test(n))
    .sort();
  if (
    files.length !== 9 ||
    files.at(-1) !== migration ||
    rows.length !== (allowApplied ? 9 : 8)
  )
    throw Error("Unexpected migration inventory; stopped.");
  same(
    rows.map((row) => row.migration_id),
    files.slice(0, allowApplied ? 9 : 8),
    "Unexpected pending migration sequence.",
  );
  for (const row of rows) {
    if (
      !files.includes(row.migration_id) ||
      row.artifact_sha256 !==
        sha(
          await fs.readFile(path.join(root, "db/migrations", row.migration_id)),
        )
    )
      throw Error("Provenance/artifact mismatch.");
    const historical = /^000[1-7]_/.test(row.migration_id);
    if (
      row.provenance !== (historical ? "observed_historical" : "executed") ||
      Boolean(row.executed_at) === historical
    )
      throw Error("Unexpected provenance semantics.");
  }
}

/** Gate requires a verified exact pre-change bundle; only the SQL file below is executed.
 * Caller already checked PostgreSQL version and named loopback target. */
export async function executeM1c(client, bundle, command, modules) {
  if (!["apply", "import-people"].includes(command))
    throw Error("Unknown M1-C command.");
  const m = await checkBundle(bundle);
  const verification = JSON.parse(
    await fs.readFile(path.join(bundle, "verification.json"), "utf8"),
  );
  const target = (
    await client.query(
      "select current_database() as name,current_setting('server_version_num')::int as version",
    )
  ).rows[0];
  if (
    Math.floor(target.version / 10000) !== 17 ||
    !verification.verified ||
    !verification.sourceUnchanged ||
    (target.name !== m.databaseName &&
      !/^assethub_m1c_test_[a-f0-9]{24}$/.test(target.name))
  )
    throw Error("Verified PostgreSQL 17 source/restore required.");
  const media = await mediaManifest(path.join(root, ".local/asset-media"));
  same(media, m.media, "Media drift after verified recovery.");
  for (const artifact of m.migrations)
    if (
      artifact.sha256 !==
      sha(await fs.readFile(path.join(root, "db/migrations", artifact.name)))
    )
      throw Error("Recovery migration artifact mismatch.");
  const ddl = await fs.readFile(path.join(root, "db/migrations", migration));
  const checksum = sha(ddl);
  await client.query("begin");
  try {
    await client.query("set local lock_timeout='1000ms'");
    await client.query("set local statement_timeout='15000ms'");
    await client.query("set local timezone='UTC'");
    if (
      !(
        await client.query(
          "select pg_try_advisory_xact_lock(hashtextextended('assethub:persistence:migration',0)) as locked",
        )
      ).rows[0].locked
    )
      throw Error("Another migration/import is active.");
    const tables = Object.keys(m.databaseManifest.tables).map((name) =>
      name.split(".").map(quote).join("."),
    );
    await client.query(`lock table ${tables.join(",")} in share mode nowait`);
    same(
      await manifest(client),
      m.databaseManifest,
      "Database drift after recovery verification.",
    );
    await verifyLedger(client, command === "import-people");
    const priorLedger = (
      await client.query(
        "select to_jsonb(p) as value from app_core.migration_provenance p order by migration_id",
      )
    ).rows;
    const priorBaselines = (
      await client.query(
        "select to_jsonb(p) as value from app_core.persistence_baselines p order by id",
      )
    ).rows;
    const priorCanonical = new Map();
    if (command === "import-people") {
      for (const table of ["people", "development_imports"]) {
        priorCanonical.set(
          table,
          (
            await client.query(
              `select to_jsonb(p) as value from identity_core.${table} p order by id`,
            )
          ).rows,
        );
      }
    }
    if (command === "apply") {
      if (
        (
          await client.query(
            "select 1 from pg_namespace where nspname='identity_core'",
          )
        ).rowCount
      )
        throw Error(
          "Canonical schema already exists; no DDL replay permitted.",
        );
      await client.query(ddl.toString("utf8"));
      const baselineId = randomUUID();
      await client.query(
        "insert into app_core.persistence_baselines(id,observed_at,schema_sha256,manifest_sha256,table_manifest,media_manifest_sha256,migration_artifacts,recovery_bundle_id,note) values($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [
          baselineId,
          m.observedAt,
          m.databaseManifest.schemaSha256,
          sha(await fs.readFile(path.join(bundle, "baseline.json"))),
          JSON.stringify(m.databaseManifest.tables),
          sha(JSON.stringify(m.media)),
          JSON.stringify([
            ...m.migrations,
            { name: migration, sha256: checksum },
          ]),
          m.bundleId,
          "M1-C pre-change baseline, verified isolated recovery; no historical script replay.",
        ],
      );
      await client.query(
        "insert into app_core.migration_provenance(migration_id,artifact_sha256,provenance,observed_at,executed_at,baseline_id) values($1,$2,'executed',now(),now(),$3)",
        [migration, checksum, baselineId],
      );
    }
    const imported = await new modules.PeopleRepository(
      client,
    ).importDevelopmentPeople(modules.peopleFixtures);
    const after = await manifest(client);
    for (const [name, value] of Object.entries(m.databaseManifest.tables)) {
      if (
        !name.startsWith("app_core.") &&
        !["identity_core.people", "identity_core.development_imports"].includes(
          name,
        )
      )
        same(after.tables[name], value, `Business table changed: ${name}`);
    }
    for (const [table, rows] of priorCanonical) {
      for (const row of rows) {
        const existing = (
          await client.query(
            `select to_jsonb(p) as value from identity_core.${table} p where id=$1`,
            [row.value.id],
          )
        ).rows[0];
        same(existing, row, `Existing canonical record changed: ${table}`);
      }
    }
    for (const row of priorLedger) {
      const existing = (
        await client.query(
          "select to_jsonb(p) as value from app_core.migration_provenance p where migration_id=$1",
          [row.value.migration_id],
        )
      ).rows[0];
      same(existing, row, "Historical provenance changed.");
    }
    for (const row of priorBaselines) {
      const existing = (
        await client.query(
          "select to_jsonb(p) as value from app_core.persistence_baselines p where id=$1",
          [row.value.id],
        )
      ).rows[0];
      same(existing, row, "Historical baseline changed.");
    }
    same(
      after.sequences,
      m.databaseManifest.sequences,
      "Existing sequence changed.",
    );
    for (const [section, definitions] of Object.entries(
      m.databaseManifest.schema,
    )) {
      const existingDefinitions =
        command === "apply"
          ? after.schema[section].filter(
              (row) =>
                row.nspname !== "identity_core" &&
                row.schemaname !== "identity_core",
            )
          : after.schema[section];
      same(
        existingDefinitions,
        definitions,
        `Existing schema changed: ${section}`,
      );
    }
    same(
      await mediaManifest(path.join(root, ".local/asset-media")),
      media,
      "Media changed during application.",
    );
    await client.query("commit");
    return {
      migration,
      checksum,
      command,
      ...imported,
      businessTablesPreserved: true,
      historicalProvenancePreserved: true,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function main() {
  process.umask(0o077);
  const [command, expectedDatabase, bundle] = process.argv.slice(2);
  if (
    !["apply", "import-people"].includes(command) ||
    !expectedDatabase ||
    !bundle
  )
    throw Error(
      "Usage: node scripts/people-m1c.mjs apply|import-people EXACT_DATABASE VERIFIED_BUNDLE",
    );
  const local = parseEnv(
    await fs.readFile(path.join(root, ".env.local"), "utf8"),
  );
  const url = process.env.ASSETHUB_DATABASE_URL ?? local.ASSETHUB_DATABASE_URL;
  assertTarget(url, expectedDatabase);
  const client = new pg.Client({
    connectionString: url,
    application_name: "assethub_m1c_operator",
    connectionTimeoutMillis: 5000,
  });
  await client.connect();
  try {
    const before = await snapshot(client);
    const result = await executeM1c(
      client,
      path.resolve(bundle),
      command,
      await operatorModules(),
    );
    const after = await snapshot(client);
    const directory = path.join(root, ".local/m1c");
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    await fs.writeFile(
      path.join(directory, `operation-${Date.now()}-${randomUUID()}.json`),
      JSON.stringify(
        { database: expectedDatabase, result, before, after },
        null,
        2,
      ),
      { mode: 0o600, flag: "wx" },
    );
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.end();
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch(async (error) => {
    const code = error.code ?? "STOPPED";
    await fs.mkdir(path.join(root, ".local/m1c"), {
      recursive: true,
      mode: 0o700,
    });
    await fs.writeFile(
      path.join(root, ".local/m1c", `failure-${Date.now()}.json`),
      JSON.stringify({
        code,
        outcome: "Not certified; inspect database provenance before any retry.",
      }),
      { mode: 0o600 },
    );
    console.error(
      `M1-C stopped: ${code}; inspect target/recovery privately. No historical suite was run.`,
    );
    process.exitCode = 1;
  });
