/** Dedicated loopback Next/Chromium verification against the driver's owned clone. */
import fs from "node:fs/promises";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import pg from "pg";
import sharp from "sharp";
const root = process.cwd(),
  run = path.resolve(process.argv[2] ?? "");
if (!run.startsWith(path.join(root, ".local/gate234/")))
  throw Error("Private owned run directory required");
const database = new URL(process.env.ASSETHUB_DATABASE_URL ?? "invalid:");
if (
  !["127.0.0.1", "localhost"].includes(database.hostname) ||
  !/^\/assethub_test_registration_[a-f0-9]{24}$/.test(database.pathname)
)
  throw Error("Owned clone required");
const db = new pg.Client({ connectionString: database.href });
await db.connect();
database.username = db.connectionParameters.user;
database.password = db.connectionParameters.password ?? "";
const owner = (
  await db.query(
    "select shobj_description(oid,'pg_database') as owner from pg_database where datname=current_database()",
  )
).rows[0];
if (
  owner.owner !==
  `assethub:gate1:${process.env.ASSETHUB_REGISTRATION_TEST_TOKEN}`
)
  throw Error("Clone ownership mismatch");
const dir = path.join(run, "source");
await fs.mkdir(dir, { mode: 0o700 });
for (const name of [
  "src",
  "public",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "postcss.config.mjs",
]) {
  try {
    await fs.cp(path.join(root, name), path.join(dir, name), {
      recursive: true,
      errorOnExist: true,
    });
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
}
await fs.symlink(
  path.join(root, "node_modules"),
  path.join(dir, "node_modules"),
  "dir",
);
await fs.writeFile(
  path.join(dir, "next.config.ts"),
  `import type {NextConfig} from 'next';const config:NextConfig={turbopack:{root:${JSON.stringify(root)}}};export default config;`,
);
const probe = createServer();
await new Promise((r) => probe.listen(0, "127.0.0.1", r));
const port = probe.address().port;
await new Promise((r) => probe.close(r));
const origin = `http://127.0.0.1:${port}`;
let server, browser;
const evidence = { checks: [], screenshots: [], origin };
const record = (name) => {
  evidence.checks.push(name);
  console.log("Browser:", name);
};
const env = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  TMPDIR: process.env.TMPDIR,
  NODE_ENV: "development",
  NEXT_TELEMETRY_DISABLED: "1",
  ASSETHUB_DATABASE_URL: database.href,
  ASSETHUB_VENDOR_ENABLED: "true",
  ASSETHUB_ACTOR_MODE: "local-development",
  ASSETHUB_LOCAL_ACTOR_ORIGIN: origin,
  ASSETHUB_MEDIA_SIGNING_KEY: "isolated-inventory-browser-media",
  ASSETHUB_ASSET_MEDIA_ROOT: process.env.ASSETHUB_ASSET_MEDIA_ROOT,
};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function start() {
  const log = await fs.open(path.join(run, "next-runtime.log"), "a", 0o600);
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
    if (server.exitCode !== null) throw Error("Isolated Next server exited");
    try {
      await fetch(origin + "/api/actor", { signal: AbortSignal.timeout(1500) });
      break;
    } catch {
      await pause(250);
    }
  }
  const topology = execFileSync(
    "lsof",
    ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fn"],
    { encoding: "utf8" },
  );
  assert(topology.includes(`n127.0.0.1:${port}`));
  assert(!topology.includes("n*:"));
  evidence.topology = topology;
}
async function stop() {
  if (server) {
    const exited = once(server, "exit");
    server.kill("SIGTERM");
    await exited;
    server = null;
  }
}
async function signIn(context, personId) {
  const response = await context.request.post(
    origin + "/api/development/session",
    { headers: { origin }, data: { personId } },
  );
  assert.equal(response.status(), 200, JSON.stringify(await response.json()));
  assert(
    (await context.cookies()).some(
      (c) => c.name === "assethub_local_actor" && c.httpOnly,
    ),
  );
}
try {
  await start();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await signIn(context, "dev-user");
  let page = await context.newPage();
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(e.message));
  const contacts = await (
    await context.request.get(origin + "/api/internal-contacts")
  ).json();
  const locations = await (
    await context.request.get(origin + "/api/asset-registration-locations")
  ).json();
  async function choose(label, text) {
    await page
      .getByText(label, { exact: true })
      .locator("..")
      .getByRole("button")
      .first()
      .click();
    const option = page.getByRole("option").filter({ hasText: text }).first();
    if (!(await option.isVisible())) {
      await page
        .getByText(label, { exact: true })
        .locator("..")
        .getByRole("button")
        .first()
        .press("Escape");
      await page
        .getByText(label, { exact: true })
        .locator("..")
        .getByRole("button")
        .first()
        .click();
    }
    await option.click();
  }
  await page.goto(origin + "/assets/new");
  await page
    .getByRole("textbox", { name: "Asset name", exact: true })
    .fill("Browser isolated durable asset");
  await choose(
    "Warehouse location",
    locations.find((l) => l.type === "Internal warehouse").name,
  );
  await choose("Cari Owner asset", contacts[0].name);
  await choose("Cari PIC internal", contacts[1].name);
  await page.screenshot({
    path: path.join(run, "add-desktop.png"),
    fullPage: true,
  });
  evidence.screenshots.push("add-desktop.png");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(run, "add-mobile-top.png") });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth),
    390,
  );
  await page.screenshot({
    path: path.join(run, "add-mobile.png"),
    fullPage: true,
  });
  evidence.screenshots.push("add-mobile.png");
  await page
    .getByRole("button", { name: "Continue", exact: true })
    .scrollIntoViewIfNeeded();
  const clearance = await page
    .getByRole("button", { name: "Continue", exact: true })
    .evaluate((button) => ({
      bottom: button.getBoundingClientRect().bottom,
      navTop:
        document.querySelector(".mobile-bottom-nav")?.getBoundingClientRect()
          .top ?? window.innerHeight,
    }));
  assert(clearance.bottom <= clearance.navTop);
  evidence.mobileActionClearance = clearance;
  record("Desktop/mobile Add master selections; no horizontal overflow");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  // Required-photo rejection is exercised through the actual mounted form.
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Register asset", exact: true })
      .count(),
    0,
  );
  await page.getByLabel("Received date", { exact: true }).fill("2026-10-20");
  await page
    .getByLabel("Event / project reference", { exact: true })
    .fill("Metadata reference only");
  await page
    .getByLabel("Informational asset value", { exact: true })
    .fill("1234.50");
  await page
    .getByLabel("Currency (explicit code, e.g. IDR)", { exact: true })
    .fill("IDR");
  await page
    .getByLabel("Additional notes", { exact: true })
    .fill("Isolated verification notes");
  record(
    "Actual UI blocks registration without a primary photo; optional metadata entered",
  );
  const png = await sharp({
    create: { width: 60, height: 80, channels: 3, background: "#337799" },
  })
    .png()
    .toBuffer();
  await page
    .getByLabel("Choose asset photos")
    .setInputFiles({ name: "browser.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const responsePromise = page.waitForResponse(
    (r) =>
      r.url() === origin + "/api/assets" && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Register asset", exact: true })
    .click();
  const savedResponse = await responsePromise;
  assert.equal(savedResponse.status(), 201);
  const saved = await savedResponse.json();
  const id = saved.asset.id;
  await page.waitForURL("**/assets/" + id);
  await page
    .getByRole("heading", {
      name: "Browser isolated durable asset",
      exact: true,
    })
    .waitFor();
  await page.waitForFunction(() => {
    const image = document.querySelector(".asset-gallery img");
    return (
      image instanceof HTMLImageElement &&
      image.complete &&
      image.naturalWidth > 0
    );
  });
  assert(
    await page
      .locator(".asset-gallery img")
      .first()
      .evaluate((img) => img.complete && img.naturalWidth > 0),
  );
  await page.screenshot({
    path: path.join(run, "detail-mobile.png"),
    fullPage: true,
  });
  evidence.screenshots.push("detail-mobile.png");
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth),
    390,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: path.join(run, "detail-desktop.png"),
    fullPage: true,
  });
  evidence.screenshots.push("detail-desktop.png");
  record(
    "Browser registration with actual file; real private gallery; mobile/desktop Detail",
  );
  await page.reload();
  await page
    .getByRole("heading", {
      name: "Browser isolated durable asset",
      exact: true,
    })
    .waitFor();
  record("Browser refresh retains canonical asset");
  await page.getByRole("button", { name: "Edit asset", exact: true }).click();
  await page
    .getByLabel("Nama asset", { exact: true })
    .fill("Browser edited durable asset");
  const editResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/assets/" + id) && r.request().method() === "PATCH",
  );
  await page
    .getByRole("button", { name: "Simpan perubahan", exact: true })
    .click();
  assert.equal((await editResponse).status(), 200);
  await page
    .getByRole("heading", { name: "Browser edited durable asset", exact: true })
    .waitFor();
  await page
    .getByText("Data asset tersimpan di database.", { exact: true })
    .waitFor();
  record(
    "Manual durable edit via existing UI/PATCH; accurate durable-save feedback",
  );
  async function catalog() {
    const response = await context.request.get(origin + "/api/assets");
    assert.equal(response.status(), 200);
    return (await response.json()).assets;
  }
  let current = (await catalog()).find((a) => a.id === id);
  assert.deepEqual(current.registrationMetadata, {
    receivedDate: "2026-10-20",
    assetValue: { amount: "1234.50", currency: "IDR" },
    eventProjectReference: "Metadata reference only",
    additionalNotes: "Isolated verification notes",
  });
  assert.equal(current.producedAt, saved.asset.producedAt);
  assert.equal(current.lastUsed, saved.asset.lastUsed);
  const originalPhoto = current.photos[0];
  await page
    .getByRole("button", { name: "Add / replace photos", exact: true })
    .click();
  const condition = await sharp({
    create: { width: 48, height: 64, channels: 3, background: "#bb7733" },
  })
    .webp()
    .toBuffer();
  await page
    .getByLabel("Choose asset photos")
    .setInputFiles({
      name: "condition.webp",
      mimeType: "image/webp",
      buffer: condition,
    });
  await choose("Photo 1 category", "Condition Photo");
  let photoResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/assets/" + id + "/photos") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Save documentation", exact: true })
    .click();
  assert.equal((await photoResponse).status(), 200);
  await page.waitForLoadState("domcontentloaded");
  await page
    .getByRole("button", { name: "Add / replace photos", exact: true })
    .waitFor();
  current = (await catalog()).find((a) => a.id === id);
  assert.equal(
    current.photos.filter((p) => p.category === "Condition").length,
    1,
  );
  assert.equal(current.photos.find((p) => p.isPrimary).id, originalPhoto.id);
  await page
    .getByRole("button", { name: "Add / replace photos", exact: true })
    .click();
  await choose("Replace an existing image (optional)", "Photo 1 · Asset");
  const replacement = await sharp({
    create: { width: 70, height: 90, channels: 3, background: "#55aa44" },
  })
    .jpeg()
    .toBuffer();
  await page
    .getByLabel("Choose asset photos")
    .setInputFiles({
      name: "replacement.jpeg",
      mimeType: "image/jpeg",
      buffer: replacement,
    });
  photoResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/assets/" + id + "/photos") &&
      r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Save documentation", exact: true })
    .click();
  assert.equal((await photoResponse).status(), 200);
  await page.waitForLoadState("domcontentloaded");
  await page
    .getByRole("heading", { name: "Browser edited durable asset", exact: true })
    .waitFor();
  current = (await catalog()).find((a) => a.id === id);
  assert.equal(current.photos.find((p) => p.isPrimary).revision, 2);
  assert(!current.photos.some((p) => p.id === originalPhoto.id));
  const revisedHistory = await (
    await context.request.get(origin + "/api/assets/" + id + "/history")
  ).json();
  assert.equal(
    revisedHistory.filter((e) => e.kind === "Documentation").length,
    2,
  );
  assert(!revisedHistory.some((e) => ["Usage", "Movement"].includes(e.kind)));
  const oldEvidence = revisedHistory
    .flatMap((e) => e.evidence ?? [])
    .find((e) => e.label.includes("historical"));
  assert(oldEvidence);
  assert.equal(
    (await context.request.get(origin + oldEvidence.url)).status(),
    200,
  );
  const unauthenticated = await browser.newContext();
  assert.equal(
    (
      await unauthenticated.request.get(origin + current.photos[0].url)
    ).status(),
    401,
  );
  const forged = new URL(origin + current.photos[0].url);
  forged.searchParams.set("signature", "forged");
  assert.equal((await context.request.get(forged.href)).status(), 403);
  await unauthenticated.close();
  await page
    .getByRole("region", { name: "Asset History", exact: true })
    .getByRole("button", { name: "Documentation", exact: true })
    .click();
  await page
    .getByText("Dokumentasi diperbarui", { exact: true })
    .first()
    .waitFor();
  assert.equal(
    await page.getByRole("link", { name: /Request this asset/ }).count(),
    0,
  );
  record(
    "Condition-only upload and primary replacement via UI; old evidence retained; private media cookie/signature guards; History filters and held CTA",
  );
  const groupName = "Final verification group";
  const grouped = [];
  for (const mode of ["create", "existing"]) {
    await page.setViewportSize(
      mode === "create"
        ? { width: 1440, height: 1000 }
        : { width: 390, height: 844 },
    );
    await page.goto(origin + "/assets/new");
    await choose(
      "Asset Group",
      mode === "create"
        ? "Create group with this asset"
        : "Join an existing group",
    );
    if (mode === "create")
      await page.getByLabel("New group name", { exact: true }).fill(groupName);
    else {
      await choose("Select existing group", groupName);
      await page.getByText(/Assignments cannot be changed here/).waitFor();
      assert.equal(
        await page.getByText("Cari Owner asset", { exact: true }).count(),
        0,
      );
    }
    await page
      .getByLabel("Asset name", { exact: true })
      .fill("Group individual " + mode);
    if (mode === "existing") await choose("Warehouse type", "Vendor warehouse");
    await choose(
      "Warehouse location",
      locations.find(
        (l) =>
          l.type ===
          (mode === "create" ? "Internal warehouse" : "Vendor warehouse"),
      ).name,
    );
    if (mode === "create") {
      await choose("Cari Owner asset", contacts[0].name);
      await choose("Cari PIC pengelola tetap", contacts[1].name);
    }
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await choose(
      "Recorded condition",
      mode === "create" ? "Fair" : "Needs review",
    );
    await page
      .getByLabel("Choose asset photos")
      .setInputFiles({ name: "group.png", mimeType: "image/png", buffer: png });
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    const submitted = page.waitForResponse(
      (r) =>
        r.url() === origin + "/api/assets" && r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Register asset", exact: true })
      .click();
    const res = await submitted;
    assert.equal(res.status(), 201);
    const member = (await res.json()).asset;
    grouped.push(member);
    await page.waitForURL("**/assets/" + member.id);
    await page
      .getByRole("heading", { name: "Group individual " + mode, exact: true })
      .waitFor();
    await page
      .getByRole("heading", { name: "Owner & Contacts", exact: true })
      .waitFor();
    await page
      .getByRole("heading", { name: "Asset History", exact: true })
      .waitFor();
    assert.equal(
      await page.getByRole("link", { name: /Request this asset/ }).count(),
      0,
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth),
      mode === "create" ? 1440 : 390,
    );
    await page.getByRole("button", { name: "Edit asset", exact: true }).click();
    await page.getByText(/Group assignments cannot be changed here/).waitFor();
    await page.getByRole("button", { name: "Edit asset", exact: true }).click();
    await page.screenshot({
      path: path.join(run, "group-" + mode + ".png"),
      fullPage: true,
    });
    evidence.screenshots.push("group-" + mode + ".png");
  }
  const members = (await catalog()).filter((a) =>
    grouped.some((g) => g.id === a.id),
  );
  assert.equal(members.length, 2);
  assert.equal(members[0].assetGroup.id, members[1].assetGroup.id);
  for (const member of members) {
    assert.equal(member.assignmentSource, "group");
    assert.equal(member.ownerContactId, contacts[0].id);
    assert.deepEqual(member.managementContactIds, [contacts[1].id]);
    assert.equal(member.assetGroup.memberCount, 2);
  }
  assert.notEqual(members[0].warehouseId, members[1].warehouseId);
  assert.notEqual(members[0].condition, members[1].condition);
  for (const member of members) {
    const h = await (
      await context.request.get(
        origin + "/api/assets/" + member.id + "/history",
      )
    ).json();
    assert.equal(h.filter((e) => e.kind === "Registration").length, 1);
    assert(!h.some((e) => e.kind === "Documentation"));
  }
  // Existing asset compatibility and positive/negative CTA agree with current policy.
  const original = (await catalog()).filter((a) => !a.registrationProvenance);
  assert(original.length >= 1073);
  const eligible = original.find(
    (a) =>
      a.classification === "ASSET" &&
      a.trackingType === "Individual" &&
      (a.totalQuantity ?? 1) === 1 &&
      a.availability !== "unavailable" &&
      a.inspectionState === "Clear" &&
      !a.maintenance &&
      !a.issues.some((i) => i.blocksUsage && i.status !== "Resolved"),
  );
  if (eligible) {
    await page.goto(origin + "/assets/" + eligible.id);
    await page
      .getByRole("heading", { name: eligible.name, exact: true })
      .waitFor();
    await page.getByRole("link", { name: /Request this asset/ }).waitFor();
  } else
    throw Error(
      "No existing eligible individual fixture for positive CTA verification",
    );
  record(
    "Desktop new group + mobile join existing group through actual forms; inherited contacts; independent internal/vendor warehouse, condition/history; existing catalog positive CTA",
  );
  await page.goto(origin + "/assets/" + id);
  await page
    .getByRole("heading", { name: "Browser edited durable asset", exact: true })
    .waitFor();
  const second = await browser.newContext();
  await signIn(second, "user-storedev");
  const secondPage = await second.newPage();
  await secondPage.goto(origin + "/assets/" + id);
  await secondPage
    .getByRole("heading", { name: "Browser edited durable asset", exact: true })
    .waitFor();
  record("Second authorized browser session reads same persisted asset");
  await stop();
  await start();
  const rejected = await context.request.get(origin + "/api/actor");
  assert.equal(rejected.status(), 401);
  await signIn(context, "dev-user");
  // A stopped dev server can race the old frame's HMR-driven navigation. Use a
  // fresh page in the same restored-cookie context, not a navigation assertion bypass.
  await page.close();
  page = await context.newPage();
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  await page.goto(origin + "/assets/" + id);
  await page
    .getByRole("heading", { name: "Browser edited durable asset", exact: true })
    .waitFor();
  await page.waitForFunction(() => {
    const image = document.querySelector(".asset-gallery img");
    return (
      image instanceof HTMLImageElement &&
      image.complete &&
      image.naturalWidth > 0
    );
  });
  assert(
    await page
      .locator(".asset-gallery img")
      .first()
      .evaluate((img) => img.complete && img.naturalWidth > 0),
  );
  record(
    "Actual Next restart invalidates session; re-selection restores asset and private photo",
  );
  const history = await (
    await context.request.get(origin + "/api/assets/" + id + "/history")
  ).json();
  assert(history.some((e) => e.kind === "Registration"));
  assert(history.some((e) => e.kind === "Metadata"));
  assert(!history.some((e) => e.kind === "Usage"));
  await page
    .getByText("Informasi / Owner / PIC diperbarui", { exact: true })
    .waitFor();
  const deniedContext = await browser.newContext();
  assert.equal(
    (
      await deniedContext.request.post(origin + "/api/assets", {
        headers: { origin, "x-prototype-actor-id": "dev-user" },
        data: {},
      })
    ).status(),
    401,
  );
  await signIn(deniedContext, "user-brand");
  assert.equal(
    (
      await deniedContext.request.post(origin + "/api/assets", {
        headers: { origin },
        data: {},
      })
    ).status(),
    403,
  );
  await deniedContext.close();
  record(
    "Actual Next route rejects missing-cookie/header-spoofed and denied-role registration",
  );
  record("Durable registration/edit history; no invented Usage");
  evidence.consoleErrors = consoleErrors;
  assert.equal(consoleErrors.length, 0);
  evidence.assetId = id;
  evidence.success = true;
  await fs.writeFile(
    path.join(run, "browser.json"),
    JSON.stringify(evidence, null, 2),
    { mode: 0o600 },
  );
} finally {
  await browser?.close();
  await stop();
  await db.end();
}
