/** Explicit opt-in M1-D integration verification. Writes only to an owned PG17 clone.
 * Usage: node scripts/test-m1d-runtime.mjs <verified-M0-bundle>
 * No environment files, active database records, or shared listeners are modified. */
import fs from "node:fs/promises";
import path from "node:path";
import { parseEnv } from "node:util";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import http from "node:http";
import assert from "node:assert/strict";
import pg from "pg";
import { chromium } from "playwright";
import {
  root,
  assertLocal,
  checkBundle,
  manifest,
  mediaManifest,
} from "./persistence-m0.mjs";
process.umask(0o077);
const bundle = path.resolve(process.argv[2] ?? "");
const baseline = await checkBundle(bundle);
const verification = JSON.parse(
  await fs.readFile(path.join(bundle, "verification.json"), "utf8"),
);
assert(
  verification.verified && verification.sourceUnchanged,
  "Verified recovery required",
);
const config = parseEnv(
  await fs.readFile(path.join(root, ".env.local"), "utf8"),
);
const sourceUrl =
  process.env.ASSETHUB_DATABASE_URL ?? config.ASSETHUB_DATABASE_URL;
assertLocal(sourceUrl);
const source = new pg.Client({ connectionString: sourceUrl });
await source.connect();
await source.query("set timezone='UTC'");
const database = "assethub_m1d_test_" + randomBytes(12).toString("hex");
const dir = await fs.mkdtemp(path.join(root, ".local/m1d-runtime-"));
const evidence = {
  started: new Date().toISOString(),
  checks: [],
  sourceCopy: dir,
  database,
  topologies: [],
};
const targetUrl = new URL(sourceUrl);
targetUrl.pathname = "/" + database;
targetUrl.username = source.connectionParameters.user;
targetUrl.password = source.connectionParameters.password ?? "";
const port = 4319,
  origin = `http://127.0.0.1:${port}`;
let created = false,
  server,
  browser,
  test;
const record = (name, details = {}) => {
  evidence.checks.push({ name, ...details });
  console.log(name, JSON.stringify(details));
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const same = (a, b) => assert.deepEqual(a, b);
async function start(mode = "enabled") {
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    TMPDIR: process.env.TMPDIR ?? "/tmp",
    NODE_ENV: "development",
    NEXT_TELEMETRY_DISABLED: "1",
    ASSETHUB_DATABASE_URL: targetUrl.href,
    ASSETHUB_VENDOR_ENABLED: "true",
    NEXT_PUBLIC_ASSETHUB_BOOKING_ENABLED: "true",
    ASSETHUB_MEDIA_SIGNING_KEY: randomBytes(32).toString("hex"),
    NODE_OPTIONS: "--require " + JSON.stringify(path.join(dir, "clock.cjs")),
  };
  if (mode === "no-lsof") env.PATH = path.join(dir, "empty-path");
  if (mode !== "default") {
    env.ASSETHUB_ACTOR_MODE =
      mode === "provider" ? "provider" : "local-development";
    env.ASSETHUB_LOCAL_ACTOR_ORIGIN = origin;
  }
  const log = await fs.open(path.join(dir, mode + ".log"), "a", 0o600);
  server = spawn(
    process.execPath,
    [
      path.join(root, "node_modules/next/dist/bin/next"),
      "dev",
      dir,
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    { cwd: dir, env, stdio: ["ignore", log.fd, log.fd] },
  );
  await log.close();
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null)
      throw Error("Dedicated server exited; see private log");
    try {
      await fetch(origin + "/api/actor", { signal: AbortSignal.timeout(1000) });
      break;
    } catch {
      await sleep(250);
    }
  }
  const topology = execFileSync(
    "lsof",
    ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fpcn"],
    { encoding: "utf8" },
  );
  assert.match(topology, new RegExp(`n127\\.0\\.0\\.1:${port}`));
  assert.doesNotMatch(topology, /n\*:|n0\.0\.0\.0:/);
  evidence.topologies.push({ mode, listing: topology });
}
async function stop() {
  if (!server) return;
  const child = server;
  server = null;
  const ended = once(child, "exit");
  child.kill("SIGTERM");
  await ended;
}
async function call(url, { method = "GET", cookie, body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const r = http.request(
      origin + url,
      {
        method,
        headers: {
          origin,
          ...(cookie ? { cookie } : {}),
          ...(payload
            ? {
                "content-type": "application/json",
                "content-length": Buffer.byteLength(payload),
              }
            : {}),
          ...headers,
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (x) => (raw += x));
        res.on("end", () => {
          let data;
          try {
            data = JSON.parse(raw);
          } catch {
            data = { binary: true };
          }
          resolve({
            status: res.statusCode,
            data,
            headers: res.headers,
            cookie: res.headers["set-cookie"]?.[0]?.split(";")[0],
          });
        });
      },
    );
    r.on("error", reject);
    if (payload) r.write(payload);
    r.end();
  });
}
async function select(id) {
  const r = await call("/api/development/session", {
    method: "POST",
    body: { personId: id },
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert(r.cookie);
  return r.cookie;
}
async function expectStatus(route, status, options) {
  const r = await call(route, options);
  assert.equal(
    r.status,
    status,
    `${route}: ${JSON.stringify(r.data).slice(0, 250)}`,
  );
  return r;
}
try {
  const sourceBefore = await manifest(source);
  same(sourceBefore.tables, baseline.databaseManifest.tables);
  same(sourceBefore.schemaSha256, baseline.databaseManifest.schemaSha256);
  await source.query(`create database "${database}" template template0`);
  created = true;
  const p = source.connectionParameters;
  execFileSync(
    "/opt/homebrew/opt/postgresql@17/bin/pg_restore",
    [
      "--exit-on-error",
      "--single-transaction",
      "--dbname",
      database,
      path.join(bundle, "database.dump"),
    ],
    {
      env: {
        PATH: process.env.PATH,
        PGHOST: p.host,
        PGPORT: String(p.port),
        PGUSER: p.user,
        PGPASSWORD: p.password ?? "",
      },
      stdio: "pipe",
    },
  );
  test = new pg.Client({ connectionString: targetUrl.href });
  await test.connect();
  await test.query("set timezone='UTC'");
  same((await manifest(test)).tables, sourceBefore.tables);
  for (const item of [
    "src",
    "package.json",
    "package-lock.json",
    "postcss.config.mjs",
    "tsconfig.json",
    "next-env.d.ts",
  ])
    await fs.cp(path.join(root, item), path.join(dir, item), {
      recursive: true,
    });
  await fs.symlink(
    path.join(root, "node_modules"),
    path.join(dir, "node_modules"),
    "dir",
  );
  await fs.writeFile(
    path.join(dir, "next.config.ts"),
    `import type {NextConfig} from 'next';const config:NextConfig={turbopack:{root:${JSON.stringify(root)}}};export default config;`,
  );
  await fs.mkdir(path.join(dir, "empty-path"));
  await fs.mkdir(path.join(dir, ".local"), { recursive: true });
  await fs.cp(
    path.join(bundle, "media"),
    path.join(dir, ".local/asset-media"),
    { recursive: true },
  );
  await fs.writeFile(path.join(dir, "clock-offset.json"), "0");
  await fs.writeFile(
    path.join(dir, "clock.cjs"),
    `const fs=require('node:fs'),path=require('node:path'),original=Date.now.bind(Date);Date.now=()=>original()+Number(fs.readFileSync(path.join(__dirname,'clock-offset.json'),'utf8'));`,
  );
  browser = await chromium.launch({ headless: true });
  await start("default");
  for (const route of [
    "/api/actor",
    "/api/development/session",
    "/api/assets",
    "/api/vendor-locations",
    "/api/vendors",
    "/api/booking/requests",
  ])
    await expectStatus(route, 404);
  await expectStatus("/api/development/session", 404, {
    method: "POST",
    body: { personId: "dev-user" },
  });
  record("default-disabled routes");
  await stop();
  await start();
  for (const route of [
    "/api/assets",
    "/api/vendor-locations",
    "/api/vendors",
    "/api/booking/requests",
    "/api/actor/person",
    "/api/booking/reviewers",
  ])
    await expectStatus(route, 401, {
      headers: { "x-prototype-actor-id": "dev-user" },
    });
  record("header-only requests denied across protected API families");
  const admin = await select("dev-user"),
    brand = await select("user-brand"),
    store = await select("user-storedev"),
    vendor = await select("user-vendor"),
    management = await select("user-management");
  const projection = await expectStatus("/api/actor", 200, {
    cookie: brand,
    headers: { "x-prototype-actor-id": "dev-user", "x-role": "SUPER_ADMIN" },
  });
  assert.equal(projection.data.person.id, "user-brand");
  same(projection.data.capabilities, ["asset:read", "request:create"]);
  same(Object.keys(projection.data.person).sort(), ["id", "name"]);
  await expectStatus("/api/vendors", 403, {
    cookie: brand,
    headers: { "x-prototype-actor-id": "dev-user" },
  });
  await expectStatus("/api/vendors", 200, { cookie: admin });
  await expectStatus("/api/vendor-locations", 200, { cookie: vendor });
  const catalog = await expectStatus("/api/assets", 200, { cookie: brand });
  assert.equal(catalog.data.assets.length, 1073);
  const photo = catalog.data.assets
    .flatMap((a) => a.photos)
    .find((p) => p.url?.startsWith("/api/assets/media/"));
  assert(photo);
  await expectStatus(photo.url, 200, { cookie: brand });
  await expectStatus(photo.url, 401);
  await expectStatus(
    photo.url.replace(/signature=[a-f0-9]+/, "signature=" + "0".repeat(64)),
    403,
    { cookie: brand },
  );
  await expectStatus("/api/assets/" + catalog.data.assets[0].id, 403, {
    method: "PATCH",
    cookie: brand,
    body: {},
  });
  record(
    "catalog, signed media, vendor role gates and unchanged actor projection",
  );
  const choices = await expectStatus("/api/development/session", 200);
  same(
    choices.data.map((p) => p.id).sort(),
    [
      "dev-user",
      "user-storedev",
      "user-brand",
      "user-vendor",
      "user-management",
    ].sort(),
  );
  assert(choices.data.every((p) => !("email" in p) && !("brandIds" in p)));
  const reviewers = await expectStatus("/api/booking/reviewers", 200, {
    cookie: admin,
  });
  assert(!reviewers.data.some((p) => p.id === "user-vendor"));
  assert(reviewers.data.every((p) => !("email" in p)));
  await test.query(
    "update identity_core.people set status='INACTIVE' where id='user-brand'",
  );
  await expectStatus("/api/assets", 401, { cookie: brand });
  await expectStatus("/api/development/session", 401, {
    method: "POST",
    body: { personId: "user-brand" },
  });
  assert(
    !(
      await expectStatus("/api/booking/reviewers", 200, { cookie: admin })
    ).data.some((p) => p.id === "user-brand"),
  );
  await test.query(
    "update identity_core.people set status='ACTIVE',name='Canonical runtime proof' where id='user-brand'",
  );
  assert.equal(
    (await expectStatus("/api/actor", 200, { cookie: brand })).data.person.name,
    "Canonical runtime proof",
  );
  await test.query(
    "update identity_core.people set name='Nadia Prasetyo' where id='user-brand'",
  );
  const missing = (
    await test.query(
      "select to_jsonb(p) as data from identity_core.people p where id='user-management'",
    )
  ).rows[0].data;
  await test.query(
    "delete from identity_core.people where id='user-management'",
  );
  await expectStatus("/api/assets", 401, { cookie: management });
  await test.query(
    "insert into identity_core.people select * from jsonb_populate_record(null::identity_core.people,$1::jsonb)",
    [JSON.stringify(missing)],
  );
  record(
    "canonical activity/name/missing records rechecked, narrow projections",
  );
  await expectStatus("/api/actor", 401, {
    cookie: brand.slice(0, -4) + "xxxx",
  });
  for (const headers of [
    { origin: "http://evil.invalid" },
    { host: "evil.invalid:4319" },
    { "x-forwarded-host": "evil.invalid" },
    { forwarded: "for=127.0.0.1;host=evil.invalid" },
    { "x-forwarded-for": "198.51.100.1" },
  ])
    await expectStatus("/api/actor", 403, { cookie: admin, headers });
  await fs.writeFile(path.join(dir, "clock-offset.json"), String(3601 * 1000));
  await expectStatus("/api/actor", 401, { cookie: brand });
  await fs.writeFile(path.join(dir, "clock-offset.json"), "0");
  record("forgery, expiry, wire origin/host/proxy rejection");
  // Commands use a valid existing asset; no new application functionality or test schema.
  const asset = (
    await test.query(
      "select id from booking.assets a where not exists(select 1 from booking.request_items i where i.asset_id=a.id) and availability_hint='available' and not maintenance_hold and not inspection_hold and not issue_hold and classification='ASSET' and tracking_type='Individual' order by id limit 1",
    )
  ).rows[0];
  assert(asset);
  const draft = {
    items: [{ assetId: asset.id, quantity: 1 }],
    startDate: "2090-01-20",
    endDate: "2090-01-20",
    pickupDate: "2090-01-20",
    returnDate: "2090-01-20",
    pickupTime: "10:00",
    returnTime: "12:00",
    projectName: "M1-D isolated project",
    projectAddress: "Isolated venue",
    budgetCode: "M1D-TEST",
    destination: "Isolated test venue",
    purpose: "M1-D verification",
    contact: "Operational PIC, not actor",
    wbsCodes: [],
  };
  const commandKey = randomUUID();
  const submitted = await expectStatus("/api/booking/requests", 201, {
    method: "POST",
    cookie: brand,
    body: { draft, commandKey },
  });
  const number = submitted.data.id;
  same(
    (
      await expectStatus("/api/booking/requests", 201, {
        method: "POST",
        cookie: brand,
        body: { draft, commandKey },
      })
    ).data,
    submitted.data,
  );
  const fingerprint = createHash("sha256")
    .update(JSON.stringify({ draft, actor: "user-brand", kind: "submit" }))
    .digest("hex");
  assert.equal(
    (
      await test.query(
        "select fingerprint from booking.command_receipts where key=$1",
        [commandKey],
      )
    ).rows[0].fingerprint,
    fingerprint,
  );
  await expectStatus("/api/booking/requests", 409, {
    method: "POST",
    cookie: brand,
    body: { draft: { ...draft, purpose: "different" }, commandKey },
  });
  const route = `/api/booking/requests/${number}/review`;
  await expectStatus(route, 400, {
    method: "POST",
    cookie: brand,
    body: { action: "assign", reviewerId: "user-storedev", expectedVersion: 1 },
  });
  await expectStatus(route, 400, {
    method: "POST",
    cookie: admin,
    body: { action: "assign", reviewerId: "user-vendor", expectedVersion: 1 },
  });
  await expectStatus(route, 400, {
    method: "POST",
    cookie: admin,
    body: { action: "assign", reviewerId: "user-brand", expectedVersion: 1 },
  });
  await expectStatus(route, 200, {
    method: "POST",
    cookie: admin,
    body: { action: "assign", reviewerId: "user-storedev", expectedVersion: 1 },
  });
  await expectStatus(route, 400, {
    method: "POST",
    cookie: admin,
    body: {
      action: "decide",
      decision: "Approved",
      note: "",
      expectedVersion: 2,
    },
  });
  await expectStatus(route, 400, {
    method: "POST",
    cookie: store,
    body: {
      action: "decide",
      decision: "Needs update",
      note: "",
      expectedVersion: 2,
    },
  });
  await test.query("update identity_core.people set roles=array['STORE_DEV','VENDOR'],legacy_vendor_id='vendor-abc-production' where id='user-storedev'");
  await expectStatus(route, 200, {
    method: "POST",
    cookie: store,
    body: {
      action: "decide",
      decision: "Needs update",
      note: "Clarify plan",
      expectedVersion: 2,
    },
  });
  await test.query("update identity_core.people set roles=array['STORE_DEV'],legacy_vendor_id=null where id='user-storedev'");
  const revisionKey = randomUUID(),
    revision = { draft, commandKey: revisionKey, expectedVersion: 3 };
  await expectStatus(`/api/booking/requests/${number}`, 400, {
    method: "PATCH",
    cookie: vendor,
    body: revision,
  });
  const resubmitted = await expectStatus(
    `/api/booking/requests/${number}`,
    200,
    { method: "PATCH", cookie: brand, body: revision },
  );
  assert.equal(resubmitted.data.reviewRound, 2);
  assert.equal(resubmitted.data.version, 4);
  same(resubmitted.data.items[0].id, submitted.data.items[0].id);
  await expectStatus(`/api/booking/requests/${number}`, 200, {
    method: "PATCH",
    cookie: brand,
    body: revision,
  });
  // Historical receipt bytes and all pre-existing business records must stay equal.
  const legacyKey = randomUUID();
  await test.query(
    "insert into booking.command_receipts(key,kind,fingerprint,request_id) values($1,'submit',$2,$3)",
    [legacyKey, fingerprint, submitted.data.canonicalId],
  );
  const legacyBefore = (
    await test.query("select * from booking.command_receipts where key=$1", [
      legacyKey,
    ])
  ).rows;
  assert.equal(
    (
      await expectStatus("/api/booking/requests", 201, {
        method: "POST",
        cookie: brand,
        body: { draft, commandKey: legacyKey },
      })
    ).data.id,
    number,
  );
  same(
    (
      await test.query("select * from booking.command_receipts where key=$1", [
        legacyKey,
      ])
    ).rows,
    legacyBefore,
  );
  await expectStatus(route, 200, {
    method: "POST",
    cookie: admin,
    body: { action: "assign", reviewerId: "user-storedev", expectedVersion: 4 },
  });
  await expectStatus(route, 200, {
    method: "POST",
    cookie: store,
    body: {
      action: "decide",
      decision: "Needs update",
      note: "Second revision",
      expectedVersion: 5,
    },
  });
  const adminRevisionKey = randomUUID();
  await expectStatus(`/api/booking/requests/${number}`, 200, {
    method: "PATCH",
    cookie: admin,
    body: { draft, expectedVersion: 6, commandKey: adminRevisionKey },
  });
  const cloned = await test.query(
    "select * from booking.command_receipts where key<>all($1::uuid[]) order by key",
    [[commandKey, revisionKey, legacyKey, adminRevisionKey]],
  );
  const original = await source.query(
    "select * from booking.command_receipts order by key",
  );
  same(cloned.rows, original.rows);
  record(
    "booking submit/retry/fingerprint/resubmit/reviewer rules and historical receipts",
  );
  // Vendor update: unchanged public draft/version contract; only clone is changed.
  const vendors = (await expectStatus("/api/vendors", 200, { cookie: admin }))
    .data;
  const v = vendors[0];
  const body = {
    draft: {
      name: v.name,
      legalName: v.legalName,
      active: v.active,
      contacts: v.contacts,
      warehouses: v.warehouses,
    },
    version: v.version,
  };
  await expectStatus(`/api/vendors/${v.id}`, 200, {
    method: "PUT",
    cookie: admin,
    body,
  });
  await expectStatus(`/api/vendors/${v.id}`, 409, {
    method: "PUT",
    cookie: admin,
    body,
  });
  record("vendor version concurrency and success shape");
  // Fresh browser contexts, genuine UI selector and HttpOnly browser delivery.
  for (const [label, viewport] of [
    ["desktop", { width: 1440, height: 1000 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(origin + "/me");
    const selector = page.getByRole("button", { name: /Current local user/ });
    await selector.waitFor({ timeout: 60000 });
    await selector.click();
    await page
      .getByRole("option")
      .filter({ hasText: "Raihan Pradana" })
      .click();
    await page
      .getByRole("heading", { name: "Raihan Pradana", exact: true })
      .waitFor();
    const cookie = (await ctx.cookies()).find(
      (c) => c.name === "assethub_local_actor",
    );
    assert(cookie?.httpOnly);
    assert.equal(cookie.sameSite, "Strict");
    assert.equal(cookie.path, "/api");
    assert(
      !(await page.evaluate(() => document.cookie)).includes(
        "assethub_local_actor",
      ),
    );
    for (const route of ["/assets", "/requests", "/requests/new", `/assets/${catalog.data.assets[0].id}`, "/admin/warehouses-vendors"]) {
      await page.goto(origin + route);
      await page.waitForTimeout(500);
      assert(
        !(await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )),
        label + " overflow " + route,
      );
    }
    await page.screenshot({ path: path.join(dir, label + ".png") });
    assert.deepEqual(errors, []);
    record(label + " real UI selection/cookie/navigation", { viewport });
    await ctx.close();
  }
  // The same old cookie must fail across a real process restart.
  await stop();
  await start();
  await expectStatus("/api/actor", 401, { cookie: admin });
  record("actual process restart invalidates prior sessions");
  await stop();
  await start("provider");
  await expectStatus("/api/assets", 503, { cookie: admin });
  record("provider remains unconfigured with no cookie fallback");
  await stop();
  await start("no-lsof");
  await expectStatus("/api/assets", 503, { cookie: admin });
  record("unverifiable listener denied without opening a wildcard socket");
  const sourceAfter = await manifest(source);
  same(sourceAfter, sourceBefore);
  same(
    await mediaManifest(path.join(root, ".local/asset-media")),
    baseline.media,
  );
  same((await manifest(test)).schemaSha256, sourceBefore.schemaSha256);
  for (const table of [
    "asset_master.assets",
    "asset_master.media",
    "asset_master.asset_media",
    "identity_core.identity_links",
    "identity_core.development_imports",
  ])
    same((await manifest(test)).tables[table], sourceBefore.tables[table]);
  record(
    "active database/schema/sequences/media unchanged; clone catalog and mappings preserved",
  );
  evidence.passed = true;
} finally {
  await stop();
  await browser?.close();
  await test?.end();
  if (created) {
    await source.query(`drop database "${database}"`);
    evidence.temporaryDatabaseDropped = true;
  }
  await source.end();
  await fs.writeFile(
    path.join(dir, "results.json"),
    JSON.stringify(evidence, null, 2),
  );
  console.log("Private runtime evidence:", dir);
}
