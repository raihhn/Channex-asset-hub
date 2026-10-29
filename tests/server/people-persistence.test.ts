// @vitest-environment node
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import pg from "pg";
import {
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { PeopleRepository } from "@/server/people/repository";
import { peopleFixtures } from "@/lib/fixtures/people";
import { executeM1c, assertTarget } from "../../scripts/people-m1c.mjs";
vi.mock("server-only", () => ({}));
const url = process.env.ASSETHUB_PEOPLE_TEST_DATABASE_URL;
const bundle = process.env.ASSETHUB_PEOPLE_TEST_BUNDLE;
describe.skipIf(!url || !bundle)(
  "isolated PostgreSQL 17 canonical People",
  () => {
    let pool: pg.Pool, client: pg.PoolClient, repository: PeopleRepository;
    let baseline: {
      databaseManifest: {
        tables: Record<string, { count: number; sha256: string }>;
      };
    };
    beforeAll(async () => {
      if (!url || !bundle)
        throw Error("Dedicated M1-C test URL/bundle required");
      const db = decodeURIComponent(new URL(url).pathname.slice(1));
      assertTarget(url, db);
      if (!/^assethub_m1c_test_[a-f0-9]{24}$/.test(db))
        throw Error("Active/generic databases forbidden for tests");
      pool = new pg.Pool({
        connectionString: url,
        max: 1,
        application_name: "assethub_m1c_isolated_tests",
      });
      client = await pool.connect();
      const target = (
        await client.query(
          "select current_database() as db,current_setting('server_version_num')::int as version",
        )
      ).rows[0];
      if (target.db !== db || Math.floor(target.version / 10000) !== 17)
        throw Error("Unexpected PostgreSQL target");
      baseline = JSON.parse(
        await fs.readFile(path.join(bundle, "baseline.json"), "utf8"),
      );
      repository = new PeopleRepository(client);
      // A fixture collision must roll back DDL and its executed provenance together.
      await expect(
        executeM1c(client, bundle, "apply", {
          PeopleRepository,
          peopleFixtures: [
            ...peopleFixtures,
            { ...peopleFixtures[0], id: "duplicate-import-id" },
          ],
        }),
      ).rejects.toMatchObject({ code: "23505" });
      expect(
        (
          await client.query(
            "select 1 from pg_namespace where nspname='identity_core'",
          )
        ).rowCount,
      ).toBe(0);
      expect(
        (
          await client.query(
            "select 1 from app_core.migration_provenance where migration_id='0009_canonical_people.sql'",
          )
        ).rowCount,
      ).toBe(0);
      const result = await executeM1c(client, bundle, "apply", {
        PeopleRepository,
        peopleFixtures,
      });
      expect(result.inserted).toEqual(peopleFixtures.map((p) => p.id));
      expect(result.skipped).toEqual([]);
      await expect(
        executeM1c(client, bundle, "apply", {
          PeopleRepository,
          peopleFixtures,
        }),
      ).rejects.toThrow("Database drift after recovery verification.");
    }, 30000);
    beforeEach(async () => {
      await client.query("begin");
      await client.query("set local timezone='UTC'");
    });
    afterEach(async () => {
      await client.query("rollback");
    });
    afterAll(async () => {
      try {
        if (client && baseline) {
          await client.query("begin read only");
          await client.query("set local timezone='UTC'");
          for (const [qualified, expected] of Object.entries(
            baseline.databaseManifest.tables,
          )) {
            if (qualified.startsWith("app_core.")) continue;
            const table = qualified
              .split(".")
              .map((s) => '"' + s.replaceAll('"', '""') + '"')
              .join(".");
            const rows = (
              await client.query(
                `select to_jsonb(t)::text as value from ${table} t order by to_jsonb(t)::text collate "C"`,
              )
            ).rows;
            const hash = createHash("sha256");
            for (const row of rows) hash.update(row.value + "\n");
            expect({ count: rows.length, sha256: hash.digest("hex") }).toEqual(
              expected,
            );
          }
          await client.query("rollback");
        }
      } finally {
        client?.release();
        await pool?.end();
      }
    });
    it("preserves all stable fixture IDs, profile fields, role/scope order, dates and initial versions", async () => {
      for (const person of peopleFixtures) {
        const saved = await repository.get(person.id);
        expect(saved).toEqual({
          person: {
            ...person,
            createdAt: new Date(person.createdAt).toISOString(),
            updatedAt: new Date(person.updatedAt).toISOString(),
          },
          version: 1,
          resolvedVendorId: null,
        });
      }
      expect((await repository.get("user-vendor"))?.person.vendorId).toBe(
        "vendor-abc-production",
      );
      expect(
        (
          await client.query(
            "select count(*)::int as n from identity_core.identity_links",
          )
        ).rows[0].n,
      ).toBe(0);
    });
    it("rejects duplicate email case/whitespace variants without creating another Person", async () => {
      await expect(
        repository.importDevelopmentPeople([
          {
            ...peopleFixtures[0],
            id: "different-person",
            email: " " + peopleFixtures[0].email.toUpperCase() + " ",
          },
        ]),
      ).rejects.toMatchObject({ code: "23505" });
    });
    it("rejects invalid existing scope IDs and unknown roles rather than granting scope", async () => {
      await expect(
        repository.update("user-brand", 1, {
          ...peopleFixtures[2],
          areaIds: ["warehouse-jakarta-hub"],
        }),
      ).rejects.toThrow(/organizational/);
      await expect(
        client.query(
          "update identity_core.people set roles=array['NEW_ADMIN'] where id='user-brand'",
        ),
      ).rejects.toMatchObject({ code: "23514" });
    });
    it("increments versions, rejects stale updates and never overwrites later edits on reimport", async () => {
      const draft = {
        ...peopleFixtures[2],
        name: "Edited after import",
        status: "INACTIVE" as const,
        brandIds: ["WRD"],
      };
      const updated = await repository.update("user-brand", 1, draft);
      expect(updated.version).toBe(2);
      await expect(
        repository.update("user-brand", 1, peopleFixtures[2]),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      const repeated = await repository.importDevelopmentPeople(peopleFixtures);
      expect(repeated.inserted).toEqual([]);
      expect(repeated.skipped).toEqual(peopleFixtures.map((p) => p.id));
      expect(await repository.get("user-brand")).toEqual(updated);
    });
    it("is repeatable without creating duplicates, versions or implicit identity links", async () => {
      await repository.importDevelopmentPeople(peopleFixtures);
      await repository.importDevelopmentPeople(peopleFixtures);
      expect(
        (
          await client.query(
            "select count(*)::int as n from identity_core.people",
          )
        ).rows[0].n,
      ).toBe(5);
      expect((await repository.get("dev-user"))?.version).toBe(1);
      expect(
        (
          await client.query(
            "select count(*)::int as n from identity_core.identity_links",
          )
        ).rows[0].n,
      ).toBe(0);
      expect(
        (
          await client.query(
            "select count(*)::int as n from identity_core.development_imports",
          )
        ).rows[0].n,
      ).toBe(3);
    });
    it("resolves only explicit exact issuer/subject links, never matching emails", async () => {
      expect(
        await repository.resolveIdentity("corp", peopleFixtures[2].email),
      ).toBeNull();
      await repository.createIdentityLink({
        issuer: "corp",
        subject: "subject-1",
        personId: "user-brand",
        linkedByPersonId: "dev-user",
      });
      expect(
        (await repository.resolveIdentity("corp", "subject-1"))?.person.id,
      ).toBe("user-brand");
      expect(await repository.resolveIdentity("Corp", "subject-1")).toBeNull();
      expect(await repository.resolveIdentity("corp", "Subject-1")).toBeNull();
      expect(
        await repository.resolveIdentity("corp", peopleFixtures[2].email),
      ).toBeNull();
    });
    it("enforces permanent issuer/subject uniqueness and foreign-key mapping integrity", async () => {
      await repository.createIdentityLink({
        issuer: "corp",
        subject: "subject-1",
        personId: "user-brand",
        linkedByPersonId: "dev-user",
      });
      await expect(
        repository.createIdentityLink({
          issuer: "corp",
          subject: "subject-1",
          personId: "dev-user",
          linkedByPersonId: "dev-user",
        }),
      ).rejects.toMatchObject({ code: "23505" });
    });
    it("rejects explicit links to missing People without provisioning them", async () => {
      await expect(
        repository.createIdentityLink({
          issuer: "corp",
          subject: "missing",
          personId: "not-a-person",
          linkedByPersonId: "dev-user",
        }),
      ).rejects.toMatchObject({ code: "23503" });
    });
    it("revokes mappings with version checks, retains history and rejects silent reassignment", async () => {
      const link = await repository.createIdentityLink({
        issuer: "corp",
        subject: "subject-1",
        personId: "user-brand",
        linkedByPersonId: "dev-user",
      });
      await expect(
        repository.revokeIdentityLink(link.id, 2, "dev-user", "reason"),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(
        await repository.revokeIdentityLink(
          link.id,
          1,
          "dev-user",
          "Controlled revocation",
        ),
      ).toEqual({ version: 2 });
      expect(await repository.resolveIdentity("corp", "subject-1")).toBeNull();
      const row = (
        await client.query(
          "select * from identity_core.identity_links where id=$1",
          [link.id],
        )
      ).rows[0];
      expect(row.person_id).toBe("user-brand");
      expect(row.revoked_at).not.toBeNull();
      await expect(
        repository.createIdentityLink({
          issuer: "corp",
          subject: "subject-1",
          personId: "dev-user",
          linkedByPersonId: "dev-user",
        }),
      ).rejects.toMatchObject({ code: "23505" });
    });
    it("does not resolve an inactive Person or reactivate them via import", async () => {
      await repository.createIdentityLink({
        issuer: "corp",
        subject: "subject-1",
        personId: "user-brand",
        linkedByPersonId: "dev-user",
      });
      await repository.update("user-brand", 1, {
        ...peopleFixtures[2],
        status: "INACTIVE",
      });
      expect(await repository.resolveIdentity("corp", "subject-1")).toBeNull();
      await repository.importDevelopmentPeople(peopleFixtures);
      expect(await repository.resolveIdentity("corp", "subject-1")).toBeNull();
    });
    it("keeps all new tables private with RLS and no public policies", async () => {
      const rows = (
        await client.query(
          "select relname,relrowsecurity,has_table_privilege('public',c.oid,'SELECT') as public_read from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='identity_core' and c.relkind='r' order by relname",
        )
      ).rows;
      expect(rows).toHaveLength(3);
      expect(rows.every((r) => r.relrowsecurity && !r.public_read)).toBe(true);
      expect(
        (
          await client.query(
            "select 1 from pg_policies where schemaname='identity_core'",
          )
        ).rowCount,
      ).toBe(0);
    });
    it("records only the new migration as executed and rejects DDL replay without side effects", async () => {
      const rows = (
        await client.query(
          "select migration_id,provenance,executed_at from app_core.migration_provenance order by migration_id",
        )
      ).rows;
      expect(rows).toHaveLength(9);
      expect(
        rows
          .slice(0, 7)
          .every(
            (r) =>
              r.provenance === "observed_historical" && r.executed_at === null,
          ),
      ).toBe(true);
      expect(rows[8].migration_id).toBe("0009_canonical_people.sql");
      expect(rows[8].provenance).toBe("executed");
    });
  },
);
