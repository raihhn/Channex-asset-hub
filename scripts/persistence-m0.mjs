/** Explicit local PostgreSQL 17 backup/restore and provenance. Never run at startup. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migration = '0008_persistence_provenance.sql';
const bin = process.env.ASSETHUB_PG_BIN ?? '/opt/homebrew/opt/postgresql@17/bin';
const sha = (value) => createHash('sha256').update(value).digest('hex');
const quote = (value) => '"' + value.replaceAll('"', '""') + '"';
const same = (a, b, message) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(message);
};
const json = async (file, value) => fs.writeFile(file, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' });

export function assertLocal(url) {
  const parsed = new URL(url);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) ||
      !parsed.pathname || parsed.pathname === '/') throw new Error('A named loopback PostgreSQL database is required.');
  return parsed;
}
export function assertRestoreTarget(target, source) {
  if (!/^assethub_m0_restore_[a-f0-9]{24}$/.test(target) || target === source)
    throw new Error('Restore target must be a new M0-only database distinct from source.');
}

async function sourceClient() {
  // Node's parser handles quoting; never print or copy the environment file.
  const { parseEnv } = await import('node:util');
  const local = parseEnv(await fs.readFile(path.join(root, '.env.local'), 'utf8'));
  const url = process.env.ASSETHUB_DATABASE_URL ?? local.ASSETHUB_DATABASE_URL;
  assertLocal(url);
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000,
    application_name: 'assethub_m0_recovery' });
  await client.connect();
  const result = await client.query("select current_database() as database,current_setting('server_version_num')::int as version, (select rolcreatedb or rolsuper from pg_roles where rolname=current_user) as can_create");
  if (Math.floor(result.rows[0].version / 10000) !== 17 || !result.rows[0].can_create) {
    await client.end();
    throw new Error('PostgreSQL 17 and permission to create isolated databases are required.');
  }
  await client.query("set statement_timeout='15000ms'");
  return client;
}

function cliEnv(client, database, readOnly = false) {
  const c = client.connectionParameters;
  const env = { ...process.env, PGHOST: c.host, PGPORT: String(c.port), PGUSER: c.user,
    PGPASSWORD: c.password ?? '', PGDATABASE: database, PGCONNECT_TIMEOUT: '5',
    PGOPTIONS: readOnly ? '-c default_transaction_read_only=on -c statement_timeout=300000' : '-c statement_timeout=300000',
    PGAPPNAME: 'assethub_m0_recovery', PGSSLMODE: c.ssl ? 'require' : 'disable' };
  delete env.PGSERVICE;
  return env;
}
async function run(tool, args, env, log) {
  const handle = await fs.open(log, 'ax', 0o600);
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(path.join(bin, tool), args, { env, stdio: ['ignore', handle.fd, handle.fd] });
      child.on('error', () => reject(new Error(`${tool} could not start; inspect private log.`)));
      child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${tool} failed (${code}); inspect private log.`)));
    });
  } finally { await handle.close(); }
}
async function readTransaction(client) {
  await client.query('begin isolation level repeatable read read only');
  await client.query("set local statement_timeout='15000ms'");
  await client.query("set local lock_timeout='1000ms'");
  await client.query("set local timezone='UTC'");
  await client.query('set local row_security=off');
}

// Stable logical definitions, not OIDs, physical sizes, timestamps or dump headers.
// pg_dump omits explicit ACLs equivalent to defaults; fingerprint their effective grants.
const schemaQueries = {
  schemas: "select nspname,pg_get_userbyid(nspowner) as owner,coalesce(nspacl,acldefault('n',nspowner))::text as acl from pg_namespace where nspname !~ '^pg_' and nspname <> 'information_schema' order by nspname",
  relations: "select n.nspname,c.relname,c.relkind,c.relpersistence,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) as owner,case when c.relkind='S' then coalesce(c.relacl,acldefault('s',c.relowner))::text when c.relkind in ('r','p','v','m','f') then coalesce(c.relacl,acldefault('r',c.relowner))::text else c.relacl::text end as acl,obj_description(c.oid,'pg_class') as comment from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname !~ '^pg_' and n.nspname <> 'information_schema' order by 1,2",
  columns: "select n.nspname,c.relname,a.attname,a.attnum,format_type(a.atttypid,a.atttypmod) as type,a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid) as default_expr,col_description(c.oid,a.attnum) as comment from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where n.nspname !~ '^pg_' and n.nspname <> 'information_schema' and a.attnum>0 and not a.attisdropped order by 1,2,4",
  constraints: "select n.nspname,c.relname,k.conname,pg_get_constraintdef(k.oid,true) as definition,k.convalidated,k.condeferrable,k.condeferred from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname !~ '^pg_' and n.nspname <> 'information_schema' order by 1,2,3",
  indexes: "select schemaname,tablename,indexname,indexdef from pg_indexes where schemaname !~ '^pg_' and schemaname <> 'information_schema' order by 1,2,3",
  views: "select schemaname,viewname,definition from pg_views where schemaname !~ '^pg_' and schemaname <> 'information_schema' order by 1,2",
  functions: "select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,pg_get_functiondef(p.oid) as definition,coalesce(p.proacl,acldefault('f',p.proowner))::text as acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname !~ '^pg_' and n.nspname <> 'information_schema' and p.prokind in ('f','p') order by 1,2,3",
  triggers: "select n.nspname,c.relname,t.tgname,pg_get_triggerdef(t.oid) as definition,t.tgenabled from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname !~ '^pg_' and n.nspname <> 'information_schema' order by 1,2,3",
  policies: "select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname !~ '^pg_' order by 1,2,3",
  defaults: "select pg_get_userbyid(d.defaclrole) as owner,n.nspname,d.defaclobjtype,d.defaclacl::text as acl from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace order by 1,2,3",
  sequences: "select schemaname,sequencename,sequenceowner,data_type,start_value,min_value,max_value,increment_by,cycle,cache_size from pg_sequences where schemaname !~ '^pg_' order by 1,2",
  extensions: 'select extname,extversion from pg_extension order by extname',
};
export async function manifest(client) {
  if ((await client.query('select count(*)::int as count from pg_largeobject_metadata')).rows[0].count)
    throw new Error('Large objects require extended recovery verification; stopped.');
  const schema = {};
  for (const [name, query] of Object.entries(schemaQueries)) schema[name] = (await client.query(query)).rows;
  const tables = {};
  for (const table of schema.relations.filter(r => r.relkind === 'r')) {
    const qualified = `${quote(table.nspname)}.${quote(table.relname)}`;
    const rows = (await client.query(`select to_jsonb(t)::text as value from ${qualified} t order by to_jsonb(t)::text collate "C"`)).rows;
    const hash = createHash('sha256');
    for (const row of rows) hash.update(row.value + '\n');
    tables[`${table.nspname}.${table.relname}`] = { count: rows.length, sha256: hash.digest('hex') };
  }
  const sequences = {};
  for (const s of schema.sequences) sequences[`${s.schemaname}.${s.sequencename}`] =
    (await client.query(`select last_value::text,is_called from ${quote(s.schemaname)}.${quote(s.sequencename)}`)).rows[0];
  return { schemaSha256: sha(JSON.stringify(schema)), schema, tables, sequences };
}
async function artifacts() {
  const result = [];
  for (const name of (await fs.readdir(path.join(root, 'db/migrations'))).filter(n => /^\d+.*\.sql$/.test(n)).sort()) {
    result.push({ name, sha256: sha(await fs.readFile(path.join(root, 'db/migrations', name))) });
  }
  return result;
}
export async function mediaManifest(directory) {
  const rows = [];
  async function walk(relative = '') {
    for (const name of (await fs.readdir(path.join(directory, relative))).sort()) {
      const rel = path.join(relative, name), file = path.join(directory, rel), stat = await fs.lstat(file);
      if (stat.isSymbolicLink()) throw new Error('Media symlinks are not supported; stopped.');
      if (stat.isDirectory()) await walk(rel);
      else if (stat.isFile()) rows.push({ path: rel, bytes: stat.size, sha256: sha(await fs.readFile(file)) });
      else throw new Error('Unsupported media file type; stopped.');
    }
  }
  await walk();
  return rows;
}
async function copyMedia(from, to, entries) {
  await fs.mkdir(to, { mode: 0o700 });
  for (const entry of entries) {
    const destination = path.join(to, entry.path);
    await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
    await fs.copyFile(path.join(from, entry.path), destination, fs.constants.COPYFILE_EXCL);
    await fs.chmod(destination, 0o600);
  }
  same(await mediaManifest(to), entries, 'Copied media does not match.');
}
async function snapshot(client) {
  await readTransaction(client);
  try { return await manifest(client); } finally { await client.query('rollback'); }
}
export async function checkBundle(bundle) {
  const m = JSON.parse(await fs.readFile(path.join(bundle, 'baseline.json'), 'utf8'));
  same(sha(await fs.readFile(path.join(bundle, 'database.dump'))), m.dumpSha256, 'Backup checksum mismatch.');
  same(await mediaManifest(path.join(bundle, 'media')), m.media, 'Backup media mismatch.');
  for (const a of m.migrations) same(sha(await fs.readFile(path.join(bundle, 'migrations', a.name))), a.sha256, 'Migration archive mismatch.');
  return m;
}
async function verifyRestore(source, bundle, m) {
  const target = 'assethub_m0_restore_' + randomUUID().replaceAll('-', '').slice(0, 24);
  assertRestoreTarget(target, source.database);
  let created = false, restored;
  try {
    if ((await source.query('select 1 from pg_database where datname=$1', [target])).rowCount) throw new Error('Restore target exists; stopped.');
    await source.query(`create database ${quote(target)} template template0`);
    created = true;
    await run('pg_restore', ['--exit-on-error', '--single-transaction', '--dbname', target, path.join(bundle, 'database.dump')], cliEnv(source, target), path.join(bundle, `restore-${target}.log`));
    restored = new pg.Client({ ...source.connectionParameters, database: target, connectionTimeoutMillis: 5000 });
    await restored.connect();
    const restoredManifest = await snapshot(restored);
    if (JSON.stringify(restoredManifest) !== JSON.stringify(m.databaseManifest)) {
      await json(path.join(bundle, `restore-difference-${target}.json`), restoredManifest);
      throw new Error('Restored schema/data/sequences differ from baseline; private difference manifest retained.');
    }
    const restoredMedia = path.join(bundle, 'restore-media-' + target.slice(-24));
    await copyMedia(path.join(bundle, 'media'), restoredMedia, m.media);
    await fs.rm(restoredMedia, { recursive: true }); // only this newly created, verified media copy
    return { verified: true, database: target, allTables: Object.keys(m.databaseManifest.tables).length,
      mediaFiles: m.media.length, schemaMatch: true, rowHashesMatch: true, sequencesMatch: true, mediaHashesMatch: true };
  } finally {
    if (restored) await restored.end();
    // Never force termination or drop any caller-specified database.
    if (created) await source.query(`drop database ${quote(target)}`);
  }
}
async function backup(client) {
  const bundleId = new Date().toISOString().replaceAll(':', '-') + '-' + randomUUID().slice(0, 8);
  const bundle = path.join(root, '.local/recovery', bundleId);
  await fs.mkdir(bundle, { recursive: true, mode: 0o700 });
  const mediaDir = path.join(root, '.local/asset-media');
  const media = await mediaManifest(mediaDir), migrations = await artifacts();
  const space = await fs.statfs(bundle);
  const mediaBytes = media.reduce((sum, file) => sum + file.bytes, 0);
  const databaseBytes = Number((await client.query('select pg_database_size(current_database()) as bytes')).rows[0].bytes);
  if (space.bavail * space.bsize < 3 * (mediaBytes + databaseBytes) + 100_000_000) throw new Error('Insufficient free space for recovery validation.');
  await readTransaction(client);
  let databaseManifest;
  try {
    databaseManifest = await manifest(client);
    const registered = (await client.query('select object_key,byte_size from asset_master.media')).rows;
    for (const item of registered) {
      const file = media.find(f => f.path === item.object_key);
      if (!file || file.bytes !== item.byte_size || file.sha256 !== item.object_key.split('.')[0]) throw new Error('Registered media integrity check failed.');
    }
    const id = (await client.query('select pg_export_snapshot() as id')).rows[0].id;
    await run('pg_dump', ['--format=custom', '--snapshot', id, '--file', path.join(bundle, 'database.dump')], cliEnv(client, client.database, true), path.join(bundle, 'dump.log'));
  } finally { await client.query('rollback'); }
  await copyMedia(mediaDir, path.join(bundle, 'media'), media);
  await fs.mkdir(path.join(bundle, 'migrations'), { mode: 0o700 });
  for (const a of migrations) await fs.copyFile(path.join(root, 'db/migrations', a.name), path.join(bundle, 'migrations', a.name), fs.constants.COPYFILE_EXCL);
  const m = { format: 1, bundleId, observedAt: new Date().toISOString(), databaseName: client.database,
    postgresMajor: 17, databaseManifest, media, migrations,
    dumpSha256: sha(await fs.readFile(path.join(bundle, 'database.dump'))) };
  await json(path.join(bundle, 'baseline.json'), m);
  await checkBundle(bundle);
  const report = await verifyRestore(client, bundle, m);
  same(await snapshot(client), databaseManifest, 'Source changed during recovery validation; no baseline recorded.');
  same(await mediaManifest(mediaDir), media, 'Source media changed during recovery validation.');
  same(await artifacts(), migrations, 'Migration files changed during backup.');
  report.sourceUnchanged = true;
  report.temporaryDatabaseDropped = true;
  await json(path.join(bundle, 'verification.json'), report);
  console.log(JSON.stringify({ bundle, ...report }, null, 2));
}

async function record(client, bundle) {
  const m = await checkBundle(bundle);
  const report = JSON.parse(await fs.readFile(path.join(bundle, 'verification.json'), 'utf8'));
  if (!report.verified || !report.sourceUnchanged || m.databaseName !== client.database) throw new Error('A verified backup of this exact source is required.');
  same(await artifacts(), m.migrations, 'Migration artifacts changed after backup.');
  same(await mediaManifest(path.join(root, '.local/asset-media')), m.media, 'Media changed after backup.');
  await client.query('begin');
  try {
    await client.query("set local lock_timeout='1000ms'");
    await client.query("set local statement_timeout='15000ms'");
    await client.query("set local timezone='UTC'");
    if (!(await client.query("select pg_try_advisory_xact_lock(hashtextextended('assethub:m0:provenance',0)) as locked")).rows[0].locked) throw new Error('Another M0 record operation is active.');
    if ((await client.query("select 1 from pg_namespace where nspname='app_core'")).rowCount) throw new Error('app_core already exists; inspect provenance instead of replaying.');
    const tables = Object.keys(m.databaseManifest.tables).map(name => name.split('.').map(quote).join('.'));
    if (tables.length) await client.query(`lock table ${tables.join(',')} in share mode nowait`);
    same(await manifest(client), m.databaseManifest, 'Source no longer matches verified baseline.');
    const ddl = await fs.readFile(path.join(root, 'db/migrations', migration));
    if (sha(ddl) !== m.migrations.find(a => a.name === migration)?.sha256) throw new Error('M0 migration checksum mismatch.');
    await client.query(ddl.toString('utf8'));
    const id = randomUUID();
    await client.query('insert into app_core.persistence_baselines(id,observed_at,schema_sha256,manifest_sha256,table_manifest,media_manifest_sha256,migration_artifacts,recovery_bundle_id,note) values($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [id, m.observedAt, m.databaseManifest.schemaSha256, sha(await fs.readFile(path.join(bundle, 'baseline.json'))), JSON.stringify(m.databaseManifest.tables), sha(JSON.stringify(m.media)), JSON.stringify(m.migrations), m.bundleId,
        'Observed historical schema and data with verified isolated restore. Historical artifact checksums are not proof of execution.']);
    for (const a of m.migrations) {
      if (a.name !== migration && !/^000[1-7]_/.test(a.name)) throw new Error('Unexpected migration outside M0 scope.');
      await client.query("insert into app_core.migration_provenance(migration_id,artifact_sha256,provenance,observed_at,executed_at,baseline_id) values($1,$2,$3,$4,case when $3='executed' then now() else null end,$5)",
        [a.name, a.sha256, a.name === migration ? 'executed' : 'observed_historical', m.observedAt, id]);
    }
    await client.query('commit');
    console.log(JSON.stringify({ baselineId: id, recorded: true, historicalScriptsExecuted: false, executedMigration: migration }));
  } catch (error) { await client.query('rollback'); throw error; }
}

async function main() {
  process.umask(0o077);
  const [command, input] = process.argv.slice(2);
  if (!['backup-verify', 'record-baseline', 'verify-backup'].includes(command) ||
      (command !== 'backup-verify' && !input)) throw new Error('Usage: node scripts/persistence-m0.mjs backup-verify | record-baseline BUNDLE | verify-backup BUNDLE');
  const client = await sourceClient();
  try {
    // Verify client tools before creating a backup or ledger.
    const version = await new Promise((resolve, reject) => {
      const p = spawn(path.join(bin, 'pg_dump'), ['--version']); let value = '';
      p.stdout.on('data', d => { value += d; }); p.on('error', reject); p.on('close', code => code === 0 ? resolve(value) : reject(new Error('pg_dump unavailable')));
    });
    if (!/PostgreSQL\) 17\./.test(version)) throw new Error('PostgreSQL 17 client tools required.');
    if (command === 'backup-verify') await backup(client);
    else if (command === 'record-baseline') await record(client, path.resolve(input));
    else {
      const bundle = path.resolve(input), m = await checkBundle(bundle);
      console.log(JSON.stringify(await verifyRestore(client, bundle, m), null, 2));
    }
  } finally { await client.end(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    // Database errors can contain sensitive row detail. Only print our bounded messages/codes.
    console.error(error.code ? `M0 stopped: PostgreSQL ${error.code}; source was not reset.` : `M0 stopped: ${error.message}`);
    process.exitCode = 1;
  });
}
