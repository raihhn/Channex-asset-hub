import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { validatePersonDraft } from "@/lib/domain/people";
import { userRoles, type Person, type PersonDraft } from "@/types/identity";

export type StoredPerson = {
  person: Person;
  version: number;
  resolvedVendorId: string | null;
};
export class PeopleStoreError extends Error {
  readonly code: "VALIDATION" | "CONFLICT";
  constructor(code: "VALIDATION" | "CONFLICT") {
    super(code);
    this.code = code;
  }
}
const projection = `id,name,email,status,roles,brand_ids as "brandIds",category_ids as "categoryIds",area_ids as "areaIds",dc_ids as "dcIds",legacy_vendor_id as "vendorId",vendor_id as "resolvedVendorId",created_at as "createdAt",updated_at as "updatedAt",version`;
type Row = Omit<Person, "createdAt" | "updatedAt" | "vendorId"> & {
  createdAt: Date;
  updatedAt: Date;
  vendorId: string | null;
  version: number;
  resolvedVendorId: string | null;
};
function stored(row: Row): StoredPerson {
  const { version, resolvedVendorId, ...person } = row;
  return {
    version,
    resolvedVendorId,
    person: {
      ...person,
      vendorId: person.vendorId ?? undefined,
      createdAt: new Date(person.createdAt).toISOString(),
      updatedAt: new Date(person.updatedAt).toISOString(),
    },
  };
}
function validate(draft: PersonDraft) {
  validatePersonDraft(draft);
  if (
    !["ACTIVE", "INACTIVE"].includes(draft.status) ||
    draft.roles.some((role) => !userRoles.includes(role))
  )
    throw new PeopleStoreError("VALIDATION");
}
function fields(person: PersonDraft) {
  return [
    person.name,
    person.email,
    person.status,
    person.roles,
    person.brandIds,
    person.categoryIds,
    person.areaIds,
    person.dcIds,
    person.vendorId ?? null,
  ];
}
function version(value: number) {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new PeopleStoreError("VALIDATION");
}

/** Storage only, not a command authorization service. No route/session consumes it.
 * Inject an exclusively checked-out client. Caller owns the surrounding transaction
 * for imports or combined operations; ordinary versioned updates are atomic SQL. */
export class PeopleRepository {
  private readonly client: PoolClient;
  constructor(client: PoolClient) {
    this.client = client;
  }
  async get(id: string): Promise<StoredPerson | null> {
    const result = await this.client.query<Row>(
      `select ${projection} from identity_core.people where id=$1`,
      [id],
    );
    return result.rows[0] ? stored(result.rows[0]) : null;
  }
  async update(
    id: string,
    expectedVersion: number,
    draft: PersonDraft,
  ): Promise<StoredPerson> {
    version(expectedVersion);
    validate(draft);
    const result = await this.client.query<Row>(
      `update identity_core.people set name=$2,email=$3,status=$4,roles=$5,brand_ids=$6,category_ids=$7,area_ids=$8,dc_ids=$9,legacy_vendor_id=$10,version=version+1,updated_at=now() where id=$1 and version=$11 returning ${projection}`,
      [id, ...fields(draft), expectedVersion],
    );
    if (!result.rows[0]) throw new PeopleStoreError("CONFLICT");
    return stored(result.rows[0]);
  }
  /** Insert-only import; existing IDs are skipped even when their profiles changed.
   * Run inside one caller-owned transaction. No identity link is ever imported. */
  async importDevelopmentPeople(people: readonly Person[]) {
    await this.client.query(
      "select pg_advisory_xact_lock(hashtextextended('assethub:m1c:development-import',0))",
    );
    const inserted: string[] = [],
      skipped: string[] = [];
    for (const person of people) {
      validate(person);
      if (
        !person.id.trim() ||
        !Number.isFinite(Date.parse(person.createdAt)) ||
        !Number.isFinite(Date.parse(person.updatedAt))
      )
        throw new PeopleStoreError("VALIDATION");
      if (await this.get(person.id)) {
        skipped.push(person.id);
        continue;
      }
      const result = await this.client.query(
        `insert into identity_core.people(id,name,email,status,roles,brand_ids,category_ids,area_ids,dc_ids,legacy_vendor_id,created_at,updated_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) on conflict(id) do nothing returning id`,
        [person.id, ...fields(person), person.createdAt, person.updatedAt],
      );
      (result.rowCount ? inserted : skipped).push(person.id);
    }
    const sourceSha256 = createHash("sha256")
      .update(JSON.stringify(people))
      .digest("hex");
    await this.client.query(
      `insert into identity_core.development_imports(id,source_name,source_sha256,inserted_ids,skipped_ids) values($1,'development-people-fixtures-v1',$2,$3,$4)`,
      [randomUUID(), sourceSha256, inserted, skipped],
    );
    return { inserted, skipped, sourceSha256 };
  }
  /** Explicit IDs from a future approved trusted service, never email lookup. */
  async createIdentityLink(input: {
    issuer: string;
    subject: string;
    personId: string;
    linkedByPersonId: string;
  }) {
    if (!input.issuer.trim() || !input.subject.trim())
      throw new PeopleStoreError("VALIDATION");
    const id = randomUUID();
    await this.client.query(
      `insert into identity_core.identity_links(id,issuer,subject,person_id,linked_by_person_id) values($1,$2,$3,$4,$5)`,
      [id, input.issuer, input.subject, input.personId, input.linkedByPersonId],
    );
    return { id, version: 1 };
  }
  async resolveIdentity(
    issuer: string,
    subject: string,
  ): Promise<StoredPerson | null> {
    const result = await this.client.query<Row>(
      `select ${projection
        .split(",")
        .map((part) => "p." + part)
        .join(
          ",",
        )} from identity_core.people p join identity_core.identity_links l on l.person_id=p.id where l.issuer=$1 and l.subject=$2 and l.revoked_at is null and p.status='ACTIVE'`,
      [issuer, subject],
    );
    return result.rows[0] ? stored(result.rows[0]) : null;
  }
  async revokeIdentityLink(
    id: string,
    expectedVersion: number,
    revokedByPersonId: string,
    reason: string,
  ) {
    version(expectedVersion);
    if (!reason.trim()) throw new PeopleStoreError("VALIDATION");
    const result = await this.client.query(
      `update identity_core.identity_links set revoked_at=now(),revoked_by_person_id=$3,revocation_reason=$4,version=version+1 where id=$1 and version=$2 and revoked_at is null returning version`,
      [id, expectedVersion, revokedByPersonId, reason],
    );
    if (!result.rows[0]) throw new PeopleStoreError("CONFLICT");
    return { version: result.rows[0].version as number };
  }
}
