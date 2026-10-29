/** Restore a verified bundle into a new PG17 database, run only M1-C tests, drop it. */
import fs from "node:fs/promises";
import path from "node:path";
import { parseEnv } from "node:util";
import { randomUUID } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import pg from "pg";
import { assertLocal, checkBundle } from "./persistence-m0.mjs";
const root = path.resolve(import.meta.dirname, "..");
async function main() {
  process.umask(0o077);
  const bundle = process.argv[2];
  if (!bundle) throw Error("Verified recovery bundle path required.");
  const m = await checkBundle(bundle),
    receipt = JSON.parse(
      await fs.readFile(path.join(bundle, "verification.json"), "utf8"),
    );
  if (!receipt.verified || !receipt.sourceUnchanged)
    throw Error("Recovery not verified.");
  const toolVersion = execFileSync(
    path.join(
      process.env.ASSETHUB_PG_BIN ?? "/opt/homebrew/opt/postgresql@17/bin",
      "pg_restore",
    ),
    ["--version"],
    { encoding: "utf8" },
  );
  if (!/PostgreSQL\) 17\./.test(toolVersion))
    throw Error("PostgreSQL 17 restore tools required.");
  const envFile = parseEnv(
    await fs.readFile(path.join(root, ".env.local"), "utf8"),
  );
  const url =
    process.env.ASSETHUB_DATABASE_URL ?? envFile.ASSETHUB_DATABASE_URL;
  assertLocal(url);
  const source = new pg.Client({
    connectionString: url,
    application_name: "assethub_m1c_isolated_runner",
    connectionTimeoutMillis: 5000,
  });
  await source.connect();
  let target,
    created = false,
    passed = false;
  try {
    const row = (
      await source.query(
        "select current_database() as name,current_setting('server_version_num')::int as version",
      )
    ).rows[0];
    if (row.name !== m.databaseName || Math.floor(row.version / 10000) !== 17)
      throw Error("Source target differs from PG17 recovery bundle.");
    target =
      "assethub_m1c_test_" + randomUUID().replaceAll("-", "").slice(0, 24);
    if (
      (
        await source.query("select 1 from pg_database where datname=$1", [
          target,
        ])
      ).rowCount
    )
      throw Error("Target exists.");
    await source.query(`create database "${target}" template template0`);
    created = true;
    await fs.mkdir(path.join(root, ".local/m1c"), {
      recursive: true,
      mode: 0o700,
    });
    const log = await fs.open(
      path.join(root, ".local/m1c", `restore-${target}.log`),
      "ax",
      0o600,
    );
    const p = source.connectionParameters;
    const cliEnv = {
      ...process.env,
      PGHOST: p.host,
      PGPORT: String(p.port),
      PGUSER: p.user,
      PGPASSWORD: p.password ?? "",
      PGDATABASE: target,
      PGCONNECT_TIMEOUT: "5",
    };
    delete cliEnv.PGSERVICE;
    try {
      await new Promise((resolve, reject) => {
        const child = spawn(
          path.join(
            process.env.ASSETHUB_PG_BIN ??
              "/opt/homebrew/opt/postgresql@17/bin",
            "pg_restore",
          ),
          [
            "--exit-on-error",
            "--single-transaction",
            "--dbname",
            target,
            path.resolve(bundle, "database.dump"),
          ],
          { env: cliEnv, stdio: ["ignore", log.fd, log.fd] },
        );
        child.on("error", reject);
        child.on("exit", (code) =>
          code === 0 ? resolve() : reject(Error("Isolated restore failed.")),
        );
      });
    } finally {
      await log.close();
    }
    const testUrl = new URL(url);
    testUrl.pathname = "/" + target;
    const testEnv = {
      ...process.env,
      ASSETHUB_PEOPLE_TEST_DATABASE_URL: testUrl.href,
      ASSETHUB_PEOPLE_TEST_BUNDLE: path.resolve(bundle),
    };
    for (const key of [
      "ASSETHUB_DATABASE_URL",
      "ASSETHUB_VENDOR_TEST_DATABASE_URL",
      "ASSETHUB_VENDOR_ENABLED",
      "NEXT_PUBLIC_ASSETHUB_BOOKING_ENABLED",
    ])
      delete testEnv[key];
    await new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          path.join(root, "node_modules/vitest/vitest.mjs"),
          "run",
          "tests/server/people-persistence.test.ts",
        ],
        { cwd: root, env: testEnv, stdio: "inherit" },
      );
      child.on("error", reject);
      child.on("exit", (code) =>
        code === 0
          ? resolve()
          : reject(
              Error("Isolated People tests failed; generated target retained."),
            ),
      );
    });
    passed = true;
  } finally {
    if (created && passed) {
      await source.query(`drop database "${target}"`);
      console.log("Owned isolated test database removed:", target);
    } else if (created)
      console.error(
        "Generated isolated target retained for inspection:",
        target,
      );
    await source.end();
  }
}
main().catch((error) => {
  console.error(
    error.code
      ? `M1-C isolated verification stopped: PostgreSQL ${error.code}`
      : error.message,
  );
  process.exitCode = 1;
});
