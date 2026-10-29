/** Explicit, recovery-gated operator tool. Never runs during application startup. */
import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import ts from "typescript";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseEnv } from "node:util";
import { registerHooks } from "node:module";
import { createHash, randomUUID } from "node:crypto";
import pg from "pg";
import {
  assertLocal,
  checkBundle,
  manifest,
  mediaManifest,
} from "./persistence-m0.mjs";
export const migration = "0010_internal_contact_directory.sql";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sha = (v) => createHash("sha256").update(v).digest("hex");
const same = (a, b, message) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw Error(message);
};
const quote = (s) => '"' + s.replaceAll('"', '""') + '"';
export async function contactModules() {
  const hooks = registerHooks({
    load(url, context, next) {
      if (
        url.startsWith(pathToFileURL(path.join(root, "src")).href + "/") &&
        url.endsWith(".ts")
      )
        return {
          format: "module",
          shortCircuit: true,
          source: ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
            compilerOptions: {
              module: ts.ModuleKind.ESNext,
              target: ts.ScriptTarget.ES2022,
            },
          }).outputText,
        };
      return next(url, context);
    },
    resolve(specifier, context, next) {
      if (specifier === "server-only")
        return { url: "data:text/javascript,export{}", shortCircuit: true };
      if (specifier.startsWith("@/"))
        return next(
          pathToFileURL(path.join(root, "src", specifier.slice(2) + ".ts"))
            .href,
          context,
        );
      if (specifier.startsWith(".") && !path.extname(specifier))
        return next(
          new URL(specifier + ".ts", context.parentURL).href,
          context,
        );
      return next(specifier, context);
    },
  });
  try {
    const [{ InternalContactsRepository }, { catalogContactCandidates }] =
      await Promise.all([
        import("../src/server/contacts/repository.ts"),
        import("../src/lib/domain/internal-contacts.ts"),
      ]);
    return { InternalContactsRepository, catalogContactCandidates };
  } finally {
    hooks.deregister();
  }
}
export async function importContacts(client, actorId, modules) {
  const actor = (
    await client.query(
      "select id from identity_core.people where id=$1 and status='ACTIVE' and roles && array['STORE_DEV','SUPER_ADMIN']::text[]",
      [actorId],
    )
  ).rows[0];
  if (!actor)
    throw Error("Explicit active StoreDev/Super Admin operator required.");
  const assets = (
    await client.query("select id,payload from asset_master.assets order by id")
  ).rows.map((r) => ({ ...r.payload, id: r.id }));
  const repo = new modules.InternalContactsRepository(client);
  const summary = {
    contactsCreated: 0,
    assetsLinked: 0,
    linksCreated: 0,
    alreadyLinked: 0,
    needsConfirmation: 0,
    empty: 0,
  };
  const review = [];
  for (const item of modules.catalogContactCandidates(assets)) {
    if ((await repo.linked(item.assetId)).length) {
      summary.alreadyLinked++;
      continue;
    }
    if (!item.contacts.length) {
      if (item.reason === "needs-confirmation") {
        summary.needsConfirmation++;
        review.push({ assetId: item.assetId, reason: item.reason });
      } else summary.empty++;
      continue;
    }
    const ids = [];
    for (const contact of item.contacts) {
      const result = await repo.create(contact, actorId, "catalog-import");
      summary.contactsCreated += Number(result.created);
      ids.push(result.contact.id);
    }
    // Do not modify payloads, revisions, existing business audit, or source snapshots.
    await repo.replace(item.assetId, ids, actorId);
    summary.assetsLinked++;
    summary.linksCreated += ids.length;
  }
  if (summary.contactsCreated || summary.linksCreated)
    await client.query(
      "insert into contact_core.audit_events(id,actor_user_id,action,summary) values($1,$2,'IMPORT_CONTACTS',$3::jsonb)",
      [randomUUID(), actorId, JSON.stringify(summary)],
    );
  return { summary, review };
}
export async function executeContactMigration(client, bundle, actorId) {
  const baseline = await checkBundle(bundle);
  const verified = JSON.parse(
    await fs.readFile(path.join(bundle, "verification.json"), "utf8"),
  );
  const target = (
    await client.query(
      "select current_database() as name,current_setting('server_version_num')::int as version",
    )
  ).rows[0];
  if (
    !verified.verified ||
    !verified.sourceUnchanged ||
    Math.floor(target.version / 10000) !== 17 ||
    (target.name !== baseline.databaseName &&
      !/^assethub_test_contacts_[a-f0-9]{24}$/.test(target.name))
  )
    throw Error("Verified source or isolated PostgreSQL 17 target required.");
  const files = (await fs.readdir(path.join(root, "db/migrations")))
    .filter((f) => /^\d.*\.sql$/.test(f))
    .sort();
  same(
    files,
    baseline.migrations.map((m) => m.name),
    "Migration inventory drift.",
  );
  for (const item of baseline.migrations)
    same(
      sha(await fs.readFile(path.join(root, "db/migrations", item.name))),
      item.sha256,
      "Migration checksum drift.",
    );
  same(
    await mediaManifest(path.join(root, ".local/asset-media")),
    baseline.media,
    "Media drift.",
  );
  const ddl = await fs.readFile(path.join(root, "db/migrations", migration));
  const modules = await contactModules();
  await client.query("begin");
  try {
    await client.query("set local timezone='UTC'");
    await client.query("set local lock_timeout='1000ms'");
    await client.query("set local statement_timeout='30000ms'");
    if (
      !(
        await client.query(
          "select pg_try_advisory_xact_lock(hashtextextended('assethub:persistence:migration',0)) as locked",
        )
      ).rows[0].locked
    )
      throw Error("Another migration is active.");
    await client.query(
      `lock table ${Object.keys(baseline.databaseManifest.tables)
        .map((t) => t.split(".").map(quote).join("."))
        .join(",")} in share mode nowait`,
    );
    same(
      await manifest(client),
      baseline.databaseManifest,
      "Database drift after verified recovery.",
    );
    const ledger = (
      await client.query(
        "select * from app_core.migration_provenance order by migration_id",
      )
    ).rows;
    same(
      ledger.map((r) => r.migration_id),
      files.filter((f) => f !== migration),
      "Unexpected pending migration sequence.",
    );
    for (const r of ledger) {
      same(
        r.artifact_sha256,
        baseline.migrations.find((m) => m.name === r.migration_id)?.sha256,
        "Historical provenance checksum mismatch.",
      );
      if (
        r.provenance !==
        (/^000[1-7]_/.test(r.migration_id) ? "observed_historical" : "executed")
      )
        throw Error("Historical provenance mismatch.");
    }
    if (
      (await client.query("select to_regnamespace('contact_core') as schema"))
        .rows[0].schema
    )
      throw Error("Contact schema already exists; refuse migration replay.");
    const oldBaselines = (
      await client.query(
        "select to_jsonb(b) as value from app_core.persistence_baselines b order by id",
      )
    ).rows;
    await client.query(ddl.toString("utf8"));
    const baselineId = randomUUID();
    await client.query(
      "insert into app_core.persistence_baselines(id,observed_at,schema_sha256,manifest_sha256,table_manifest,media_manifest_sha256,migration_artifacts,recovery_bundle_id,note) values($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        baselineId,
        baseline.observedAt,
        baseline.databaseManifest.schemaSha256,
        sha(await fs.readFile(path.join(bundle, "baseline.json"))),
        JSON.stringify(baseline.databaseManifest.tables),
        sha(JSON.stringify(baseline.media)),
        JSON.stringify(baseline.migrations),
        baseline.bundleId,
        "Internal contact directory pre-change recovery baseline; only 0010 executed, no Person or business record updates.",
      ],
    );
    await client.query(
      "insert into app_core.migration_provenance(migration_id,artifact_sha256,provenance,observed_at,executed_at,baseline_id) values($1,$2,'executed',now(),now(),$3)",
      [migration, sha(ddl), baselineId],
    );
    const imported = await importContacts(client, actorId, modules);
    const after = await manifest(client);
    for (const [table, value] of Object.entries(
      baseline.databaseManifest.tables,
    ))
      if (!table.startsWith("app_core."))
        same(after.tables[table], value, `Business data changed: ${table}`);
    same(
      after.sequences,
      baseline.databaseManifest.sequences,
      "Sequence drift.",
    );
    for (const [section, definitions] of Object.entries(
      baseline.databaseManifest.schema,
    ))
      same(
        after.schema[section].filter(
          (row) =>
            row.nspname !== "contact_core" && row.schemaname !== "contact_core",
        ),
        definitions,
        `Existing schema changed: ${section}`,
      );
    const newLedger = (
      await client.query(
        "select * from app_core.migration_provenance where migration_id<>$1 order by migration_id",
        [migration],
      )
    ).rows;
    same(newLedger, ledger, "Historical provenance modified.");
    same(
      (
        await client.query(
          "select to_jsonb(b) as value from app_core.persistence_baselines b where id<>$1 order by id",
          [baselineId],
        )
      ).rows,
      oldBaselines,
      "Historical baselines modified.",
    );
    same(
      await mediaManifest(path.join(root, ".local/asset-media")),
      baseline.media,
      "Media changed during migration.",
    );
    await client.query("commit");
    return {
      migration,
      checksum: sha(ddl),
      ...imported,
      businessDataPreserved: true,
      historicalProvenancePreserved: true,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}
async function main() {
  process.umask(0o077);
  const [command, expected, bundle, actorId] = process.argv.slice(2);
  if (command !== "apply-and-import" || !expected || !bundle || !actorId)
    throw Error(
      "Usage: node scripts/internal-contacts.mjs apply-and-import EXACT_DATABASE VERIFIED_BUNDLE ACTOR_ID",
    );
  const local = parseEnv(
    await fs.readFile(path.join(root, ".env.local"), "utf8"),
  );
  const url = process.env.ASSETHUB_DATABASE_URL ?? local.ASSETHUB_DATABASE_URL;
  const target = decodeURIComponent(assertLocal(url).pathname.slice(1));
  if (
    target !== expected ||
    !(
      target === "assethub_dev" ||
      /^assethub_test_contacts_[a-f0-9]{24}$/.test(target)
    )
  )
    throw Error(
      "Explicit loopback development or generated test target required.",
    );
  const client = new pg.Client({
    connectionString: url,
    connectionTimeoutMillis: 5000,
  });
  await client.connect();
  try {
    const report = await executeContactMigration(
      client,
      path.resolve(bundle),
      actorId,
    );
    const dir = path.join(root, ".local/internal-contacts");
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    await fs.writeFile(
      path.join(dir, `operation-${Date.now()}.json`),
      JSON.stringify({ database: target, ...report }, null, 2),
      { mode: 0o600, flag: "wx" },
    );
    console.log(JSON.stringify({ ...report, review: report.review.length }));
  } finally {
    await client.end();
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(
      `Contact migration stopped: ${error.code ?? error.message ?? "UNKNOWN"}`,
    );
    process.exitCode = 1;
  });
