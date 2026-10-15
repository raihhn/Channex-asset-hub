import "server-only";
import { randomUUID } from "node:crypto";
import pg, { type PoolClient } from "pg";
import {
  VendorError,
  validateVendorDraft,
  validateVendorId,
} from "@/lib/domain/vendor-master";
import { peopleFixtures } from "@/lib/fixtures/people";
import type { Person } from "@/types/identity";
import type { VendorRecord } from "@/types/vendor";

const localHosts = ["localhost", "127.0.0.1", "[::1]"];
const pool = new pg.Pool({
  connectionString: process.env.ASSETHUB_DATABASE_URL,
  max: 5,
});
export function vendorConfigured() {
  try {
    return (
      process.env.ASSETHUB_VENDOR_ENABLED === "true" &&
      localHosts.includes(
        new URL(process.env.ASSETHUB_DATABASE_URL ?? "").hostname,
      )
    );
  } catch {
    return false;
  }
}
function assertConfigured() {
  if (!vendorConfigured())
    throw new VendorError(
      "DISABLED",
      "Vendor database is not configured for local development.",
    );
}
/** Local development bridge only; replace with verified Auth before deployment. */
export function operationalVendorActor(request: Request): Person {
  assertConfigured();
  const url = new URL(request.url);
  const host = request.headers.get("host")?.split(":")[0];
  if (
    !localHosts.includes(url.hostname) ||
    (host && !localHosts.includes(host))
  )
    throw new VendorError(
      "FORBIDDEN",
      "Vendor development API is available on localhost only.",
    );
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin)
    throw new VendorError(
      "FORBIDDEN",
      "Cross-origin vendor access is not allowed.",
    );
  const actor = peopleFixtures.find(
    (p) =>
      p.id === request.headers.get("x-prototype-actor-id") &&
      p.status === "ACTIVE",
  );
  if (!actor)
    throw new VendorError(
      "FORBIDDEN",
      "Choose an active prototype user to view vendor destinations.",
    );
  return actor;
}
export function vendorActor(request: Request): Person {
  const actor = operationalVendorActor(request);
  if (!actor.roles.includes("SUPER_ADMIN"))
    throw new VendorError(
      "FORBIDDEN",
      "Only the active Super Admin can manage vendor records.",
    );
  return actor;
}
function requireAdmin(actor: Person) {
  assertConfigured();
  // Never trust roles passed from a request payload, including mutable UI People.
  const canonical = peopleFixtures.find(
    (p) =>
      p.id === actor.id &&
      p.status === "ACTIVE" &&
      p.roles.includes("SUPER_ADMIN"),
  );
  if (!canonical)
    throw new VendorError("FORBIDDEN", "Only Super Admin can manage vendors.");
  return canonical;
}
const projection = `select v.id, v.name, v.legal_name as "legalName", v.active, v.version,
  v.updated_at as "updatedAt",
  coalesce((select jsonb_agg(jsonb_build_object('issues',i.issues,'source',i.source) order by i.imported_at,i.source_key) from vendor_master.import_rows i where i.vendor_id=v.id and cardinality(i.issues)>0),'[]'::jsonb) as "importNotes",
  coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'phone',c.phone,'email',c.email,'active',c.active) order by c.name,c.id)
    from vendor_master.contacts c where c.vendor_id=v.id),'[]'::jsonb) as contacts,
  coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'name',w.name,'address',w.address,'addressVerified',w.address_verified,'active',w.active,
    'contactIds',coalesce((select jsonb_agg(wc.contact_id order by wc.contact_id) from vendor_master.warehouse_contacts wc where wc.warehouse_id=w.id),'[]'::jsonb)) order by w.name,w.id)
    from vendor_master.warehouses w where w.vendor_id=v.id),'[]'::jsonb) as warehouses
  from vendor_master.vendors v`;
async function read(client: PoolClient, id: string): Promise<VendorRecord> {
  const { rows } = await client.query(projection + " where v.id=$1", [id]);
  if (!rows[0]) throw new VendorError("NOT_FOUND", "Vendor not found.");
  return { ...rows[0], updatedAt: rows[0].updatedAt.toISOString() };
}
export async function listVendors(actor: Person): Promise<VendorRecord[]> {
  requireAdmin(actor);
  const { rows } = await pool.query(
    projection + " order by lower(v.name),v.id",
  );
  return rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }));
}
export async function saveVendor(
  value: unknown,
  actor: Person,
  id?: string,
  version?: number,
): Promise<VendorRecord> {
  const admin = requireAdmin(actor);
  const draft = validateVendorDraft(value);
  const vendorId = id ? validateVendorId(id) : randomUUID();
  if (id && (!Number.isSafeInteger(version) || (version ?? 0) < 1))
    throw new VendorError("VALIDATION", "Vendor version is required.");
  const client = await pool.connect();
  try {
    await client.query("begin");
    let previous: VendorRecord | undefined;
    if (id) {
      const lock = await client.query(
        "select version from vendor_master.vendors where id=$1 for update",
        [vendorId],
      );
      if (!lock.rows[0])
        throw new VendorError("NOT_FOUND", "Vendor not found.");
      if (lock.rows[0].version !== version)
        throw new VendorError(
          "STALE",
          "Vendor changed in another session. Reload before editing.",
        );
      previous = await read(client, vendorId);
      if (
        previous.contacts.some(
          (c) => !draft.contacts.some((d) => d.id === c.id),
        ) ||
        previous.warehouses.some(
          (w) => !draft.warehouses.some((d) => d.id === w.id),
        )
      )
        throw new VendorError(
          "VALIDATION",
          "Keep existing warehouse/PIC records; inactivate them instead of deleting.",
        );
      await client.query(
        "update vendor_master.vendors set name=$2,legal_name=$3,active=$4,version=version+1,updated_at=now() where id=$1",
        [vendorId, draft.name, draft.legalName, draft.active],
      );
    } else {
      await client.query(
        "insert into vendor_master.vendors(id,name,legal_name,active) values($1,$2,$3,$4)",
        [vendorId, draft.name, draft.legalName, draft.active],
      );
    }
    for (const c of draft.contacts) {
      const result = await client.query(
        `insert into vendor_master.contacts(id,vendor_id,name,phone,email,active) values($1,$2,$3,$4,$5,$6)
        on conflict(id) do update set name=excluded.name,phone=excluded.phone,email=excluded.email,active=excluded.active
        where contacts.vendor_id=excluded.vendor_id returning id`,
        [c.id, vendorId, c.name, c.phone, c.email, c.active],
      );
      if (!result.rowCount)
        throw new VendorError("VALIDATION", "PIC belongs to another vendor.");
    }
    for (const w of draft.warehouses) {
      const result = await client.query(
        `insert into vendor_master.warehouses(id,vendor_id,name,address,address_verified,active) values($1,$2,$3,$4,$5,$6)
        on conflict(id) do update set name=excluded.name,address=excluded.address,address_verified=excluded.address_verified,active=excluded.active
        where warehouses.vendor_id=excluded.vendor_id returning id`,
        [w.id, vendorId, w.name, w.address, w.addressVerified, w.active],
      );
      if (!result.rowCount)
        throw new VendorError(
          "VALIDATION",
          "Warehouse belongs to another vendor.",
        );
    }
    await client.query(
      "delete from vendor_master.warehouse_contacts where vendor_id=$1",
      [vendorId],
    );
    for (const w of draft.warehouses)
      for (const contactId of w.contactIds)
        await client.query(
          "insert into vendor_master.warehouse_contacts(vendor_id,warehouse_id,contact_id) values($1,$2,$3)",
          [vendorId, w.id, contactId],
        );
    const saved = await read(client, vendorId);
    const changed = previous
      ? ["name", "legalName", "active", "contacts", "warehouses"].filter(
          (key) =>
            JSON.stringify(previous![key as keyof VendorRecord]) !==
            JSON.stringify(saved[key as keyof VendorRecord]),
        )
      : ["name", "legalName", "contacts", "warehouses"];
    await client.query(
      "insert into vendor_master.audit_events(vendor_id,actor_id,actor_name,action,version,changed_fields) values($1,$2,$3,$4,$5,$6)",
      [
        vendorId,
        admin.id,
        admin.name,
        previous ? "VENDOR_UPDATED" : "VENDOR_CREATED",
        saved.version,
        changed,
      ],
    );
    await client.query("commit");
    return saved;
  } catch (error) {
    await client.query("rollback");
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    )
      throw new VendorError(
        "CONFLICT",
        "Vendor or warehouse name already exists.",
      );
    throw error;
  } finally {
    client.release();
  }
}
export async function vendorAudit(actor: Person, id: string) {
  requireAdmin(actor);
  return (
    await pool.query(
      `select actor_name as "actorName", action, version, changed_fields as "changedFields",occurred_at as "occurredAt"
    from vendor_master.audit_events where vendor_id=$1 order by occurred_at desc,id desc limit 50`,
      [validateVendorId(id)],
    )
  ).rows;
}
export async function closeVendorPool() {
  await pool.end();
}

export async function operationalVendorLocations(
  actor: Person,
): Promise<import("@/lib/fixtures/registered-locations").RegisteredLocation[]> {
  assertConfigured();
  if (!peopleFixtures.some((p) => p.id === actor.id && p.status === "ACTIVE"))
    throw new VendorError("FORBIDDEN", "Active identity required.");
  const { rows } = await pool.query(
    projection + " where v.active order by lower(v.name),v.id",
  );
  return rows.flatMap((vendor) =>
    vendor.warehouses.flatMap((w: import("@/types/vendor").VendorWarehouse) => {
      const contacts = (
        vendor.contacts as import("@/types/vendor").VendorContact[]
      ).filter((c) => c.active && w.contactIds.includes(c.id));
      if (!w.active || !w.addressVerified || !contacts.length) return [];
      return [
        {
          id: w.id,
          type: "Vendor warehouse" as const,
          name: `${vendor.name} — ${w.name}`,
          address: w.address,
          city: w.name,
          vendorId: vendor.id,
          vendorName: vendor.name,
          contact: contacts.map((c) => `${c.name} · ${c.phone}`).join(" / "),
        },
      ];
    }),
  );
}
/** Revalidate canonical warehouse association in the booking transaction. */
export async function assertVendorDestination(
  client: PoolClient,
  id: string | undefined,
  vendorId: string | undefined,
) {
  assertConfigured();
  validateVendorId(id);
  validateVendorId(vendorId);
  const result = await client.query(
    `select w.id from vendor_master.warehouses w join vendor_master.vendors v on v.id=w.vendor_id
    where w.id=$1 and v.id=$2 and v.active and w.active and w.address_verified and exists(select 1 from vendor_master.warehouse_contacts wc join vendor_master.contacts c on c.id=wc.contact_id where wc.warehouse_id=w.id and c.active)
    for share of v,w`,
    [id, vendorId],
  );
  if (!result.rowCount)
    throw new VendorError(
      "VALIDATION",
      "Choose an active database vendor warehouse with a confirmed address and active PIC.",
    );
}
