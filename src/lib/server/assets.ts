import "server-only";
import { mediaRoot } from "@/server/assets/local-media-storage";
import { projectAssetDocumentation } from "./asset-photo-projection";
import { projectRegistrationRelationships } from "./asset-registration-projection";
import { InternalContactsRepository } from "@/server/contacts/repository";
import pg from "pg";
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { validateAssetEdit } from "@/lib/domain/asset-edit";
import { VendorError } from "@/lib/domain/vendor-master";
import type { Asset } from "@/types/prototype";
import { operationalVendorActor } from "@/lib/server/vendors";
const pool = new pg.Pool({
  connectionString: process.env.ASSETHUB_DATABASE_URL,
  max: 3,
});
function signingKey() {
  const secret = process.env.ASSETHUB_MEDIA_SIGNING_KEY;
  if (!secret) throw new Error("Local media signing key is not configured.");
  return secret;
}
function signature(key: string, expires: string) {
  return createHmac("sha256", signingKey())
    .update(`${key}:${expires}`)
    .digest("hex");
}
export function signedMediaUrl(key: string) {
  const expires = String(Math.floor(Date.now() / 1000) + 86400);
  return `/api/assets/media/${key}?expires=${expires}&signature=${signature(key, expires)}`;
}
export async function readAssetCatalog(request: Request) {
  await operationalVendorActor(request);
  const { rows } = await pool.query<{ payload: Asset; revision: string; number: string | null }>(
    "select payload, updated_at::text as revision, to_jsonb(a)->>'asset_number' as number from asset_master.assets a order by case when payload->'importInfo'->>'sheet'='ALL BRAND (Storedev)' then 0 else 1 end, (payload->'importInfo'->>'row')::int",
  );
  const links = (
    await pool.query<{
      assetId: string;
      contact: import("@/lib/domain/internal-contacts").InternalContact;
    }>(
      `select a.asset_id as "assetId", jsonb_build_object('id',c.id,'name',c.name,'email',c.email,'phone',c.phone,'active',c.active,'source',c.source) as contact
     from contact_core.asset_management_contacts a join contact_core.internal_contacts c on c.id=a.contact_id order by a.asset_id,a.position`,
    )
  ).rows;
  const byAsset = new Map<
    string,
    import("@/lib/domain/internal-contacts").InternalContact[]
  >();
  for (const link of links)
    byAsset.set(link.assetId, [
      ...(byAsset.get(link.assetId) ?? []),
      link.contact,
    ]);
  const expires = String(Math.floor(Date.now() / 1000) + 86400);
  const catalog = rows.map(({ payload, revision, number }) => ({
    catalogRevision: revision,
    ...payload,
    assetNumber: number ? `AST-${number.padStart(6, "0")}` : undefined,
    ...(byAsset.has(payload.id) || payload.managementContactIds !== undefined
      ? {
          managementContactIds: (byAsset.get(payload.id) ?? []).map(
            (contact) => contact.id,
          ),
          managementContacts: byAsset.get(payload.id) ?? [],
        }
      : {}),
    photos: payload.photos.map((photo) => ({
      ...photo,
      url: photo.objectKey
        ? `/api/assets/media/${photo.objectKey}?expires=${expires}&signature=${signature(photo.objectKey, expires)}`
        : photo.url,
    })),
  }));
  const warehouseRows = (
    await pool.query(`select a.id,coalesce(i.id,w.id::text) as warehouse_id,coalesce(i.name,w.name) as name,coalesce(i.address,w.address,'') as address,v.name as vendor_name,w.active,w.address_verified,
    coalesce((select string_agg(c.name || ' · ' || c.phone,' / ' order by c.name) from vendor_master.warehouse_contacts wc join vendor_master.contacts c on c.id=wc.contact_id where wc.warehouse_id=w.id and c.active),'') as contact
    from asset_master.assets a left join asset_master.internal_warehouses i on i.id=a.internal_warehouse_id left join vendor_master.warehouses w on w.id=a.warehouse_id and w.vendor_id=a.vendor_id left join vendor_master.vendors v on v.id=w.vendor_id`)
  ).rows;
  const warehouseMap = new Map(warehouseRows.map((w) => [w.id, w]));
  const located = catalog.map((a) => {
    const w = warehouseMap.get(a.id);
    return !w?.warehouse_id
      ? a
      : {
          ...a,
          warehouseDetails: {
            id: w.warehouse_id,
            name: w.name,
            address: w.address,
            vendorName: w.vendor_name ?? undefined,
            active: w.active ?? undefined,
            addressVerified: w.address_verified ?? undefined,
            contact: w.contact,
          },
        };
  });
  const linked = await projectRegistrationRelationships(pool, located);
  return projectAssetDocumentation(
    pool,
    linked,
    (key) =>
      `/api/assets/media/${key}?expires=${expires}&signature=${signature(key, expires)}`,
  );
}
/** Signed, same-origin, loopback-only local media adapter. Never a public filesystem path. */
export async function readAssetMedia(request: Request, key: string) {
  await (
    await import("@/server/auth/resolve-actor")
  ).resolveServerActor(request);
  const url = new URL(request.url);
  if (!/^[a-f0-9]{64}\.(png|jpe?g|gif|webp)$/.test(key))
    return new Response("Not found", { status: 404 });
  const expires = url.searchParams.get("expires") ?? "",
    provided = url.searchParams.get("signature") ?? "";
  if (
    !/^\d+$/.test(expires) ||
    Number(expires) < Date.now() / 1000 ||
    !/^[a-f0-9]{64}$/.test(provided) ||
    !timingSafeEqual(
      Buffer.from(provided, "hex"),
      Buffer.from(signature(key, expires), "hex"),
    )
  )
    return new Response("Forbidden", { status: 403 });
  const { rows } = await pool.query(
    "select mime_type,byte_size from asset_master.media where object_key=$1",
    [key],
  );
  if (!rows[0]) return new Response("Not found", { status: 404 });
  const bytes = await readFile(path.join(mediaRoot(), key));
  return new Response(bytes, {
    headers: {
      "Content-Type": rows[0].mime_type,
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function readInternalWarehouses(request: Request) {
  await operationalVendorActor(request);
  const { rows } = await pool.query(
    "select id,name,address,'Internal warehouse' as type,'' as city from asset_master.internal_warehouses order by name",
  );
  return rows;
}

/** Local prototype actor bridge only; does not activate shared authentication. */
export async function editCatalogAsset(request: Request, id: string) {
  const actor = await operationalVendorActor(request);
  if (
    !actor.roles.some((role) => role === "STORE_DEV" || role === "SUPER_ADMIN")
  )
    throw new VendorError(
      "FORBIDDEN",
      "Only StoreDev or Super Admin can edit assets.",
    );
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    !request.headers.get("origin")
  )
    throw new VendorError(
      "FORBIDDEN",
      "A same-origin browser request is required.",
    );
  const body = await request.json();
  if (
    body?.edit &&
    [
      "assetGroup",
      "groupId",
      "group",
      "warehouseId",
      "vendorId",
      "location",
      "condition",
      "availability",
      "inspectionState",
    ].some((k) => k in body.edit)
  )
    throw new VendorError(
      "VALIDATION",
      "Operational fields and group membership cannot be edited here.",
    );
  const edit = validateAssetEdit(body?.edit);
  if (typeof body.revision !== "string" || !body.revision)
    throw new VendorError("VALIDATION", "Reload the asset before editing.");
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await client.query<{ payload: Asset; revision: string; number: string | null }>(
      "select payload, updated_at::text as revision from asset_master.assets where id=$1 for update",
      [id],
    );
    const existing = result.rows[0];
    if (!existing) throw new VendorError("NOT_FOUND", "Asset not found.");
    if (existing.revision !== body.revision)
      throw new VendorError(
        "STALE",
        "This asset has changed. Reload before saving.",
      );
    const registrationInstalled = (
      await client.query(
        "select to_regclass('asset_master.asset_groups') as installed",
      )
    ).rows[0]?.installed;
    if (
      !registrationInstalled &&
      (edit.ownerContactId !== undefined ||
        edit.registrationMetadata !== undefined ||
        edit.legacyReference !== undefined)
    )
      throw new VendorError(
        "DISABLED",
        "New inventory fields await approved active migration.",
      );
    let ownerBefore: string | undefined;
    if (registrationInstalled) {
      ownerBefore = (
        await client.query(
          "select contact_id from contact_core.asset_owner_contacts where asset_id=$1",
          [id],
        )
      ).rows[0]?.contact_id;
      const group = (
        await client.query(
          "select g.* from asset_master.asset_group_memberships m join asset_master.asset_groups g on g.id=m.group_id where m.asset_id=$1 for share of g",
          [id],
        )
      ).rows[0];
      if (group) {
        if (
          (edit.ownerContactId !== undefined &&
            edit.ownerContactId !== group.owner_contact_id) ||
          (edit.managementContactIds !== undefined &&
            (edit.managementContactIds.length !== 1 ||
              edit.managementContactIds[0] !== group.managing_contact_id))
        )
          throw new VendorError(
            "VALIDATION",
            "Group assignments are inherited and cannot be changed here.",
          );
        delete edit.managementContactIds;
        delete edit.managementContacts;
        delete edit.ownerContactId;
      } else if (edit.ownerContactId !== undefined) {
        await new InternalContactsRepository(client).resolve([
          edit.ownerContactId,
        ]);
        await client.query(
          "insert into contact_core.asset_owner_contacts(asset_id,contact_id,assigned_by) values($1,$2,$3) on conflict(asset_id) do update set contact_id=excluded.contact_id,assigned_by=excluded.assigned_by,assigned_at=clock_timestamp()",
          [id, edit.ownerContactId, actor.id],
        );
      }
    }
    const contacts = new InternalContactsRepository(client);
    const beforeIds =
      edit.managementContactIds !== undefined
        ? (await contacts.linked(id)).map((contact) => contact.id)
        : undefined;
    if (edit.managementContactIds !== undefined) {
      // Browser-supplied contact names/channels are never authority for linked PICs.
      edit.managementContacts = await contacts.replace(
        id,
        edit.managementContactIds,
        actor.id,
      );
    }
    const payload = { ...existing.payload, ...edit };
    const saved = await client.query<{ revision: string }>(
      "update asset_master.assets set payload=$2::jsonb, updated_at=clock_timestamp() where id=$1 returning updated_at::text as revision",
      [id, JSON.stringify(payload)],
    );
    await client.query(
      "insert into asset_master.audit_events(asset_id,actor_user_id,action,changes) values($1,$2,'EDIT_METADATA',$3::jsonb)",
      [
        id,
        actor.id,
        JSON.stringify({
          before: {
            ownerContactId: ownerBefore,
            name: existing.payload.name,
            description: existing.payload.description,
            responsiblePic: existing.payload.responsiblePic,
            ...(beforeIds !== undefined
              ? { managementContactIds: beforeIds }
              : { managementContacts: existing.payload.managementContacts }),
            details: existing.payload.details,
          },
          after:
            edit.managementContactIds !== undefined
              ? { ...edit, managementContacts: undefined }
              : edit,
        }),
      ],
    );
    await client.query("commit");
    return { edit, revision: saved.rows[0].revision };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
